import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, getApiError, isUnauthenticated } from '../services/api';
import './store-inventory.css';
import StockActivity from './StockActivity';
import ProfilePage from './ProfilePage';
import RestockPage from './RestockPage';
import SalesCalendar from './SalesCalendar';
import StoreCatalog from './StoreCatalog';
import OrderList from '../components/OrderList';
import Brand from '../components/Brand';
import Icon from '../components/Icon';
import type { AuthUser } from '../types/auth';

type Item = { purchasePrice: number | null; sellingPrice: number | null; id: number; name: string; unit: string; quantity: number; lowThreshold: number; updatedAt: string; expiryDate: string | null; daysUntilExpiry: number | null; expiryLabel: string };
type Message = { from: 'bot' | 'user'; text: string; time?: string };
const empty = { name: '', unit: 'lon', quantity: '0', purchasePrice: '', sellingPrice: '', expiryDate: '' };
const examples = ['Coca còn bao nhiêu?', 'Hàng nào sắp hết hạn?', 'Ngày nào nên nhập hàng?', 'Cuối tuần nên nhập gì?'];
const tabs = [
  { id: 'overview', label: 'Tổng quan', icon: 'store' },
  { id: 'inventory', label: 'Kho hàng', icon: 'box' },
  { id: 'catalog', label: 'Tìm nguồn sỉ', icon: 'store' },
  { id: 'orders', label: 'Đơn mua hàng', icon: 'box' },
  { id: 'activity', label: 'Nhập / bán hàng', icon: 'arrow' },
  { id: 'history', label: 'Lịch sử giao dịch', icon: 'check' },
  { id: 'calendar', label: 'Lịch nhập dự kiến', icon: 'sparkle' },
  { id: 'restock', label: 'Kế hoạch nhập', icon: 'sparkle' },
  { id: 'profile', label: 'Thông tin cá nhân', icon: 'user' },
] as const;
type StoreTab = typeof tabs[number]['id'];

export default function StoreInventory({ user, onLogout, onSignOut, signingOut }: { user: AuthUser; onLogout: () => void; onSignOut: () => void; signingOut: boolean }) {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user.name);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const { '*': page = '' } = useParams();
  const activeTab = tabs.find((tab) => tab.id === (page || 'overview'))?.id;
  function setActiveTab(tab: StoreTab) { navigate(tab === 'overview' ? '/store' : `/store/${tab}`); }
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenu = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLDialogElement>(null);
  const editVersion = useRef<string | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [aiMode, setAiMode] = useState('Chưa bật AI · Tra cứu cơ bản');
  const [messages, setMessages] = useState<Message[]>([{ from: 'bot', text: 'Chào bạn! Mình giúp tra cứu số lượng trong kho. Hãy hỏi tên sản phẩm hoặc xem những hàng sắp hết nhé.' }]);
  const chatEnd = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!accountOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenu.current?.contains(event.target)) setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setAccountOpen(false); accountTrigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [accountOpen]);

  useEffect(() => {
    document.title = `${tabs.find((tab) => tab.id === activeTab)?.label ?? 'Cửa hàng'} · SupplyMind AI`;
    return () => { document.title = 'SupplyMind AI'; };
  }, [activeTab]);

  useEffect(() => {
    let active = true;
    api.get<{ items: Item[] }>('/inventory').then(({ data }) => { if (active) setItems(data.items); })
      .catch((issue: unknown) => { if (active) { if (isUnauthenticated(issue)) onLogout(); else setError(getApiError(issue)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onLogout]);
  useEffect(() => { if (chatOpen) chatEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages, asking, chatOpen]);
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
      const payload = { purchasePrice: form.purchasePrice === '' ? null : Number(form.purchasePrice), sellingPrice: form.sellingPrice === '' ? null : Number(form.sellingPrice), name: form.name.trim(), unit: form.unit.trim(), quantity: Number(form.quantity), expiryDate: form.expiryDate || null, expectedUpdatedAt: editing === null ? undefined : editVersion.current };
      if (editing === null) await api.post('/inventory', payload);
      else await api.put(`/inventory/${editing}`, payload);
      setForm(empty); setEditing(null); editor.current?.close(); setNotice('Đã lưu sản phẩm vào kho.');
      await refresh();
    } catch (issue) { if (isUnauthenticated(issue)) onLogout(); else setError(getApiError(issue)); }
    finally { setSaving(false); }
  }
  async function ask(value: string) {
    if (!value.trim() || asking) return;
    setQuestion(''); setAsking(true);
    setMessages((current) => [...current.slice(-39), { from: 'user', text: value }]);
    try {
      const { data } = await api.post<{ answer: string; checkedAt: string; mode: string }>('/advisor/chat', { message: value, history: messages.slice(-6).map(m => ({ role: m.from === 'bot' ? 'assistant' : 'user', content: m.text.slice(0, 1500) })) }, { timeout: 35000 });
      setAiMode(data.mode === 'AI' ? 'AI đang kết nối' : data.mode === 'RULES' ? 'Chưa bật AI · Tra cứu cơ bản' : 'AI tạm không khả dụng');
      setMessages((current) => [...current, { from: 'bot', text: data.answer, time: data.checkedAt }]);
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setMessages((current) => [...current, { from: 'bot', text: getApiError(issue) }]);
    } finally { setAsking(false); }
  }
  function edit(item: Item) {
    editVersion.current = item.updatedAt;
    setEditing(item.id); setForm({ purchasePrice: item.purchasePrice?.toString() ?? '', sellingPrice: item.sellingPrice?.toString() ?? '', name: item.name, unit: item.unit, quantity: String(item.quantity), expiryDate: item.expiryDate?.slice(0, 10) || '' });
    setNotice(''); setError(''); editor.current?.showModal(); nameInput.current?.focus();
  }
  const soon = items.filter((item) => item.quantity > 0 && item.daysUntilExpiry !== null && item.daysUntilExpiry >= 0 && item.daysUntilExpiry <= 15);
  const expired = items.filter((item) => item.quantity > 0 && item.daysUntilExpiry !== null && item.daysUntilExpiry < 0);
  const out = items.filter((item) => item.quantity === 0);
  const fold = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const visible = items.filter((item) => fold(item.name).includes(fold(search)) && (filter === 'all' || (filter === 'out' && item.quantity === 0) || (filter === 'soon' && soon.includes(item)) || (filter === 'expired' && expired.includes(item))));
  function addProduct() { setEditing(null); setForm(empty); setError(''); editor.current?.showModal(); }
  function openFilter(value: string) { setFilter(value); setSearch(''); setActiveTab('inventory'); }
  if (!activeTab) return <Navigate to="/store" replace />;
  return (
    <main className="store-dashboard">
      <aside className="store-sidebar">
        <div className="sidebar-brand"><Brand /><span>GROCERY WORKSPACE</span></div>
        <div className="sidebar-shop"><span className="shop-symbol"><Icon name="store" /></span><div><strong>Cửa hàng của bạn</strong><small>Không gian chủ tạp hóa</small></div><span className="online-dot" /></div>
        <p className="nav-caption">QUẢN LÝ CỬA HÀNG</p>
        <nav aria-label="Điều hướng cửa hàng">{tabs.filter((tab) => tab.id !== 'profile').map((tab) => <button key={tab.id} aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => setActiveTab(tab.id)}><Icon name={tab.icon} /><span>{tab.label}</span>{tab.id === 'inventory' && <small>{items.length}</small>}</button>)}</nav>
        <nav aria-label="Nguồn hàng"><button onClick={() => navigate('/store/catalog')}><Icon name="store" /><span>Tìm nguồn sỉ</span></button></nav>
        <div className="sidebar-tip"><span className="tip-icon"><Icon name="sparkle" /></span><strong>Một câu hỏi.<br />Nắm rõ cả kho.</strong><p>Tra cứu số lượng và hạn dùng với trợ lý cửa hàng.</p><button onClick={() => setChatOpen(true)}>Hỏi trợ lý <Icon name="arrow" /></button></div>
        <div className="sidebar-bottom"><span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>Chủ tạp hóa</small></div><button aria-label="Đăng xuất" title="Đăng xuất" onClick={onSignOut} disabled={signingOut}><Icon name="logout" /></button></div>
      </aside>
      <div className="store-main">
        <header className="store-topbar"><div><span className="breadcrumb">Không gian làm việc</span><span className="breadcrumb-divider">/</span><strong>{tabs.find((tab) => tab.id === activeTab)?.label}</strong></div><div className="topbar-right"><span className="today-label">{new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span><div className="account-dropdown" ref={accountMenu} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false); }}><button ref={accountTrigger} className="topbar-account account-trigger" aria-expanded={accountOpen} aria-controls="account-options" onClick={() => setAccountOpen(!accountOpen)}><span className="online-dot" /><span>@{user.username}</span><span aria-hidden="true">⌄</span></button>{accountOpen && <div id="account-options" className="account-options"><button onClick={() => { setActiveTab('profile'); setAccountOpen(false); accountTrigger.current?.focus(); }}><Icon name="user" />Thông tin cá nhân</button><button className="account-signout" onClick={() => { setAccountOpen(false); onSignOut(); }} disabled={signingOut}><Icon name="logout" />{signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</button></div>}</div></div></header>
        <div className="dashboard-content">
          {activeTab === 'catalog' ? <StoreCatalog onLogout={onLogout} /> : activeTab === 'orders' ? <OrderList kind="store" onLogout={onLogout} /> : <>
          <div className="dashboard-title"><div><p className="dashboard-eyebrow">SUPPLYMIND · CỬA HÀNG THÔNG MINH</p><h1>{activeTab === 'overview' ? `Chào bạn, ${displayName.split(' ').at(-1)}!` : tabs.find((tab) => tab.id === activeTab)?.label}</h1><p>{activeTab === 'overview' ? 'Một góc nhìn rõ ràng hơn cho ngày kinh doanh của bạn.' : activeTab === 'inventory' ? 'Mỗi mặt hàng đều trong tầm kiểm soát.' : activeTab === 'activity' ? 'Ghi nhận nhanh, số tồn luôn theo sát cửa hàng.' : activeTab === 'restock' ? 'Ước tính sức bán, chuẩn bị nguồn hàng và lưu kế hoạch của bạn.' : activeTab === 'profile' ? 'Thông tin của bạn, luôn được cập nhật.' : 'Mọi thay đổi trong kho, được ghi lại rõ ràng.'}</p></div>{(activeTab === 'overview' || activeTab === 'inventory') && <button className="dash-primary" onClick={addProduct}><span>＋</span> Thêm sản phẩm</button>}</div>
          {error && !editor.current?.open && <p className="error-notice" role="alert">{error} <button className="text-button" onClick={() => void refresh()}>Thử lại</button></p>}
          {notice && <p className="inventory-notice" role="status">✓ {notice}</p>}
          <section hidden={activeTab === 'profile' || activeTab === 'restock' || activeTab === 'calendar'} className="metric-grid" aria-label="Tổng quan kho">
            {[{ label: 'Tổng mặt hàng', value: items.length, detail: 'Trong danh mục cửa hàng', icon: 'box', color: 'green', target: 'all' }, { label: 'Đã hết hàng', value: out.length, detail: 'Cần bổ sung vào kho', icon: 'store', color: 'blue', target: 'out' }, { label: 'Gần hết hạn', value: soon.length, detail: 'Hạn dùng trong 15 ngày tới', icon: 'leaf', color: 'amber', target: 'soon' }, { label: 'Đã quá hạn', value: expired.length, detail: 'Hàng còn tồn cần kiểm tra', icon: 'shield', color: 'rose', target: 'expired' }].map((metric) => <button className={`metric-card ${metric.color}`} key={metric.label} onClick={() => openFilter(metric.target)}><div><span className="metric-icon"><Icon name={metric.icon as 'box' | 'store' | 'leaf' | 'shield'} /></span><span className="metric-corner">↗</span></div><p>{metric.label}</p><strong>{loading ? '—' : metric.value.toString().padStart(2, '0')}</strong><small>{metric.detail}</small></button>)}
          </section>
          </>}
          {activeTab === 'overview' && <>
            <section className="dashboard-hero"><div className="hero-copy"><span className="hero-pill"><span className="online-dot" /> MỖI NGÀY, CHỦ ĐỘNG HƠN</span><h2>Kho gọn gàng.<br />Kinh doanh nhẹ đầu.</h2><p>Biết mình còn gì, cần thêm gì và hàng nào cần chú ý.<br />Bắt đầu từ những cập nhật nhỏ mỗi ngày.</p><button onClick={() => setActiveTab('activity')}>Ghi nhận nhập / bán hàng <Icon name="arrow" /></button></div><div className="shop-illustration" aria-hidden="true"><div className="illustration-orbit" /><div className="shop-roof">supplymind market</div><div className="shop-awning"><i /><i /><i /><i /><i /><i /></div><div className="shop-building"><div className="shop-window"><span>▥</span><span>▥</span><span>▥</span><hr /><span>▥</span><span>▥</span><span>▥</span></div><div className="shop-door"><span>OPEN</span><i /></div></div><div className="shop-step" /><div className="illustration-tag"><Icon name="check" /> Chủ động mỗi ngày</div></div></section>
            <div className="overview-grid"><section className="dashboard-card attention-card"><div className="card-heading"><div><span className="section-kicker">ĐỪNG BỎ LỠ</span><h2>Hàng cần chú ý</h2></div><button className="dash-link" onClick={() => openFilter('soon')}>Xem kho ↗</button></div>{loading ? <p className="inventory-empty">Đang kiểm tra kho…</p> : [...expired, ...soon].length ? [...expired, ...soon].slice(0, 4).map((item) => <button className="attention-row" key={item.id} onClick={() => { setActiveTab('inventory'); edit(item); }}><span className={`product-avatar ${item.daysUntilExpiry! < 0 ? 'rose' : 'amber'}`}><Icon name="box" /></span><span><strong>{item.name}</strong><small>Còn {item.quantity} {item.unit}</small></span><span className={`status-pill ${item.daysUntilExpiry! < 0 ? 'danger' : 'warning'}`}>{item.expiryLabel}</span></button>) : <div className="calm-state"><span><Icon name="check" /></span><h3>Kho hôm nay khá ổn!</h3><p>Không có hàng còn tồn với hạn dùng đã nhập nằm trong diện cảnh báo.</p></div>}</section><section className="dashboard-card quick-card"><span className="section-kicker">THAO TÁC NHANH</span><h2>Bạn muốn làm gì?</h2><button onClick={addProduct}><span className="quick-symbol">＋</span><span><strong>Thêm mặt hàng mới</strong><small>Mở rộng danh mục cửa hàng</small></span><Icon name="arrow" /></button><button onClick={() => setActiveTab('history')}><span className="quick-symbol"><Icon name="check" /></span><span><strong>Xem lịch sử kho</strong><small>Theo dõi từng lần nhập, bán</small></span><Icon name="arrow" /></button><button onClick={() => setChatOpen(true)}><span className="quick-symbol"><Icon name="sparkle" /></span><span><strong>Hỏi trợ lý tồn kho</strong><small>Tra cứu nhanh bằng tiếng Việt</small></span><Icon name="arrow" /></button></section></div>
          </>}
          {activeTab === 'inventory' && <section className="dashboard-card product-card"><div className="card-heading"><div><span className="section-kicker">DANH MỤC CỬA HÀNG</span><h2>Hàng hóa của bạn <span className="count-chip">{items.length}</span></h2></div><button className="inventory-refresh" disabled={loading || saving} onClick={() => void refresh()}>↻ Tải lại kho</button></div><div className="inventory-toolbar"><label className="product-search"><span aria-hidden="true">⌕</span><input aria-label="Tìm sản phẩm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm sản phẩm trong kho…" /></label><select aria-label="Lọc trạng thái kho" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="out">Đã hết hàng</option><option value="soon">Sắp hết hạn</option><option value="expired">Đã quá hạn</option></select></div>
            {loading ? <p role="status" className="inventory-empty">Đang tải kho hàng…</p> : !visible.length ? <div className="calm-state"><span><Icon name="box" /></span><h3>{items.length ? 'Chưa tìm thấy sản phẩm' : 'Bắt đầu với mặt hàng đầu tiên'}</h3><p>{items.length ? 'Thử đổi từ khóa hoặc bộ lọc để xem thêm hàng hóa.' : 'Thêm tên hàng, số lượng và hạn dùng để quản lý kho của bạn.'}</p><button className="dash-primary" onClick={items.length ? () => { setSearch(''); setFilter('all'); } : addProduct}>{items.length ? 'Xóa bộ lọc' : '＋ Thêm sản phẩm'}</button></div> : <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Sản phẩm</th><th>Tồn kho</th><th>Giá nhập / bán</th><th>Trạng thái</th><th>Hạn sử dụng</th><th>Thao tác</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><div className="product-name-cell"><span className="product-avatar"><Icon name="box" /></span><div><strong>{item.name}</strong><small>Mã SP #{String(item.id).padStart(4, '0')}</small></div></div></td><td><strong className="quantity-number">{item.quantity}</strong> <span className="unit-label">{item.unit}</span></td><td>{item.purchasePrice === null ? 'Chưa có giá nhập' : item.purchasePrice.toLocaleString('vi-VN') + ' ₫'}<small>{item.sellingPrice === null ? 'Chưa có giá bán' : item.sellingPrice.toLocaleString('vi-VN') + ' ₫'}</small></td><td><span className={`status-pill ${item.quantity === 0 ? 'neutral' : 'available'}`}><i />{item.quantity === 0 ? 'Hết hàng' : 'Còn hàng'}</span></td><td><span className={`expiry-text ${item.daysUntilExpiry !== null && item.daysUntilExpiry < 0 ? 'expired' : item.daysUntilExpiry !== null && item.daysUntilExpiry <= 15 ? 'expiring' : ''}`}>{item.expiryLabel}</span>{item.expiryDate && <small>{item.expiryDate.slice(0, 10).split('-').reverse().join('/')}</small>}</td><td><button className="edit-product" disabled={saving} aria-label={`Sửa ${item.name}`} onClick={() => edit(item)}>Chỉnh sửa ↗</button></td></tr>)}</tbody></table></div>}<div className="table-footer">{visible.length} / {items.length} mặt hàng<span>Dữ liệu riêng của cửa hàng bạn</span></div></section>}
          <div hidden={activeTab !== 'activity' && activeTab !== 'history'} className="dashboard-card activity-card"><StockActivity items={items} revision={revision} onChanged={refresh} onLogout={onLogout} mode={activeTab === 'history' ? 'history' : 'activity'} /></div>
          <div hidden={activeTab !== 'calendar'}><SalesCalendar revision={revision} onLogout={onLogout} onChat={() => setChatOpen(true)} /></div><div hidden={activeTab !== 'restock'}><RestockPage revision={revision} onLogout={onLogout} /></div><div hidden={activeTab !== 'profile'}><ProfilePage onSaved={setDisplayName} onLogout={onLogout} /></div><footer className="dashboard-footer"><span>SupplyMind AI <i>·</i> Người bạn của nhà bán lẻ</span><span><Icon name="shield" /> Kho hàng của riêng bạn</span></footer>
        </div>
      </div>
      <dialog ref={editor} aria-label={editing === null ? 'Thêm sản phẩm mới' : 'Chỉnh sửa sản phẩm'} className="inventory-dialog" onCancel={(event) => { if (saving) event.preventDefault(); }}><div className="dialog-heading"><span className="product-avatar"><Icon name="box" /></span><div><span className="section-kicker">KHO HÀNG</span><h2>{editing === null ? 'Thêm sản phẩm mới' : 'Chỉnh sửa sản phẩm'}</h2></div><button disabled={saving} className="dialog-close" aria-label="Đóng form sản phẩm" onClick={() => editor.current?.close()}>×</button></div><form className="inventory-form" onSubmit={save}><label className="inventory-name">Tên sản phẩm<input ref={nameInput} required maxLength={100} value={form.name} disabled={saving} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Coca lon 330ml" /></label><label>Đơn vị<input required maxLength={20} value={form.unit} disabled={saving} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="lon, gói, thùng…" /></label><label>Số lượng tồn<input required type="number" min="0" max="2147483647" step="1" value={form.quantity} disabled={saving} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label><label>Giá nhập (₫ / đơn vị)<input type="number" min="0" max="2147483647" step="1" placeholder="Chưa nhập" value={form.purchasePrice} disabled={saving} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} /></label><label>Giá bán (₫ / đơn vị)<input type="number" min="0" max="2147483647" step="1" placeholder="Chưa nhập" value={form.sellingPrice} disabled={saving} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></label><label className="inventory-name">Hạn sử dụng <span className="optional-label">Không bắt buộc</span><input type="date" min="0001-01-01" max="9999-12-31" value={form.expiryDate} disabled={saving} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /><small>Nhập ngày in trên bao bì. Nhiều lô hàng? Dùng hạn gần nhất.</small></label>{error && <p className="error-notice inventory-name" role="alert">{error}</p>}<div className="inventory-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => editor.current?.close()}>Để sau</button><button className="dash-primary" disabled={saving}>{saving ? 'Đang lưu…' : editing === null ? '＋ Thêm vào kho' : 'Lưu thay đổi'}</button></div></form></dialog>
      <section className="inventory-chat floating-chat" hidden={!chatOpen} aria-label="Trợ lý tồn kho"><div className="inventory-chat-header"><span className="chat-logo"><Icon name="sparkle" /></span><div><h3>Trợ lý SupplyMind</h3><p><span className="online-dot" /> {aiMode}</p></div><button className="chat-close" aria-label="Đóng chatbox" onClick={() => setChatOpen(false)}>×</button></div><div className="inventory-messages" role="log" aria-live="polite" aria-relevant="additions">{messages.map((message, index) => <div key={index} className={`inventory-message ${message.from}`}><strong>{message.from === 'bot' ? 'SupplyMind' : 'Bạn'}</strong><p>{message.text}</p>{message.time && <small>Tra cứu lúc {new Date(message.time).toLocaleTimeString('vi-VN')}</small>}</div>)}{asking && <p role="status">Đang kiểm tra kho…</p>}<div ref={chatEnd} /></div><div className="inventory-examples">{examples.map((example) => <button key={example} disabled={asking} onClick={() => void ask(example)}>{example}</button>)}</div><form className="inventory-chat-form" onSubmit={(e) => { e.preventDefault(); void ask(question); }}><input aria-label="Câu hỏi về tồn kho" value={question} maxLength={1000} disabled={asking} onChange={(e) => setQuestion(e.target.value)} placeholder="Hỏi về hàng trong kho…" required /><button className="dash-primary" aria-label="Gửi câu hỏi" disabled={asking || !question.trim()}><Icon name="arrow" /></button></form><p className="inventory-chat-note">AI khi được cấu hình · Chỉ đọc kho của bạn, không tự đặt hàng</p></section>
      <button className="chat-launcher" aria-expanded={chatOpen} onClick={() => setChatOpen(!chatOpen)}><Icon name="sparkle" /><span>{chatOpen ? 'Thu gọn trợ lý' : 'Hỏi SupplyMind'}</span><span className="online-dot" /></button>
    </main>
  );
}


