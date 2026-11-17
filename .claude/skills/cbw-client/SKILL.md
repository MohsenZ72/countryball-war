---
name: cbw-client
description: Use when changing the Countryball War browser client — canvas rendering, camera, pointer input, HUD, screens, styling or accessibility in apps/client. Covers the phone-first rules and the input traps already found here.
---

# Working on the client

Canvas draws the board; DOM draws everything you can press. Buttons need focus
rings, hit targets, labels and a screen reader, and drawing them into the
canvas means rebuilding all of that by hand, badly.

## Non-negotiables

**Phone first.** Every control is at least 44x44 px. Hit testing takes
whichever is larger, the drawn radius or a 44 px touch target. Actions live in
the bottom strip so a thumb can reach them.

**The whole map is always visible.** No pan, no zoom. On a portrait screen the
board rotates a quarter turn instead of shrinking (ADR-0008). Anything
converting between world and screen coordinates **must** go through
`toScreen`/`toWorld` — bypassing the camera works upright and breaks silently
on a phone.

**Tokens only.** `theme.ts` for canvas, `styles.css` for DOM. A literal colour
or size anywhere else is a bug.

**Guard every platform call.** `localStorage` and `AudioContext` can throw or
return nothing in a private window or with site data blocked. Wrap them; make
the game work when they fail.

## Traps already found here

- **`hidden` versus `display`.** A `display` rule in `styles.css` outranks the
  user agent's `[hidden]` rule, which left an invisible full-screen overlay
  eating every HUD tap. There is a global
  `[hidden] { display: none !important }` guarding this. Do not remove it, and
  do not work around it per element. ADR-0009.
- **Rings that collide at small scale.** The selection ring clears the capital
  ring by a fixed number of *screen pixels*. Scaled with the map, the two
  landed half a pixel apart on a phone and selection became invisible exactly
  where it mattered.
- **Narrowing into hoisted closures.** TypeScript will not narrow a `const`
  that a hoisted function closes over. Bind the checked value to its own
  constant (`const ctx: CanvasRenderingContext2D = context2d`).
- **Per-frame randomness in the renderer.** Column dot positions derive from
  the army id. A `Math.random` there makes columns fizz as they travel.

## Verifying a change in a browser

The dev build exposes `globalThis.__cbw` (`world`, `screenOf(id)`,
`setPaused`, `pointer`, `queued`) so automation can aim a real drag at a real
territory. It is stripped from production by `import.meta.env.DEV`.

```js
const p = await page.evaluate((id) => globalThis.__cbw.screenOf(id), nodeId);
await page.mouse.move(p.x, p.y); await page.mouse.down();
await page.mouse.move(target.x, target.y, { steps: 6 }); await page.mouse.up();
```

An automated tab often reports itself hidden, and the game pauses on
`visibilitychange` by design. Call `globalThis.__cbw.setPaused(false)` between
steps or nothing will advance.

Check both viewports. 390x844 is the one that finds bugs.

## Accessibility

Real `<button>`s with labels; `aria-pressed` on toggles; `radiogroup` for the
nation picker; `polite` live region for order feedback and `alert` for an
inbound warhead; visible focus everywhere; `prefers-reduced-motion` skips map
effects entirely rather than shortening them.

Known gap: the canvas board is not keyboard navigable or exposed to a screen
reader. A parallel DOM tree with roving focus is the fix, and it is on the
roadmap.
