import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { costOf, rateFor, type RawUsage } from "./pricing.js";

export interface ModelUsage {
  model: string;
  cost: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  messages: number;
  priced: boolean;
}

export interface UsageSummary {
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  messages: number;
  byModel: ModelUsage[];
  /** repo name -> USD cost, when the session cwd maps under a scanned repo */
  byRepo: Map<string, number>;
}

interface ScanOpts {
  claudeDir: string;
  since: string;
  until: string;
  repoPaths: string[];
}

function listJsonl(projectsDir: string): string[] {
  if (!existsSync(projectsDir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(projectsDir)) {
    const sub = join(projectsDir, entry);
    try {
      if (!statSync(sub).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const f of readdirSync(sub)) {
      if (f.endsWith(".jsonl")) files.push(join(sub, f));
    }
  }
  return files;
}

/** Map a session cwd to one of the scanned repo names (longest matching path). */
function repoForCwd(cwd: string | undefined, repoPaths: string[]): string | null {
  if (!cwd) return null;
  let best: string | null = null;
  let bestLen = -1;
  for (const p of repoPaths) {
    if ((cwd === p || cwd.startsWith(p + "/")) && p.length > bestLen) {
      best = p;
      bestLen = p.length;
    }
  }
  return best ? (best.split("/").pop() ?? best) : null;
}

export function scanUsage(opts: ScanOpts): UsageSummary {
  const sinceMs = Date.parse(opts.since);
  const untilMs = Date.parse(opts.until);
  const models = new Map<string, ModelUsage>();
  const byRepo = new Map<string, number>();
  const seen = new Set<string>(); // dedupe by API message id

  for (const file of listJsonl(join(opts.claudeDir, "projects"))) {
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      let obj: any;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (obj?.type !== "assistant") continue;
      const usage: RawUsage | undefined = obj.message?.usage;
      if (!usage) continue;
      const ts = Date.parse(obj.timestamp ?? "");
      if (Number.isNaN(ts) || ts < sinceMs || ts >= untilMs) continue;

      const id = obj.message?.id ?? obj.uuid;
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }

      const model: string = obj.message?.model ?? "unknown";
      const rate = rateFor(model);
      const bd = costOf(usage, rate ?? { input: 0, output: 0 });

      let m = models.get(model);
      if (!m) {
        m = { model, cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, messages: 0, priced: rate !== null };
        models.set(model, m);
      }
      m.cost += bd.cost;
      m.input += bd.input;
      m.output += bd.output;
      m.cacheRead += bd.cacheRead;
      m.cacheWrite += bd.cacheWrite;
      m.messages += 1;

      const repo = repoForCwd(obj.cwd, opts.repoPaths);
      if (repo) byRepo.set(repo, (byRepo.get(repo) ?? 0) + bd.cost);
    }
  }

  const byModel = [...models.values()].sort((a, b) => b.cost - a.cost);
  return {
    totalCost: byModel.reduce((s, m) => s + m.cost, 0),
    inputTokens: byModel.reduce((s, m) => s + m.input, 0),
    outputTokens: byModel.reduce((s, m) => s + m.output, 0),
    cacheReadTokens: byModel.reduce((s, m) => s + m.cacheRead, 0),
    cacheWriteTokens: byModel.reduce((s, m) => s + m.cacheWrite, 0),
    messages: byModel.reduce((s, m) => s + m.messages, 0),
    byModel,
    byRepo,
  };
}
