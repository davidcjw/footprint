import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Commit, Footprint, RepoSummary } from "./types.js";

// Separators are produced BY git (via %x1f / %x1e in the format), so the format
// string we pass to execFile contains no control bytes (null bytes are rejected).
const UNIT = "\x1f"; // unit separator between fields
const REC = "\x1e"; // record separator marking the start of each commit
const FMT_UNIT = "%x1f";
const FMT_REC = "%x1e";

function git(repo: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

/** Find immediate child directories of `root` that are git repos. */
export function findRepos(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const p = join(root, entry);
    let isDir = false;
    try {
      isDir = statSync(p).isDirectory();
    } catch {
      continue;
    }
    if (isDir && existsSync(join(p, ".git"))) out.push(p);
  }
  return out.sort();
}

/**
 * Collect commits authored on a given local day by any of `authors`.
 * `authors` are matched against author name OR email (git --author is a regex,
 * but we pass plain substrings which is the common case).
 */
function commitsForRepo(repo: string, since: string, until: string, authors: string[]): Commit[] {
  const fmt = `${FMT_REC}%H${FMT_UNIT}%s${FMT_UNIT}%aI`;
  const args = [
    "log",
    "--no-merges",
    `--since=${since}`,
    `--until=${until}`,
    `--pretty=format:${fmt}`,
    "--numstat",
  ];
  for (const a of authors) args.splice(1, 0, `--author=${a}`);
  // Note: multiple --author are OR-ed by git.

  const raw = git(repo, args);
  if (!raw.trim()) return [];

  const commits: Commit[] = [];
  for (const block of raw.split(REC)) {
    if (!block.trim()) continue;
    const lines = block.split("\n");
    const [hash, subject, date] = lines[0].split(UNIT);
    if (!hash) continue;
    let added = 0;
    let deleted = 0;
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      const a = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      if (!Number.isNaN(a)) added += a;
      if (!Number.isNaN(d)) deleted += d;
    }
    commits.push({ hash, subject, date, added, deleted });
  }
  return commits;
}

const EXT_RE = /\.([a-z0-9]+)$/i;

/** Per-language line changes, derived from numstat filenames per commit. */
function languageBreakdown(repo: string, since: string, until: string, authors: string[]): Map<string, number> {
  const fmt = `${FMT_REC}`;
  const args = ["log", "--no-merges", `--since=${since}`, `--until=${until}`, `--pretty=format:${fmt}`, "--numstat"];
  for (const a of authors) args.splice(1, 0, `--author=${a}`);
  const raw = git(repo, args);
  const map = new Map<string, number>();
  for (const line of raw.split("\n")) {
    if (!line.trim() || line.startsWith(REC)) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const a = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    const changes = (Number.isNaN(a) ? 0 : a) + (Number.isNaN(d) ? 0 : d);
    if (changes === 0) continue;
    const file = parts[2];
    const m = file.match(EXT_RE);
    const ext = m ? m[1].toLowerCase() : "other";
    map.set(ext, (map.get(ext) ?? 0) + changes);
  }
  return map;
}

export interface ScanOptions {
  root: string;
  authors: string[];
  since: string;
  until: string;
  date: string;
  dateLabel: string;
}

export function scan(opts: ScanOptions): Footprint {
  const repos = findRepos(opts.root);
  const summaries: RepoSummary[] = [];
  const langTotals = new Map<string, number>();

  for (const repo of repos) {
    const commits = commitsForRepo(repo, opts.since, opts.until, opts.authors);
    if (commits.length === 0) continue;
    const added = commits.reduce((s, c) => s + c.added, 0);
    const deleted = commits.reduce((s, c) => s + c.deleted, 0);
    summaries.push({ name: repo.split("/").pop() ?? repo, path: repo, commits, added, deleted });

    for (const [ext, n] of languageBreakdown(repo, opts.since, opts.until, opts.authors)) {
      langTotals.set(ext, (langTotals.get(ext) ?? 0) + n);
    }
  }

  summaries.sort((a, b) => b.commits.length - a.commits.length || b.added + b.deleted - (a.added + a.deleted));

  const languages = [...langTotals.entries()]
    .map(([ext, changes]) => ({ ext, changes }))
    .sort((a, b) => b.changes - a.changes);

  return {
    date: opts.date,
    dateLabel: opts.dateLabel,
    authors: opts.authors,
    repos: summaries,
    totalCommits: summaries.reduce((s, r) => s + r.commits.length, 0),
    totalAdded: summaries.reduce((s, r) => s + r.added, 0),
    totalDeleted: summaries.reduce((s, r) => s + r.deleted, 0),
    languages,
  };
}
