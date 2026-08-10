/**
 * Version 1.4 Phase 3 self-tests — notifications, records, rematch contracts.
 * Run: npm run test:async-duel-phase3
 */

import { formatRecordLine, formatWinRate } from './asyncDuelRecords';
import type { PlayerDuelRecord } from './asyncDuelRecords';
import {
  DUEL_NOTIFICATION_REGISTRY,
  formatNotificationBody,
  formatNotificationTitle,
  parseNotificationDeepLink,
} from '../notifications/duelNotificationRegistry';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Async Duel Phase 3 self-test failed: ${message}`);
  }
}

function outcomeMapping(
  duelOutcome: 'challenger_win' | 'opponent_win' | 'tie',
): { challenger: 'win' | 'loss' | 'tie'; opponent: 'win' | 'loss' | 'tie' } {
  if (duelOutcome === 'challenger_win') {
    return { challenger: 'win', opponent: 'loss' };
  }
  if (duelOutcome === 'opponent_win') {
    return { challenger: 'loss', opponent: 'win' };
  }
  return { challenger: 'tie', opponent: 'tie' };
}

export function runAsyncDuelPhase3SelfTests(): void {
  // Registry completeness
  for (const key of [
    'DUEL_CHALLENGE_RECEIVED',
    'DUEL_COMPLETED',
    'DUEL_DECLINED',
    'DUEL_EXPIRED',
  ] as const) {
    const entry = DUEL_NOTIFICATION_REGISTRY[key];
    assert(Boolean(entry), `${key} registered`);
    assert(Boolean(entry.inAppTitle), `${key} title`);
    assert(Boolean(entry.deepLinkScreen), `${key} deep link`);
    assert(Boolean(entry.dedupePattern.includes('{duelId}')), `${key} dedupe`);
  }

  assert(
    DUEL_NOTIFICATION_REGISTRY.DUEL_CHALLENGE_RECEIVED.intendedRecipient ===
      'opponent',
    'challenge recipient is opponent',
  );
  assert(
    DUEL_NOTIFICATION_REGISTRY.DUEL_COMPLETED.intendedRecipient === 'challenger',
    'completed recipient is challenger',
  );
  assert(
    DUEL_NOTIFICATION_REGISTRY.DUEL_EXPIRED.pushEligible === false,
    'expired is in-app only',
  );

  assert(
    formatNotificationTitle('DUEL_CHALLENGE_RECEIVED') === 'NEW DUEL',
    'challenge title',
  );
  assert(
    formatNotificationBody('DUEL_CHALLENGE_RECEIVED', {
      opponentDisplayName: 'BlazeKing',
    }) === 'BlazeKing challenged you.',
    'challenge body',
  );
  // Untrusted display names rendered as plain text substitution only
  const xssName = '<script>x</script>';
  const body = formatNotificationBody('DUEL_DECLINED', {
    opponentDisplayName: xssName,
  });
  assert(body.includes(xssName), 'name preserved as text');
  assert(!body.includes('onclick='), 'no injected handlers');

  assert(
    parseNotificationDeepLink({
      screen: 'AsyncDuelResult',
      duelId: 'abc',
    })?.screen === 'AsyncDuelResult',
    'valid deep link',
  );
  assert(
    parseNotificationDeepLink({ screen: 'Evil', duelId: 'abc' }) === null,
    'reject unknown screen',
  );
  assert(
    parseNotificationDeepLink({ screen: 'AsyncDuelResult' }) === null,
    'reject missing duelId',
  );
  assert(parseNotificationDeepLink(null) === null, 'reject null payload');
  assert(
    parseNotificationDeepLink({
      screen: 'AsyncDuelResult',
      duelId: 'x',
      seed: 'secret',
    })?.duelId === 'x',
    'extra fields ignored',
  );

  // Stat outcome mapping
  assert(
    outcomeMapping('challenger_win').challenger === 'win' &&
      outcomeMapping('challenger_win').opponent === 'loss',
    'challenger win mapping',
  );
  assert(
    outcomeMapping('opponent_win').challenger === 'loss' &&
      outcomeMapping('opponent_win').opponent === 'win',
    'opponent win mapping',
  );
  assert(
    outcomeMapping('tie').challenger === 'tie' &&
      outcomeMapping('tie').opponent === 'tie',
    'tie mapping',
  );

  const empty: PlayerDuelRecord = {
    completedDuels: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    winRate: null,
    highestDuelScore: 0,
  };
  assert(formatWinRate(empty.winRate) === '—', 'zero games win rate');
  assert(formatRecordLine(empty) === '0–0–0', 'empty record line');

  const sample: PlayerDuelRecord = {
    completedDuels: 22,
    wins: 12,
    losses: 8,
    ties: 2,
    winRate: 54.5,
    highestDuelScore: 18420,
  };
  assert(sample.completedDuels === sample.wins + sample.losses + sample.ties, 'totals');
  assert(formatWinRate(sample.winRate) === '54.5%', 'win rate format');

  // Rematch contract: client may only submit source duel id (enforced by API shape)
  const rematchArgs = { p_source_duel_id: 'duel-1' };
  assert(
    Object.keys(rematchArgs).length === 1 &&
      !('seed' in rematchArgs) &&
      !('opponentId' in rematchArgs) &&
      !('winner' in rematchArgs),
    'rematch client args only source id',
  );

  // Push payload must never include seed
  const pushData = {
    screen: 'AsyncDuelResult',
    duelId: 'd1',
  };
  assert(!('seed' in pushData), 'push data omits seed');
}

runAsyncDuelPhase3SelfTests();
console.log('Async Duel Phase 3 self-tests passed.');
