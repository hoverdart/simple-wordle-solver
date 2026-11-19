# Simple Wordle Solver

[Try the browser solver](https://wordle.shauryav.com/). Enter your guesses and color feedback; the solver remembers every row, narrows the list of possible words, and suggests information-rich next guesses. No account, server inference, or uploaded board.

- [Daily word challenge](https://wordle.shauryav.com/today/): our own playable five-letter puzzle with optional hints and a solver walkthrough.
- [Challenge archive](https://wordle.shauryav.com/archive/): every published edition of the original challenge, beginning November 19, 2026.
- [Selected NYT Wordle answers](https://wordle.shauryav.com/wordle-answer/): a separate, explicitly incomplete editorial index built from independently verified published facts. It does **not** pull unpublished puzzles or crawl NYT.
- [Method](https://wordle.shauryav.com/method/): scoring, entropy ranking, the offline benchmark, and data limitations.

## Run locally

Requires Node.js 24; no runtime packages.

```sh
npm run check
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. The build emits static HTML, crawlable archives, sitemap, robots, canonical URLs, and JSON. A hosting root override such as `SITE_URL=https://example.com/solver/ npm run build` is supported.

## Solver

Green copies are counted first, then unmatched copies are consumed left-to-right for yellows. A possible answer has to reproduce **all** feedback rows. For recommendation, the solver ranks a bounded browser-friendly set of permitted guesses by Shannon entropy under a uniform candidate prior. Fewer candidates does not mean the missing words are impossible outside this dictionary. See [data provenance](data/SOURCES.md); the browser word list is not the official NYT answer list.

The offline benchmark evaluates every word in our frozen original challenge bank, opens with SLATE, and uses only feedback in later choices. The actual answer is used to simulate scoring, not pick guesses. Build output records successes, failures, and an average among successes. This is not an optimality claim or a guarantee over NYT puzzles.

## Daily publishing

The original puzzle is deterministic from the frozen bank and dated in America/New_York. Never edit or reorder the source bank once running; publish new entries with a versioned bank in a future release. `npm run publish:daily` advances the checked-in publication cutoff but rejects a future edition. The GitHub workflow validates and commits the cutoff daily, then requests a production rebuild. Set the repository Actions secret `WORDLE_DEPLOY_HOOK` to a Vercel deploy hook for this project's **main** branch; without it the workflow relies on the project's Git integration. Never commit or print the hook URL. GitHub schedules can start late and inactivity can pause scheduled workflows.

Editorial NYT facts have a separate bounded import command with required provenance:

```sh
node scripts/sync-daily.mjs --import path/to/verified-records.json
```

See `data/SOURCES.md` for the format. No automatic NYT source is configured. This independent project is not affiliated with The New York Times.

The old Flask/Waffle implementation remains as historical source in `legacy/flask/`; the static site does not run it.
