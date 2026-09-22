import { api } from './api';

export type SupplierProfile = {
  id: number;
  businessName: string;
  warehouseAddress: string;
  deliveryRadiusKm: number;
  deliveryFee: number;
};

export type SupplierProduct = {
  category: string;
  imageUrl: string | null;
  id: number;
  name: string;
  packaging: string;
  wholesalePrice: number;
  stockQty: number;
  moq: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierOrder = {
  recipientName: string | null;
  recipientPhone: string | null;
  deliveryAddress: string | null;
  supplier?: { id: number; businessName: string };
  id: number;
  status: string;
  statusLabel: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  note: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  buyer: { id: number; name: string; username: string };
  items: Array<{ id: number; productId: number; productName: string; packaging: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

export type SupplierDashboard = {
  profile: SupplierProfile | null;
  products: SupplierProduct[];
  orders: SupplierOrder[];
  summary: { productCount: number; lowStockCount: number; pendingOrders: number; deliveredRevenue: number };
};

export type SupplierProfileInput = Omit<SupplierProfile, 'id'>;
export type SupplierProductInput = Omit<SupplierProduct, 'id' | 'createdAt' | 'updatedAt'>;

export async function getSupplierDashboard(): Promise<SupplierDashboard> {
  const response = await api.get<SupplierDashboard>('/supplier/dashboard');
  return response.data;
}

export async function saveSupplierProfile(input: SupplierProfileInput): Promise<SupplierProfile> {
  const response = await api.put<{ profile: SupplierProfile }>('/supplier/profile', input);
  return response.data.profile;
}

export async function createSupplierProduct(input: SupplierProductInput): Promise<SupplierProduct> {
  const response = await api.post<{ product: SupplierProduct }>('/supplier/products', input);
  return response.data.product;
}

export async function updateSupplierProduct(id: number, input: SupplierProductInput, expectedUpdatedAt: string): Promise<SupplierProduct> {
  const response = await api.put<{ product: SupplierProduct }>(`/supplier/products/${id}`, { ...input, expectedUpdatedAt });
  return response.data.product;
}

export async function deactivateSupplierProduct(id: number): Promise<SupplierProduct> {
  const response = await api.delete<{ product: SupplierProduct }>(`/supplier/products/${id}`);
  return response.data.product;
}

export async function updateSupplierOrderStatus(id: number, status: string, rejectReason?: string): Promise<SupplierOrder> {
  const response = await api.patch<{ order: SupplierOrder }>(`/supplier/orders/${id}/status`, { status, rejectReason });
  return response.data.order;
}
