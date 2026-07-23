export const colors = {
  background: '#070707',
  backgroundSecondary: '#111111',
  backgroundCard: '#181818',
  backgroundElevated: '#1D1D1D',

  primary: '#FF6500',
  brightOrange: '#FF8A00',
  secondary: '#FFB629',
  gold: '#FFB629',
  deepRed: '#C51A0A',
  danger: '#FF2929',
  warningRed: '#FF2929',
  success: '#2ECC71',
  successBadgeBg: '#1A7A1A',
  successBadgeText: '#4AFF4A',

  textPrimary: '#FFFFFF',
  textSecondary: '#B7B7B7',
  textMuted: '#747474',
  textDisabled: '#666666',

  border: 'rgba(255,132,0,0.35)',
  blazeSubtle: 'rgba(255,132,0,0.35)',
  blazeStrong: 'rgba(255,132,0,0.70)',
  whiteSubtle: 'rgba(255,255,255,0.08)',

  cardFace: '#FFFFFF',
  cardFaceAlt: '#F0F0F0',
  cardInk: '#111111',
  cardInkRed: '#CC1111',
  cardBorder: '#CCCCCC',

  overlay: 'rgba(0, 0, 0, 0.72)',
  buttonDisabled: '#3A3A3A',
  flameInactive: '#333333',
} as const;

export type ColorName = keyof typeof colors;
