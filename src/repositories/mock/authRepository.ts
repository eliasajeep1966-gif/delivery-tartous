import { AuthRepository, AppSession } from '../interfaces';

export class InMemoryAuthRepository implements AuthRepository {
  private session: AppSession | null = null;

  async getCurrentSession(): Promise<AppSession | null> {
    return this.session;
  }

  async signIn(email: string, _password: string): Promise<AppSession> {
    this.session = {
      userId: 'mock-user-1',
      role: 'admin',
      email,
    };
    return this.session;
  }

  async signOut(): Promise<void> {
    this.session = null;
  }
}
