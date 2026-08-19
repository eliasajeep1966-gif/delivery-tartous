import { resolveRouteForRole } from '@/features/auth/roleRouting';

function assertEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

export function runRoleRoutingTests() {
  console.log('Running role routing tests...');

  assertEqual(resolveRouteForRole('admin'), '/admin', 'admin should route to /admin');
  assertEqual(resolveRouteForRole('supervisor'), '/supervisor', 'supervisor should route to /supervisor');
  assertEqual(resolveRouteForRole('captain'), '/captain', 'captain should route to /captain');
  assertEqual(resolveRouteForRole('unknown' as any), '/', 'unknown role should fallback to /');

  console.log('Role routing tests passed.');
}

runRoleRoutingTests();
