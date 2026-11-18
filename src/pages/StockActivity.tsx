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


    batches.push({
      id: `batch-${isInbound ? 'in' : 'out'}-${dayKey}-${row.id}`,
      batchType: isInbound ? 'DAILY_IMPORT' : 'DAILY_EXPORT',
      title: isInbound ? `Nhập kho ngày ${dayDisplay}` : `Xuất kho ngày ${dayDisplay}`,
      subtitle: `${batchMovements.length} giao dịch`,
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
  accountCreatedAt,
}: {
  items: Product[];
  revision: number;
  onChanged: () => Promise<void>;
  onLogout: () => void;
  mode?: 'activity' | 'history';
  accountCreatedAt?: string;
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

  const today = useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
    [],
  );

  const minDate = useMemo(() => {
    if (accountCreatedAt && /^\d{4}-\d{2}-\d{2}/.test(accountCreatedAt)) {
      return accountCreatedAt.slice(0, 10);
    }
    return undefined;
  }, [accountCreatedAt]);

  // Bộ lọc phân loại: 'OUT' (Xuất kho) hoặc 'IN' (Nhập kho) - Đã xóa lựa chọn "Tất cả"
  const [direction, setDirection] = useState<'OUT' | 'IN'>('OUT');

  // Tìm kiếm: Tên sản phẩm & Ngày giao dịch (1 ngày duy nhất)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchDate, setSearchDate] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [filters, setFilters] = useState<{ date: string; product: string }>({
    date: '',
    product: '',
  });
  const hasFilters = Boolean(filters.date || filters.product);

  const [historyError, setHistoryError] = useState('');
  const [rows, setRows] = useState<Movement[]>([]);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);

  // Nhóm các biến động theo đợt / đơn hàng
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  const selected = items.find((item) => item.id === Number(itemId));

  function handleFilterSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    setExpandedBatches({});
    setFilters({
      date: searchDate,
      product: searchProduct.trim(),
    });
  }

  function handleResetFilters() {
    setSearchDate('');
    setSearchProduct('');
    setLoading(true);
    setPage(1);
    setExpandedBatches({});
    setFilters({ date: '', product: '' });
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<{ movements: Movement[]; hasMore: boolean }>('/inventory/history', {
        params: {
          page,
          limit: 100,
          direction,
          from: filters.date || undefined,
          to: filters.date || undefined,
          product: filters.product || undefined,
        },
      })
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
  }, [page, reload, revision, onLogout, direction, filters]);

  // Gom các biến động thành từng đợt theo đúng phân loại
  const filteredRows = useMemo(() => {
    if (direction === 'OUT') {
      return rows.filter((r) => r.quantityChange < 0 || r.type === 'SALE');
    }
    return rows.filter((r) => r.quantityChange > 0 || ['RECEIPT', 'IMPORT', 'OPENING'].includes(r.type));
  }, [rows, direction]);

  const batches = useMemo(() => groupMovementsIntoBatches(filteredRows), [filteredRows]);

  function toggleBatch(batchId: string) {
    setExpandedBatches((prev) => ({ ...prev, [batchId]: !prev[batchId] }));
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
        <div className="inventory-heading stock-history-heading">
          <h3>Lịch sử nhập / xuất kho</h3>
          <div className="stock-history-tools">
            <div className="stock-history-modes" role="group" aria-label="Phân loại đơn">
              <button
                type="button"
                aria-pressed={direction === 'OUT'}
                onClick={() => {
                  if (direction !== 'OUT') {
                    setDirection('OUT');
                    setPage(1);
                    setExpandedBatches({});
                  }
                }}
              >
                Xuất kho
              </button>
              <button
                type="button"
                aria-pressed={direction === 'IN'}
                onClick={() => {
                  if (direction !== 'IN') {
                    setDirection('IN');
                    setPage(1);
                    setExpandedBatches({});
                  }
                }}
              >
                Nhập kho
              </button>
            </div>
            <button
              type="button"
              aria-expanded={searchOpen}
              aria-controls="stock-history-search"
              onClick={() => setSearchOpen((open) => !open)}
            >
              Tìm kiếm
            </button>
            <button
              type="button"
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

        <form
          id="stock-history-search"
          className="stock-history-search"
          hidden={!searchOpen}
          onSubmit={handleFilterSubmit}
        >
          <label>
            Tên sản phẩm
            <input
              type="search"
              value={searchProduct}
              maxLength={100}
              placeholder="Tìm theo tên sản phẩm…"
              onChange={(event) => setSearchProduct(event.target.value)}
            />
          </label>
          <label>
            Ngày giao dịch
            <DatePicker
              min={minDate}
              max={today}
              value={searchDate}
              clearable={false}
              placeholder="Chọn ngày giao dịch"
              onChange={(val) => {
                let clamped = val;
                if (clamped && clamped > today) clamped = today;
                if (clamped && minDate && clamped < minDate) clamped = minDate;
                setSearchDate(clamped);
              }}
            />
          </label>
          <button type="submit">Áp dụng</button>
        </form>

        {hasFilters && (
          <div className="stock-history-active-filter">
            <span>
              {[
                filters.date ? `Ngày ${filters.date.split('-').reverse().join('/')}` : '',
                filters.product ? `Sản phẩm "${filters.product}"` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <button type="button" onClick={handleResetFilters}>
              Bỏ lọc
            </button>
          </div>
        )}

        {historyError ? (
          <p role="alert" className="error-notice">
            {historyError}
          </p>
        ) : loading ? (
          <p role="status">Đang tải lịch sử…</p>
        ) : !rows.length ? (
          <p className="inventory-empty">
            {hasFilters ? 'Không tìm thấy giao dịch phù hợp với bộ lọc.' : 'Chưa có giao dịch nào ở trang này.'}
          </p>
        ) : (
          <div className="stock-history-groups">
            {batches.map((batch) => {
              const isExpanded = Boolean(expandedBatches[batch.id]);
              return (
                <article className="stock-history-group" key={batch.id}>
                  <button
                    type="button"
                    className="stock-history-summary"
                    aria-expanded={isExpanded}
                    onClick={() => toggleBatch(batch.id)}
                  >
                    <span>
                      <strong>{batch.title}</strong>
                      <small>
                        {batch.subtitle}
                        {batch.orderId ? ' · ' + toVnDateDisplay(batch.occurredAt) : ''}
                      </small>
                    </span>
                    <strong className={batch.batchType === 'DAILY_EXPORT' ? 'stock-out' : 'stock-in'}>
                      {summarizeBatchQuantities(batch.movements)}
                    </strong>
                    <span aria-hidden="true">{isExpanded ? '▴' : '▾'}</span>
                  </button>
                  {isExpanded && (
                    <ul className="stock-history-rows">
                      {batch.movements.map((m) => (
                        <li key={m.id}>
                          <div>
                            <strong>{m.productName}</strong>
                            <small>
                              {labels[m.type] || m.type} ·{' '}
                              {new Date(m.createdAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Asia/Ho_Chi_Minh',
                              })}
                            </small>
                          </div>
                          <div className="stock-history-quantity">
                            <span className={`stock-change-pill ${m.quantityChange < 0 ? 'is-out' : 'is-in'}`}>
                              {m.quantityChange > 0 ? '+' : ''}{m.quantityChange} {m.unit}
                            </span>
                            <div className="stock-balance-pill">
                              <span className="stock-balance-title">Tồn kho:</span>
                              <span className="stock-balance-before">{m.quantityBefore}</span>
                              <span className="stock-balance-arrow" aria-hidden="true">→</span>
                              <strong className={`stock-balance-after ${m.quantityChange < 0 ? 'is-out' : 'is-in'}`}>
                                {m.quantityAfter} {m.unit}
                              </strong>
                            </div>
                          </div>
                          {m.note && (
                            <details>
                              <summary>Ghi chú</summary>
                              <p>{m.note}</p>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
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
