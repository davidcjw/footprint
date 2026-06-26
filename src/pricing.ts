// Per-million-token USD pricing for Claude models (input / output).
// Source: claude-api skill pricing table.
export interface Rate {
  input: number;
  output: number;
}

export const PRICING: Record<string, Rate> = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-mythos-5": { input: 10, output: 50 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-opus-4-5": { input: 5, output: 25 },
  "claude-opus-4-1": { input: 15, output: 75 },
  "claude-opus-4-0": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-4-0": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

// Cache pricing relative to the base input rate.
export const CACHE_READ_MULT = 0.1;
export const CACHE_WRITE_5M_MULT = 1.25;
export const CACHE_WRITE_1H_MULT = 2.0;

/** Resolve a model id to a rate: exact match, then longest-prefix match. */
export function rateFor(model: string): Rate | null {
  if (PRICING[model]) return PRICING[model];
  let best: { key: string; rate: Rate } | null = null;
  for (const [key, rate] of Object.entries(PRICING)) {
    if (model.startsWith(key) && (!best || key.length > best.key.length)) best = { key, rate };
  }
  return best?.rate ?? null;
}

export interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
}

export interface CostBreakdown {
  cost: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** Compute USD cost + token tallies for one API response's usage object. */
export function costOf(u: RawUsage, rate: Rate): CostBreakdown {
  const input = u.input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;

  const c = u.cache_creation;
  let write5 = c?.ephemeral_5m_input_tokens ?? 0;
  let write1 = c?.ephemeral_1h_input_tokens ?? 0;
  // Fall back to the flat cache_creation_input_tokens (treat as 5m) when the
  // detailed breakdown is absent.
  if (write5 === 0 && write1 === 0) write5 = u.cache_creation_input_tokens ?? 0;
  const cacheWrite = write5 + write1;

  const cost =
    (input * rate.input +
      output * rate.output +
      cacheRead * rate.input * CACHE_READ_MULT +
      write5 * rate.input * CACHE_WRITE_5M_MULT +
      write1 * rate.input * CACHE_WRITE_1H_MULT) /
    1e6;

  return { cost, input, output, cacheRead, cacheWrite };
}
