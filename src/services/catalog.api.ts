import { api } from './api';
import type { SupplierProfile } from './supplier.api';

export type CatalogProduct = {
  category: string; imageUrl: string | null;
  id: number; name: string; packaging: string; wholesalePrice: number;
  stockQty: number; moq: number; updatedAt: string; supplier: SupplierProfile;
};
export type CatalogPage = { products: CatalogProduct[]; page: number; hasMore: boolean };

export async function getCatalog(params: { q: string; supplierId?: string; page: number; category?: string; inStock?: string; minPrice?: string; maxPrice?: string }, signal?: AbortSignal) {
  return (await api.get<CatalogPage>('/catalog/products', { params, signal })).data;
}
export async function getCatalogSuppliers(signal?: AbortSignal) {
  return (await api.get<{ suppliers: SupplierProfile[] }>('/catalog/suppliers', { signal })).data.suppliers;
}
export const PRODUCT_CATEGORIES = ['Đồ uống', 'Thực phẩm', 'Gia vị', 'Hóa phẩm', 'Chăm sóc cá nhân', 'Khác'];
