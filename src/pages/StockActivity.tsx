import DatePicker from '../components/DatePicker';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';

type Product = {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  sellingPrice: number | null;
};

type Movement = {
  id: string;
  type: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  productName: string;
  unit: string;
  note: string;
  createdAt: string;
};

type StockBatch = {
  id: string;
  batchType: 'WHOLESALE_ORDER' | 'DAILY_IMPORT' | 'DAILY_EXPORT';
  title: string;
  subtitle: string;
  occurredAt: string;
  supplierName?: string;
  orderId?: number;
  totalItems: number;
  totalQuantity: number;
  movements: Movement[];
};

const labels: Record<string, string> = {
  SALE: 'Xuất bán',
  RECEIPT: 'Nhập kho',
  IMPORT: 'Nhập kho sỉ',
  ADJUSTMENT: 'Điều chỉnh',
  OPENING: 'Tồn đầu kỳ',
};

function toVnDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function toVnDateDisplay(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function summarizeBatchQuantities(movements: Movement[]): string {
  const byUnit = new Map<string, number>();
  for (const m of movements) {
    byUnit.set(m.unit, (byUnit.get(m.unit) || 0) + m.quantityChange);
  }
  const parts: string[] = [];
  for (const [unit, total] of byUnit.entries()) {
    if (total === 0) continue;
    parts.push(`${total > 0 ? '+' : ''}${total} ${unit}`);
  }
  return parts.join(' · ') || `${movements.length} lượt`;
}

function groupMovementsIntoBatches(movements: Movement[]): StockBatch[] {
  const batches: StockBatch[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < movements.length; i++) {
    const row = movements[i];
    if (visited.has(row.id)) continue;

    // Đơn hàng sỉ qua thẻ [ĐƠN SỈ #X]
    const orderMatch = row.note ? row.note.match(/\[ĐƠN SỈ #(\d+)\]/i) : null;
    const nccMatch = row.note ? row.note.match(/\[NCC:\s*([^\]]+)\]/i) : null;
    const supplier = nccMatch ? nccMatch[1].trim() : undefined;

    if (orderMatch) {
      const orderId = Number(orderMatch[1]);
      const orderTag = `[ĐƠN SỈ #${orderId}]`;
      const batchMovements = movements.filter(
        (m) => !visited.has(m.id) && m.note && m.note.includes(orderTag),
      );
      batchMovements.forEach((m) => visited.add(m.id));

      const totalQty = batchMovements.reduce(
        (sum, m) => sum + Math.max(0, m.quantityChange),
        0,
      );

      batches.push({
        id: `batch-order-${orderId}`,
        batchType: 'WHOLESALE_ORDER',
        orderId,
        title: `Nhập kho từ Đơn sỉ #${orderId}`,
        subtitle: supplier ? `Nhà cung cấp: ${supplier}` : `${batchMovements.length} mặt hàng`,
        occurredAt: batchMovements[0].createdAt,
        supplierName: supplier,
        totalItems: batchMovements.length,
        totalQuantity: totalQty,
        movements: batchMovements,
      });
      continue;
    }

    const isInbound = row.quantityChange > 0 || ['RECEIPT', 'IMPORT', 'OPENING'].includes(row.type);
    const dayKey = toVnDateKey(row.createdAt);
    const dayDisplay = toVnDateDisplay(row.createdAt);
    const batchMovements = [row];
    visited.add(row.id);

    for (let j = i + 1; j < movements.length; j++) {
      const nextRow = movements[j];
      if (visited.has(nextRow.id)) continue;
      if (nextRow.note && nextRow.note.includes('[ĐƠN SỈ #')) continue;
      const nextInbound = nextRow.quantityChange > 0 || ['RECEIPT', 'IMPORT', 'OPENING'].includes(nextRow.type);
      if (nextInbound !== isInbound) continue;
      if (toVnDateKey(nextRow.createdAt) === dayKey) {
        batchMovements.push(nextRow);
        visited.add(nextRow.id);
      }
    }

    const uniqueNames = Array.from(new Set(batchMovements.map((m) => m.productName)));
    const previewNames = uniqueNames.slice(0, 3).join(', ') + (uniqueNames.length > 3 ? ` và ${uniqueNames.length - 3} món khác` : '');

    batches.push({
      id: `batch-${isInbound ? 'in' : 'out'}-${dayKey}-${row.id}`,
      batchType: isInbound ? 'DAILY_IMPORT' : 'DAILY_EXPORT',
      title: isInbound ? `Nhập kho ngày ${dayDisplay}` : `Xuất kho ngày ${dayDisplay}`,
      subtitle: `${batchMovements.length} giao dịch · ${previewNames}`,
      occurredAt: row.createdAt,
      totalItems: batchMovements.length,
      totalQuantity: batchMovements.reduce((sum, m) => sum + Math.abs(m.quantityChange), 0),
      movements: batchMovements,
    });
  }

  return batches;
}

export default function StockActivity({
  items,
  revision,
  onChanged,
  onLogout,
  mode = 'activity',
}: {
  items: Product[];
  revision: number;
  onChanged: () => Promise<void>;
  onLogout: () => void;
  mode?: 'activity' | 'history';
}) {
  const [itemId, setItemId] = useState('');
  const type = 'RECEIPT';
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [occurredOn, setOccurredOn] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
  );
  const [lotExpiryDate, setLotExpiryDate] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [rows, setRows] = useState<Movement[]>([]);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);

  // Chế độ hiển thị: theo từng đợt nhập hàng (batch) hoặc xem toàn bộ biến động (flat)
  const [viewMode, setViewMode] = useState<'batch' | 'flat'>('batch');
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  const selected = items.find((item) => item.id === Number(itemId));

  useEffect(() => {
    let active = true;
    api
      .get<{ movements: Movement[]; hasMore: boolean }>('/inventory/history', { params: { page, limit: 100 } })
      .then(({ data }) => {
        if (active) {
          setRows(data.movements);
          setMore(data.hasMore);
          setHistoryError('');
        }
      })
      .catch((issue: unknown) => {
        if (active) {
          setHistoryError(getApiError(issue));
          if (isUnauthenticated(issue)) onLogout();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, reload, revision, onLogout]);

  // Gom các biến động thành từng đợt
  const batches = useMemo(() => groupMovementsIntoBatches(rows), [rows]);

  function toggleBatch(batchId: string) {
    setExpandedBatches((prev) => ({ ...prev, [batchId]: !prev[batchId] }));
  }

  function toggleExpandAll() {
    const allExpanded = batches.every((b) => expandedBatches[b.id]);
    if (allExpanded) {
      setExpandedBatches({});
    } else {
      const next: Record<string, boolean> = {};
      batches.forEach((b) => (next[b.id] = true));
      setExpandedBatches(next);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !selected) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const body = {
      type,
      quantity: Number(quantity),
      occurredOn,
      ...(lotExpiryDate ? { lotExpiryDate } : {}),
      note: note.trim(),
    };
    const signature = JSON.stringify({ itemId, ...body });
    if (request.current?.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    try {
      await api.post<{ movement: Movement }>(`/inventory/${itemId}/movements`, {
        ...body,
        requestId: request.current.id,
      });
      setNotice(
        `Đã lưu giao dịch ngày ${occurredOn}. Bạn có thể nhập trễ, hệ thống vẫn tổng hợp đúng ngày.`,
      );
      request.current = null;
      setQuantity('1');
      setNote('');
      setLotExpiryDate('');
      setOccurredOn(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
      setPage(1);
      setReload((value) => value + 1);
      setLoading(true);
      await onChanged();
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="stock-activity" aria-label="Nhập xuất kho">
      <div hidden={mode !== 'activity'} className="transaction-form-card">
        <h3>Ghi nhận nhập hàng</h3>
        <p className="stock-help">
          Mỗi lần nhập sẽ tạo một lô mới, có thể chọn ngày nhập và hạn sử dụng riêng.
        </p>
        <form className="inventory-form" onSubmit={submit}>
          <label className="inventory-name">
            Sản phẩm
            <select
              required
              value={itemId}
              disabled={busy}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">Chọn sản phẩm</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — còn {item.quantity} {item.unit}
                </option>
              ))}
            </select>
          </label>
          <label>
            Thao tác
            <select value="RECEIPT" disabled>
              <option value="RECEIPT">Nhập thêm (tạo lô)</option>
            </select>
          </label>
          <label>
            Ngày giao dịch
            <DatePicker
              required
              max={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })}
              value={occurredOn}
              disabled={busy}
              onChange={(val) => setOccurredOn(val)}
            />
            <small>
              Quên nhập hôm qua? Chọn đúng ngày thực tế, hệ thống sẽ cộng vào báo cáo ngày đó.
            </small>
          </label>
          <label>
            Hạn sử dụng của lô (không bắt buộc)
            <DatePicker
              min={occurredOn}
              value={lotExpiryDate}
              disabled={busy}
              onChange={(val) => setLotExpiryDate(val)}
              placeholder="DD/MM/YYYY (hạn sử dụng lô)"
            />
            <small>Ngày này có thể ở tương lai; đây là hạn dùng, không phải ngày nhập.</small>
          </label>
          <label>
            Số lượng{selected ? ` (${selected.unit})` : ''}
            <input
              type="number"
              required
              min="1"
              max="2147483647"
              step="1"
              disabled={busy}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className="inventory-name">
            Ghi chú (không bắt buộc)
            <input
              value={note}
              disabled={busy}
              maxLength={250}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: bán tại quầy, nhập từ nhà cung cấp…"
            />
          </label>
          <div className="inventory-actions">
            <button className="primary-button" disabled={busy || !selected}>
              {busy ? 'Đang ghi nhận…' : 'Ghi nhận nhập hàng'}
            </button>
          </div>
        </form>
        {error && (
          <p className="error-notice" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="inventory-notice" role="status">
            {notice}
          </p>
        )}
      </div>

      <div hidden={mode !== 'history'}>
        <div className="inventory-heading" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Lịch sử nhập / xuất kho</h3>
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>
              Theo dõi và phân biệt chi tiết từng đợt nhập hàng và các biến động kho
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                padding: '2px',
                backgroundColor: '#f8fafc',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('batch')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12.5px',
                  fontWeight: viewMode === 'batch' ? 700 : 500,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: viewMode === 'batch' ? '#0284c7' : 'transparent',
                  color: viewMode === 'batch' ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Theo từng đợt nhập hàng ({batches.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12.5px',
                  fontWeight: viewMode === 'flat' ? 700 : 500,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: viewMode === 'flat' ? '#0284c7' : 'transparent',
                  color: viewMode === 'flat' ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Tất cả biến động ({rows.length})
              </button>
            </div>

            {viewMode === 'batch' && batches.length > 0 && (
              <button
                type="button"
                onClick={toggleExpandAll}
                className="secondary-button"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                {batches.every((b) => expandedBatches[b.id]) ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
              </button>
            )}

            <button
              className="inventory-refresh"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setReload((value) => value + 1);
              }}
            >
              Tải lại
            </button>
          </div>
        </div>

        {historyError ? (
          <p role="alert" className="error-notice">
            {historyError}
          </p>
        ) : loading ? (
          <p role="status">Đang tải lịch sử…</p>
        ) : !rows.length ? (
          <p className="inventory-empty">Chưa có giao dịch ở trang này.</p>
        ) : viewMode === 'batch' ? (
          /* Chế độ gom theo từng đợt nhập hàng */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
            {batches.map((batch) => {
              const isExpanded = Boolean(expandedBatches[batch.id]);
              const isImport = batch.batchType === 'WHOLESALE_ORDER' || batch.batchType === 'DAILY_IMPORT';

              return (
                <div
                  key={batch.id}
                  style={{
                    borderRadius: '10px',
                    border: `1px solid ${isImport ? '#bbf7d0' : '#fecaca'}`,
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header nhóm theo ngày */}
                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: isImport ? '#f0fdf4' : '#fef2f2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '260px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          letterSpacing: '0.3px',
                          backgroundColor: isImport ? '#16a34a' : '#dc2626',
                          color: '#ffffff',
                        }}
                      >
                        {isImport ? 'NHẬP KHO' : 'XUẤT KHO'}
                      </span>

                      <div>
                        <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>
                          {batch.title}
                        </strong>
                        <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                          {batch.subtitle}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '13px', color: isImport ? '#15803d' : '#b91c1c', display: 'block' }}>
                          {summarizeBatchQuantities(batch.movements)}
                        </strong>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {toVnDateDisplay(batch.occurredAt)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleBatch(batch.id)}
                        style={{
                          padding: '6px 14px',
                          fontSize: '12.5px',
                          fontWeight: 650,
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: isExpanded ? '#0284c7' : '#ffffff',
                          color: isExpanded ? '#ffffff' : '#0f172a',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {isExpanded ? 'Thu gọn ▲' : 'Chi tiết ▼'}
                      </button>
                    </div>
                  </div>

                  {/* Chi tiết từng món trong ngày */}
                  {isExpanded && (
                    <div style={{ padding: '12px 16px', backgroundColor: '#ffffff' }}>
                      <table className="inventory-table" style={{ margin: 0 }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc' }}>
                            <th style={{ fontSize: '12px' }}>Sản phẩm</th>
                            <th style={{ fontSize: '12px' }}>Thao tác</th>
                            <th style={{ fontSize: '12px' }}>Số lượng</th>
                            <th style={{ fontSize: '12px' }}>Tồn trước → Sau</th>
                            <th style={{ fontSize: '12px' }}>Ghi chú / Thời gian</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batch.movements.map((m) => (
                            <tr key={m.id}>
                              <td>
                                <strong style={{ color: '#0f172a' }}>{m.productName}</strong>
                              </td>
                              <td style={{ fontSize: '12.5px' }}>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    backgroundColor: m.quantityChange > 0 ? '#dcfce7' : '#fee2e2',
                                    color: m.quantityChange > 0 ? '#15803d' : '#b91c1c',
                                  }}
                                >
                                  {labels[m.type] || m.type}
                                </span>
                              </td>
                              <td
                                className={m.quantityChange < 0 ? 'stock-out' : 'stock-in'}
                                style={{ fontWeight: 700 }}
                              >
                                {m.quantityChange > 0 ? '+' : ''}
                                {m.quantityChange} {m.unit}
                              </td>
                              <td style={{ fontSize: '12.5px', color: '#475569' }}>
                                {m.quantityBefore} → <strong>{m.quantityAfter}</strong> {m.unit}
                              </td>
                              <td style={{ fontSize: '12px', color: '#64748b' }}>
                                {m.note ? `${m.note} · ` : ''}
                                {new Date(m.createdAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: 'Asia/Ho_Chi_Minh',
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Chế độ xem toàn bộ biến động phẳng (flat) */
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Sản phẩm</th>
                  <th>Thao tác</th>
                  <th>Thay đổi</th>
                  <th>Tồn trước → sau</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td>
                    <td>
                      <strong>{row.productName}</strong>
                      <small>{row.note}</small>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          backgroundColor: row.quantityChange > 0 ? '#dcfce7' : '#fee2e2',
                          color: row.quantityChange > 0 ? '#15803d' : '#b91c1c',
                        }}
                      >
                        {labels[row.type] || row.type}
                      </span>
                    </td>
                    <td className={row.quantityChange < 0 ? 'stock-out' : 'stock-in'}>
                      {row.quantityChange > 0 ? '+' : ''}
                      {row.quantityChange} {row.unit}
                    </td>
                    <td>
                      {row.quantityBefore} → {row.quantityAfter} {row.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="stock-pagination">
          <button
            className="secondary-button"
            disabled={loading || page === 1}
            onClick={() => {
              setLoading(true);
              setPage(page - 1);
            }}
          >
            Trước
          </button>
          <span>Trang {page}</span>
          <button
            className="secondary-button"
            disabled={loading || !more}
            onClick={() => {
              setLoading(true);
              setPage(page + 1);
            }}
          >
            Sau
          </button>
        </div>
      </div>
    </section>
  );
}
