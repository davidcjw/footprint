import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { Footprint, RepoSummary } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, "..", "assets");

const PALETTE = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#fb923c", "#4ade80"];

// Minimal hyperscript producing satori-compatible vnodes (no JSX/React needed).
type Node = { type: string; props: Record<string, unknown> };
function h(type: string, style: Record<string, unknown>, children?: unknown): Node {
  return { type, props: { style, ...(children !== undefined ? { children } : {}) } };
}

function loadFonts() {
  return [
    { name: "Inter", weight: 400 as const, style: "normal" as const, data: readFileSync(join(ASSETS, "Inter-Regular.ttf")) },
    { name: "Inter", weight: 600 as const, style: "normal" as const, data: readFileSync(join(ASSETS, "Inter-SemiBold.ttf")) },
    { name: "Inter", weight: 700 as const, style: "normal" as const, data: readFileSync(join(ASSETS, "Inter-Bold.ttf")) },
  ];
}

function statBlock(value: string, label: string, color: string) {
  return h("div", { display: "flex", flexDirection: "column" }, [
    h("div", { fontSize: 52, fontWeight: 700, color, lineHeight: 1 }, value),
    h("div", { fontSize: 18, color: "#94a3b8", marginTop: 6, fontWeight: 600, letterSpacing: 1 }, label.toUpperCase()),
  ]);
}

function repoRow(r: RepoSummary, maxCommits: number, color: string, cost?: number) {
  const pct = maxCommits > 0 ? Math.max(6, Math.round((r.commits.length / maxCommits) * 100)) : 6;
  const name = r.name.length > 24 ? r.name.slice(0, 23) + "…" : r.name;
  return h("div", { display: "flex", alignItems: "center", marginBottom: 14 }, [
    h("div", { width: 240, fontSize: 22, fontWeight: 600, color: "#e2e8f0", overflow: "hidden" }, name),
    h(
      "div",
      { display: "flex", flex: 1, height: 22, background: "#1e293b", borderRadius: 6, overflow: "hidden", marginRight: 16 },
      [h("div", { width: `${pct}%`, height: "100%", background: color, borderRadius: 6 })],
    ),
    h("div", { width: 50, fontSize: 20, fontWeight: 700, color: "#cbd5e1", textAlign: "right" }, String(r.commits.length)),
    h("div", { width: 138, fontSize: 18, fontWeight: 600, textAlign: "right", display: "flex", justifyContent: "flex-end" }, [
      h("span", { color: "#34d399" }, `+${r.added}`),
      h("span", { color: "#64748b", margin: "0 6px" }, "/"),
      h("span", { color: "#f87171" }, `-${r.deleted}`),
    ]),
    h(
      "div",
      { width: 80, marginLeft: 14, fontSize: 18, fontWeight: 700, textAlign: "right", color: cost ? "#a78bfa" : "#334155" },
      cost ? `$${cost.toFixed(0)}` : "·",
    ),
  ]);
}

function langChip(ext: string, changes: number, color: string) {
  return h(
    "div",
    {
      display: "flex",
      alignItems: "center",
      background: "#1e293b",
      borderRadius: 999,
      padding: "6px 14px",
      marginRight: 10,
      marginTop: 10,
      fontSize: 16,
    },
    [
      h("div", { width: 10, height: 10, borderRadius: 999, background: color, marginRight: 8 }),
      h("span", { color: "#e2e8f0", fontWeight: 600 }, `.${ext}`),
      h("span", { color: "#64748b", marginLeft: 8 }, changes.toLocaleString()),
    ],
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function usageBand(u: NonNullable<Footprint["usage"]>): Node {
  const top = u.byModel.slice(0, 3);
  return h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      marginTop: 24,
      background: "#170d2e",
      border: "1px solid #3b2d6b",
      borderRadius: 16,
      padding: "22px 28px",
    },
    [
      h("div", { display: "flex", justifyContent: "space-between", alignItems: "center" }, [
        h("div", { display: "flex", alignItems: "center" }, [
          h("div", { width: 8, height: 20, background: "#a78bfa", borderRadius: 3, marginRight: 12 }),
          h("div", { fontSize: 20, color: "#c4b5fd", fontWeight: 700, letterSpacing: 1 }, "CLAUDE USAGE"),
        ]),
        h("div", { fontSize: 40, color: "#34d399", fontWeight: 700 }, `$${u.totalCost.toFixed(2)}`),
      ]),
      h("div", { display: "flex", marginTop: 14 }, [
        h("div", { fontSize: 18, color: "#94a3b8", marginRight: 20 }, `${fmtTokens(u.inputTokens)} in`),
        h("div", { fontSize: 18, color: "#94a3b8", marginRight: 20 }, `${fmtTokens(u.outputTokens)} out`),
        h("div", { fontSize: 18, color: "#64748b", marginRight: 20 }, `${fmtTokens(u.cacheReadTokens)} cache-read`),
        h("div", { fontSize: 18, color: "#64748b" }, `${u.messages.toLocaleString()} msgs`),
      ]),
      h(
        "div",
        { display: "flex", flexWrap: "wrap", marginTop: 8 },
        top.map((m) =>
          h(
            "div",
            { display: "flex", alignItems: "center", marginRight: 18, marginTop: 8, fontSize: 16 },
            [
              h("span", { color: "#e2e8f0", fontWeight: 600 }, m.model.replace(/^claude-/, "")),
              h("span", { color: "#34d399", marginLeft: 8 }, `$${m.cost.toFixed(2)}`),
            ],
          ),
        ),
      ),
    ],
  );
}

function buildTree(fp: Footprint): Node {
  const shown = fp.repos.slice(0, 10);
  const maxCommits = Math.max(1, ...shown.map((r) => r.commits.length));
  const moreRepos = fp.repos.length - shown.length;

  const children: unknown[] = [
    // header
    h("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }, [
      h("div", { display: "flex", flexDirection: "column" }, [
        h("div", { display: "flex", alignItems: "center" }, [
          h("div", { width: 8, height: 22, background: "#22d3ee", borderRadius: 3, marginRight: 12 }),
          h("div", { fontSize: 22, color: "#22d3ee", fontWeight: 700, letterSpacing: 2 }, "DAILY FOOTPRINT"),
        ]),
        h("div", { fontSize: 40, color: "#f8fafc", fontWeight: 700, marginTop: 6 }, fp.dateLabel),
      ]),
      h("div", { fontSize: 18, color: "#64748b", fontWeight: 600 }, fp.authors[0] ?? ""),
    ]),
    // stat strip
    h(
      "div",
      { display: "flex", justifyContent: "space-between", background: "#0b1220", borderRadius: 16, padding: "26px 32px", marginBottom: 30 },
      [
        statBlock(String(fp.repos.length), "repos", "#f8fafc"),
        statBlock(String(fp.totalCommits), "commits", "#22d3ee"),
        statBlock(`+${fp.totalAdded.toLocaleString()}`, "added", "#34d399"),
        statBlock(`-${fp.totalDeleted.toLocaleString()}`, "deleted", "#f87171"),
      ],
    ),
    // column header
    h("div", { display: "flex", alignItems: "center", marginBottom: 10, fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#475569" }, [
      h("div", { flex: 1 }, "REPO"),
      h("div", { width: 50, textAlign: "right" }, "CMT"),
      h("div", { width: 138, textAlign: "right" }, "LINES"),
      h("div", { width: 80, marginLeft: 14, textAlign: "right" }, "AI $"),
    ]),
    // repo rows
    h(
      "div",
      { display: "flex", flexDirection: "column" },
      shown.map((r, i) => repoRow(r, maxCommits, PALETTE[i % PALETTE.length], fp.usage?.byRepo.get(r.name))),
    ),
  ];

  if (moreRepos > 0) {
    children.push(h("div", { fontSize: 18, color: "#64748b", marginTop: 4, fontWeight: 600 }, `+ ${moreRepos} more repos`));
  }

  if (fp.languages.length) {
    children.push(
      h(
        "div",
        { display: "flex", flexWrap: "wrap", marginTop: 22 },
        fp.languages.slice(0, 8).map((l, i) => langChip(l.ext, l.changes, PALETTE[i % PALETTE.length])),
      ),
    );
  }

  if (fp.usage && fp.usage.messages > 0) {
    children.push(usageBand(fp.usage));
  }

  children.push(
    h(
      "div",
      { display: "flex", justifyContent: "flex-end", marginTop: 26, fontSize: 16, color: "#475569", fontWeight: 600 },
      "made with footprint",
    ),
  );

  return h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      padding: 50,
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
      fontFamily: "Inter",
    },
    children,
  );
}

export async function renderCard(fp: Footprint): Promise<Buffer> {
  const width = 1000;
  const svg = await satori(buildTree(fp) as unknown as Parameters<typeof satori>[0], {
    width,
    fonts: loadFonts(),
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width * 2 } });
  return Buffer.from(resvg.render().asPng());
}
