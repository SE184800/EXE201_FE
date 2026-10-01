import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';

type Product = { id: number; name: string; unit: string; quantity: number; sellingPrice: number | null };
type Movement = { id: string; type: string; quantityChange: number; quantityBefore: number; quantityAfter: number; productName: string; unit: string; note: string; createdAt: string };
const labels: Record<string, string> = { SALE: 'Bán hàng', RECEIPT: 'Nhập hàng', ADJUSTMENT: 'Điều chỉnh', OPENING: 'Tồn đầu kỳ' };

export default function StockActivity({ items, revision, onChanged, onLogout, mode = 'activity' }: { items: Product[]; revision: number; onChanged: () => Promise<void>; onLogout: () => void; mode?: 'activity' | 'history' }) {
  const [itemId, setItemId] = useState('');
  const type = 'RECEIPT';
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [occurredOn, setOccurredOn] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
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
  const selected = items.find((item) => item.id === Number(itemId));
  useEffect(() => {
    let active = true;
    api.get<{ movements: Movement[]; hasMore: boolean }>('/inventory/history', { params: { page } })
      .then(({ data }) => { if (active) { setRows(data.movements); setMore(data.hasMore); setHistoryError(''); } })
      .catch((issue: unknown) => { if (active) { setHistoryError(getApiError(issue)); if (isUnauthenticated(issue)) onLogout(); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, reload, revision, onLogout]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !selected) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const body = { type, quantity: Number(quantity), occurredOn, ...(lotExpiryDate ? { lotExpiryDate } : {}), note: note.trim() };
    const signature = JSON.stringify({ itemId, ...body });
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      await api.post<{ movement: Movement }>(`/inventory/${itemId}/movements`, { ...body, requestId: request.current.id });
      setNotice(`Đã lưu giao dịch ngày ${occurredOn}. Bạn có thể nhập trễ, hệ thống vẫn tổng hợp đúng ngày.`);
      request.current = null; setQuantity('1'); setNote(''); setLotExpiryDate(''); setOccurredOn(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })); setPage(1); setReload((value) => value + 1); setLoading(true);
      await onChanged();
    } catch (issue) { setError(getApiError(issue)); if (isUnauthenticated(issue)) onLogout(); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="stock-activity" aria-label="Nhập xuất kho">
    <div hidden={mode !== 'activity'} className="transaction-form-card">
    <h3>Ghi nhận nhập hàng</h3>
    <p className="stock-help">Mỗi lần nhập sẽ tạo một lô mới, có thể chọn ngày nhập và hạn sử dụng riêng.</p>
    <form className="inventory-form" onSubmit={submit}>
      <label className="inventory-name">Sản phẩm<select required value={itemId} disabled={busy} onChange={(e) => setItemId(e.target.value)}><option value="">Chọn sản phẩm</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} — còn {item.quantity} {item.unit}</option>)}</select></label>
      <label>Thao tác<select value="RECEIPT" disabled><option value="RECEIPT">Nhập thêm (tạo lô)</option></select></label>
      <label>Ngày giao dịch<input type="date" required max={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })} value={occurredOn} disabled={busy} onChange={(e) => setOccurredOn(e.target.value)} /><small>Quên nhập hôm qua? Chọn đúng ngày thực tế, hệ thống sẽ cộng vào báo cáo ngày đó.</small></label>
      <label>Hạn sử dụng của lô (không bắt buộc)<input type="date" min={occurredOn} value={lotExpiryDate} disabled={busy} onChange={(e) => setLotExpiryDate(e.target.value)} /><small>Ngày này có thể ở tương lai; đây là hạn dùng, không phải ngày nhập.</small></label>
      <label>Số lượng{selected ? ` (${selected.unit})` : ''}<input type="number" required min="1" max="2147483647" step="1" disabled={busy} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
      <label className="inventory-name">Ghi chú (không bắt buộc)<input value={note} disabled={busy} maxLength={250} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: bán tại quầy, nhập từ nhà cung cấp…" /></label>
      <div className="inventory-actions"><button className="primary-button" disabled={busy || !selected}>{busy ? 'Đang ghi nhận…' : 'Ghi nhận nhập hàng'}</button></div>
    </form>
    {error && <p className="error-notice" role="alert">{error}</p>}{notice && <p className="inventory-notice" role="status">{notice}</p>}
    </div>
    <div hidden={mode !== 'history'}>
    <div className="inventory-heading"><h3>Lịch sử nhập / xuất</h3><button className="inventory-refresh" disabled={loading} onClick={() => { setLoading(true); setReload((value) => value + 1); }}>Tải lại lịch sử</button></div>
    {historyError ? <p role="alert" className="error-notice">{historyError}</p> : loading ? <p role="status">Đang tải lịch sử…</p> : !rows.length ? <p className="inventory-empty">Chưa có giao dịch ở trang này.</p> : <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Thời gian</th><th>Sản phẩm</th><th>Thao tác</th><th>Thay đổi</th><th>Tồn trước → sau</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td><td><strong>{row.productName}</strong><small>{row.note}</small></td><td>{labels[row.type] || row.type}</td><td className={row.quantityChange < 0 ? 'stock-out' : 'stock-in'}>{row.quantityChange > 0 ? '+' : ''}{row.quantityChange} {row.unit}</td><td>{row.quantityBefore} → {row.quantityAfter}</td></tr>)}</tbody></table></div>}
    <div className="stock-pagination"><button className="secondary-button" disabled={loading || page === 1} onClick={() => { setLoading(true); setPage(page - 1); }}>Trước</button><span>Trang {page}</span><button className="secondary-button" disabled={loading || !more} onClick={() => { setLoading(true); setPage(page + 1); }}>Sau</button></div>
    </div>
  </section>;
}
