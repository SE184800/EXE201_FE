import { useEffect, useState, type FormEvent } from 'react';
import { fillEmptySuggestions } from '../validation/restock';
import { api, getApiError, isUnauthenticated } from '../services/api';

type Forecast = { purchasePrice: number | null; itemId: number; name: string; unit: string; quantity: number; averageDailySales: number | null; daysUntilStockout: number | null; suggestedQuantity: number | null; notes: string[] };
type Plan = { id: string; name: string; note: string; horizonDays: number; safetyDays: number; updatedAt: string; lines: { purchasePrice: number | null; sourceItemId: number; productName: string; unit: string; quantity: number }[] };
const money = (value: number | bigint) => value.toLocaleString('vi-VN') + ' ₫';
function budget(lines: { quantity: number; purchasePrice: number | null }[]) {
  const selected = lines.filter((line) => Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 2147483647);
  const total = selected.reduce((sum, line) => sum + (line.purchasePrice == null ? BigInt(0) : BigInt(line.quantity) * BigInt(line.purchasePrice)), BigInt(0));
  const missing = selected.filter((line) => line.purchasePrice == null).length;
  return `${missing ? 'Tạm tính phần có giá' : 'Chi phí dự kiến'}: ${money(total)}${missing ? ` · ${missing} mặt hàng chưa có giá nhập` : ''}`;
}
export default function RestockPage({ revision, onLogout }: { revision: number; onLogout: () => void }) {
  const [view, setView] = useState<'forecast' | 'saved'>('forecast');
  const [horizon, setHorizon] = useState(7), [safety, setSafety] = useState(2);
  const [items, setItems] = useState<Forecast[]>([]), [quantities, setQuantities] = useState<Record<number, string>>({});
  const [name, setName] = useState('Kế hoạch nhập hàng'), [note, setNote] = useState('');
  const [editing, setEditing] = useState<Plan | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [plans, setPlans] = useState<Plan[]>([]), [page, setPage] = useState(1), [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    api.get(view === 'forecast' ? `/restock/forecast?horizonDays=${horizon}&safetyDays=${safety}` : `/restock/plans?page=${page}`)
      .then(({ data }) => { if (!active) return; if (view === 'forecast') setItems(data.items); else { setPlans(data.plans); setHasMore(data.hasMore); } })
      .catch((e: unknown) => { if (active) { if (view === 'forecast') setItems([]); setError(getApiError(e)); if (isUnauthenticated(e)) onLogout(); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [horizon, safety, page, view, revision, reload, onLogout]);
  function change() { setRequestId(crypto.randomUUID()); setMessage(''); }
  function refresh() { setLoading(true); setError(''); setReload((n) => n + 1); }
  function openView(next: 'forecast' | 'saved') { if (next !== view) { setLoading(true); setError(''); setView(next); } }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const lines = Object.entries(quantities).filter(([, q]) => q !== '' && Number(q) !== 0).map(([itemId, quantity]) => ({ itemId: Number(itemId), quantity: Number(quantity) }));
    try {
      const payload = { requestId, name, note, horizonDays: horizon, safetyDays: safety, lines, expectedUpdatedAt: editing?.updatedAt };
      const { data } = editing ? await api.put(`/restock/plans/${editing.id}`, payload) : await api.post('/restock/plans', payload);
      setEditing(data.plan); setMessage('Đã lưu kế hoạch. Tồn kho không thay đổi.');
    } catch (e) { setError(getApiError(e)); if (isUnauthenticated(e)) onLogout(); }
    finally { setSaving(false); }
  }
  function edit(plan: Plan) {
    setEditing(plan); setName(plan.name); setNote(plan.note); setHorizon(plan.horizonDays); setSafety(plan.safetyDays);
    setQuantities(Object.fromEntries(plan.lines.map((line) => [line.sourceItemId, String(line.quantity)]))); change(); openView('forecast');
  }
  return <section className="dashboard-card restock-card">
    <div className="card-heading"><div><span className="section-kicker">CHỦ ĐỘNG NGUỒN HÀNG</span><h2>Dự báo & kế hoạch nhập</h2></div><button className="inventory-refresh" onClick={refresh} disabled={loading || saving}>↻ Tải lại</button></div>
    <div className="restock-tabs"><button aria-pressed={view === 'forecast'} onClick={() => openView('forecast')} disabled={saving}>Gợi ý nhập hàng</button><button aria-pressed={view === 'saved'} onClick={() => openView('saved')} disabled={saving}>Kế hoạch đã lưu</button></div>
    {error && <p role="alert" className="restock-error">{error}</p>}{message && <p role="status" className="restock-success">{message}</p>}
    {loading && <p role="status">Đang tải dữ liệu…</p>}
    {view === 'forecast' ? <form onSubmit={(e) => void save(e)}><fieldset disabled={saving || loading}>
      <p className="restock-explanation">Ước tính thống kê từ tối đa 30 ngày trọn vẹn gần nhất, cần ít nhất 3 ngày theo dõi và có bán hàng. Hãy ghi nhận đầy đủ các lần bán; kết quả chưa tính mùa vụ hay thời gian giao hàng.</p>
      <div className="restock-controls"><label>Nhập đủ bán trong<select value={horizon} onChange={(e) => { setHorizon(Number(e.target.value)); setLoading(true); change(); }}>{[7, 14, 30].map((n) => <option key={n} value={n}>{n} ngày</option>)}</select></label><label>Dự phòng thêm<select value={safety} onChange={(e) => { setSafety(Number(e.target.value)); setLoading(true); change(); }}>{Array.from({ length: 8 }, (_, n) => <option key={n} value={n}>{n} ngày</option>)}</select></label><button type="button" className="inventory-refresh" onClick={() => { setQuantities(current => fillEmptySuggestions(current, items)); change(); }}>Điền đề xuất vào ô trống</button></div>
      <p className="restock-explanation">Gợi ý = mức bán trung bình × (số ngày bán + dự phòng) − tồn có thể sử dụng. Hạn gần nhất được áp dụng cho cả mặt hàng; nếu nhiều lô, cần kiểm tra lại trước khi nhập.</p>
      <div className="restock-table-wrap"><table className="restock-table"><thead><tr><th>Mặt hàng</th><th>Tồn kho</th><th>Bán/ngày</th><th>Còn đủ bán</th><th>Giá nhập</th><th>Gợi ý nhập</th><th>Số lượng bạn chọn</th></tr></thead><tbody>{items.map((item) => <tr key={item.itemId}><td><strong>{item.name}</strong><small>{item.unit}</small><details><summary>Cơ sở ước tính</summary>{item.notes.map((text) => <p key={text}>{text}</p>)}</details></td><td>{item.quantity}</td><td>{item.averageDailySales === null ? 'Chưa đủ dữ liệu' : item.averageDailySales.toLocaleString('vi-VN')}</td><td>{item.daysUntilStockout === null ? 'Chưa xác định' : `≈ ${item.daysUntilStockout.toLocaleString('vi-VN')} ngày`}</td><td>{item.purchasePrice == null ? 'Chưa có giá' : money(item.purchasePrice)}</td><td>{item.suggestedQuantity ?? 'Chọn thủ công'}</td><td><input aria-label={`Lượng nhập ${item.name}`} type="number" min="0" max="2147483647" step="1" value={quantities[item.itemId] ?? ''} placeholder="0" onChange={(e) => { setQuantities({ ...quantities, [item.itemId]: e.target.value }); change(); }} /></td></tr>)}</tbody></table></div>
      {!items.length && !loading && <p>Chưa có hàng trong kho. Thêm mặt hàng để bắt đầu lập kế hoạch.</p>}
      {Object.keys(quantities).some((id) => !items.some((i) => i.itemId === Number(id))) && <p className="restock-error">Có mặt hàng đã bị xóa khỏi kho. <button type="button" onClick={() => { setQuantities(Object.fromEntries(Object.entries(quantities).filter(([id]) => items.some((i) => i.itemId === Number(id))))); change(); }}>Bỏ các mặt hàng này</button></p>}
      <p className="restock-success">{budget(items.map((item) => ({ quantity: Number(quantities[item.itemId] ?? 0), purchasePrice: item.purchasePrice })))}</p><div className="restock-draft"><h3>{editing ? 'Chỉnh kế hoạch đã lưu' : 'Kế hoạch mới'}</h3><label>Tên kế hoạch<input required maxLength={100} value={name} onChange={(e) => { setName(e.target.value); change(); }} /></label><label>Ghi chú<textarea maxLength={500} value={note} onChange={(e) => { setNote(e.target.value); change(); }} placeholder="Nhà cung cấp, ngày dự kiến nhập…" /></label><p>Chọn số lượng lớn hơn 0 để đưa vào kế hoạch. Chi phí chưa gồm vận chuyển, chiết khấu. Giá nhập được chụp lại lúc lưu; mở sửa và lưu lại sẽ dùng giá hiện tại. Lưu kế hoạch không đặt mua hàng hay cộng hàng vào kho.</p><div className="restock-actions"><button className="dash-primary" disabled={!items.length}>{saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu kế hoạch'}</button><button type="button" className="inventory-refresh" onClick={() => { setEditing(null); setName('Kế hoạch nhập hàng'); setNote(''); setQuantities({}); change(); }}>Tạo kế hoạch mới</button></div></div>
    </fieldset></form> : !loading && <div className="restock-saved">{plans.length ? plans.map((plan) => <article key={plan.id}><div className="card-heading"><div><h3>{plan.name}</h3><small>{new Date(plan.updatedAt).toLocaleString('vi-VN')} · {plan.horizonDays} ngày + {plan.safetyDays} ngày dự phòng</small></div><button className="inventory-refresh" onClick={() => edit(plan)}>Mở chỉnh sửa</button></div>{plan.note && <p>{plan.note}</p>}<ul>{plan.lines.map((line) => <li key={line.sourceItemId}>{line.productName}: <strong>{line.quantity} {line.unit}</strong> · {line.purchasePrice == null ? 'Chưa có giá' : money(line.purchasePrice) + ' / ' + line.unit}</li>)}</ul><p><strong>{budget(plan.lines)}</strong></p></article>) : <p>Chưa có kế hoạch đã lưu.</p>}<div className="restock-actions"><button disabled={page === 1} onClick={() => { setPage(page - 1); setLoading(true); }}>Trang trước</button><span>Trang {page}</span><button disabled={!hasMore} onClick={() => { setPage(page + 1); setLoading(true); }}>Trang sau</button></div></div>}
  </section>;
}


