import { UserRole, Permission } from '@/types';

export function can(role: UserRole, permission: Permission): boolean {
  switch (role) {
    case 'admin':
      return true;
    case 'supervisor':
      return (
        permission === 'create_orders' ||
        permission === 'assign_captains' ||
        permission === 'cancel_orders' ||
        permission === 'view_all_orders' ||
        permission === 'manage_finances'
      );
    case 'captain':
      return (
        permission === 'view_own_orders' ||
        permission === 'change_availability'
      );
    default:
      return false;
  }
}
