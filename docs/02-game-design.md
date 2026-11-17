# Game design

Every number here comes from `packages/core/src/config.ts`. If the two
disagree, the file is right and this document is the bug.

## The loop

1. Territories you hold produce troops, up to a cap.
2. You move troops between territories. Movement takes time and is visible.
3. When a column lands on ground you do not hold, the larger force wins.
4. You win by holding everything, or by holding the most when time runs out.

## Territories

Three kinds. Each is a real trade, not a reskin.

| Kind | Capacity | Production | Defence | Warheads |
| --- | --- | --- | --- | --- |
| City | 1.0x | 1.0x | 1.0x | — |
| Fort | 0.7x | 0.7x | **1.6x** | — |
| Factory | 1.3x | **1.35x** | 0.85x | 1 per 45 s |

Multipliers apply to the level's base values:

| Level | Capacity | Production | Cost to upgrade |
| --- | --- | --- | --- |
| 1 | 20 | 0.50 / s | 60% of capacity |
| 2 | 35 | 0.90 / s | 75% of capacity |
| 3 | 60 | 1.50 / s | — |

**Upgrade cost is a share of capacity, not a flat number.** The first pass used
flat costs (25 then 55) and that silently removed the entire build path from
the game: a level-1 city caps at 20 troops and a level-1 fort at 14, so neither
could ever afford 25. It is now a ratio, and `balance.test.ts` fails if any
upgrade is ever unaffordable for the node that must pay for it. See ADR-0006.

A garrison above its cap does not keep growing; it bleeds back down at 0.6/s.
Reinforcing past the cap is a way to park troops briefly, not to hoard.

## Capitals

Each faction starts on one capital: level 2, 22 troops, and **1.5x defence**
that it keeps for whoever holds it afterwards.

Capitals are fortified because without it, matches ended in the opening minute.
Bots that had out-expanded their rival simply walked into the enemy seat, and
1v1 matches were averaging 42 seconds. Capitals have to be worth besieging.

Bots also keep at least 25% of a capital's capacity at home whatever their
skill says (`capitalReserveFloor`). Leaving your seat literally empty is not a
playstyle, it is a blunder — but the floor is deliberately low. A floor high
enough to stop a one-garrison rush outright (0.6) also stopped the strongest
bot from spending its capital, and inverted the whole skill ladder. Rushing a
careless opponent's seat is still a real strategy.

## Movement and combat

- A column carries `floor(garrison x ratio)` troops and always leaves at least
  1 behind. The player picks the ratio: 25%, 50% or 100%.
- **A multi-source order is one assault.** Every column in it is given the
  slowest column's travel time, so they all land together. Without this,
  pooling was a trap: a player who followed the game's own advice and tapped
  six territories watched six columns trickle into a fort one at a time and
  get cut down individually, with nothing explaining why. Found by playing,
  not by reading.
- Marching speed is 190 map units/s, clamped to between 0.7 s and 4.5 s. The
  clamp is a feel decision: at the original 150 units/s a cross-map move took
  six seconds and the opening of a match felt dead.
- On arrival: `attacker > garrison x defence` captures, and the survivors
  become the new garrison. Otherwise the garrison loses `attacker / defence`.
- Friendly columns reinforce, and may push a garrison above its cap.

## Warheads

- Armed only by factories, one charge per 45 s each, three banked at most.
- Three seconds of flight, under a shrinking ring, announced by a banner.
- On impact: the garrison is wiped, the territory goes neutral, it loses a
  level, and nobody can take it for 4 s of fallout.
- Minimum range 140 units, so a warhead cannot be used as a melee weapon.

A warhead does not win ground. It makes ground winnable — somebody still has
to walk in, and after the fallout, anyone can.

## The campaign

Twelve levels. Maps are seeded from the level id, so every player gets exactly
the same map, and authoring one costs nothing.

| # | Level | Rivals | Nodes | Par | Teaches |
| --- | --- | --- | --- | --- | --- |
| 1 | First Steps | 1 calm | 8 | 1:40 | Dragging onto neutral ground |
| 2 | Two Fronts | 2 calm | 11 | 2:30 | Not opening two fronts at once |
| 3 | Factory Floor | 1 steady | 12 | 2:40 | Factories are worth the detour |
| 4 | The Narrows | 2 | 13 | 3:00 | Short marches cut both ways |
| 5 | Fortress Line | 2 steady | 14 | 3:30 | Pooling garrisons to crack a fort |
| 6 | Three Crowns | 3 | 15 | 3:50 | Letting two rivals bleed each other |
| 7 | Warhead | 2 | 15 | 4:00 | Arming and spending a strike |
| 8 | Attrition | 3 | 17 | 4:30 | Upgrading before expanding |
| 9 | Encirclement | 3 | 18 | 4:50 | Everything is a border |
| 10 | Cold Open | 3 sharp | 19 | 5:10 | Keeping a garrison out of range |
| 11 | The Great Game | 4 | 21 | 5:40 | Trading territory for tempo |
| 12 | The Last Dictator | 5 | 23 | 6:20 | All of it at once |

Level 3 drops back to a single rival on purpose: it is a teaching level, and
`map.test.ts` allows a one-seat dip while requiring that maps never shrink and
par times always grow.

## Bot commanders

One decision pass per interval, in strict priority order: **survive**
(reinforce a territory an inbound column would take), **strike** (take the
best-value target it can afford, pooling garrisons whose columns land within
1.1 s of each other), **invest** (upgrade an interior territory), **escalate**
(spend a warhead on a garrison it could never storm), and as a last resort
**commit** (go all-in from a territory already at capacity, because a full
garrison produces nothing).

### The bug that mattered

Bots did not count their own columns already in flight. A bot thinking twice a
second therefore re-sent to the same target on every pass, pouring three or
four columns into one territory while the rest of its front sat empty. The
symptom was absurd and took a while to believe: **a slower-thinking bot beat a
faster-thinking one**, consistently. Tallying inbound columns per destination
fixed it, and reaction speed started paying for itself. See ADR-0007.

### What actually decides a match

The ladder was tuned by coordinate descent against a fixed opponent, 40 seeds
per measurement, on 14-node maps. The results were not what we assumed:

| Axis | Effect | Direction |
| --- | --- | --- |
| `reserveRatio` | **Decides games.** 0.00 to 33% win rate, 0.34 to 88% | Higher is better |
| `holdRatio` | **Large and inverted.** 0.00 to 97%, 0.40 to 47% | Lower is better |
| `commitRatio` | Moderate, noisy; 0.70–0.85 all play well | Higher is better |
| `safetyMargin` | Nearly flat from 1.02 to 1.60 | Marginal |
| `thinkEvery` | Flat, once in-flight columns are counted | Marginal |
| `buildBias` | Flat from 0 to 0.7 for a bot | None measured |

Two of these are worth dwelling on.

**Reserves win games.** Keeping a share of a border garrison at home more than
doubles a bot's win rate. It is the single most transferable lesson in the
game, and it is what the defeat screen tells a player who has just lost.

**"Don't take what you can't hold" is wrong.** It sounds like prudence. It
measures as a 50-point swing in the wrong direction, because it makes a bot
decline free territory. The weak profiles carry a high `holdRatio` precisely
because it plays badly.

**`buildBias` does nothing measurable for a bot** at any value from 0 to 0.7,
because bots spend their troops expanding either way. It still matters for a
human, who can sit on a territory and bank the production. We kept the knob and
wrote down that it is inert for bots rather than pretending otherwise.

### Measured win rates

24 seeds per matchup, 14-node maps, 600 s limit (`npm run sim`):

| Matchup | Record | Avg length |
| --- | --- | --- |
| ruthless vs sharp | 22–2 | 86 s |
| sharp vs steady | 17–7 | 108 s |
| steady vs calm | 20–4 | 120 s |
| ruthless / sharp / steady / calm | 20 / 4 / 0 / 0 | 121 s |

Strictly ordered, including the free-for-all. `bot.test.ts` re-measures the
three adjacent pairs on every run and fails if the ladder ever inverts.

## Open design questions

- Match length on the last three levels has not been measured with a human
  playing, only with bots in every seat.
- Forts may be under-taken. A 1.6x defender is a strong objective, but the
  value function may be undervaluing them relative to factories.
- There is no comeback mechanic. Whether the genre needs one here is an open
  question, not an oversight.
