import { describe, it, expect, vi } from "vitest";

// Fake ~/.claude/projects layout: one project dir with one session transcript.
// Mock node:fs so scanUsage reads our canned JSONL instead of the disk.
const PROJECTS = "/fake/.claude/projects";
const PROJ_DIR = PROJECTS + "/proj1";
const SESSION = PROJ_DIR + "/session.jsonl";

const line = (o: unknown) => JSON.stringify(o);
const TRANSCRIPT = [
  // In-window opus message: 1M input @ $5 + 0.2M output @ $25 = $10
  line({
    type: "assistant",
    timestamp: "2026-06-15T10:00:00.000Z",
    cwd: "/home/u/code/repo1",
    message: { id: "m1", model: "claude-opus-4-8", usage: { input_tokens: 1_000_000, output_tokens: 200_000 } },
  }),
  // Duplicate message id -> must be skipped
  line({
    type: "assistant",
    timestamp: "2026-06-15T10:05:00.000Z",
    cwd: "/home/u/code/repo1",
    message: { id: "m1", model: "claude-opus-4-8", usage: { input_tokens: 9_999_999, output_tokens: 9_999_999 } },
  }),
  // Second in-window message: 1M output @ $25 = $25
  line({
    type: "assistant",
    timestamp: "2026-06-16T10:00:00.000Z",
    cwd: "/home/u/code/repo1",
    message: { id: "m2", model: "claude-opus-4-8", usage: { input_tokens: 0, output_tokens: 1_000_000 } },
  }),
  // Out-of-window message -> must be skipped
  line({
    type: "assistant",
    timestamp: "2020-01-01T00:00:00.000Z",
    cwd: "/home/u/code/repo1",
    message: { id: "m3", model: "claude-opus-4-8", usage: { input_tokens: 1_000_000, output_tokens: 0 } },
  }),
  // Non-assistant line -> ignored
  line({ type: "user", timestamp: "2026-06-15T10:00:00.000Z" }),
  "not json at all",
].join("\n");

vi.mock("node:fs", () => ({
  existsSync: vi.fn((p: string) => p === PROJECTS),
  statSync: vi.fn(() => ({ isDirectory: () => true })),
  readFileSync: vi.fn(() => TRANSCRIPT),
  readdirSync: vi.fn((p: string) => {
    if (p === PROJECTS) return ["proj1"];
    if (p === PROJ_DIR) return ["session.jsonl"];
    return [];
  }),
}));

import { scanUsage } from "./usage.js";

const opts = {
  claudeDir: "/fake/.claude",
  since: "2026-06-01T00:00:00.000Z",
  until: "2026-07-01T00:00:00.000Z",
  repoPaths: ["/home/u/code/repo1"],
};

describe("scanUsage", () => {
  it("sums cost across in-window messages and dedupes by message id", () => {
    const u = scanUsage(opts);
    expect(u.messages).toBe(2); // dup + out-of-window excluded
    expect(u.totalCost).toBeCloseTo(35, 6); // $10 + $25
    expect(u.inputTokens).toBe(1_000_000);
    expect(u.outputTokens).toBe(1_200_000);
  });

  it("groups per-model usage and marks priced models", () => {
    const u = scanUsage(opts);
    expect(u.byModel).toHaveLength(1);
    expect(u.byModel[0].model).toBe("claude-opus-4-8");
    expect(u.byModel[0].priced).toBe(true);
    expect(u.byModel[0].messages).toBe(2);
  });

  it("maps session cwd to the owning scanned repo", () => {
    const u = scanUsage(opts);
    expect(u.byRepo.get("repo1")).toBeCloseTo(35, 6);
  });

  it("skips cost attribution when cwd is outside any scanned repo", () => {
    const u = scanUsage({ ...opts, repoPaths: ["/somewhere/else"] });
    expect(u.byRepo.size).toBe(0);
    expect(u.totalCost).toBeCloseTo(35, 6); // cost still tallied globally
  });
});
