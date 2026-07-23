
import type { CardRank, CardSuit } from './cardTypes';
export const suitSymbol: Record<CardSuit,string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
export const rankName: Record<CardRank,string> = { A:'Ace','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine','10':'Ten',J:'Jack',Q:'Queen',K:'King' };
export const cardAccessibilityLabel = (rank: CardRank, suit: CardSuit) => `${rankName[rank]} of ${suit[0].toUpperCase()}${suit.slice(1)}`;
