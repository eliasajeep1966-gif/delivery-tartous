import { DeliveryOrder, UserProfile, CaptainProfile, OrderFinancialBreakdown } from '@/types';
import { Tables } from './database.types';

type OrderRow = Tables['orders']['Row'];
type ProfileRow = Tables['profiles']['Row'];
type CaptainStatusRow = Tables['captain_status']['Row'];
type FinancialLedgerRow = Tables['financial_ledger']['Row'];

export function mapOrderRowToDeliveryOrder(row: OrderRow): DeliveryOrder {
  return {
    id: row.id,
    orderNumber: String(row.order_number),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    pickupAddress: row.pickup_address,
    deliveryAddress: row.delivery_address,
    fee: Number(row.fee),
    status: row.status,
    assignedCaptainId: row.assigned_captain_id,
    createdByUserId: row.created_by_user_id,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function mapProfileRowToUserProfile(row: ProfileRow): UserProfile {
  return {
    userId: row.id,
    role: row.role,
    name: row.full_name ?? row.email,
  };
}

export function mapCaptainRowToCaptainProfile(
  profile: ProfileRow,
  captainStatus: CaptainStatusRow
): CaptainProfile {
  return {
    userId: profile.id,
    name: profile.full_name ?? profile.email,
    availability: captainStatus.availability,
  };
}

export function mapLedgerRowToOrderFinancialBreakdown(row: FinancialLedgerRow): OrderFinancialBreakdown {
  return {
    orderId: row.order_id,
    orderFee: Number(row.gross_fee),
    captainEarnings: Number(row.captain_amount),
    companyProfit: Number(row.company_amount),
    adjustmentAmount: Number(row.settlement_amount),
  };
}
