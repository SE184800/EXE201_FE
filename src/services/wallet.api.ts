import { api } from './api';

export type WalletSummary = {
  balance: number;
  heldBalance: number;
  total: number;
  currency: string;
  updatedAt: string;
};

export type WalletOverview = {
  wallet: WalletSummary;
  pendingDeposits: number;
  pendingWithdrawals: number;
};

export type WalletTransaction = {
  id: number;
  type: string;
  typeLabel: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceAfter: number;
  reference: string;
  status: string;
  /** REAL money needs an admin review, SANDBOX money settles instantly. */
  method: 'REAL' | 'SANDBOX';
  orderId: number | null;
  note: string | null;
  createdAt: string;
};

export type WalletTransactionList = {
  transactions: WalletTransaction[];
  total: number;
  page: number;
  hasMore: boolean;
};

export type DepositRequest = {
  id: number;
  userId: number;
  userName: string | null;
  username: string | null;
  amount: number;
  method: string;
  /** True when the request was created through the sandbox flow. */
  isSandbox: boolean;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  reference: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  statusLabel: string;
  note: string | null;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type WithdrawalRequest = {
  id: number;
  userId: number;
  userName: string | null;
  username: string | null;
  amount: number;
  /** True when the request was created through the sandbox flow. */
  isSandbox: boolean;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'FAILED';
  statusLabel: string;
  adminNote: string | null;
  reference: string | null;
  reviewedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type RequestList<T> = {
  requests: T[];
  total: number;
  page: number;
  hasMore: boolean;
};

export type OrderPayment = {
  id: number;
  orderId: number;
  buyerId: number;
  supplierUserId: number;
  buyerName: string | null;
  supplierName: string | null;
  amount: number;
  commissionAmount: number | null;
  supplierAmount: number | null;
  status: string;
  statusLabel: string;
  reference: string;
  paidAt: string;
  refunded: boolean;
};

export type OrderPaymentList = {
  payments: OrderPayment[];
  total: number;
  page: number;
  hasMore: boolean;
};

export type DepositInput = {
  amount: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  reference?: string;
  note?: string;
};

export type WithdrawalInput = {
  amount: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  note?: string;
};

export async function getWallet(): Promise<WalletOverview> {
  return (await api.get<WalletOverview>('/wallet')).data;
}

export async function getWalletTransactions(
  params: { page?: number; type?: string } = {},
): Promise<WalletTransactionList> {
  return (await api.get<WalletTransactionList>('/wallet/transactions', { params })).data;
}

export async function getWalletPayments(
  params: { page?: number; scope?: 'BUYER' | 'SUPPLIER' } = {},
): Promise<OrderPaymentList> {
  return (await api.get<OrderPaymentList>('/wallet/payments', { params })).data;
}

export async function createDepositRequest(input: DepositInput): Promise<DepositRequest> {
  return (await api.post<{ request: DepositRequest }>('/wallet/deposits', input)).data.request;
}

/** Credits simulated money instantly. No admin review, no real transfer. */
export async function createSandboxDepositRequest(
  input: { amount: number; note?: string },
): Promise<DepositRequest> {
  return (
    await api.post<{ request: DepositRequest }>('/wallet/deposits/sandbox', input)
  ).data.request;
}

export async function getDepositRequests(
  params: { page?: number; status?: string } = {},
): Promise<RequestList<DepositRequest>> {
  return (await api.get<RequestList<DepositRequest>>('/wallet/deposits', { params })).data;
}

/** Bank account that receives the VietQR deposits. */
export type QrConfig = {
  enabled: boolean;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

/** Details of a generated VietQR code. */
export type QrCode = {
  payload: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  billNumber: string;
};

export async function getQrConfig(): Promise<QrConfig> {
  return (await api.get<QrConfig>('/wallet/qr-config')).data;
}

/** Creates a QR deposit ticket and returns the code to scan. */
export async function createQrDepositRequest(input: {
  amount: number;
  note?: string;
}): Promise<{ request: DepositRequest; qr: QrCode }> {
  return (
    await api.post<{ request: DepositRequest; qr: QrCode }>('/wallet/deposits/qr', input)
  ).data;
}

/** Confirms the transfer so the money is credited to the wallet. */
export async function confirmQrDeposit(
  id: number,
  input: { reference?: string } = {},
): Promise<DepositRequest> {
  return (
    await api.post<{ request: DepositRequest }>(`/wallet/deposits/qr/${id}/confirm`, input)
  ).data.request;
}

export async function createWithdrawalRequest(input: WithdrawalInput): Promise<WithdrawalRequest> {
  return (await api.post<{ request: WithdrawalRequest }>('/wallet/withdrawals', input)).data
    .request;
}

/** Debits simulated money instantly. No admin review, no real transfer. */
export async function createSandboxWithdrawalRequest(
  input: { amount: number; note?: string },
): Promise<WithdrawalRequest> {
  return (
    await api.post<{ request: WithdrawalRequest }>('/wallet/withdrawals/sandbox', input)
  ).data.request;
}

export async function getWithdrawalRequests(
  params: { page?: number; status?: string } = {},
): Promise<RequestList<WithdrawalRequest>> {
  return (await api.get<RequestList<WithdrawalRequest>>('/wallet/withdrawals', { params })).data;
}

/** Pays a wholesale order with the wallet. The amount is decided by the backend. */
export async function payOrderWithWallet(orderId: number): Promise<OrderPayment> {
  return (await api.post<{ payment: OrderPayment }>(`/wallet/payments/${orderId}`)).data.payment;
}

// ===================== ADMIN =====================

export async function getAdminDeposits(
  params: { page?: number; status?: string } = {},
): Promise<RequestList<DepositRequest>> {
  return (await api.get<RequestList<DepositRequest>>('/admin/wallet/deposits', { params })).data;
}

export async function getAdminDeposit(id: number): Promise<DepositRequest> {
  return (await api.get<{ request: DepositRequest }>(`/admin/wallet/deposits/${id}`)).data.request;
}

export async function approveDeposit(
  id: number,
  input: { reference?: string; adminNote?: string } = {},
): Promise<DepositRequest> {
  return (
    await api.post<{ request: DepositRequest }>(`/admin/wallet/deposits/${id}/approve`, input)
  ).data.request;
}

export async function rejectDeposit(
  id: number,
  input: { adminNote: string },
): Promise<DepositRequest> {
  return (
    await api.post<{ request: DepositRequest }>(`/admin/wallet/deposits/${id}/reject`, input)
  ).data.request;
}

export async function getAdminWithdrawals(
  params: { page?: number; status?: string } = {},
): Promise<RequestList<WithdrawalRequest>> {
  return (await api.get<RequestList<WithdrawalRequest>>('/admin/wallet/withdrawals', { params }))
    .data;
}

export async function getAdminPayments(
  params: { page?: number } = {},
): Promise<OrderPaymentList> {
  return (await api.get<OrderPaymentList>('/admin/wallet/payments', { params })).data;
}

export async function getAdminWithdrawal(id: number): Promise<WithdrawalRequest> {
  return (await api.get<{ request: WithdrawalRequest }>(`/admin/wallet/withdrawals/${id}`)).data
    .request;
}

export async function approveWithdrawal(
  id: number,
  input: { adminNote?: string } = {},
): Promise<WithdrawalRequest> {
  return (
    await api.post<{ request: WithdrawalRequest }>(
      `/admin/wallet/withdrawals/${id}/approve`,
      input,
    )
  ).data.request;
}

export async function rejectWithdrawal(
  id: number,
  input: { adminNote: string },
): Promise<WithdrawalRequest> {
  return (
    await api.post<{ request: WithdrawalRequest }>(
      `/admin/wallet/withdrawals/${id}/reject`,
      input,
    )
  ).data.request;
}

export async function completeWithdrawal(
  id: number,
  input: { reference: string; adminNote?: string },
): Promise<WithdrawalRequest> {
  return (
    await api.post<{ request: WithdrawalRequest }>(
      `/admin/wallet/withdrawals/${id}/complete`,
      input,
    )
  ).data.request;
}

export async function failWithdrawal(
  id: number,
  input: { adminNote: string },
): Promise<WithdrawalRequest> {
  return (
    await api.post<{ request: WithdrawalRequest }>(`/admin/wallet/withdrawals/${id}/fail`, input)
  ).data.request;
}

export async function refundOrder(
  orderId: number,
  input: { reason: string },
): Promise<{ id: number; orderId: number; amount: number; reason: string; status: string }> {
  return (await api.post<{ refund: { id: number; orderId: number; amount: number; reason: string; status: string } }>(
    `/admin/wallet/orders/${orderId}/refund`,
    input,
  )).data.refund;
}
