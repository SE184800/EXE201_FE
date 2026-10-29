import { api } from './api';

export type DriverInfo = {
  driverName: string;
  driverPhone: string;
  vehicleType: string;
  licensePlate: string;
  estimatedDeliveryTime?: string;
  deliveryNotes?: string;
};

export type ConsignmentRequest = {
  id: string;
  storeId: number;
  storeName: string;
  storePhone: string;
  storeAddress?: string;
  supplierId: number | null;
  supplierName: string;
  itemId: number;
  productName: string;
  unit: string;
  type: 'RESTOCK' | 'EXCHANGE_EXPIRY';
  currentQty: number;
  requestedQty: number;
  expiryDate: string | null;
  status: 'PENDING' | 'DISPATCHED' | 'COMPLETED' | 'REJECTED';
  note: string;
  driverInfo?: DriverInfo | null;
  newExpiryDate?: string | null;
  supplierNotes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getStoreConsignmentRequests() {
  const res = await api.get<{ requests: ConsignmentRequest[] }>('/inventory/consignment-requests');
  return res.data.requests;
}

export async function createConsignmentRequest(
  itemId: number,
  payload: {
    type: 'RESTOCK' | 'EXCHANGE_EXPIRY';
    requestedQty?: number;
    note?: string;
  },
) {
  const res = await api.post<{ request: ConsignmentRequest; message: string }>(
    `/inventory/${itemId}/consignment-request`,
    payload,
  );
  return res.data;
}

export async function confirmConsignmentReceipt(requestId: string) {
  const res = await api.post<{ request: ConsignmentRequest; message: string }>(
    `/inventory/consignment-requests/${requestId}/confirm-receipt`,
  );
  return res.data;
}

export async function getSupplierConsignmentRequests() {
  const res = await api.get<{ requests: ConsignmentRequest[] }>('/supplier/consignments/requests');
  return res.data.requests;
}

export async function dispatchConsignmentRequest(
  requestId: string,
  payload: {
    driverInfo: DriverInfo;
    newExpiryDate?: string;
    supplierNotes?: string;
  },
) {
  const res = await api.post<{ request: ConsignmentRequest; message: string }>(
    `/supplier/consignments/requests/${requestId}/dispatch`,
    payload,
  );
  return res.data;
}

export async function rejectConsignmentRequest(requestId: string, reason: string) {
  const res = await api.post<{ request: ConsignmentRequest; message: string }>(
    `/supplier/consignments/requests/${requestId}/reject`,
    { reason },
  );
  return res.data;
}
