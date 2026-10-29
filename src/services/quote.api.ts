import { api } from './api';
import type { SupplierOrder, SupplierProduct } from './supplier.api';

export type StoreProspect = {
  id: number;
  name: string;
  username: string;
  phone: string | null;
};

export type QuoteLine = {
  id: number;
  productId: number;
  productName: string;
  packaging: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type MarketingQuote = {
  id: number;
  title: string;
  status: 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  validUntil: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  depositRate: number;
  depositAmount: number;
  note: string | null;
  responseNote: string | null;
  respondedAt: string | null;
  orderId: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  isConsignment?: boolean;
  settlementPrice?: number;
  autoRestock?: boolean;
  autoExchangeExpiry?: boolean;
  termsNote?: string | null;
  supplier?: {
    id: number;
    businessName: string;
    phone: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankAccountHolder: string | null;
  };
  buyer?: StoreProspect;
  lines: QuoteLine[];
};

export type QuotePage = {
  quotes: MarketingQuote[];
  total: number;
  page: number;
  hasMore: boolean;
};

export type QuoteDraft = {
  buyerId: number;
  title: string;
  validUntil: string;
  deliveryFee: number;
  depositRate: number;
  note: string;
  isConsignment?: boolean;
  settlementPrice?: number;
  autoRestock?: boolean;
  autoExchangeExpiry?: boolean;
  termsNote?: string;
  lines: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
    expectedUpdatedAt: string;
  }>;
};

export async function getProspects(q = '') {
  return (
    await api.get<{ stores: StoreProspect[] }>('/supplier/quotes/prospects', { params: { q } })
  ).data.stores;
}

export async function getSupplierQuotes(page = 1, status = '') {
  return (await api.get<QuotePage>('/supplier/quotes', { params: { page, status } })).data;
}

export async function createMarketingQuote(input: QuoteDraft) {
  return (await api.post<{ quote: MarketingQuote }>('/supplier/quotes', input)).data.quote;
}

export async function cancelMarketingQuote(id: number) {
  return (await api.post<{ quote: MarketingQuote }>(`/supplier/quotes/${id}/cancel`)).data.quote;
}

export async function getStoreQuotes(page = 1, status = '') {
  return (await api.get<QuotePage>('/quotes', { params: { page, status } })).data;
}

export async function acceptMarketingQuote(
  id: number,
  input: {
    requestId: string;
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    note: string;
  },
) {
  return (await api.post<{ order: SupplierOrder }>(`/quotes/${id}/accept`, input)).data.order;
}

export async function rejectMarketingQuote(id: number, responseNote: string) {
  return (await api.post<{ quote: MarketingQuote }>(`/quotes/${id}/reject`, { responseNote })).data
    .quote;
}

export type QuoteProduct = Pick<
  SupplierProduct,
  'id' | 'name' | 'packaging' | 'wholesalePrice' | 'stockQty' | 'updatedAt' | 'isActive'
>;
