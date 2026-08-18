import { UsersRepository, UserProfile, CaptainProfile, CaptainAvailability } from '../interfaces';
import { getSupabaseClient } from '@/data/supabase/client';
import { mapProfileRowToUserProfile, mapCaptainRowToCaptainProfile } from '@/data/supabase/mappers';
import { Tables } from '@/data/supabase/database.types';

type ProfileRow = Tables<'profiles'>;
type CaptainStatusRow = Tables<'captain_status'>;

export class SupabaseUsersRepository implements UsersRepository {
  async getProfile(userId: string): Promise<UserProfile | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapProfileRowToUserProfile(data as ProfileRow);
  }

  async listCaptains(): Promise<CaptainProfile[]> {
    const client = getSupabaseClient();

    const { data: profiles, error: profilesError } = await client
      .from('profiles')
      .select('*')
      .eq('role', 'captain');

    if (profilesError) throw new Error(profilesError.message);

    const captains = profiles as ProfileRow[];
    if (captains.length === 0) return [];

    const captainIds = captains.map(c => c.id);
    const { data: statuses, error: statusesError } = await client
      .from('captain_status')
      .select('*')
      .in('captain_id', captainIds);

    if (statusesError) throw new Error(statusesError.message);

    const statusMap = new Map((statuses ?? []).map(s => [s.captain_id, s as CaptainStatusRow]));

    return captains.map(profile => {
      const status = statusMap.get(profile.id);
      if (!status) {
        return {
          userId: profile.id,
          name: profile.full_name ?? profile.email,
          availability: 'unavailable',
        };
      }
      return mapCaptainRowToCaptainProfile(profile, status);
    });
  }

  async setCaptainAvailability(status: CaptainAvailability): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.rpc('set_captain_availability', {
      new_availability: status,
    });
    if (error) throw new Error(error.message);
  }
}
