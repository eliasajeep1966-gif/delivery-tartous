import { AuthRepository, OrdersRepository, UsersRepository } from '../interfaces';
import { InMemoryAuthRepository } from './authRepository';
import { InMemoryOrdersRepository } from './ordersRepository';
import { InMemoryUsersRepository } from './usersRepository';

export class MockRepositories {
  static auth: AuthRepository;
  static orders: OrdersRepository;
  static users: UsersRepository;

  static init() {
    this.auth = new InMemoryAuthRepository();
    this.orders = new InMemoryOrdersRepository();
    this.users = new InMemoryUsersRepository();
  }
}

MockRepositories.init();
