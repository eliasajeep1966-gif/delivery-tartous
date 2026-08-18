import { DeliveryOrder } from './order';

export interface OrderFinancialBreakdown {
  orderId: string;
  orderFee: number;
  captainEarnings: number;
  companyProfit: number;
  adjustmentAmount: number;
}

export interface EarningsSummary {
  captainId: string;
  totalEarnings: number;
  ordersCount: number;
  orders: DeliveryOrder[];
}

export interface CompanyProfitSummary {
  totalProfit: number;
  totalAdjustments: number;
  completedOrdersCount: number;
  falseOrdersCount: number;
  orders: DeliveryOrder[];
}
