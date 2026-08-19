import type { CaptainProfile, DeliveryOrder, UserRole } from '@/types';

export type ManagementDashboardRole = Extract<UserRole, 'admin' | 'supervisor'>;

export const managementDashboardRole: ManagementDashboardRole = 'supervisor';

export type ManagementDashboard = {
  role: ManagementDashboardRole;
  roleLabel: 'المدير' | 'المشرف';
  orders: DeliveryOrder[];
  captains: CaptainProfile[];
  metrics: {
    awaitingCaptainAcceptance: number;
    inDelivery: number;
    completed: number;
    closed: number;
  };
};

const orders: DeliveryOrder[] = [
  {
    id: 'order-1001',
    orderNumber: 'DT-1001',
    customerName: 'أحمد محمود',
    customerPhone: '0933000001',
    pickupAddress: 'الكرنك، طرطوس',
    deliveryAddress: 'الإنشاءات، طرطوس',
    fee: 25000,
    status: 'assigned',
    assignedCaptainId: 'captain-1',
    createdByUserId: 'supervisor-1',
    cancellationReason: null,
    createdAt: '2026-08-19T08:15:00.000Z',
    updatedAt: '2026-08-19T08:20:00.000Z',
    completedAt: null,
  },
  {
    id: 'order-1002',
    orderNumber: 'DT-1002',
    customerName: 'سارة ديب',
    customerPhone: '0933000002',
    pickupAddress: 'شارع الثورة، طرطوس',
    deliveryAddress: 'الرمل الجنوبي، طرطوس',
    fee: 32000,
    status: 'in_delivery',
    assignedCaptainId: 'captain-2',
    createdByUserId: 'supervisor-1',
    cancellationReason: null,
    createdAt: '2026-08-19T07:50:00.000Z',
    updatedAt: '2026-08-19T08:40:00.000Z',
    completedAt: null,
  },
  {
    id: 'order-1003',
    orderNumber: 'DT-1003',
    customerName: 'مروان خليل',
    customerPhone: '0933000003',
    pickupAddress: 'دوار الشيخ سعد، طرطوس',
    deliveryAddress: 'الزهراء، طرطوس',
    fee: 18000,
    status: 'completed',
    assignedCaptainId: 'captain-3',
    createdByUserId: 'admin-1',
    cancellationReason: null,
    createdAt: '2026-08-19T06:30:00.000Z',
    updatedAt: '2026-08-19T08:05:00.000Z',
    completedAt: '2026-08-19T08:05:00.000Z',
  },
  {
    id: 'order-1004',
    orderNumber: 'DT-1004',
    customerName: 'رامي عثمان',
    customerPhone: '0933000004',
    pickupAddress: 'المشروع السادس، طرطوس',
    deliveryAddress: 'المدينة القديمة، طرطوس',
    fee: 22000,
    status: 'cancelled',
    assignedCaptainId: 'captain-1',
    createdByUserId: 'admin-1',
    cancellationReason: 'تعذر التواصل مع العميل',
    createdAt: '2026-08-19T06:10:00.000Z',
    updatedAt: '2026-08-19T06:40:00.000Z',
    completedAt: null,
  },
];

const captains: CaptainProfile[] = [
  { userId: 'captain-1', name: 'محمد علي', availability: 'available' },
  { userId: 'captain-2', name: 'حسن يوسف', availability: 'available' },
  { userId: 'captain-3', name: 'كريم حمود', availability: 'unavailable' },
  { userId: 'captain-4', name: 'يزن إبراهيم', availability: 'available' },
];

const metrics = {
  awaitingCaptainAcceptance: orders.filter((order) => order.status === 'assigned').length,
  inDelivery: orders.filter((order) => order.status === 'in_delivery').length,
  completed: orders.filter((order) => order.status === 'completed').length,
  closed: orders.filter(
    (order) => order.status === 'cancelled' || order.status === 'false_order'
  ).length,
};

const dashboards: Record<ManagementDashboardRole, ManagementDashboard> = {
  admin: {
    role: 'admin',
    roleLabel: 'المدير',
    orders,
    captains,
    metrics,
  },
  supervisor: {
    role: 'supervisor',
    roleLabel: 'المشرف',
    orders,
    captains,
    metrics,
  },
};

export function getManagementDashboard(role: ManagementDashboardRole): ManagementDashboard {
  return dashboards[role];
}
