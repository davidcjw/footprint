import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the filesystem so findRepos discovers a single fake repo, and mock
// child_process so scan() never shells out to real git.
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
  readdirSync: vi.fn(() => ["repo1"]),
  statSync: vi.fn(() => ({ isDirectory: () => true })),
}));

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "node:child_process";
import { findRepos, scan, type ScanOptions } from "./git.js";

const REC = "\x1e";
const UNIT = "\x1f";

// A canned `git log --numstat` payload for two commits. Both commitsForRepo and
// languageBreakdown call git() with --numstat, so returning this for every call
// is sufficient.
const LOG =
  `${REC}abc123${UNIT}feat: x${UNIT}2026-06-15T10:00:00+00:00\n` +
  `10\t2\tsrc/a.ts\n` +
  `5\t3\tlib/b.js\n` +
  `${REC}def456${UNIT}fix: y${UNIT}2026-06-20T10:00:00+00:00\n` +
  `1\t1\tREADME.md`;

const baseOpts: ScanOptions = {
  root: "/home/u/code",
  authors: ["David"],
  since: "2026-06-01T00:00:00.000Z",
  until: "2026-07-01T00:00:00.000Z",
  date: "2026-06",
  dateLabel: "June 2026",
  period: "day",
  daysInMonth: 30,
};

beforeEach(() => {
  vi.mocked(execFileSync).mockReset();
  vi.mocked(execFileSync).mockReturnValue(LOG as unknown as Buffer);
});

describe("findRepos", () => {
  it("returns child directories that contain a .git entry", () => {
    expect(findRepos("/home/u/code")).toEqual(["/home/u/code/repo1"]);
  });
});

describe("scan", () => {
  it("aggregates commits and churn across a repo", () => {
    const fp = scan(baseOpts);
    expect(fp.repos).toHaveLength(1);
    expect(fp.repos[0].name).toBe("repo1");
    expect(fp.totalCommits).toBe(2);
    // commit1: +15/-5 (10+5 added, 2+3 deleted); commit2: +1/-1
    expect(fp.totalAdded).toBe(16);
    expect(fp.totalDeleted).toBe(6);
  });

  it("derives a language breakdown from numstat file extensions", () => {
    const fp = scan(baseOpts);
    const byExt = Object.fromEntries(fp.languages.map((l) => [l.ext, l.changes]));
    expect(byExt.ts).toBe(12); // 10 + 2
    expect(byExt.js).toBe(8); // 5 + 3
    expect(byExt.md).toBe(2); // 1 + 1
  });

  it("buckets commits into per-day activity for the month period", () => {
    const fp = scan({ ...baseOpts, period: "month" });
    expect(fp.activity).toBeDefined();
    expect(fp.activity!).toHaveLength(30);
    expect(fp.activity![14]).toBe(1); // 2026-06-15
    expect(fp.activity![19]).toBe(1); // 2026-06-20
  });

  it("passes each author to git as a repeatable --author arg", () => {
    scan({ ...baseOpts, authors: ["alice", "bob"] });
    const args = vi.mocked(execFileSync).mock.calls[0][1] as string[];
    expect(args).toContain("--author=alice");
    expect(args).toContain("--author=bob");
  });
});
