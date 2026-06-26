# footprint

Summarize the commits you authored **today** across all your local repos — as a
clean terminal report and a shareable PNG card.

> One glance at everything you shipped today, across every repo. Drop the card in
> Slack/Twitter/standup, or pipe the terminal output anywhere.

![example card](docs/example.png)

## What it does

- Scans every git repo directly under a root folder (default `~/code`).
- Finds commits **you** authored on a given local day (matched by your git email).
- Aggregates: repos touched, commit counts, lines added/deleted, top languages.
- Prints a colored terminal summary **and** renders a PNG "footprint card".

No services, no API keys, no headless Chrome — the card is rendered with
[`satori`](https://github.com/vercel/satori) + [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js).

## Usage

```bash
npm install

# today, repos under ~/code
npm run footprint

# a specific day, open the card when done
npm run footprint -- --date 2026-06-25 --open
```

Or install the CLI globally:

```bash
npm link          # then `footprint` is on your PATH
footprint --open
```

The card is written to `./out/footprint-<date>.png`.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--root <dir>` | `~/code` | Folder containing your repos (immediate children) |
| `--author <s>` | git global `user.email` | Match author name/email. Repeatable (OR-ed) |
| `--date <YMD>` | today (local) | Target day, e.g. `2026-06-25` |
| `--out <dir>` | `./out` | Where to write the PNG card |
| `--no-card` | — | Terminal summary only, skip rendering |
| `--open` | — | Open the PNG after rendering (macOS) |
| `-h, --help` | — | Show help |

## How "today" is decided

The target day is a full local-midnight-to-midnight window. Commits are filtered
by git author date (`%aI`) and author identity, so the count matches what you'd
see in your git history — not when changes happened to be pushed.

## Notes

- Only scans **immediate** subdirectories of `--root` that contain a `.git`.
- Merge commits are excluded.
- Bundled font: Inter (SIL Open Font License), in `assets/`.

## License

MIT
