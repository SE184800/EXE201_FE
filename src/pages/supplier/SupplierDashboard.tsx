import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../catalog.css';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import SupplierVerification from './SupplierVerification';
import { getApiError, getApiFieldErrors, isUnauthenticated } from '../../services/api';
import { logout } from '../../services/auth.api';
import {
  getSupplierDashboard,
  saveSupplierProfile,
  type SupplierDashboard as SupplierDashboardData,
  type SupplierProfileInput,
} from '../../services/supplier.api';
import type { AuthUser } from '../../types/auth';

const EMPTY_PROFILE: SupplierProfileInput = { businessName: '', warehouseAddress: '', deliveryRadiusKm: 10, deliveryFee: 0 };

function money(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}

export default function SupplierDashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [data, setData] = useState<SupplierDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof SupplierProfileInput, string>>>({});
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getSupplierDashboard();
      setData(next);
      if (next.profile) setProfile({ businessName: next.profile.businessName, warehouseAddress: next.profile.warehouseAddress, deliveryRadiusKm: next.profile.deliveryRadiusKm, deliveryFee: next.profile.deliveryFee });
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
    event.preventDefault(); setBusy(true); setNotice(''); setNoticeError(false);
    try {
      const saved = await saveSupplierProfile(profile);
      setData((current) => current ? { ...current, profile: saved } : current);
      setNotice('Đã lưu thông tin gian hàng và kho.');
      setProfileErrors({});
      setEditingProfile(false);
    } catch (issue) {
      setNoticeError(true);
      setProfileErrors(getApiFieldErrors(issue, ['businessName', 'warehouseAddress', 'deliveryRadiusKm', 'deliveryFee']));
      setNotice(getApiError(issue));
    } finally { setBusy(false); }
  }

  async function handleLogout() { setBusy(true); try { await logout(); onLogout(); } catch (issue) { setNoticeError(true); setNotice(getApiError(issue)); } finally { setBusy(false); } }

  if (loading) return <main className="supplier-page supplier-loading"><Brand /><p>Đang tải không gian chủ vựa…</p></main>;
  if (error) return <main className="supplier-page supplier-loading"><Brand /><p className="error-notice">{error}</p><button className="primary-button supplier-retry" onClick={() => void load()}>Thử lại</button></main>;

  return (
    <main className="supplier-page">
      <header className="supplier-header"><Brand /><div className="supplier-header-actions"><span><strong>{user.name}</strong><small>Chủ vựa / Đại lý bỏ mối</small></span><button className="secondary-button" onClick={handleLogout} disabled={busy}><Icon name="logout" /> Đăng xuất</button></div></header>
      <section className="supplier-main">
        <nav className="catalog-nav" aria-label="Chủ vựa">
          <Link to="/supplier" aria-current="page">Tổng quan</Link>
          <Link to="/supplier/products">Sản phẩm đăng bán</Link>
          <Link to="/supplier/orders">Đơn hàng</Link>
          <Link to="/supplier/inventory">Kho hàng</Link>
        </nav>
        <div className="supplier-heading"><div><p className="form-eyebrow">WHOLESALE SUPPLIER</p><h1>{data?.profile ? `Xin chào, ${user.name}` : 'Thiết lập gian hàng sỉ'}</h1><p className="form-description">{data?.profile ? 'Theo dõi hàng hóa, đơn hàng và hoạt động bán sỉ trong một nơi.' : 'Hoàn thiện thông tin kho để bắt đầu nhận đơn từ các tiệm tạp hóa.'}</p></div><button className="ghost-button" onClick={() => void load()} disabled={busy}>↻ Làm mới</button></div>
        {notice && <p className={noticeError ? 'error-notice' : 'supplier-success'} role={noticeError ? 'alert' : 'status'}>{notice}</p>}
        {!data?.profile ? <ProfileForm value={profile} errors={profileErrors} busy={busy} onChange={setProfile} onSubmit={handleProfile} /> : <>
          <section className="supplier-kpis">
            <Link to="/supplier/products" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Kpi label="Sản phẩm đang bán" value={data.summary.productCount} note="Trong danh mục" />
            </Link>
            <Kpi label="Sắp hết hàng" value={data.summary.lowStockCount} note="Tồn kho ≤ MOQ" tone={data.summary.lowStockCount > 0 ? 'warning' : undefined} />
            <Link to="/supplier/orders" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Kpi label="Đơn chờ duyệt" value={data.summary.pendingOrders} note="Cần xử lý" tone={data.summary.pendingOrders > 0 ? 'warning' : undefined} />
            </Link>
            <Kpi label="Doanh thu đã giao" value={money(data.summary.deliveredRevenue)} note="Tổng đơn hoàn tất" />
          </section>
          <section className="supplier-panel supplier-profile-strip"><div><span className="supplier-panel-label">GIAN HÀNG & KHO</span><h2>{data.profile.businessName}</h2><p>{data.profile.warehouseAddress} · Bán kính giao {data.profile.deliveryRadiusKm} km</p></div><button className="ghost-button" disabled={busy} onClick={() => setEditingProfile((value) => !value)}>Chỉnh sửa</button></section>
          {editingProfile && <ProfileForm value={profile} errors={profileErrors} busy={busy} onChange={setProfile} onSubmit={handleProfile} />}
          <section className="store-catalog-entry">
            <div>
              <h2>Đăng hàng & quản lý đơn sỉ</h2>
              <p>Thêm sản phẩm, cập nhật giá sỉ và theo dõi các đơn hàng từ tiệm tạp hóa.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link className="ghost-button catalog-link" to="/supplier/products">Sản phẩm đăng bán →</Link>
              <Link className="ghost-button catalog-link" to="/supplier/orders">Đơn hàng từ cửa hàng →</Link>
            </div>
          </section>
          <SupplierVerification key={`${data.profile.id}-${data.profile.verificationVersion}`} profile={data.profile} onLogout={onLogout} onSaved={saved => setData(current => current ? { ...current, profile: saved } : current)} />
          <section className="supplier-coming-grid"><Coming title="AI Retail Assistant" text="Hỏi đáp và lập kế hoạch gom hàng theo ngân sách." /><Coming title="Khuyến mãi & tiếp thị sỉ" text="Đăng chương trình giảm giá và chiết khấu bậc thang." /><Coming title="AI Trend Alert" text="Cảnh báo nhu cầu thị trường theo thời tiết và khu vực." /></section>
        </>}
      </section>
    </main>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string | number; note: string; tone?: 'warning' }) { return <article className={`supplier-kpi ${tone ? 'supplier-kpi-warning' : ''}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }

function ProfileForm({ value, errors, busy, onChange, onSubmit }: { value: SupplierProfileInput; errors: Partial<Record<keyof SupplierProfileInput, string>>; busy: boolean; onChange: (value: SupplierProfileInput) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="supplier-panel supplier-form" onSubmit={onSubmit}><div className="supplier-panel-title"><div><span className="supplier-panel-label">BƯỚC 1</span><h2>Thông tin gian hàng</h2></div><span className="supplier-required">Bắt buộc</span></div><div className="supplier-form-grid"><Field label="Tên gian hàng / đại lý" error={errors.businessName}><input value={value.businessName} onChange={(event) => onChange({ ...value, businessName: event.target.value })} placeholder="Đại lý Minh Phát" disabled={busy} /></Field><Field label="Bán kính nhận giao hàng (km)" error={errors.deliveryRadiusKm}><input type="number" min="0.01" max="500" step="0.01" value={value.deliveryRadiusKm} onChange={(event) => onChange({ ...value, deliveryRadiusKm: Number(event.target.value) })} disabled={busy} /></Field><Field label="Phí giao hàng mỗi đơn (VNĐ)" error={errors.deliveryFee}><input type="number" min="0" max="1000000000" step="0.01" value={value.deliveryFee} onChange={(event) => onChange({ ...value, deliveryFee: Number(event.target.value) })} disabled={busy} /></Field><Field label="Địa chỉ kho bãi" error={errors.warehouseAddress} full><input value={value.warehouseAddress} onChange={(event) => onChange({ ...value, warehouseAddress: event.target.value })} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" disabled={busy} /></Field></div><button className="primary-button supplier-submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu và bắt đầu quản lý hàng sỉ'} <Icon name="arrow" /></button></form>;
}

function Coming({ title, text }: { title: string; text: string }) { return <article className="supplier-coming"><span>SẮP CÓ</span><h3>{title}</h3><p>{text}</p></article>; }

function Field({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: ReactNode }) { return <label className={`supplier-field ${full ? 'supplier-field-full' : ''}`}><span>{label}</span><div className={error ? 'supplier-input-error' : ''}>{children}</div>{error && <small>{error}</small>}</label>; }
