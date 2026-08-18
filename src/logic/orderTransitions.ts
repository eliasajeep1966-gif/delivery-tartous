import {
  OrderStatus,
  DeliveryOrder,
  TransitionResult,
  ChangeOrderStatusInput,
} from '@/types';

export function canTransitionOrder(
  actor: { role: string; userId: string },
  order: DeliveryOrder,
  nextStatus: OrderStatus
): TransitionResult {
  if (isFinalState(order.status)) {
    return { allowed: false, reason: 'final_state_transition' };
  }

  if (isFinalState(nextStatus) && order.status === nextStatus) {
    return { allowed: false, reason: 'already_in_final_state' };
  }

  switch (nextStatus) {
    case 'assigned':
      if (order.status !== 'pending') {
        return { allowed: false, reason: 'invalid_source_status' };
      }
      if (actor.role !== 'admin' && actor.role !== 'supervisor') {
        return { allowed: false, reason: 'actor_not_authorized' };
      }
      return { allowed: true };

    case 'received':
      if (order.status !== 'assigned') {
        return { allowed: false, reason: 'invalid_source_status' };
      }
      if (order.assignedCaptainId !== actor.userId) {
        return { allowed: false, reason: 'actor_not_assigned_captain' };
      }
      return { allowed: true };

    case 'in_delivery':
      if (order.status !== 'received') {
        return { allowed: false, reason: 'invalid_source_status' };
      }
      if (order.assignedCaptainId !== actor.userId) {
        return { allowed: false, reason: 'actor_not_assigned_captain' };
      }
      return { allowed: true };

    case 'completed':
      if (order.status !== 'in_delivery') {
        return { allowed: false, reason: 'invalid_source_status' };
      }
      if (order.assignedCaptainId !== actor.userId) {
        return { allowed: false, reason: 'actor_not_assigned_captain' };
      }
      return { allowed: true };

    case 'cancelled':
      if (
        order.status !== 'pending' &&
        order.status !== 'assigned' &&
        order.status !== 'received' &&
        order.status !== 'in_delivery'
      ) {
        return { allowed: false, reason: 'invalid_source_status' };
      }
      if (actor.role !== 'admin' && actor.role !== 'supervisor') {
        return { allowed: false, reason: 'actor_not_authorized' };
      }
      return { allowed: true };

    case 'false_order':
      if (
        order.status !== 'assigned' &&
        order.status !== 'received' &&
        order.status !== 'in_delivery'
      ) {
        return { allowed: false, reason: 'invalid_source_status' };
      }
      if (order.assignedCaptainId !== actor.userId) {
        return { allowed: false, reason: 'actor_not_assigned_captain' };
      }
      return { allowed: true };

    default:
      return { allowed: false, reason: 'unknown_target_status' };
  }
}

export function transitionOrder(
  order: DeliveryOrder,
  actor: { role: string; userId: string },
  input: ChangeOrderStatusInput
): DeliveryOrder {
  const result = canTransitionOrder(actor, order, input.nextStatus);
  if (!result.allowed) {
    return order;
  }

  const now = new Date().toISOString();
  const updated: DeliveryOrder = {
    ...order,
    status: input.nextStatus,
    updatedAt: now,
  };

  if (input.nextStatus === 'cancelled') {
    if (!input.cancellationReason) {
      return order;
    }
    updated.cancellationReason = input.cancellationReason;
  }

  if (input.nextStatus === 'completed') {
    updated.completedAt = now;
  }

  return updated;
}

function isFinalState(status: OrderStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'false_order';
}
