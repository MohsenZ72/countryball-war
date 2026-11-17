/**
 * Playable nations.
 *
 * These are invented states, not real countries. That is deliberate: it keeps
 * the game's identity its own, avoids putting real flags next to a nuclear
 * strike button, and lets the renderer draw every emblem from a tiny spec
 * instead of shipping image assets. See `docs/08-legal-and-ip.md`.
 *
 * `flag` is a key the client resolves in `apps/client/src/render/flags.ts`.
 */

export interface Nation {
  readonly id: string;
  readonly name: string;
  readonly flag: string;
  /** Primary colour, used for territory fills and the HUD. */
  readonly colour: string;
  /** Darker shade for outlines and shadowed sides. */
  readonly shade: string;
}

export const NATIONS: readonly Nation[] = [
  { id: 'brightland', name: 'Brightland', flag: 'brightland', colour: '#f0b429', shade: '#9c7006' },
  { id: 'verdalia', name: 'Verdalia', flag: 'verdalia', colour: '#3fb27f', shade: '#1b6b4a' },
  { id: 'cobalt', name: 'Cobalt Reach', flag: 'cobalt', colour: '#4c8dff', shade: '#1f4ca6' },
  { id: 'crimsonia', name: 'Crimsonia', flag: 'crimsonia', colour: '#ef5350', shade: '#9b2320' },
  { id: 'violetta', name: 'Violetta', flag: 'violetta', colour: '#a06cf0', shade: '#5b2f9c' },
  { id: 'tangerine', name: 'Tangier Isles', flag: 'tangerine', colour: '#ff8a3d', shade: '#a84b11' },
  { id: 'slate', name: 'Slate Union', flag: 'slate', colour: '#8fa3b8', shade: '#4a5a6b' },
  { id: 'teal', name: 'Tealmark', flag: 'teal', colour: '#2fb6c4', shade: '#11636d' },
  { id: 'rose', name: 'Roseland', flag: 'rose', colour: '#f06ea9', shade: '#9c2d63' },
  { id: 'lime', name: 'Limeworth', flag: 'lime', colour: '#b7d94c', shade: '#6d8411' },
  { id: 'indigo', name: 'Indigo Pact', flag: 'indigo', colour: '#6b63f0', shade: '#2e2896' },
  { id: 'sand', name: 'Sandmere', flag: 'sand', colour: '#d9b382', shade: '#8a6a3c' },
];

export function nationById(id: string): Nation | undefined {
  return NATIONS.find((n) => n.id === id);
}

export function nationAt(index: number): Nation {
  const nation = NATIONS[index % NATIONS.length];
  if (!nation) throw new Error('NATIONS must not be empty');
  return nation;
}
