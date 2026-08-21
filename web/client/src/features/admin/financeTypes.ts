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
