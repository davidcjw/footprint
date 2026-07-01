import { describe, it, expect } from "vitest";
import {
  rateFor,
  costOf,
  PRICING,
  CACHE_READ_MULT,
  CACHE_WRITE_5M_MULT,
  CACHE_WRITE_1H_MULT,
} from "./pricing.js";

describe("rateFor", () => {
  it("resolves an exact model id", () => {
    expect(rateFor("claude-opus-4-8")).toEqual({ input: 5, output: 25 });
  });

  it("resolves via longest-prefix match for a dated id", () => {
    // e.g. "claude-opus-4-8-20260115" should match "claude-opus-4-8"
    expect(rateFor("claude-opus-4-8-20260115")).toEqual(PRICING["claude-opus-4-8"]);
  });

  it("returns null for an unknown model", () => {
    expect(rateFor("gpt-4o")).toBeNull();
  });
});

describe("costOf", () => {
  const rate = { input: 5, output: 25 }; // per-million USD

  it("computes plain input/output cost (token-to-dollar math)", () => {
    // 1M input @ $5 + 0.2M output @ $25 = 5 + 5 = $10
    const bd = costOf({ input_tokens: 1_000_000, output_tokens: 200_000 }, rate);
    expect(bd.cost).toBeCloseTo(10, 9);
    expect(bd.input).toBe(1_000_000);
    expect(bd.output).toBe(200_000);
  });

  it("prices cache reads at the read multiplier", () => {
    const bd = costOf({ cache_read_input_tokens: 1_000_000 }, rate);
    // 1M * $5 * 0.1 = $0.5
    expect(bd.cost).toBeCloseTo(1_000_000 * rate.input * CACHE_READ_MULT / 1e6, 9);
    expect(bd.cacheRead).toBe(1_000_000);
    expect(bd.cost).toBeCloseTo(0.5, 9);
  });

  it("prices detailed 5m and 1h cache writes with their multipliers", () => {
    const bd = costOf(
      {
        cache_creation: {
          ephemeral_5m_input_tokens: 1_000_000,
          ephemeral_1h_input_tokens: 1_000_000,
        },
      },
      rate,
    );
    const expected =
      (1_000_000 * rate.input * CACHE_WRITE_5M_MULT + 1_000_000 * rate.input * CACHE_WRITE_1H_MULT) / 1e6;
    expect(bd.cost).toBeCloseTo(expected, 9);
    expect(bd.cacheWrite).toBe(2_000_000);
  });

  it("falls back to the flat cache_creation_input_tokens (treated as 5m)", () => {
    const bd = costOf({ cache_creation_input_tokens: 1_000_000 }, rate);
    expect(bd.cacheWrite).toBe(1_000_000);
    expect(bd.cost).toBeCloseTo(1_000_000 * rate.input * CACHE_WRITE_5M_MULT / 1e6, 9);
  });

  it("treats missing fields as zero", () => {
    const bd = costOf({}, rate);
    expect(bd).toEqual({ cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  });
});
