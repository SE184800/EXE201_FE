import { api } from './api';
import axios from 'axios';

export type SubscriptionPayment = {
  id: number;
  amount: number;
  status: string;
  method: string;
  reference: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string;
};

export type Subscription = {
  exempt: boolean;
  id?: number;
  status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'EXEMPT';
  hasAccess: boolean;
  monthlyPrice: number;
  walletBalance?: number;
  paymentSource?: 'WALLET';
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  accessEndsAt: string | null;
  daysRemaining: number | null;
  payments: SubscriptionPayment[];
};

export async function getSubscription() {
  return (await api.get<{ subscription: Subscription }>('/subscription')).data.subscription;
}

export async function renewSubscription(requestId: string) {
  return (
    await api.post<{ subscription: Subscription }>('/subscription/renew', {
      requestId,
      paymentSource: 'WALLET',
    })
  ).data.subscription;
}

export async function renewExpiredSubscription(renewalToken: string, requestId: string) {
  return (
    await api.post<{ subscription: Subscription }>('/subscription/renew-public', {
      renewalToken,
      requestId,
      paymentSource: 'WALLET',
    })
  ).data.subscription;
}

export async function topUpExpiredSubscription(renewalToken: string, requestId: string) {
  return (
    await api.post<{ subscription: Subscription }>('/subscription/top-up-public', {
      renewalToken,
      requestId,
    })
  ).data.subscription;
}

export function insufficientWalletBalance(error: unknown): number | null {
  if (!axios.isAxiosError<{ code?: string; walletBalance?: number }>(error)) return null;
  const data = error.response?.data;
  return data?.code === 'INSUFFICIENT_WALLET_BALANCE' && typeof data.walletBalance === 'number'
    ? data.walletBalance
    : null;
}

// Preserve the purchase ID on refresh after a lost response. The server may already have debited the wallet.
export function pendingRenewal(id: number): string | null {
  try {
    return sessionStorage.getItem(`supplymind-subscription-${id}`);
  } catch {
    return null;
  }
}

export function savePendingRenewal(id: number, requestId: string | null) {
  try {
    const key = `supplymind-subscription-${id}`;
    if (requestId) sessionStorage.setItem(key, requestId);
    else sessionStorage.removeItem(key);
  } catch {
    /* The in-memory ID still protects retries when storage is unavailable. */
  }
}
