import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CliConfig {
  root: string;
  authors: string[];
  date: string; // YYYY-MM-DD local
  dateLabel: string;
  since: string;
  until: string;
  outDir: string;
  noCard: boolean;
  open: boolean;
  noUsage: boolean;
  claudeDir: string;
}

function gitConfig(key: string): string | null {
  try {
    return execFileSync("git", ["config", "--global", key], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Default author matchers. We include the global user.name as well as user.email
 * because the same person often commits under multiple emails (e.g. a GitHub
 * `…@users.noreply.github.com` address). git --author is a regex matched against
 * "Name <email>", so the name catches every identity sharing that name.
 */
function defaultAuthors(): string[] {
  const out: string[] = [];
  const name = gitConfig("user.name");
  const email = gitConfig("user.email");
  if (name) out.push(name);
  if (email) out.push(email);
  return [...new Set(out)];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function localYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function labelFor(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** Parse argv into config. Supported flags: --root, --author (repeatable), --date, --out, --no-card, --open. */
export function parseArgs(argv: string[]): CliConfig {
  const args = argv.slice(2);
  const authors: string[] = [];
  let root = join(homedir(), "code");
  let dateStr: string | null = null;
  let outDir = join(process.cwd(), "out");
  let noCard = false;
  let open = false;
  let noUsage = false;
  let claudeDir = join(homedir(), ".claude");

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--root") root = args[++i];
    else if (a === "--author") authors.push(args[++i]);
    else if (a === "--date") dateStr = args[++i];
    else if (a === "--out") outDir = args[++i];
    else if (a === "--no-card") noCard = true;
    else if (a === "--open") open = true;
    else if (a === "--no-usage") noUsage = true;
    else if (a === "--claude-dir") claudeDir = args[++i];
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (authors.length === 0) authors.push(...defaultAuthors());

  // Resolve the target local day -> [since, until) covering that whole day.
  const base = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0);
  const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 0, 0, 0);

  return {
    root,
    authors,
    date: localYMD(start),
    dateLabel: labelFor(start),
    since: start.toISOString(),
    until: end.toISOString(),
    outDir,
    noCard,
    open,
    noUsage,
    claudeDir,
  };
}

export function printHelp(): void {
  console.log(`footprint — summarize today's commits across all your repos

Usage:
  footprint [options]

Options:
  --root <dir>     Directory containing your repos     (default: ~/code)
  --author <s>     Match author name/email (repeatable) (default: git global user.email)
  --date <YMD>     Target day, e.g. 2026-06-26          (default: today, local)
  --out <dir>      Where to write the PNG card          (default: ./out)
  --no-card        Skip PNG rendering, terminal only
  --open           Open the PNG after rendering (macOS)
  --no-usage       Skip Claude Code token/cost tracking
  --claude-dir <d> Claude Code data dir                 (default: ~/.claude)
  -h, --help       Show this help
`);
}
