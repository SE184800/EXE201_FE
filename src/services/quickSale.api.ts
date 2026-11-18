import { api, ApiCompatibilityError, isMissingApiRoute } from './api';
import type { SaleRequest } from '../mobile/quickSale';

type Movement = { id: string };

export async function recordQuickSale(rows: SaleRequest[]): Promise<{ movements: Movement[] }> {
  try {
    return (
      await api.post<{ movements: Movement[] }>(
        '/inventory/sales/batch',
        {
          rows: rows.map(({ itemId, unit, quantity, unitSalePrice, requestId }) => ({
            itemId,
            unit,
            quantity,
            unitSalePrice,
            requestId,
          })),
        },
        { timeout: 30000 },
      )
    ).data;
  } catch (error) {
    // Only a confirmed missing route permits another endpoint. A timeout/500
    // could have committed already; leave that request pending for an exact retry.
    if (!isMissingApiRoute(error)) throw error;
    if (rows.length !== 1)
      throw new ApiCompatibilityError(
        'Máy chủ chưa hỗ trợ bán nhiều mặt hàng cùng lúc. Cần cập nhật backend; lượt bán vẫn được giữ trên máy.',
      );
    const row = rows[0];
    const { data } = await api.post<{ movement: Movement }>(
      `/inventory/${row.itemId}/movements`,
      {
        type: 'SALE',
        quantity: row.quantity,
        unitSalePrice: row.unitSalePrice,
        requestId: row.requestId,
        note: 'Bán nhanh bằng giọng nói',
      },
      { timeout: 30000 },
    );
    // Keep the same idempotency key and note as the batch endpoint, including
    // when the server is upgraded between an uncertain result and its retry.
    return { movements: data.movement ? [data.movement] : [] };
  }
}
