export const deliveryColors = {
  primary: '#0060B8',
  primaryDark: '#003878',
  primaryLight: '#0080D8',
  primarySoft: '#EAF4FC',
  background: '#F7F9FC',
  surface: '#FFFFFF',
  text: '#14213D',
  muted: '#64748B',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
} as const;

export const deliverySpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const deliveryRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const deliveryShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;
