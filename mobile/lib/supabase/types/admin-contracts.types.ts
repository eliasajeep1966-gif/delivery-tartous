export type NativeAdminOrderStopInput = {
  stopType: "pickup" | "delivery";
  sequence: number;
  contactName: string;
  contactPhone: string;
  address: string;
  note?: string;
};

export type NativeCreatedOrder = {
  id: string;
  orderNumber: number;
  status: string;
};

export type NativeEditableOrder = {
  id: string;
  orderNumber: number;
  fee: number;
  stops: NativeAdminOrderStopInput[];
};

export type NativeAppRole = "admin" | "supervisor" | "captain";

export type NativeUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: NativeAppRole;
  isActive: boolean;
  createdAt: string;
};

export type NativePendingAccount = {
  id: string;
  email: string;
  fullName: string | null;
  role: NativeAppRole;
  createdAt: string;
};

export type NativePendingAccountInput = {
  email: string;
  fullName: string;
  role: NativeAppRole;
  custodyItemsText?: string;
};

export class NativeAdminRequestTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NativeAdminRequestTimeoutError";
  }
}
