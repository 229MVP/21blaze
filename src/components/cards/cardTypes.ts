
export type CardRank = 'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K';
export type CardSuit = 'hearts'|'diamonds'|'clubs'|'spades';
export type CardSize = 'tiny'|'small'|'medium'|'large';
export type CardModel = { rank: CardRank; suit: CardSuit };
