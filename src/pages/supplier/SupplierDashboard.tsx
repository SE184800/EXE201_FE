import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../catalog.css';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import { getApiError, getApiFieldErrors, isUnauthenticated } from '../../services/api';
import { logout } from '../../services/auth.api';
import {
  getSupplierDashboard,
  saveSupplierProfile, updateSupplierOrderStatus,
  type SupplierDashboard as SupplierDashboardData, type SupplierOrder,
  type SupplierProfileInput,
} from '../../services/supplier.api';
import type { AuthUser } from '../../types/auth';

const EMPTY_PROFILE: SupplierProfileInput = {
  businessName: '',
  warehouseAddress: '',
  deliveryRadiusKm: 10,
  deliveryFee: 0
};
const STATUS_ACTIONS: Record<string, { next: string; label: string }> = {
  PENDING: { next: 'APPROVED', label: 'Duyệt đơn' },
  APPROVED: { next: 'PREPARING', label: 'Bắt đầu soạn' },
  PREPARING: { next: 'SHIPPING', label: 'Bàn giao vận chuyển' },
  SHIPPING: { next: 'DELIVERED', label: 'Xác nhận đã giao' },
};

function money(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}

function date(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

export default function SupplierDashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [data, setData] = useState<SupplierDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof SupplierProfileInput, string>>>({});
  const [notice, setNotice] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [rejectingOrder, setRejectingOrder] = useState<SupplierOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getSupplierDashboard();
      setData(next);
     if (next.profile) setProfile({
  businessName: next.profile.businessName,
  warehouseAddress: next.profile.warehouseAddress,
  deliveryRadiusKm: next.profile.deliveryRadiusKm,
  deliveryFee: next.profile.deliveryFee
});
      setError('');
    } catch (issue) {
      if (isUnauthenticated(issue)) return onLogout();
      setError(getApiError(issue));
    } finally { setLoading(false); }
  }, [onLogout]);

  useEffect(() => {
    document.title = 'SupplyMind AI · Chủ vựa';
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);


  async function handleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const saved = await saveSupplierProfile(profile);
      setData((current) => current ? { ...current, profile: saved } : current);
      setNotice('Đã lưu thông tin gian hàng và kho.');
      setProfileErrors({});
      setEditingProfile(false);
    } catch (issue) {
      setProfileErrors(getApiFieldErrors(issue, [
  'businessName',
  'warehouseAddress',
  'deliveryRadiusKm',
  'deliveryFee'
]));
      setNotice(getApiError(issue));
    } finally { setBusy(false); }
  }

  async function handleOrderStatus(order: SupplierOrder, forcedStatus?: string, suppliedReason?: string) {
    if (forcedStatus === 'REJECTED' && suppliedReason === undefined) {
      setRejectingOrder(order);
      setRejectReason('');
      setRejectError('');
      return;
    }
    const action = forcedStatus ? { next: forcedStatus, label: 'Từ chối' } : STATUS_ACTIONS[order.status];
    if (!action) return;
    const normalizedReason = action.next === 'REJECTED' ? suppliedReason?.trim() : undefined;
    setBusy(true); setNotice('');
    try { const saved = await updateSupplierOrderStatus(order.id, action.next, normalizedReason); setData(await getSupplierDashboard()); setNotice(`Đơn #${order.id} đã chuyển sang “${saved.statusLabel}”.`); }
    catch (issue) { if (isUnauthenticated(issue)) onLogout(); else setNotice(getApiError(issue)); }
    finally { setBusy(false); }
  }

  function submitRejection() {
    if (!rejectingOrder) return;
    if (rejectReason.trim().length < 3) {
      setRejectError('Nhập lý do từ 3 ký tự trở lên.');
      return;
    }
    const order = rejectingOrder;
    const reason = rejectReason;
    setRejectingOrder(null);
    setRejectReason('');
    setRejectError('');
    void handleOrderStatus(order, 'REJECTED', reason);
  }

  async function handleLogout() { setBusy(true); try { await logout(); onLogout(); } catch (issue) { setNotice(getApiError(issue)); } finally { setBusy(false); } }

  if (loading) return <main className="supplier-page supplier-loading"><Brand /><p>Đang tải không gian chủ vựa…</p></main>;
  if (error) return <main className="supplier-page supplier-loading"><Brand /><p className="error-notice">{error}</p><button className="primary-button supplier-retry" onClick={() => void load()}>Thử lại</button></main>;

  return (
    <main className="supplier-page">
      <header className="supplier-header"><Brand /><div className="supplier-header-actions"><span><strong>{user.name}</strong><small>Chủ vựa / Đại lý bỏ mối</small></span><button className="secondary-button" onClick={handleLogout} disabled={busy}><Icon name="logout" /> Đăng xuất</button></div></header>
      <section className="supplier-main">
        <nav className="catalog-nav" aria-label="Chủ vựa"><Link to="/supplier" aria-current="page">Tổng quan & đơn hàng</Link><Link to="/supplier/products">Sản phẩm đăng bán</Link></nav>
        <div className="supplier-heading"><div><p className="form-eyebrow">WHOLESALE SUPPLIER</p><h1>{data?.profile ? `Xin chào, ${user.name}` : 'Thiết lập gian hàng sỉ'}</h1><p className="form-description">{data?.profile ? 'Theo dõi hàng hóa, đơn hàng và hoạt động bán sỉ trong một nơi.' : 'Hoàn thiện thông tin kho để bắt đầu nhận đơn từ các tiệm tạp hóa.'}</p></div><button className="ghost-button" onClick={() => void load()} disabled={busy}>↻ Làm mới</button></div>
        {notice && <p className={notice.includes('Đã') || notice.includes('đã') ? 'supplier-success' : 'error-notice'} role="status">{notice}</p>}
        {!data?.profile ? <ProfileForm value={profile} errors={profileErrors} busy={busy} onChange={setProfile} onSubmit={handleProfile} /> : <>
          <section className="supplier-kpis"><Kpi label="Sản phẩm đang bán" value={data.summary.productCount} note="Trong danh mục" /><Kpi label="Sắp hết hàng" value={data.summary.lowStockCount} note="Tồn kho ≤ MOQ" tone={data.summary.lowStockCount > 0 ? 'warning' : undefined} /><Kpi label="Đơn chờ duyệt" value={data.summary.pendingOrders} note="Cần xử lý" tone={data.summary.pendingOrders > 0 ? 'warning' : undefined} /><Kpi label="Doanh thu đã giao" value={money(data.summary.deliveredRevenue)} note="Tổng đơn hoàn tất" /></section>
          <section className="supplier-panel supplier-profile-strip"><div><span className="supplier-panel-label">GIAN HÀNG & KHO</span><h2>{data.profile.businessName}</h2><p>{data.profile.warehouseAddress} · Bán kính giao {data.profile.deliveryRadiusKm} km</p></div><button className="ghost-button" disabled={busy} onClick={() => setEditingProfile((value) => !value)}>Chỉnh sửa</button></section>
          {editingProfile && <ProfileForm value={profile} errors={profileErrors} busy={busy} onChange={setProfile} onSubmit={handleProfile} />}
          <section className="store-catalog-entry"><div><h2>Đăng hàng cho các tiệm tạp hóa</h2><p>Thêm sản phẩm, cập nhật giá sỉ và quản lý hàng đang hiển thị.</p></div><Link className="ghost-button catalog-link" to="/supplier/products">Sản phẩm đăng bán →</Link></section>
          <OrderPanel orders={data.orders} busy={busy} onStatus={handleOrderStatus} />
          <section className="supplier-coming-grid"><Coming title="AI Retail Assistant" text="Hỏi đáp và lập kế hoạch gom hàng theo ngân sách." /><Coming title="Khuyến mãi & tiếp thị sỉ" text="Đăng chương trình giảm giá và chiết khấu bậc thang." /><Coming title="AI Trend Alert" text="Cảnh báo nhu cầu thị trường theo thời tiết và khu vực." /></section>
        </>}
      </section>
      {rejectingOrder && <RejectDialog order={rejectingOrder} reason={rejectReason} error={rejectError} busy={busy} onChange={(value) => { setRejectReason(value); setRejectError(''); }} onCancel={() => { setRejectingOrder(null); setRejectReason(''); setRejectError(''); }} onSubmit={submitRejection} />}
    </main>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string | number; note: string; tone?: 'warning' }) { return <article className={`supplier-kpi ${tone ? 'supplier-kpi-warning' : ''}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }

function ProfileForm({ value, errors, busy, onChange, onSubmit }: { value: SupplierProfileInput; errors: Partial<Record<keyof SupplierProfileInput, string>>; busy: boolean; onChange: (value: SupplierProfileInput) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="supplier-panel supplier-form" onSubmit={onSubmit}><div className="supplier-panel-title"><div><span className="supplier-panel-label">BƯỚC 1</span><h2>Thông tin gian hàng</h2></div><span className="supplier-required">Bắt buộc</span></div><div className="supplier-form-grid"><Field label="Tên gian hàng / đại lý" error={errors.businessName}><input value={value.businessName} onChange={(event) => onChange({ ...value, businessName: event.target.value })} placeholder="Đại lý Minh Phát" disabled={busy} /></Field><Field label="Bán kính nhận giao hàng (km)" error={errors.deliveryRadiusKm}><input type="number" min="0.01" max="500" step="0.01" value={value.deliveryRadiusKm} onChange={(event) => onChange({ ...value, deliveryRadiusKm: Number(event.target.value) })} disabled={busy} /></Field><Field label="Địa chỉ kho bãi" error={errors.warehouseAddress} full><input value={value.warehouseAddress} onChange={(event) => onChange({ ...value, warehouseAddress: event.target.value })} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" disabled={busy} /></Field></div><button className="primary-button supplier-submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu và bắt đầu quản lý hàng sỉ'} <Icon name="arrow" /></button></form>;
}

function OrderPanel({ orders, busy, onStatus }: { orders: SupplierOrder[]; busy: boolean; onStatus: (order: SupplierOrder, forcedStatus?: string) => void }) {
  return <section className="supplier-panel order-panel"><div className="supplier-panel-title"><div><span className="supplier-panel-label">ĐIỀU PHỐI ĐƠN</span><h2>Đơn hàng từ cửa hàng</h2></div><span className="supplier-count">{orders.length} đơn</span></div>{orders.length === 0 ? <div className="order-empty"><Icon name="box" /><strong>Chưa có đơn hàng mới</strong><p>Đơn đặt hàng từ các tiệm tạp hóa sẽ hiển thị tại đây.</p></div> : <div className="order-list">{orders.map((order) => <article className="order-card" key={order.id}><div className="order-card-top"><div><strong>Đơn #{order.id}</strong><span>{date(order.createdAt)} · {order.buyer.name}</span></div><span className={`order-status order-${order.status.toLowerCase()}`}>{order.statusLabel}</span></div><div className="order-items">{order.items.map((item) => <span key={item.id}>{item.productName} × {item.quantity} {item.packaging}</span>)}</div><div className="order-card-bottom"><strong>{money(order.total)}</strong><div className="order-actions">{STATUS_ACTIONS[order.status] && <button className="table-button primary-small" onClick={() => onStatus(order)} disabled={busy}>{STATUS_ACTIONS[order.status].label}</button>}{order.status === 'PENDING' && <button className="table-button danger" onClick={() => onStatus(order, 'REJECTED')} disabled={busy}>Từ chối</button>}</div>{order.status === 'REJECTED' && <small>Lý do: {order.rejectReason}</small>}</div></article>)}</div>}</section>;
}

function Coming({ title, text }: { title: string; text: string }) { return <article className="supplier-coming"><span>SẮP CÓ</span><h3>{title}</h3><p>{text}</p></article>; }
function RejectDialog({ order, reason, error, busy, onChange, onCancel, onSubmit }: { order: SupplierOrder; reason: string; error: string; busy: boolean; onChange: (value: string) => void; onCancel: () => void; onSubmit: () => void }) {
  return <div className="supplier-dialog-backdrop" role="presentation"><section className="supplier-dialog" role="dialog" aria-modal="true" aria-labelledby="reject-dialog-title"><span className="supplier-panel-label">ĐƠN #{order.id}</span><h2 id="reject-dialog-title">Từ chối đơn hàng</h2><p>Cho cửa hàng biết lý do để họ chủ động điều chỉnh đơn.</p><label className="supplier-dialog-field"><span>Lý do từ chối</span><textarea value={reason} onChange={(event) => onChange(event.target.value)} placeholder="Ví dụ: Sản phẩm tạm hết hàng…" rows={4} maxLength={255} disabled={busy} autoFocus /></label>{error && <small className="supplier-dialog-error">{error}</small>}<div className="supplier-dialog-actions"><button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>Hủy</button><button type="button" className="table-button danger supplier-dialog-submit" onClick={onSubmit} disabled={busy}>{busy ? 'Đang xử lý…' : 'Xác nhận từ chối'}</button></div></section></div>;
}
function Field({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: ReactNode }) { return <label className={`supplier-field ${full ? 'supplier-field-full' : ''}`}><span>{label}</span><div className={error ? 'supplier-input-error' : ''}>{children}</div>{error && <small>{error}</small>}</label>; }
