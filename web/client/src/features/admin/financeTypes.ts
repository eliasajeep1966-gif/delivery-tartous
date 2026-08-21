export type FinanceOrderStatus = 'completed' | 'false_order';

export type FinanceLedgerRow = {
  financialLedgerId: string;
  orderId: string;
  orderNumber: number;
  captainId: string;
  captainName: string;
  status: FinanceOrderStatus;
  grossFee: number;
  captainAmount: number;
  companyAmount: number;
  settlementAmount: number;
  completedAt: string;
  paidAmount: number;
  unpaidAmount: number;
  isFullyPaid: boolean;
  latestPayoutId: string | null;
  latestPaidAt: string | null;
};

export type CaptainFinanceCard = {
  captainId: string;
  captainName: string;
  initial: string;
  orderCount: number;
  grossTotal: number;
  captainNetTotal: number;
  paidTotal: number;
  unpaidTotal: number;
  rows: FinanceLedgerRow[];
};

export type CaptainDetailsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; rows: FinanceLedgerRow[] }
  | { status: 'error'; message: string };

export type FinanceTotals = {
  grossTotal: number;
  captainNetTotal: number;
  companyTotal: number;
  settlementTotal: number;
  paidTotal: number;
  unpaidTotal: number;
};

export type CompanyProfitPeriod = 'daily' | 'weekly' | 'monthly';
export type CompanyProfitHistoryRow = {
  businessDay: string;
  grossTotal: number;
  companyTotal: number;
  captainNetTotal: number;
  settlementTotal: number;
  orderCount: number;
};
export type CompanyProfitPeriodHistoryRow = {
  periodStart: string;
  periodEnd: string;
  grossTotal: number;
  companyTotal: number;
  captainNetTotal: number;
  settlementTotal: number;
  orderCount: number;
};

export type CompanyProfitDayDetailRow = {
  financialLedgerId: string;
  completedAt: string;
  orderId: string;
  orderNumber: number;
  captainId: string;
  captainName: string;
  grossFee: number;
  captainAmount: number;
  companyAmount: number;
  settlementAmount: number;
  status: FinanceOrderStatus;
};

export type CompanyProfitDayDetailsState =
  | { status: 'idle' }
  | { status: 'loading'; day: string }
  | { status: 'loaded'; day: string; rows: CompanyProfitDayDetailRow[]; hasMore: boolean; nextBeforeCompletedAt: string | null; nextBeforeLedgerId: string | null }
  | { status: 'error'; day: string; message: string };

export type FinanceSnapshot = {
  totals: FinanceTotals;
  captains: CaptainFinanceCard[];
  allRows: FinanceLedgerRow[];
};

export const emptyFinanceSnapshot: FinanceSnapshot = {
  totals: {
    grossTotal: 0,
    captainNetTotal: 0,
    companyTotal: 0,
    settlementTotal: 0,
    paidTotal: 0,
    unpaidTotal: 0,
  },
  captains: [],
  allRows: [],
};
