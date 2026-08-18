import { AuthRepository, AppSession } from '../interfaces';

export class InMemoryAuthRepository implements AuthRepository {
  private session: AppSession | null = null;

  constructor(private actor: { userId: string; role: string }) {}

  async getCurrentSession(): Promise<AppSession | null> {
    return this.session;
  }

  async signIn(email: string, _password: string): Promise<AppSession> {
    this.session = {
      userId: this.actor.userId,
      role: this.actor.role as any,
      email,
    };
    return this.session;
  }

  async signOut(): Promise<void> {
    this.session = null;
  }
}
