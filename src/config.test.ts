import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "./config.js";

// Helper: parseArgs slices the first two argv entries (node + script path).
function parse(...flags: string[]) {
  return parseArgs(["node", "footprint", ...flags]);
}

describe("parseArgs defaults", () => {
  it("defaults root to ~/code and period to day", () => {
    const cfg = parse("--author", "me");
    expect(cfg.root).toBe(join(homedir(), "code"));
    expect(cfg.period).toBe("day");
    expect(cfg.daysInMonth).toBe(1);
    expect(cfg.json).toBeNull();
    expect(cfg.noCard).toBe(false);
    expect(cfg.claudeDir).toBe(join(homedir(), ".claude"));
  });

  it("collects repeatable --author flags", () => {
    const cfg = parse("--author", "alice", "--author", "bob");
    expect(cfg.authors).toEqual(["alice", "bob"]);
  });

  it("honors --root and boolean flags", () => {
    const cfg = parse("--author", "me", "--root", "/tmp/repos", "--no-card", "--no-usage", "--open");
    expect(cfg.root).toBe("/tmp/repos");
    expect(cfg.noCard).toBe(true);
    expect(cfg.noUsage).toBe(true);
    expect(cfg.open).toBe(true);
  });
});

describe("parseArgs --json", () => {
  it("treats a bare --json as stdout marker '-'", () => {
    expect(parse("--author", "me", "--json").json).toBe("-");
  });

  it("treats --json <file> as a file path", () => {
    expect(parse("--author", "me", "--json", "out.json").json).toBe("out.json");
  });

  it("treats --json followed by another flag as stdout", () => {
    expect(parse("--author", "me", "--json", "--no-card").json).toBe("-");
  });
});

describe("parseArgs date/month", () => {
  it("parses an explicit --date into a day period", () => {
    const cfg = parse("--author", "me", "--date", "2026-06-15");
    expect(cfg.period).toBe("day");
    expect(cfg.date).toBe("2026-06-15");
    expect(cfg.daysInMonth).toBe(1);
  });

  it("parses --month <YYYY-MM> with correct days in month", () => {
    const cfg = parse("--author", "me", "--month", "2026-02");
    expect(cfg.period).toBe("month");
    expect(cfg.date).toBe("2026-02");
    expect(cfg.daysInMonth).toBe(28); // Feb 2026
  });

  it("treats a bare --month as the current month", () => {
    const cfg = parse("--author", "me", "--month");
    expect(cfg.period).toBe("month");
    expect(cfg.daysInMonth).toBeGreaterThanOrEqual(28);
    expect(cfg.daysInMonth).toBeLessThanOrEqual(31);
  });
});
