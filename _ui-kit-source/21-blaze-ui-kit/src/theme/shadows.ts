
import { Platform } from 'react-native';
export const shadows = {
  panel: Platform.select({ web: { boxShadow: '0 10px 24px rgba(0,0,0,.35)' }, default: { shadowColor: '#000', shadowOpacity: 0.34, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 7 } }),
  glow: Platform.select({ web: { boxShadow: '0 0 18px rgba(255,101,0,.30)' }, default: { shadowColor: '#FF6500', shadowOpacity: 0.34, shadowRadius: 13, shadowOffset: { width: 0, height: 0 }, elevation: 5 } }),
} as const;
