import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';
import './store-inventory.css';
import StockActivity from './StockActivity';

type Item = { id: number; name: string; unit: string; quantity: number; lowThreshold: number; updatedAt: string; expiryDate: string | null; daysUntilExpiry: number | null; expiryLabel: string };
type Message = { from: 'bot' | 'user'; text: string; time?: string };
const empty = { name: '', unit: 'lon', quantity: '0', expiryDate: '' };
const examples = ['Coca còn bao nhiêu?', 'Hàng nào sắp hết hạn?', 'Xem kho'];

export default function StoreInventory({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [activeTab, setActiveTab] = useState<'inventory' | 'activity'>('inventory');
  const editVersion = useRef<string | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ from: 'bot', text: 'Chào bạn! Mình giúp tra cứu số lượng trong kho. Hãy hỏi tên sản phẩm hoặc xem những hàng sắp hết nhé.' }]);
  const chatEnd = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    api.get<{ items: Item[] }>('/inventory').then(({ data }) => { if (active) setItems(data.items); })
      .catch((issue: unknown) => { if (active) { if (isUnauthenticated(issue)) onLogout(); else setError(getApiError(issue)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onLogout]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages, asking]);

  async function refresh() {
    setError(''); setLoading(true);
    try { setItems((await api.get<{ items: Item[] }>('/inventory')).data.items); setRevision((value) => value + 1); }
    catch (issue) { if (isUnauthenticated(issue)) onLogout(); else setError(getApiError(issue)); }
    finally { setLoading(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      // Send only visible fields. Vite can preserve removed fields in form state
      // during a hot update (e.g. the old lowThreshold string).
      const payload = {
        name: form.name.trim(),
        unit: form.unit.trim(),
        quantity: Number(form.quantity),
        expiryDate: form.expiryDate || null,
        expectedUpdatedAt: editing === null ? undefined : editVersion.current,
      };
      if (editing === null) await api.post('/inventory', payload);
      else await api.put(`/inventory/${editing}`, payload);
      setForm(empty); setEditing(null); setNotice('Đã lưu vào kho. Hỏi lại chatbox để xem số lượng mới.');
      await refresh();
    } catch (issue) { if (isUnauthenticated(issue)) onLogout(); else setError(getApiError(issue)); }
    finally { setSaving(false); }
  }
  async function ask(value: string) {
    if (!value.trim() || asking) return;
    setQuestion(''); setAsking(true);
    setMessages((current) => [...current.slice(-39), { from: 'user', text: value }]);
    try {
      const { data } = await api.post<{ answer: string; checkedAt: string }>('/inventory/chat', { message: value });
      setMessages((current) => [...current, { from: 'bot', text: data.answer, time: data.checkedAt }]);
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setMessages((current) => [...current, { from: 'bot', text: getApiError(issue) }]);
    } finally { setAsking(false); }
  }
  function edit(item: Item) {
    editVersion.current = item.updatedAt;
    setEditing(item.id); setForm({ name: item.name, unit: item.unit, quantity: String(item.quantity), expiryDate: item.expiryDate?.slice(0, 10) || '' });
    setNotice(''); nameInput.current?.focus();
  }
  return (
    <section className="inventory-area" aria-label="Kho hàng và trợ lý tồn kho">
      <div className="inventory-summary"><div><span>KHO CỬA HÀNG</span><h2>Biết rõ hàng mình đang có</h2><p>Cập nhật kho thủ công, tra cứu nhanh bằng câu hỏi.</p></div><div className="inventory-count"><strong>{loading ? '…' : items.length}</strong><span>mặt hàng</span></div></div>
      <div className="inventory-tabs" role="tablist" aria-label="Chức năng kho" onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'inventory' : event.key === 'End' ? 'activity' : activeTab === 'inventory' ? 'activity' : 'inventory';
        setActiveTab(next);
        document.getElementById(`tab-${next}`)?.focus();
      }}>
        <button id="tab-inventory" role="tab" aria-selected={activeTab === 'inventory'} aria-controls="panel-inventory" tabIndex={activeTab === 'inventory' ? 0 : -1} onClick={() => setActiveTab('inventory')}>Kho hàng & chatbox</button>
        <button id="tab-activity" role="tab" aria-selected={activeTab === 'activity'} aria-controls="panel-activity" tabIndex={activeTab === 'activity' ? 0 : -1} onClick={() => setActiveTab('activity')}>Nhập / bán hàng & lịch sử</button>
      </div>
      <div id="panel-inventory" role="tabpanel" aria-labelledby="tab-inventory" hidden={activeTab !== 'inventory'}>
      <div className="inventory-layout">
        <section className="inventory-panel">
          <div className="inventory-heading"><h3>{editing === null ? 'Thêm hàng vào kho' : 'Cập nhật sản phẩm'}</h3><button type="button" className="inventory-refresh" disabled={loading || saving} onClick={() => void refresh()}>Tải lại kho</button></div>
          <form className="inventory-form" onSubmit={save}>
            <label className="inventory-name">Tên sản phẩm<input ref={nameInput} required maxLength={100} value={form.name} disabled={saving} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Coca lon 330ml" /></label>
            <label>Đơn vị<input required maxLength={20} value={form.unit} disabled={saving} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="lon, gói, thùng…" /></label>
            <label>Số lượng tồn<input required type="number" min="0" max="2147483647" step="1" value={form.quantity} disabled={saving} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
            <label className="inventory-name">Hạn sử dụng (không bắt buộc)<input type="date" min="0001-01-01" max="9999-12-31" value={form.expiryDate} disabled={saving} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /><small>Nhập ngày in trên bao bì. Nếu có nhiều lô, dùng hạn gần nhất; hiện chưa quản lý riêng từng lô.</small></label><div className="inventory-actions"><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu…' : editing === null ? 'Thêm sản phẩm' : 'Lưu thay đổi'}</button>{editing !== null && <button type="button" className="secondary-button" disabled={saving} onClick={() => { setEditing(null); setForm(empty); }}>Hủy sửa</button>}</div>
          </form>
          {error && <p className="error-notice" role="alert">{error}</p>}
          {notice && <p className="inventory-notice" role="status">{notice}</p>}
          <div className="inventory-heading"><h3>Hàng hóa của bạn</h3><span>{items.filter((item) => item.quantity === 0).length} đã hết hàng</span></div>
          {loading ? <p role="status">Đang tải kho…</p> : !items.length ? <p className="inventory-empty">Chưa có hàng trong kho. Thêm sản phẩm đầu tiên bằng biểu mẫu phía trên.</p> : <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Sản phẩm</th><th>Tồn kho</th><th>Trạng thái</th><th>Hạn sử dụng</th><th><span className="inventory-sr">Thao tác</span></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>Cập nhật {new Date(item.updatedAt).toLocaleString('vi-VN')}</small></td><td>{item.quantity} {item.unit}</td><td><span className={`stock-badge ${item.quantity === 0 ? 'stock-low' : ''}`}>{item.quantity === 0 ? 'Hết hàng' : 'Còn hàng'}</span></td><td><span className={`stock-badge ${item.daysUntilExpiry !== null && item.daysUntilExpiry <= 7 ? 'stock-low' : ''}`}>{item.expiryLabel}</span>{item.expiryDate && <small>{item.expiryDate.slice(0, 10).split('-').reverse().join('/')}</small>}</td><td><button type="button" className="text-button" disabled={saving} aria-label={`Sửa ${item.name}`} onClick={() => edit(item)}>Sửa</button></td></tr>)}</tbody></table></div>}
        </section>
        <section className="inventory-chat" aria-labelledby="inventory-chat-title">
          <div className="inventory-chat-header"><span className="inventory-chat-dot" /><div><h3 id="inventory-chat-title">Trợ lý tồn kho</h3><p>Tra cứu theo mẫu câu · Chỉ đọc dữ liệu</p></div></div>
          <div className="inventory-messages" role="log" aria-live="polite" aria-relevant="additions">{messages.map((message, index) => <div key={index} className={`inventory-message ${message.from}`}><strong>{message.from === 'bot' ? 'Trợ lý' : 'Bạn'}</strong><p>{message.text}</p>{message.time && <small>Tra cứu lúc {new Date(message.time).toLocaleTimeString('vi-VN')}. Theo lần cập nhật kho gần nhất.</small>}</div>)}{asking && <p role="status">Đang kiểm tra kho…</p>}<div ref={chatEnd} /></div>
          <div className="inventory-examples">{examples.map((example) => <button key={example} disabled={asking} onClick={() => void ask(example)}>{example}</button>)}</div>
          <form className="inventory-chat-form" onSubmit={(e) => { e.preventDefault(); void ask(question); }}><label className="inventory-sr" htmlFor="inventory-question">Câu hỏi về tồn kho</label><input id="inventory-question" value={question} maxLength={300} disabled={asking} onChange={(e) => setQuestion(e.target.value)} placeholder="Hỏi về hàng trong kho…" required /><button className="primary-button" disabled={asking || !question.trim()}>Gửi</button></form>
          <p className="inventory-chat-note">Lịch sử chat chỉ lưu trong lần mở trang này. Đổi tồn kho? Hãy gửi câu hỏi mới.</p>
        </section>
      </div>
      </div>
      <div id="panel-activity" role="tabpanel" aria-labelledby="tab-activity" hidden={activeTab !== 'activity'} className="inventory-panel inventory-activity-panel">
        <StockActivity items={items} revision={revision} onChanged={refresh} onLogout={onLogout} />
      </div>
    </section>
  );
}


