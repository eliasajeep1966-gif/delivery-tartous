import { AuthRepository, AppSession } from '../interfaces';
import { getSupabaseClient } from '@/data/supabase/client';
import { UserRole } from '@/types';

export class SupabaseAuthRepository implements AuthRepository {
  async getCurrentSession(): Promise<AppSession | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) return null;

    const userId = data.session.user.id;
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !profile) return null;

    return {
      userId,
      role: profile.role as UserRole,
      email: data.session.user.email ?? '',
    };
  }

  async signIn(email: string, password: string): Promise<AppSession> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message ?? 'Sign in failed');
    }

    const userId = data.user.id;
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    return {
      userId,
      role: profile.role as UserRole,
      email: data.user.email ?? '',
    };
  }

  async signOut(): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) throw new Error(error.message);
  }
}
