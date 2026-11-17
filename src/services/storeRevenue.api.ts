import { api } from './api';

export type RevenueDay = {
  day: string;
  revenue: string;
  purchaseCost?: string;
  profit?: string;
  salesCount: number;
  unpricedSalesCount: number;
};
export type StoreRevenueReport = {
  from: string;
  to: string;
  timezone: string;
  summary: {
    revenue: string;
    purchaseCost?: string;
    netProfit?: string;
    salesCount: number;
    pricedSalesCount: number;
    unpricedSalesCount: number;
    productCount: number;
  };
  daily: RevenueDay[];
  topProducts: {
    itemId: number;
    productName: string;
    unit: string;
    revenue: string;
    quantity: string;
    unpricedSalesCount: number;
  }[];
  sales: {
    id: string;
    itemId: number;
    productName: string;
    unit: string;
    quantity: number;
    unitSalePrice: number | null;
    isEstimatedPrice?: boolean;
    revenue: string | null;
    note: string;
    createdAt: string;
  }[];
  page: number;
  hasMore: boolean;
};

export const vnd = (value: string | number | bigint) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(BigInt(value));
export const vietnamDay = (date = new Date()) =>
  new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10);

export async function getStoreRevenue(
  from: string,
  to: string,
  page = 1,
  signal?: AbortSignal,
) {
  return (
    await api.get<StoreRevenueReport>('/inventory/revenue', { params: { from, to, page }, signal })
  ).data;
}

export async function getSupplierRevenue(
  from: string,
  to: string,
  page = 1,
  signal?: AbortSignal,
) {
  return (
    await api.get<StoreRevenueReport>('/supplier/revenue', { params: { from, to, page }, signal })
  ).data;
}
