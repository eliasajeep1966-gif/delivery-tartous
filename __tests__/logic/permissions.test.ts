import { can } from '@/logic/permissions';

function assertEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

export function runPermissionsTests() {
  console.log('Running permissions tests...');

  assertEqual(can('admin', 'manage_users'), true, 'admin should have manage_users');
  assertEqual(can('admin', 'create_orders'), true, 'admin should have create_orders');
  assertEqual(can('admin', 'change_availability'), true, 'admin should have change_availability');

  assertEqual(can('supervisor', 'create_orders'), true, 'supervisor should have create_orders');
  assertEqual(can('supervisor', 'assign_captains'), true, 'supervisor should have assign_captains');
  assertEqual(can('supervisor', 'cancel_orders'), true, 'supervisor should have cancel_orders');
  assertEqual(can('supervisor', 'view_all_orders'), true, 'supervisor should have view_all_orders');
  assertEqual(can('supervisor', 'manage_finances'), true, 'supervisor should have manage_finances');
  assertEqual(can('supervisor', 'manage_users'), false, 'supervisor should not have manage_users');

  assertEqual(can('captain', 'view_own_orders'), true, 'captain should have view_own_orders');
  assertEqual(can('captain', 'change_availability'), true, 'captain should have change_availability');
  assertEqual(can('captain', 'create_orders'), false, 'captain should not have create_orders');
  assertEqual(can('captain', 'cancel_orders'), false, 'captain should not have cancel_orders');
  assertEqual(can('captain', 'assign_captains'), false, 'captain should not have assign_captains');

  console.log('Permissions tests passed.');
}

runPermissionsTests();
