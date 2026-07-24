
export const colors = {
  background: { primary: '#050709', secondary: '#0A0D10', panel: '#15181B', elevated: '#1C2024' },
  fire: { ember: '#8C1A05', red: '#D22C08', orange: '#FF6500', brightOrange: '#FF8A00', gold: '#FFB629', pale: '#FFF0C7' },
  text: { primary: '#F8F5EE', secondary: '#B9BEC5', muted: '#747B83', inverse: '#14100C' },
  border: { default: '#34393F', orange: 'rgba(255,138,0,0.40)', active: '#FFB629', danger: '#E62D1B' },
  status: { success: '#42C76A', warning: '#FFB629', danger: '#FF3426', info: '#4AB4FF' },
  suits: { red: '#D92222', black: '#121416' },
  transparent: 'transparent',
} as const;
export type BlazeColors = typeof colors;
