import { api } from './api';

export interface WalletInfo {
  userId: number;
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: number;
  orderId?: number;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export async function getWallet(): Promise<WalletInfo> {
  const { data } = await api.get<{ success: boolean; wallet: WalletInfo }>('/wallet/me');
  return data.wallet;
}

export async function getWalletTransactions(page = 1, limit = 20): Promise<{ transactions: WalletTransaction[]; total: number }> {
  const { data } = await api.get<{ success: boolean; transactions: WalletTransaction[]; total: number }>('/wallet/transactions', {
    params: { page, limit },
  });
  return data;
}

export async function addMockFunds(amount = 5000000): Promise<{ wallet: WalletInfo; message: string }> {
  const { data } = await api.post<{ success: boolean; wallet: WalletInfo; message: string }>('/wallet/mock-add', { amount });
  return data;
}

export async function resetMockBalance(): Promise<{ wallet: WalletInfo; message: string }> {
  const { data } = await api.post<{ success: boolean; wallet: WalletInfo; message: string }>('/wallet/mock-reset');
  return data;
}

export async function depositOrderWithWallet(orderId: number): Promise<void> {
  await api.post(`/orders/${orderId}/deposit/wallet`);
}
