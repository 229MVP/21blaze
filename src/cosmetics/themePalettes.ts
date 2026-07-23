import type { CardStyle } from '../settings/types';

export type CosmeticCardThemeKey =
  | CardStyle
  | 'classic_cards'
  | 'inferno_cards'
  | 'blue_flame_cards'
  | 'lava_gold_cards'
  | 'midnight_cards'
  | 'ember_card_back'
  | 'flame_card_face'
  | 'veteran_blazer_card_back'
  | 'level_50_champion_card_back';

export type CardThemePalette = {
  face: [string, string];
  border: string;
  redSuit: string;
  blackSuit: string;
  glow: boolean;
};

const PALETTES: Record<string, CardThemePalette> = {
  classic: {
    face: ['#FFFFFF', '#F0F0F0'],
    border: '#CCCCCC',
    redSuit: '#CC1111',
    blackSuit: '#111111',
    glow: false,
  },
  classic_cards: {
    face: ['#FFFFFF', '#F0F0F0'],
    border: '#CCCCCC',
    redSuit: '#CC1111',
    blackSuit: '#111111',
    glow: false,
  },
  blaze: {
    face: ['#FFF8F0', '#FFE8D4'],
    border: '#FF6500',
    redSuit: '#CC1111',
    blackSuit: '#111111',
    glow: true,
  },
  midnight: {
    face: ['#1A1A1A', '#121212'],
    border: 'rgba(255,255,255,0.28)',
    redSuit: '#FF5A5A',
    blackSuit: '#E8E8E8',
    glow: false,
  },
  midnight_cards: {
    face: ['#1A1A1A', '#121212'],
    border: 'rgba(255,255,255,0.28)',
    redSuit: '#FF5A5A',
    blackSuit: '#E8E8E8',
    glow: false,
  },
  inferno_cards: {
    face: ['#FFF5EB', '#FFD0A8'],
    border: '#FF6500',
    redSuit: '#C51A0A',
    blackSuit: '#2A1208',
    glow: true,
  },
  blue_flame_cards: {
    face: ['#F2F8FF', '#D6E8FF'],
    border: '#4DA3FF',
    redSuit: '#E11D48',
    blackSuit: '#0F172A',
    glow: true,
  },
  lava_gold_cards: {
    face: ['#FFF8E7', '#FFE6A8'],
    border: '#FFB629',
    redSuit: '#B45309',
    blackSuit: '#1C1917',
    glow: true,
  },
  ember_card_back: {
    face: ['#FFF4EC', '#FFD8B8'],
    border: '#FF8A00',
    redSuit: '#C51A0A',
    blackSuit: '#2A1208',
    glow: true,
  },
  flame_card_face: {
    face: ['#FFF8F0', '#FFC48A'],
    border: '#FF6500',
    redSuit: '#E11D48',
    blackSuit: '#1A0F0A',
    glow: true,
  },
  veteran_blazer_card_back: {
    face: ['#FFF7ED', '#FED7AA'],
    border: '#EA580C',
    redSuit: '#B91C1C',
    blackSuit: '#1C1917',
    glow: true,
  },
  level_50_champion_card_back: {
    face: ['#FFFBEB', '#FDE68A'],
    border: '#F59E0B',
    redSuit: '#B91C1C',
    blackSuit: '#292524',
    glow: true,
  },
};

export function paletteForCardTheme(themeKey: string): CardThemePalette {
  return PALETTES[themeKey] ?? PALETTES.classic_cards!;
}

export type ArenaThemeKey =
  | 'default_arena'
  | 'volcano_arena'
  | 'neon_casino_arena'
  | 'ember_arena'
  | 'default';

export type ArenaPalette = {
  topGlow: string;
  bottomGlow: string;
  emberColor: string;
};

export function paletteForArena(arenaKey: string): ArenaPalette {
  switch (arenaKey) {
    case 'volcano_arena':
      return {
        topGlow: 'rgba(255,80,0,0.28)',
        bottomGlow: 'rgba(180,20,0,0.35)',
        emberColor: '#FF6500',
      };
    case 'neon_casino_arena':
      return {
        topGlow: 'rgba(80,120,255,0.22)',
        bottomGlow: 'rgba(255,40,160,0.28)',
        emberColor: '#FF4FD8',
      };
    case 'ember_arena':
      return {
        topGlow: 'rgba(255,140,40,0.18)',
        bottomGlow: 'rgba(180,60,10,0.22)',
        emberColor: '#FF8A00',
      };
    default:
      return {
        topGlow: 'rgba(255,101,0,0.14)',
        bottomGlow: 'rgba(197,26,10,0.12)',
        emberColor: '#FF6500',
      };
  }
}
