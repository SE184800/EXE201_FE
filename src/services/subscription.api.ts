import { api } from './api';

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
  return (await api.post<{ subscription: Subscription }>('/subscription/renew', { requestId })).data
    .subscription;
}

export async function renewExpiredSubscription(renewalToken: string, requestId: string) {
  return (
    await api.post<{ subscription: Subscription }>('/subscription/renew-public', {
      renewalToken,
      requestId,
    })
  ).data.subscription;
}
