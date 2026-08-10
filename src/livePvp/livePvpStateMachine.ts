import type { LiveMatchStatus } from './livePvpTypes';

const TERMINAL: ReadonlySet<LiveMatchStatus> = new Set([
  'completed',
  'declined',
  'cancelled',
  'expired',
  'invalid',
]);

const ALLOWED: ReadonlyArray<readonly [LiveMatchStatus, LiveMatchStatus]> = [
  ['invited', 'lobby'],
  ['invited', 'declined'],
  ['invited', 'cancelled'],
  ['invited', 'expired'],
  ['invited', 'invalid'],
  ['lobby', 'countdown'],
  ['lobby', 'cancelled'],
  ['lobby', 'expired'],
  ['lobby', 'invalid'],
  ['countdown', 'active'],
  ['countdown', 'settling'],
  ['countdown', 'invalid'],
  ['active', 'settling'],
  ['active', 'invalid'],
  ['settling', 'completed'],
  ['settling', 'invalid'],
];

export function isLivePvpTransitionAllowed(
  from: LiveMatchStatus,
  to: LiveMatchStatus,
): boolean {
  if (from === to) {
    return true;
  }
  if (TERMINAL.has(from)) {
    return false;
  }
  return ALLOWED.some(([a, b]) => a === from && b === to);
}

export function isLivePvpTerminalStatus(status: LiveMatchStatus): boolean {
  return TERMINAL.has(status);
}
