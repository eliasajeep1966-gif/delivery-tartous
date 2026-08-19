import { AppRole } from '@/data/supabase/supabaseContract';

export type AppRoute =
  | '/'
  | '/login'
  | '/activate-account'
  | '/admin'
  | '/supervisor'
  | '/captain';

export function resolveRouteForRole(role: AppRole): AppRoute {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'supervisor':
      return '/supervisor';
    case 'captain':
      return '/captain';
    default:
      return '/';
  }
}
