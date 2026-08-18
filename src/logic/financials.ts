import { DeliveryOrder, OrderFinancialBreakdown } from '@/types';

export function calculateOrderFinancials(order: DeliveryOrder): OrderFinancialBreakdown {
  if (order.status === 'completed') {
    const captainEarnings = roundToTwo(order.fee * 0.7);
    const companyProfit = roundToTwo(order.fee * 0.3);
    return {
      orderId: order.id,
      orderFee: order.fee,
      captainEarnings,
      companyProfit,
      adjustmentAmount: 0,
    };
  }

  if (order.status === 'false_order') {
    const captainEarnings = roundToTwo(order.fee * 0.7);
    const adjustmentAmount = roundToTwo(order.fee * 0.3);
    return {
      orderId: order.id,
      orderFee: order.fee,
      captainEarnings,
      companyProfit: 0,
      adjustmentAmount,
    };
  }

  return {
    orderId: order.id,
    orderFee: order.fee,
    captainEarnings: 0,
    companyProfit: 0,
    adjustmentAmount: 0,
  };
}

export function summarizeCaptainEarnings(
  orders: DeliveryOrder[],
  captainId: string
): { totalEarnings: number; ordersCount: number } {
  let totalEarnings = 0;
  let ordersCount = 0;

  for (const order of orders) {
    if (order.assignedCaptainId === captainId) {
      const breakdown = calculateOrderFinancials(order);
      totalEarnings += breakdown.captainEarnings;
      ordersCount += 1;
    }
  }

  return {
    totalEarnings: roundToTwo(totalEarnings),
    ordersCount,
  };
}

export function summarizeCompanyProfit(orders: DeliveryOrder[]): {
  totalProfit: number;
  totalAdjustments: number;
  completedOrdersCount: number;
  falseOrdersCount: number;
} {
  let totalProfit = 0;
  let totalAdjustments = 0;
  let completedOrdersCount = 0;
  let falseOrdersCount = 0;

  for (const order of orders) {
    const breakdown = calculateOrderFinancials(order);
    totalProfit += breakdown.companyProfit;
    totalAdjustments += breakdown.adjustmentAmount;

    if (order.status === 'completed') {
      completedOrdersCount += 1;
    }
    if (order.status === 'false_order') {
      falseOrdersCount += 1;
    }
  }

  return {
    totalProfit: roundToTwo(totalProfit),
    totalAdjustments: roundToTwo(totalAdjustments),
    completedOrdersCount,
    falseOrdersCount,
  };
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
