import { describe, it, expect } from "vitest";
import { toJsonObject, toJson, SCHEMA_VERSION } from "./json.js";
import type { Footprint } from "./types.js";

function baseFootprint(overrides: Partial<Footprint> = {}): Footprint {
  return {
    date: "2026-06-15",
    dateLabel: "Mon 15 Jun 2026",
    authors: ["David"],
    repos: [
      { name: "footprint", path: "/home/u/code/footprint", commits: [], added: 40, deleted: 5 },
    ],
    totalCommits: 3,
    totalAdded: 40,
    totalDeleted: 5,
    languages: [{ ext: "ts", changes: 45 }],
    period: "day",
    ...overrides,
  };
}

describe("toJsonObject", () => {
  it("produces a stable top-level shape with schema version and totals", () => {
    const out = toJsonObject(baseFootprint()) as any;
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out.date).toBe("2026-06-15");
    expect(out.period).toBe("day");
    expect(out.totals).toEqual({ commits: 3, added: 40, deleted: 5 });
    expect(out.authors).toEqual(["David"]);
  });

  it("projects repos to name/path/added/deleted/commits", () => {
    const out = toJsonObject(baseFootprint()) as any;
    expect(out.repos).toEqual([
      { name: "footprint", path: "/home/u/code/footprint", added: 40, deleted: 5, commits: [] },
    ]);
  });

  it("omits activity for a day period and includes it for a month", () => {
    expect((toJsonObject(baseFootprint()) as any).activity).toBeUndefined();
    const month = toJsonObject(
      baseFootprint({ period: "month", activity: [1, 0, 2] }),
    ) as any;
    expect(month.activity).toEqual([1, 0, 2]);
  });

  it("flattens usage.byRepo Map into an array of { repo, cost }", () => {
    const out = toJsonObject(
      baseFootprint({
        usage: {
          totalCost: 12.5,
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 10,
          cacheWriteTokens: 5,
          messages: 2,
          byModel: [],
          byRepo: new Map([
            ["footprint", 10],
            ["other", 2.5],
          ]),
        },
      }),
    ) as any;
    expect(out.usage.totalCost).toBe(12.5);
    expect(out.usage.byRepo).toEqual([
      { repo: "footprint", cost: 10 },
      { repo: "other", cost: 2.5 },
    ]);
  });

  it("omits usage entirely when absent", () => {
    expect((toJsonObject(baseFootprint()) as any).usage).toBeUndefined();
  });
});

describe("toJson", () => {
  it("returns valid, round-trippable JSON", () => {
    const parsed = JSON.parse(toJson(baseFootprint()));
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.repos).toHaveLength(1);
  });
});
