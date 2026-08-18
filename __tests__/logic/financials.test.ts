import { calculateOrderFinancials } from '@/logic/financials';
import { DeliveryOrder } from '@/types';

function createOrder(status: DeliveryOrder['status'], fee = 100): DeliveryOrder {
  return {
    id: 'order-1',
    orderNumber: 'ORD-001',
    customerName: 'Customer',
    customerPhone: '123',
    pickupAddress: 'A',
    deliveryAddress: 'B',
    fee,
    status,
    assignedCaptainId: 'captain-1',
    createdByUserId: 'user-1',
    cancellationReason: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    completedAt: null,
  };
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

export function runFinancialsTests() {
  console.log('Running financials tests...');

  const completed = calculateOrderFinancials(createOrder('completed'));
  assertEqual(completed.captainEarnings, 70, 'completed captainEarnings should be 70');
  assertEqual(completed.companyProfit, 30, 'completed companyProfit should be 30');
  assertEqual(completed.adjustmentAmount, 0, 'completed adjustmentAmount should be 0');

  const falseOrder = calculateOrderFinancials(createOrder('false_order'));
  assertEqual(falseOrder.captainEarnings, 70, 'false_order captainEarnings should be 70');
  assertEqual(falseOrder.companyProfit, 0, 'false_order companyProfit should be 0');
  assertEqual(falseOrder.adjustmentAmount, 30, 'false_order adjustmentAmount should be 30');

  const cancelled = calculateOrderFinancials(createOrder('cancelled'));
  assertEqual(cancelled.captainEarnings, 0, 'cancelled captainEarnings should be 0');
  assertEqual(cancelled.companyProfit, 0, 'cancelled companyProfit should be 0');
  assertEqual(cancelled.adjustmentAmount, 0, 'cancelled adjustmentAmount should be 0');

  const pending = calculateOrderFinancials(createOrder('pending'));
  assertEqual(pending.captainEarnings, 0, 'pending captainEarnings should be 0');
  assertEqual(pending.companyProfit, 0, 'pending companyProfit should be 0');
  assertEqual(pending.adjustmentAmount, 0, 'pending adjustmentAmount should be 0');

  const rounded = calculateOrderFinancials(createOrder('completed', 99));
  assertEqual(rounded.captainEarnings, 69.3, 'rounded captainEarnings should be 69.3');
  assertEqual(rounded.companyProfit, 29.7, 'rounded companyProfit should be 29.7');

  console.log('Financials tests passed.');
}

runFinancialsTests();
