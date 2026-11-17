# Originality and intellectual property

This game was built from the genre's shared mechanics, not from any particular
title. This document records exactly what that means, because the distinction
matters and should be verifiable rather than asserted.

## What was used

**Mechanics that belong to the genre.** Territories that produce troops up to a
cap, columns that take time to travel, larger-force-wins arrival, and win by
holding everything. These have been the shape of the genre since Galcon (2006)
and appear in dozens of games since. Game mechanics are not protected by
copyright in any jurisdiction this project cares about; expression is.

## What was not used

- **No decompilation, extraction or inspection of any other game.** No APK was
  unpacked, no binary disassembled, no asset archive opened, no network traffic
  captured, and no balance table read out of another product. The project
  directory has never contained another game's files.
- **No assets.** No image, sound, font or animation from anywhere else. Every
  visual in this game is drawn procedurally at runtime from code in this
  repository, and every sound is synthesised from oscillators. There is no
  `assets/` directory because there is nothing to put in one.
- **No names, marks or branding.** The game is called Countryball War. The
  twelve nations — Brightland, Verdalia, Cobalt Reach, Crimsonia, Violetta,
  Tangier Isles, Slate Union, Tealmark, Roseland, Limeworth, Indigo Pact,
  Sandmere — are invented. Their flags are invented, drawn from a small
  declarative spec in `apps/client/src/render/flags.ts`.
- **No real flags.** A deliberate choice. Real flags are not copyrightable, so
  using them would have been lawful, but placing real nations next to a nuclear
  strike button is a political statement this game does not want to make.
- **No copied numbers.** Every balance value in `packages/core/src/config.ts`
  was arrived at here, by measurement. The record of that work — including the
  four assumptions that turned out to be wrong — is in `02-game-design.md` and
  in ADR-0006 and ADR-0007. Several numbers exist specifically to fix defects
  found while testing this implementation, which is itself evidence of
  independent derivation.

## Why the provenance is visible

The tuning history is in the repository on purpose. Independently derived
numbers leave a trail: the upgrade cost is a ratio because a flat cost locked
forts out of the build path *here*; capitals are fortified because 1v1 matches
*here* were ending in 42 seconds; bots count their in-flight columns because
without it a slower bot beat a faster one *here*. Copied numbers have no such
history.

## Trade dress

The game does not imitate another product's interface, layout, icon, store
listing or art direction. The visual identity — dark map, countryball
territories, bottom-strip controls — was designed for this game and is
documented in `04-design-system.md`.

## If you are forking this

The code is MIT licensed; do what you like with it. Two asks, neither legal:
do not name your fork after someone else's game, and do not add the ads this
one deliberately leaves out.
