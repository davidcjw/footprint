import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "./config.js";
import { scan } from "./git.js";
import { renderTerminal } from "./terminal.js";
import { renderCard } from "./card.js";

async function main() {
  const cfg = parseArgs(process.argv);

  if (cfg.authors.length === 0) {
    console.error("No author configured. Set git global user.email or pass --author <name|email>.");
    process.exit(1);
  }

  const fp = scan({
    root: cfg.root,
    authors: cfg.authors,
    since: cfg.since,
    until: cfg.until,
    date: cfg.date,
    dateLabel: cfg.dateLabel,
  });

  process.stdout.write(renderTerminal(fp));

  if (cfg.noCard || fp.repos.length === 0) return;

  try {
    const png = await renderCard(fp);
    mkdirSync(cfg.outDir, { recursive: true });
    const file = join(cfg.outDir, `footprint-${fp.date}.png`);
    writeFileSync(file, png);
    console.log(`  🖼  card → ${file}\n`);
    if (cfg.open) {
      try {
        execFileSync("open", [file]);
      } catch {
        /* non-macOS or no opener */
      }
    }
  } catch (err) {
    console.error("  Card rendering failed:", err instanceof Error ? err.message : err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
