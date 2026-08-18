import { UserRole, CaptainAvailability } from '@/types';

export function canAssignCaptain(
  actor: { role: UserRole },
  captainAvailability: CaptainAvailability
): boolean {
  if (actor.role !== 'admin' && actor.role !== 'supervisor') {
    return false;
  }
  return captainAvailability === 'available';
}
