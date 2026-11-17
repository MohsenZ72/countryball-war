# Countryball War

A territory-capture real-time strategy game that runs in a browser. Take ground,
hold it, and out-think up to five rival commanders.

**No ads. No in-app purchases. No tracking. No account.**

```bash
npm install
npm run dev      # play at http://localhost:5178
npm test         # 55 tests
npm run sim      # bot-vs-bot balance harness
npm run build    # production bundle (~48 kB JS, ~17 kB gzipped)
```

## What the game is

Every territory on the map produces troops up to a cap. Drag from a territory
you hold onto another to send a column; when it lands, the larger force wins.
Forts defend at 1.6x, factories out-produce everything and arm nuclear
warheads, and a struck territory is left empty for whoever walks in first.

Three ideas carry the whole game:

- **A full garrison produces nothing.** Sitting still is a loss of tempo.
- **Pooling beats stacking.** Tap several territories, then the target: their
  columns arrive together and take what one garrison never could.
- **Neutral ground never fights back.** It also never grows. Taking it early is
  the cheapest territory you will ever own.

## Layout

```
packages/core     the simulation: deterministic, DOM-free, 55 tests
  src/config.ts     every balance number in the game
  src/sim/          world step, combat, command validation
  src/ai/bot.ts     the bot commander
  src/levels.ts     the 12-level campaign
apps/client       the game: Canvas 2D, plain DOM HUD, no framework
docs/             design, system design, design system, ADRs, runbook
.claude/skills/   project skills for working on this repo
```

The simulation knows nothing about the browser, and the client contains no
rules. That split is what lets `npm run sim` play thousands of matches
headlessly to check a balance change before anyone opens a tab.

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/01-vision.md](docs/01-vision.md) | What this is and what it is not |
| [docs/02-game-design.md](docs/02-game-design.md) | Rules, every number, measured bot win rates |
| [docs/03-system-design.md](docs/03-system-design.md) | Architecture, determinism, the loop |
| [docs/04-design-system.md](docs/04-design-system.md) | Tokens, components, motion, accessibility |
| [docs/05-design-patterns.md](docs/05-design-patterns.md) | The patterns the code actually uses |
| [docs/06-roadmap.md](docs/06-roadmap.md) | What is done and what is next |
| [docs/07-runbook.md](docs/07-runbook.md) | Running, testing, tuning, deploying |
| [docs/08-legal-and-ip.md](docs/08-legal-and-ip.md) | Why this game owes nobody anything |
| [docs/adr/](docs/adr/) | Nine decision records |

## Origin

The project started from a question: could the browser carry a game of this
genre — territory capture, troop columns, multiple AI commanders — built from
scratch rather than ported. The genre dates back to Galcon (2006) and has been
rebuilt many times since.

Everything here is original work: the rules were written from the genre's
shared mechanics, every number was tuned by measurement (see
`docs/02-game-design.md`), the nations are invented, and all art is drawn
procedurally at runtime. No other game's assets, code or data are used. See
[docs/08-legal-and-ip.md](docs/08-legal-and-ip.md).

## Licence

MIT. See [LICENSE](LICENSE).
