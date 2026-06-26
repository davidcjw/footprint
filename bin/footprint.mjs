#!/usr/bin/env node
// Thin launcher so `footprint` works after `npm i -g` or `npm link`.
// Uses tsx to run the TypeScript entry directly.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "..", "src", "index.ts");

const res = spawnSync(
  process.execPath,
  ["--import", "tsx", entry, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(res.status ?? 0);
