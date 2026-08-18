import { UsersRepository, UserProfile, CaptainProfile, CaptainAvailability } from '../interfaces';

export class InMemoryUsersRepository implements UsersRepository {
  private profiles: Map<string, UserProfile> = new Map();
  private captains: Map<string, CaptainProfile> = new Map();
  private availabilities: Map<string, CaptainAvailability> = new Map();

  async getProfile(userId: string): Promise<UserProfile | null> {
    return this.profiles.get(userId) ?? null;
  }

  async listCaptains(): Promise<CaptainProfile[]> {
    return Array.from(this.captains.values());
  }

  async setCaptainAvailability(status: CaptainAvailability): Promise<void> {
    this.availabilities.set('current-captain', status);
  }
}
