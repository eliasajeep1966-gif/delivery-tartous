import {
  canTransitionOrder,
  transitionOrder,
} from '@/logic/orderTransitions';
import { DeliveryOrder, ActorContext } from '@/types';

function createOrder(overrides: Partial<DeliveryOrder> = {}): DeliveryOrder {
  return {
    id: 'order-1',
    orderNumber: 'ORD-001',
    customerName: 'Customer',
    customerPhone: '123',
    pickupAddress: 'A',
    deliveryAddress: 'B',
    fee: 100,
    status: 'pending',
    assignedCaptainId: null,
    createdByUserId: 'user-1',
    cancellationReason: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    completedAt: null,
    ...overrides,
  };
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

function assertFalse(value: any, message?: string) {
  if (value !== false) {
    throw new Error(message || `Expected false but got ${value}`);
  }
}

function assertTrue(value: any, message?: string) {
  if (value !== true) {
    throw new Error(message || `Expected true but got ${value}`);
  }
}

export function runOrderTransitionTests() {
  console.log('Running order transition tests...');

  assertFalse(
    canTransitionOrder({ role: 'captain', userId: 'captain-1' }, createOrder(), 'assigned').allowed,
    'captain cannot assign an order'
  );

  assertFalse(
    canTransitionOrder(
      { role: 'captain', userId: 'captain-1' },
      createOrder({ status: 'assigned', assignedCaptainId: 'captain-2' }),
      'received'
    ).allowed,
    'unassigned captain cannot transition order status'
  );

  assertFalse(
    canTransitionOrder(
      { role: 'captain', userId: 'captain-1' },
      createOrder({ status: 'completed', assignedCaptainId: 'captain-1' }),
      'in_delivery'
    ).allowed,
    'cannot transition from completed to any state'
  );

  assertTrue(
    canTransitionOrder({ role: 'admin', userId: 'admin-1' }, createOrder(), 'cancelled').allowed,
    'cancellation requires reason from admin or supervisor'
  );

  assertFalse(
    canTransitionOrder({ role: 'captain', userId: 'captain-1' }, createOrder(), 'cancelled').allowed,
    'captain cannot cancel order'
  );

  assertFalse(
    canTransitionOrder(
      { role: 'supervisor', userId: 'supervisor-1' },
      createOrder({ status: 'assigned', assignedCaptainId: 'captain-1' }),
      'received'
    ).allowed,
    'supervisor cannot perform captain-only transition received'
  );

  assertFalse(
    canTransitionOrder(
      { role: 'supervisor', userId: 'supervisor-1' },
      createOrder({ status: 'received', assignedCaptainId: 'captain-1' }),
      'in_delivery'
    ).allowed,
    'supervisor cannot perform captain-only transition in_delivery'
  );

  assertFalse(
    canTransitionOrder(
      { role: 'supervisor', userId: 'supervisor-1' },
      createOrder({ status: 'in_delivery', assignedCaptainId: 'captain-1' }),
      'completed'
    ).allowed,
    'supervisor cannot perform captain-only transition completed'
  );

  assertFalse(
    canTransitionOrder(
      { role: 'supervisor', userId: 'supervisor-1' },
      createOrder({ status: 'assigned', assignedCaptainId: 'captain-1' }),
      'false_order'
    ).allowed,
    'supervisor cannot perform captain-only transition false_order'
  );

  const originalOrder = createOrder({ status: 'completed' });
  const result = transitionOrder(
    originalOrder,
    { role: 'captain', userId: 'captain-1' },
    { orderId: 'order-1', nextStatus: 'in_delivery', actorId: 'captain-1' }
  );
  assertEqual(result, originalOrder, 'returns original order when transition not allowed');

  console.log('Order transition tests passed.');
}

runOrderTransitionTests();
