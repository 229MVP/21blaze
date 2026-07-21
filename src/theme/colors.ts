export const colors = {
  background: '#0A0A0A',
  backgroundSecondary: '#1A1A1A',
  primary: '#FF6A00',
  secondary: '#FFB347',
  textPrimary: '#FFFFFF',
  textSecondary: '#9A9A9A',
  success: '#2ECC71',
  danger: '#E74C3C',
  border: '#2A2A2A',
  overlay: 'rgba(0, 0, 0, 0.5)',
  buttonDisabled: '#3A3A3A',
} as const;

export type ColorName = keyof typeof colors;
