/**
 * Command validation and application.
 *
 * Every player and bot action goes through `applyCommand`, so the rules live in
 * exactly one place and the UI can never produce an illegal state. A rejected
 * command pushes a `rejected` event with a human-readable reason instead of
 * throwing: a mis-aimed drag is a normal thing for a player to do.
 */

import { BALANCE, upgradeCostOf, type Balance } from '../config.js';
import { dist } from '../map/generate.js';
import type { Army, Command, Missile, NodeLevel, World } from '../types.js';

export function applyCommand(world: World, command: Command, balance: Balance = BALANCE): void {
  switch (command.kind) {
    case 'send':
      applySend(world, command, balance);
      return;
    case 'upgrade':
      applyUpgrade(world, command, balance);
      return;
    case 'nuke':
      applyNuke(world, command, balance);
      return;
  }
}

/** Troops a node would actually dispatch at `ratio`, or 0 if it cannot. */
export function sendableFrom(troops: number, ratio: number, balance: Balance = BALANCE): number {
  const wanted = Math.floor(troops * ratio);
  const allowed = Math.floor(troops - balance.garrisonFloor);
  return Math.max(0, Math.min(wanted, allowed));
}

/**
 * A multi-source send is ONE assault, not several.
 *
 * Every column in the order is given the slowest column's travel time, so they
 * all land on the same step. Without this, pooling was a trap: a player who
 * followed the game's own advice and tapped six territories watched six
 * columns trickle into a fort one at a time and get cut down individually,
 * with nothing on screen explaining why. The rule the game teaches has to be
 * the rule the game runs.
 *
 * The closer columns are visibly slower, travelling as a group, which also
 * reads correctly: an army moves at the pace of its slowest part.
 */
function applySend(
  world: World,
  command: Extract<Command, { kind: 'send' }>,
  balance: Balance,
): void {
  const target = world.nodes[command.to];
  if (!target) {
    reject(world, 'no such target node');
    return;
  }
  if (command.ratio <= 0 || command.ratio > 1) {
    reject(world, 'send ratio must be in (0, 1]');
    return;
  }

  // Gather first so the slowest march can set the pace for the whole assault.
  const unique = [...new Set(command.from)];
  const parts: { from: number; count: number; duration: number }[] = [];
  for (const fromId of unique) {
    if (fromId === command.to) continue;
    const source = world.nodes[fromId];
    if (!source || source.owner !== command.faction) continue;
    const count = sendableFrom(source.troops, command.ratio, balance);
    if (count < 1) continue;
    parts.push({ from: fromId, count, duration: marchDuration(dist(source.pos, target.pos), balance) });
  }

  if (parts.length === 0) {
    reject(world, 'no garrison could spare troops');
    return;
  }

  const duration = Math.max(...parts.map((p) => p.duration));
  for (const part of parts) {
    const source = world.nodes[part.from];
    if (!source) continue;
    source.troops -= part.count;
    const army: Army = {
      id: world.nextEntityId++,
      owner: command.faction,
      from: part.from,
      to: command.to,
      count: part.count,
      progress: 0,
      duration,
    };
    world.armies.push(army);
    world.events.push({ kind: 'launched', army: army.id, owner: command.faction, at: world.time });
  }
}

export function marchDuration(distance: number, balance: Balance = BALANCE): number {
  const raw = distance / balance.marchSpeed;
  return Math.min(balance.marchDuration.max, Math.max(balance.marchDuration.min, raw));
}

function applyUpgrade(
  world: World,
  command: Extract<Command, { kind: 'upgrade' }>,
  balance: Balance,
): void {
  const node = world.nodes[command.node];
  if (!node || node.owner !== command.faction) {
    reject(world, 'can only upgrade a node you hold');
    return;
  }
  if (node.falloutFor > 0) {
    reject(world, 'node is in fallout');
    return;
  }
  const cost = upgradeCostOf(node.level, node.kind, balance);
  if (cost === null) {
    reject(world, 'node is already at the top level');
    return;
  }
  if (node.troops < cost + balance.garrisonFloor) {
    reject(world, 'not enough troops to upgrade');
    return;
  }
  node.troops -= cost;
  node.level = (node.level + 1) as NodeLevel;
  world.events.push({ kind: 'upgraded', node: node.id, to: node.level, at: world.time });
}

function applyNuke(
  world: World,
  command: Extract<Command, { kind: 'nuke' }>,
  balance: Balance,
): void {
  const faction = world.factions[command.faction];
  const silo = world.nodes[command.from];
  const target = world.nodes[command.to];
  if (!faction || !silo || !target) {
    reject(world, 'bad launch request');
    return;
  }
  if (silo.owner !== command.faction) {
    reject(world, 'launch site must be yours');
    return;
  }
  if (faction.charges < balance.nuke.cost) {
    reject(world, 'no warhead ready');
    return;
  }
  if (target.owner === command.faction) {
    reject(world, 'cannot strike your own territory');
    return;
  }
  if (target.falloutFor > 0) {
    reject(world, 'target is already in fallout');
    return;
  }
  const range = dist(silo.pos, target.pos);
  if (range < balance.nuke.minRange) {
    reject(world, 'target is inside the minimum range');
    return;
  }

  faction.charges -= balance.nuke.cost;
  const missile: Missile = {
    id: world.nextEntityId++,
    owner: command.faction,
    from: command.from,
    to: command.to,
    progress: 0,
    duration: balance.nuke.flightTime,
  };
  world.missiles.push(missile);
  world.events.push({ kind: 'nuke-launched', owner: command.faction, to: command.to, at: world.time });
}

function reject(world: World, reason: string): void {
  world.events.push({ kind: 'rejected', reason, at: world.time });
}
