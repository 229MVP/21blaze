import type { Card } from '../../game/types';
import type { CardRank, CardSuit } from './cardTypes';

/** Map engine Card → UI-kit PlayingCard props without changing game types. */
export function toKitCardProps(card: Card): {
  rank: CardRank;
  suit: CardSuit;
} {
  return {
    rank: card.rank,
    suit: card.suit,
  };
}
