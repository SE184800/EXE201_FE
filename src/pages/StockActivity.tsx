import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';
import { vnd } from '../services/storeRevenue.api';

type Product = { id: number; name: string; unit: string; quantity: number; sellingPrice: number | null };
type Movement = { id: string; type: string; quantityChange: number; quantityBefore: number; quantityAfter: number; productName: string; unit: string; note: string; createdAt: string };
const labels: Record<string, string> = { SALE: 'Bán hàng', RECEIPT: 'Nhập hàng', ADJUSTMENT: 'Điều chỉnh', OPENING: 'Tồn đầu kỳ' };

export default function StockActivity({ items, revision, onChanged, onLogout, mode = 'activity' }: { items: Product[]; revision: number; onChanged: () => Promise<void>; onLogout: () => void; mode?: 'activity' | 'history' }) {
  const [itemId, setItemId] = useState('');
  const [type, setType] = useState('SALE');
  const [quantity, setQuantity] = useState('1');
  const [salePrice, setSalePrice] = useState('');
  const [note, setNote] = useState('');
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
    const body = { type, quantity: Number(quantity), note: note.trim(), ...(type === 'SALE' ? { unitSalePrice: Number(salePrice) } : {}) };
    const signature = JSON.stringify({ itemId, ...body });
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      const { data } = await api.post<{ movement: Movement }>(`/inventory/${itemId}/movements`, { ...body, requestId: request.current.id });
      setNotice(`Đã ghi ${labels[type].toLowerCase()} ${quantity} ${selected.unit} ${selected.name}. Tồn sau giao dịch: ${data.movement.quantityAfter} ${selected.unit}.`);
      request.current = null; setQuantity('1'); setNote(''); setPage(1); setReload((value) => value + 1); setLoading(true);
      await onChanged();
    } catch (issue) { setError(getApiError(issue)); if (isUnauthenticated(issue)) onLogout(); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="stock-activity" aria-label="Nhập xuất kho">
    <div hidden={mode !== 'activity'} className="transaction-form-card">
    <h3>Ghi nhận nhập / bán hàng</h3>
    <p className="stock-help">Nhập hàng sẽ cộng tồn. Bán hàng sẽ trừ tồn và lưu giá bán để tính doanh thu; bạn có thể sửa giá thực bán của lượt này.</p>
    <form className="inventory-form" onSubmit={submit}>
      <label className="inventory-name">Sản phẩm<select required value={itemId} disabled={busy} onChange={(e) => { setItemId(e.target.value); const item = items.find(row => row.id === Number(e.target.value)); setSalePrice(item?.sellingPrice == null ? '' : String(item.sellingPrice)); }}><option value="">Chọn sản phẩm</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} — còn {item.quantity} {item.unit}</option>)}</select></label>
      <label>Thao tác<select value={type} disabled={busy} onChange={(e) => setType(e.target.value)}><option value="SALE">Bán hàng (trừ kho)</option><option value="RECEIPT">Nhập thêm (cộng kho)</option></select></label>
      <label>Số lượng{selected ? ` (${selected.unit})` : ''}<input type="number" required min="1" max="2147483647" step="1" disabled={busy} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
      {type === 'SALE' && <label className="inventory-name">Giá bán mỗi {selected?.unit || 'đơn vị'} (VNĐ)<input type="number" required min="0" max="2147483647" step="1" disabled={busy} value={salePrice} onChange={event => setSalePrice(event.target.value)} placeholder="Nhập giá thực bán" /><small>Giá lưu riêng cho lượt bán này; không đổi giá mặc định trong kho.</small></label>}
      {type === 'SALE' && salePrice !== '' && Number.isSafeInteger(Number(salePrice)) && Number(salePrice) >= 0 && Number.isSafeInteger(Number(quantity)) && Number(quantity) > 0 && <p className="stock-help inventory-name">Thành tiền: <strong>{vnd((BigInt(Number(salePrice)) * BigInt(Number(quantity))).toString())}</strong></p>}
      <label className="inventory-name">Ghi chú (không bắt buộc)<input value={note} disabled={busy} maxLength={250} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: bán tại quầy, nhập từ nhà cung cấp…" /></label>
      <div className="inventory-actions"><button className="primary-button" disabled={busy || !selected}>{busy ? 'Đang ghi nhận…' : type === 'SALE' ? 'Ghi nhận bán hàng' : 'Ghi nhận nhập hàng'}</button></div>
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
