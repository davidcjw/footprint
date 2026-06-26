import type { Footprint } from "./types.js";

/** Bump when the output shape changes in a breaking way. */
export const SCHEMA_VERSION = 1;

/**
 * Convert a Footprint into a plain, JSON-safe object with a stable shape.
 * Notably flattens `usage.byRepo` (a Map) into an array of { repo, cost }.
 */
export function toJsonObject(fp: Footprint): Record<string, unknown> {
  const out: Record<string, unknown> = {
    schemaVersion: SCHEMA_VERSION,
    date: fp.date,
    dateLabel: fp.dateLabel,
    period: fp.period,
    authors: fp.authors,
    totals: {
      commits: fp.totalCommits,
      added: fp.totalAdded,
      deleted: fp.totalDeleted,
    },
    languages: fp.languages,
    repos: fp.repos.map((r) => ({
      name: r.name,
      path: r.path,
      added: r.added,
      deleted: r.deleted,
      commits: r.commits,
    })),
  };

  if (fp.period === "month" && fp.activity) out.activity = fp.activity;

  if (fp.usage) {
    out.usage = {
      totalCost: fp.usage.totalCost,
      inputTokens: fp.usage.inputTokens,
      outputTokens: fp.usage.outputTokens,
      cacheReadTokens: fp.usage.cacheReadTokens,
      cacheWriteTokens: fp.usage.cacheWriteTokens,
      messages: fp.usage.messages,
      byModel: fp.usage.byModel,
      byRepo: [...fp.usage.byRepo.entries()].map(([repo, cost]) => ({ repo, cost })),
    };
  }

  return out;
}

export function toJson(fp: Footprint): string {
  return JSON.stringify(toJsonObject(fp), null, 2);
}
