import pc from "picocolors";
import type { Footprint } from "./types.js";

function bar(value: number, max: number, width = 18): string {
  if (max <= 0) return "";
  const filled = Math.max(1, Math.round((value / max) * width));
  return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
}

export function renderTerminal(fp: Footprint): string {
  const lines: string[] = [];
  const rule = pc.dim("─".repeat(52));

  const title = fp.period === "month" ? "📅 Monthly Footprint  " : "⚡ Daily Footprint  ";
  lines.push("");
  lines.push(pc.bold(pc.cyan("  " + title)) + pc.dim("· " + fp.dateLabel));
  lines.push(rule);

  if (fp.repos.length === 0) {
    const when = fp.period === "month" ? `in ${fp.dateLabel}` : `on ${fp.date}`;
    lines.push(pc.dim(`  No commits by ${fp.authors.join(", ")} ${when}.`));
    lines.push(rule);
    renderUsage(fp, lines, rule);
    lines.push("");
    return lines.join("\n");
  }

  if (fp.period === "month" && fp.activity) {
    renderActivity(fp.activity, lines);
    lines.push(rule);
  }

  // headline stats
  const stat = (label: string, val: string, color: (s: string) => string) =>
    `${color(pc.bold(val))} ${pc.dim(label)}`;
  lines.push(
    "  " +
      [
        stat("repos", String(fp.repos.length), pc.white),
        stat("commits", String(fp.totalCommits), pc.cyan),
        stat("added", "+" + fp.totalAdded.toLocaleString(), pc.green),
        stat("deleted", "-" + fp.totalDeleted.toLocaleString(), pc.red),
      ].join(pc.dim("   ")),
  );
  lines.push(rule);

  const maxCommits = Math.max(...fp.repos.map((r) => r.commits.length));
  const nameW = Math.min(22, Math.max(...fp.repos.map((r) => r.name.length)));

  for (const r of fp.repos) {
    const name = r.name.length > nameW ? r.name.slice(0, nameW - 1) + "…" : r.name.padEnd(nameW);
    const churn = pc.green("+" + r.added) + " " + pc.red("-" + r.deleted);
    const cost = fp.usage?.byRepo.get(r.name);
    const costStr = cost ? "  " + pc.magenta("$" + cost.toFixed(0)) : "";
    lines.push(
      `  ${pc.bold(name)}  ${pc.cyan(bar(r.commits.length, maxCommits))} ` +
        `${pc.cyan(String(r.commits.length).padStart(2))} ${pc.dim("commits")}  ${churn}${costStr}`,
    );
  }

  if (fp.usage && fp.usage.totalCost > 0) {
    const shownCost = fp.repos.reduce((s, r) => s + (fp.usage!.byRepo.get(r.name) ?? 0), 0);
    const other = fp.usage.totalCost - shownCost;
    if (other >= 0.5) {
      lines.push(`  ${pc.dim("other repos · non-repo dirs".padEnd(nameW + 23))}${pc.magenta("$" + other.toFixed(0))}`);
    }
  }

  if (fp.languages.length) {
    lines.push(rule);
    const langs = fp.languages
      .slice(0, 6)
      .map((l) => `${pc.bold("." + l.ext)} ${pc.dim(l.changes.toLocaleString())}`)
      .join("   ");
    lines.push("  " + pc.dim("langs ") + langs);
  }

  lines.push(rule);
  renderUsage(fp, lines, rule);
  lines.push("");
  return lines.join("\n");
}

const SPARK = "▁▂▃▄▅▆▇█";

function renderActivity(activity: number[], lines: string[]): void {
  const max = Math.max(1, ...activity);
  const spark = activity
    .map((n) => {
      if (n === 0) return pc.dim("·");
      const idx = Math.min(SPARK.length - 1, Math.ceil((n / max) * SPARK.length) - 1);
      return pc.cyan(SPARK[idx]);
    })
    .join("");
  const activeDays = activity.filter((n) => n > 0).length;
  let bestDay = 0;
  activity.forEach((n, i) => {
    if (n > activity[bestDay]) bestDay = i;
  });
  lines.push("  " + pc.dim("commits/day ") + spark);
  lines.push(
    "  " +
      pc.dim(`${activeDays} active days · busiest day ${bestDay + 1} (${activity[bestDay]} commits)`),
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function renderUsage(fp: Footprint, lines: string[], rule: string): void {
  const u = fp.usage;
  if (!u || u.messages === 0) return;

  lines.push(
    "  " +
      pc.bold(pc.magenta("🤖 Claude usage")) +
      "  " +
      pc.green(pc.bold("$" + u.totalCost.toFixed(2))) +
      pc.dim("  · ") +
      pc.dim(`${u.messages.toLocaleString()} msgs`),
  );
  lines.push(
    "  " +
      pc.dim("tokens ") +
      `${pc.cyan(fmtTokens(u.inputTokens))} ${pc.dim("in")}  ` +
      `${pc.cyan(fmtTokens(u.outputTokens))} ${pc.dim("out")}  ` +
      `${pc.dim(fmtTokens(u.cacheReadTokens) + " cache-read")}  ` +
      `${pc.dim(fmtTokens(u.cacheWriteTokens) + " cache-write")}`,
  );
  for (const m of u.byModel.slice(0, 4)) {
    const label = m.model.replace(/^claude-/, "");
    const note = m.priced ? "" : pc.yellow(" (unpriced)");
    lines.push(
      `  ${pc.dim("•")} ${pc.bold(label.padEnd(14))} ${pc.green("$" + m.cost.toFixed(2)).padStart(8)} ` +
        pc.dim(`  ${fmtTokens(m.input)}/${fmtTokens(m.output)} io`) +
        note,
    );
  }
  lines.push(rule);
}
