import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppRole } from '@/data/supabase/supabaseContract';

export interface AuthContextValue {
  isBootstrapping: boolean;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  error: string | null;
  needsActivation: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};
