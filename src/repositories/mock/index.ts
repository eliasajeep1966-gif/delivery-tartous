import { AuthRepository, OrdersRepository, UsersRepository } from '../interfaces';
import { ActorContext } from '@/types';
import { InMemoryAuthRepository } from './authRepository';
import { InMemoryOrdersRepository } from './ordersRepository';
import { InMemoryUsersRepository } from './usersRepository';

export class MockRepositories {
  static auth: AuthRepository;
  static orders: OrdersRepository;
  static users: UsersRepository;

  static init(actor: ActorContext) {
    this.auth = new InMemoryAuthRepository(actor);
    this.orders = new InMemoryOrdersRepository(actor);
    this.users = new InMemoryUsersRepository();
  }
}
