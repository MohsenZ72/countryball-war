# Design patterns

The patterns this codebase actually uses, and what each one is buying. If a
pattern is not earning its complexity, it should not be here.

## Command queue

Player input and bot decisions both produce `Command` values. Nothing mutates
the world directly.

```ts
queued.push({ kind: 'send', faction: PLAYER, from: [...], to, ratio });
// ... later, inside the fixed step:
const commands = queued.splice(0, queued.length);
stepMatch(match, commands);
```

**Buys:** one place where rules live, a UI that cannot construct an illegal
state, a natural ordering (player commands are applied before bot commands, so
a player reacting inside the same step always wins the race), and a serialisable
input stream for replays or networking later.

## Pure-function bots

A bot is `(world, factionId, state) -> Command[]`. Its only mutable state is
when it next thinks. Its randomness is derived from the step index and faction
id, not from a shared stream.

**Buys:** bots are testable without a renderer, deterministic without
coordination, and reorderable without changing the outcome.

## Event stream instead of state diffing

`stepWorld` returns only the events it just produced.

**Buys:** the renderer and the audio layer react without comparing snapshots,
and the simulation never learns that either exists.

## Tokens as the only source of sizes

`theme.ts` for the canvas, `styles.css` for the DOM, `config.ts` for the rules.
A literal colour, radius or troop count anywhere else is a bug.

**Buys:** a change lands everywhere at once, and the design document has
something to be checked against.

## Derived values over stored ones

Capacity, production rate, upgrade cost and defence are computed from level and
kind by `capacityOf`, `rateOf`, `upgradeCostOf` and `defenceMulOf`. They are not
fields on the node.

**Buys:** no stale copies. It also caught a real bug — making upgrade cost a
function of capacity rather than a stored constant is what revealed that a flat
cost of 25 was unreachable for every fort in the game.

## Measure, then assert

Balance claims are measured by running matches, not asserted from intuition.
`bot.test.ts` re-measures the skill ladder on every run and fails if it
inverts; `npm run sim` prints the full table.

**Buys:** the one thing that actually caught the in-flight-accounting bug. The
assumption "faster thinking is better" was wrong, and only a measurement said
so. Four separate intuitions about the bot ladder were wrong before the
coordinate descent settled it.

## Guarded platform access

Every `localStorage` read and write, and every `AudioContext` construction, is
wrapped in `try`/`catch` with a working fallback.

**Buys:** the game runs in a private window, in a thumbnail capture, and with
site data blocked.

## Anti-patterns we avoided, and why

| Not used | Why |
| --- | --- |
| A UI framework | The whole game is ~48 kB; a framework costs that before any game code |
| An ECS | Dozens of entities, not thousands. Plain arrays are faster to read |
| A state-management library | One `World` object, mutated in one function |
| Interpolated rendering | Columns already carry a 0–1 progress value |
| Sprite sheets | Every visual is procedural, so there is nothing to load |
| Storing derived stats on nodes | Guarantees a stale copy eventually |
