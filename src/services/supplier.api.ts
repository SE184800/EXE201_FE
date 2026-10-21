import { api } from './api';

export type SupplierProfile = {
  id: number;
  businessName: string;
  warehouseAddress: string;
  deliveryRadiusKm: number;
  deliveryFee: number;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  phone?: string | null;
  region: string | null;
  taxCode: string | null;
  legalRepresentative: string | null;
  verificationDocumentUrl: string | null;
  verificationStatus: string;
  verificationNote: string | null;
  verificationVersion: number;
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
  previousPrice: number | null;
  priceChangePercent: number | null;
  priceChangedAt: string | null;
  priceChangeReason: string | null;
  priceWarning: boolean;
  moderation?: {
    status: 'AUTO_APPROVED' | 'NEEDS_REVIEW' | 'AUTO_REJECTED' | 'FLAGGED';
    riskScore: number;
    reasons: string[];
    criticalReasons?: string[];
    isClean: boolean;
  };
};

export type SupplierOrder = {
  commissionRate: number | null;
  commissionAmount: number | null;
  commissionPaidAt: string | null;
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
  depositRate: number;
  depositAmount: number;
  depositStatus: 'NONE' | 'PENDING' | 'SUBMITTED' | 'PAID' | 'REFUND_PENDING' | 'REFUNDED';
  depositReference: string | null;
  depositBankName: string | null;
  depositBankAccountNumber: string | null;
  depositBankAccountHolder: string | null;
  depositSubmittedAt: string | null;
  depositPaidAt: string | null;
  depositReviewedAt: string | null;
  depositRejectionReason: string | null;
  depositRefundedAt: string | null;
  depositRefundReference: string | null;
  note: string | null;
  rejectReason: string | null;
  complaint?: {
    id: number;
    reason: string;
    description: string;
    imageUrl?: string | null;
    status: string;
    response: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  buyer: { id: number; name: string; username: string };
  items: Array<{
    id: number;
    productId: number;
    productName: string;
    packaging: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

export type SupplierDashboard = {
  profile: SupplierProfile | null;
  products: SupplierProduct[];
  orders: SupplierOrder[];
  summary: {
    productCount: number;
    lowStockCount: number;
    pendingOrders: number;
    pendingDepositConfirmations: number;
    deliveredRevenue: number;
  };
};

export type SupplierProfileInput = Pick<
  SupplierProfile,
  | 'businessName'
  | 'warehouseAddress'
  | 'deliveryRadiusKm'
  | 'deliveryFee'
  | 'bankName'
  | 'bankAccountNumber'
  | 'bankAccountHolder'
>;
export type SupplierProductInput = Pick<
  SupplierProduct,
  | 'category'
  | 'imageUrl'
  | 'name'
  | 'packaging'
  | 'wholesalePrice'
  | 'stockQty'
  | 'moq'
  | 'isActive'
> & {
  priceChangeReason?: string | null;
};

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

export async function updateSupplierProduct(
  id: number,
  input: SupplierProductInput,
  expectedUpdatedAt: string,
): Promise<SupplierProduct> {
  const response = await api.put<{ product: SupplierProduct }>(`/supplier/products/${id}`, {
    ...input,
    expectedUpdatedAt,
  });
  return response.data.product;
}

export async function deactivateSupplierProduct(id: number): Promise<SupplierProduct> {
  const response = await api.delete<{ product: SupplierProduct }>(`/supplier/products/${id}`);
  return response.data.product;
}

export async function updateSupplierOrderStatus(
  id: number,
  status: string,
  rejectReason?: string,
): Promise<SupplierOrder> {
  const response = await api.patch<{ order: SupplierOrder }>(`/supplier/orders/${id}/status`, {
    status,
    rejectReason,
  });
  return response.data.order;
}

export async function updateSupplierOrderDeposit(
  id: number,
  action: 'CONFIRM' | 'REJECT' | 'REFUND',
  input: { reason?: string; reference?: string } = {},
): Promise<SupplierOrder> {
  const response = await api.patch<{ order: SupplierOrder }>(`/supplier/orders/${id}/deposit`, {
    action,
    ...input,
  });
  return response.data.order;
}

export async function uploadSupplierProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await api.post<{ success: boolean; imageUrl: string }>(
    '/supplier/upload-image',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
  return response.data.imageUrl;
}
