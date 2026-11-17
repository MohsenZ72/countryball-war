# Runbook

## Requirements

Node 22+ and npm. Nothing else — no database, no services, no API keys.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install the workspace |
| `npm run dev` | Dev server on http://localhost:5178 |
| `npm run build` | Production bundle into `apps/client/dist` |
| `npm run preview` | Serve the production bundle |
| `npm test` | Run the suite once |
| `npm run test:watch` | Watch mode |
| `npm run typecheck` | Typecheck both packages |
| `npm run sim` | Bot-vs-bot balance harness |

## Playing a single level

`http://localhost:5178/#level=warhead` jumps straight into a level, bypassing
unlock state. Ids are in `packages/core/src/levels.ts`.

## Changing balance

1. Edit `packages/core/src/config.ts`. It is the only file with balance
   numbers in it.
2. `npm test` — invariants live in `balance.test.ts`, and the skill ladder is
   re-measured in `bot.test.ts`.
3. `npm run sim` — expect the ladder to stay ordered and matches to last
   roughly 60–180 s. `SIM_SEEDS=64 npm run sim` for a tighter measurement.
4. Record what you measured in `docs/02-game-design.md`.

Do not tune by feel alone. Four separate intuitions about the bot ladder were
wrong before the coordinate descent settled it, including the confident one
that thinking faster must be better.

### Tuning a bot profile from scratch

Coordinate descent against a fixed opponent works well and takes a couple of
minutes: hold three skills constant, sweep one axis of the fourth across 5–7
values at 40 seeds each, keep the best, move to the next axis, then repeat the
whole pass. The useful axes are `reserveRatio` and `holdRatio`; the rest are
nearly flat.

## Deploying

The build is static files. Any static host works.

GitHub Pages is wired up in `.github/workflows/pages.yml` and builds with
`--mode pages`, which sets the base path to `/countryball-war/`. On any other
host, build without that flag.

## CI

`.github/workflows/ci.yml` runs typecheck, tests and a production build on
pushes and pull requests. It uses `vars.RUNS_ON` when that repository variable
is set, so a self-hosted runner can be selected without editing the workflow,
and falls back to `ubuntu-latest`.

## Troubleshooting

**The match is paused and will not resume.** The tab reported itself hidden.
It pauses on `visibilitychange` by design. Focus the tab.

**Automation cannot click the HUD.** Check for an element with `hidden` whose
CSS sets `display`. A `display` rule in `styles.css` outranks the user agent's
`[hidden]` rule, which once left an invisible overlay swallowing every tap.
There is a global `[hidden] { display: none !important }` guarding this.

**Territories are tiny on a phone.** The camera should be rotating. Check
`fitCamera` is picking the turned orientation — it compares both and takes the
larger scale.

**Tests are slow.** `bot.test.ts` plays several hundred headless matches. That
is the point; it is still about a second.
