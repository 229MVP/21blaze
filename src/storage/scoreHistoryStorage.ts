import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GameOverReason } from '../game/types';
import { MAX_SCORE_HISTORY, type ScoreEntry } from '../scores/types';

const SCORE_HISTORY_KEY = '@21blaze/scoreHistory';

const VALID_REASONS: readonly GameOverReason[] = [
  'busts',
  'deckEmpty',
  'timeExpired',
  'quit',
];

function asNonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 10) {
    return false;
  }

  const time = Date.parse(value);
  return Number.isFinite(time);
}

function normalizeEntry(value: unknown): ScoreEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Partial<Record<keyof ScoreEntry, unknown>>;
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  const gameOverReason = source.gameOverReason;

  if (!id) {
    return null;
  }

  if (
    typeof gameOverReason !== 'string' ||
    !VALID_REASONS.includes(gameOverReason as GameOverReason)
  ) {
    return null;
  }

  if (!isValidIsoDate(source.completedAt)) {
    return null;
  }

  return {
    id,
    score: asNonNegativeInt(source.score),
    highScoreAtCompletion: asNonNegativeInt(source.highScoreAtCompletion),
    lanesCleared: asNonNegativeInt(source.lanesCleared),
    cardsPlayed: asNonNegativeInt(source.cardsPlayed),
    busts: asNonNegativeInt(source.busts),
    timeRemainingSeconds: asNonNegativeInt(source.timeRemainingSeconds),
    gameOverReason: gameOverReason as GameOverReason,
    completedAt: source.completedAt,
  };
}

export function compareScoreEntries(a: ScoreEntry, b: ScoreEntry): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  if (b.lanesCleared !== a.lanesCleared) {
    return b.lanesCleared - a.lanesCleared;
  }

  if (b.cardsPlayed !== a.cardsPlayed) {
    return b.cardsPlayed - a.cardsPlayed;
  }

  // Earlier completion ranks higher on remaining ties.
  return Date.parse(a.completedAt) - Date.parse(b.completedAt);
}

function sortAndTrim(entries: ScoreEntry[]): ScoreEntry[] {
  return [...entries].sort(compareScoreEntries).slice(0, MAX_SCORE_HISTORY);
}

export async function loadScoreHistory(): Promise<ScoreEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SCORE_HISTORY_KEY);

    if (raw === null) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    const entries = parsed
      .map((item) => normalizeEntry(item))
      .filter((item): item is ScoreEntry => item !== null);

    return sortAndTrim(entries);
  } catch {
    return [];
  }
}

export async function saveScoreEntry(entry: ScoreEntry): Promise<ScoreEntry[]> {
  const normalized = normalizeEntry(entry);

  if (!normalized) {
    return loadScoreHistory();
  }

  try {
    const existing = await loadScoreHistory();

    if (existing.some((item) => item.id === normalized.id)) {
      return existing;
    }

    const next = sortAndTrim([normalized, ...existing]);
    await AsyncStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadScoreHistory();
  }
}

export async function clearScoreHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SCORE_HISTORY_KEY);
  } catch {
    // Ignore persistence failures.
  }
}
