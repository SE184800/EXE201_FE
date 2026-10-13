import { api } from './api';
import type { SupplierProfile } from './supplier.api';

export type CatalogProduct = {
  category: string;
  imageUrl: string | null;
  id: number;
  name: string;
  packaging: string;
  wholesalePrice: number;
  stockQty: number;
  moq: number;
  updatedAt: string;
  supplier: SupplierProfile;
  previousPrice: number | null;
  priceChangePercent: number | null;
  priceChangedAt: string | null;
  priceChangeReason: string | null;
  priceWarning: boolean;
  holidayPriceContext: { name: string; startDate: string; daysUntil: number } | null;
};
export type CatalogPage = { products: CatalogProduct[]; page: number; hasMore: boolean };

export async function getCatalog(
  params: {
    q: string;
    supplierId?: string;
    page: number;
    category?: string;
    inStock?: string;
    minPrice?: string;
    maxPrice?: string;
  },
  signal?: AbortSignal,
) {
  return (await api.get<CatalogPage>('/catalog/products', { params, signal })).data;
}
export async function getCatalogSuppliers(signal?: AbortSignal) {
  return (await api.get<{ suppliers: SupplierProfile[] }>('/catalog/suppliers', { signal })).data
    .suppliers;
}
export const PRODUCT_CATEGORIES = [
  'Đồ uống',
  'Thực phẩm',
  'Gia vị',
  'Hóa phẩm',
  'Chăm sóc cá nhân',
  'Khác',
];
