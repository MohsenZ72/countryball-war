# Vision

## What this is

A territory-capture real-time strategy game that opens in a browser tab, plays
with one thumb, and finishes a match in two to five minutes.

A match is a map of territories. Each one you hold produces troops up to a cap.
You drag troops between them. Whoever ends up holding everything wins. That is
the entire rule set a new player needs, and it is deliberately learnable in the
first fifteen seconds of level one.

## What it is for

Three audiences, in order:

1. **A player with four minutes.** The game has to be interesting before it is
   explained, and finished before it is tiring.
2. **A phone.** Not "responsive" — designed for a thumb first. The board
   rotates a quarter turn on a portrait screen rather than shrinking to fit
   (ADR-0008), touch targets are never below 44 px, and every action lives in
   the bottom strip.
3. **Anyone reading the code.** The simulation is a separate, DOM-free package
   with its own tests. A balance change can be checked across thousands of
   headless matches before a browser is opened.

## What it is not

- **Not free-to-play.** No ads, no purchases, no energy timers, no daily
  login, no analytics, no account. The game is the product and it is finished
  when you close the tab. This is a product decision, recorded in ADR-0004, and
  it constrains the design: there is no reason to pad a match, gate a level
  behind a wait, or make losing feel like a purchase opportunity.
- **Not a clone.** It takes the genre's shared mechanics — the same way a card
  game takes trick-taking — and nothing else. Every number was tuned here by
  measurement. See `08-legal-and-ip.md`.
- **Not multiplayer.** Not yet, and not without a reason. See `06-roadmap.md`.
- **Not a live service.** It is a static bundle. It will still work when
  nobody is maintaining it.

## The feel we are aiming at

> You see the board, you know what you want to do, and the only thing between
> you and doing it is whether you were right.

Concretely, that means:

- **No hidden information.** The whole map is always on screen. Every garrison
  shows its number. Every column shows what it carries and where it is going.
- **No input you have to fight.** A wrong drag costs you a column, never a
  misparse. An order that cannot be carried out says why, in words, instead of
  failing silently.
- **No surprises you could not have seen.** A warhead takes three seconds to
  land, under a shrinking ring, with a banner naming the territory. You can
  always react; you might not be able to afford to.

## How we will know it worked

- A new player takes their first territory without reading anything.
- A match on a mid-campaign level lasts between 90 and 240 seconds.
- The bot skill ladder is strictly ordered, measured rather than asserted
  (`npm run sim`, and `bot.test.ts` fails if it inverts).
- The whole game is under 60 kB of JavaScript.

All four currently hold. The sizes and win rates are in `02-game-design.md`.
