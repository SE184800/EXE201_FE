import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import { getApiError, getApiFieldErrors, isUnauthenticated } from '../../services/api';
import { createSupplierProduct, getSupplierDashboard, updateSupplierProduct, type SupplierProduct, type SupplierProductInput, type SupplierProfile } from '../../services/supplier.api';
import '../../pages/catalog.css';

const empty: SupplierProductInput = { name: '', packaging: '', wholesalePrice: 0, stockQty: 0, moq: 1, isActive: true };
const money = (value: number) => value.toLocaleString('vi-VN') + ' ₫';

export default function SupplierProducts({ onLogout }: { onLogout: () => void }) {
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fields, setFields] = useState<Partial<Record<keyof SupplierProductInput, string>>>({});
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<SupplierProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'SupplyMind AI · Sản phẩm đăng bán';
    let active = true;
    getSupplierDashboard().then((data) => {
      if (active) { setProducts(data.products); setProfile(data.profile); setLoadError(''); }
    }).catch((issue: unknown) => {
      if (active) { setLoadError(getApiError(issue)); if (isUnauthenticated(issue)) onLogout(); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onLogout, revision]);

  function remember(saved: SupplierProduct) {
    setProducts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
  }
  function edit(item: SupplierProduct) {
    setEditing(item);
    setForm({ name: item.name, packaging: item.packaging, wholesalePrice: item.wholesalePrice, stockQty: item.stockQty, moq: item.moq, isActive: item.isActive });
    setFields({}); setError(''); setNotice('');
    nameInput.current?.focus();
  }
  function cancel() { setEditing(null); setForm(empty); setFields({}); setError(''); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice(''); setFields({});
    try {
      const saved = editing ? await updateSupplierProduct(editing.id, form, editing.updatedAt) : await createSupplierProduct(form);
      remember(saved); cancel();
      setNotice(saved.isActive ? 'Đã đăng bán. Chủ tạp hóa có thể thấy sản phẩm trong Tìm nguồn sỉ.' : 'Đã lưu sản phẩm ở trạng thái ẩn.');
    } catch (issue) {
      setError(getApiError(issue)); setFields(getApiFieldErrors(issue, ['name', 'packaging', 'wholesalePrice', 'stockQty', 'moq', 'isActive']));
      if (isUnauthenticated(issue)) onLogout();
    } finally { lock.current = false; setBusy(false); }
  }
  async function toggle(item: SupplierProduct) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const saved = await updateSupplierProduct(item.id, { name: item.name, packaging: item.packaging, wholesalePrice: item.wholesalePrice, stockQty: item.stockQty, moq: item.moq, isActive: !item.isActive }, item.updatedAt);
      remember(saved);
      setNotice(saved.isActive ? 'Đã đăng lại sản phẩm cho chủ tạp hóa xem.' : 'Đã ẩn sản phẩm khỏi Tìm nguồn sỉ.');
    } catch (issue) { setError(getApiError(issue)); if (isUnauthenticated(issue)) onLogout(); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="supplier-page">
    <header className="supplier-header"><Brand /><Link className="ghost-button catalog-link" to="/supplier">← Tổng quan chủ vựa</Link></header>
    <section className="supplier-main">
      <nav className="catalog-nav" aria-label="Chủ vựa"><Link to="/supplier">Tổng quan & đơn hàng</Link><Link to="/supplier/products" aria-current="page">Sản phẩm đăng bán</Link></nav>
      <div className="supplier-heading"><div><p className="form-eyebrow">GIAN HÀNG CỦA BẠN</p><h1>Sản phẩm đăng bán</h1><p className="form-description">Đưa nguồn hàng sỉ của {profile?.businessName || 'gian hàng'} đến các tiệm tạp hóa.</p></div><button className="ghost-button" disabled={loading || busy} onClick={() => { setLoading(true); setRevision((value) => value + 1); }}>Tải lại sản phẩm</button></div>
      {loadError && <p className="error-notice" role="alert">{loadError}</p>}
      {loading ? <p role="status">Đang tải gian hàng…</p> : !loadError && !profile ? <section className="supplier-panel catalog-empty"><Icon name="store" /><h2>Thiết lập gian hàng trước khi đăng bán</h2><p>Thêm tên vựa, địa chỉ kho và bán kính giao hàng để tiệm tạp hóa biết nguồn cung.</p><Link className="primary-button catalog-link" to="/supplier">Thiết lập gian hàng</Link></section> : !loadError && <>
        {notice && <p className="supplier-success" role="status">{notice}</p>}{error && <p className="error-notice" role="alert">{error}</p>}
        <div className="publish-layout">
          <form className="supplier-panel publish-form" onSubmit={save}>
            <div className="supplier-panel-title"><div><span className="supplier-panel-label">{editing ? 'CẬP NHẬT' : 'THÊM MẶT HÀNG'}</span><h2>{editing ? 'Sửa sản phẩm' : 'Đăng sản phẩm mới'}</h2></div><Icon name="box" /></div>
            <div className="supplier-form-grid">
              <label className="supplier-field supplier-field-full">Tên sản phẩm<input ref={nameInput} required minLength={2} maxLength={150} value={form.name} disabled={busy} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nước ngọt Coca Cola 330ml" />{fields.name && <small>{fields.name}</small>}</label>
              <label className="supplier-field supplier-field-full">Quy cách / đơn vị bán<input required maxLength={50} value={form.packaging} disabled={busy} onChange={(event) => setForm({ ...form, packaging: event.target.value })} placeholder="Thùng 24 lon, bao 25kg…" />{fields.packaging && <small>{fields.packaging}</small>}</label>
              <label className="supplier-field supplier-field-full">Giá sỉ mỗi đơn vị (VNĐ)<input required type="number" min="0.01" max="1000000000" step="0.01" value={form.wholesalePrice || ''} disabled={busy} onChange={(event) => setForm({ ...form, wholesalePrice: Number(event.target.value) })} placeholder="180000" />{fields.wholesalePrice && <small>{fields.wholesalePrice}</small>}</label>
              <label className="supplier-field">Số lượng tồn<input required type="number" min="0" max="2147483647" step="1" value={form.stockQty} disabled={busy} onChange={(event) => setForm({ ...form, stockQty: Number(event.target.value) })} />{fields.stockQty && <small>{fields.stockQty}</small>}</label>
              <label className="supplier-field">Đặt tối thiểu (MOQ)<input required type="number" min="1" max="2147483647" step="1" value={form.moq} disabled={busy} onChange={(event) => setForm({ ...form, moq: Number(event.target.value) })} />{fields.moq && <small>{fields.moq}</small>}</label>
              <label className="publish-checkbox"><input type="checkbox" checked={form.isActive} disabled={busy} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /><span>Hiển thị cho chủ tạp hóa</span></label>
            </div>
            <p className="catalog-hint">Giá, tồn kho và MOQ tính theo quy cách bán đã nhập. Bỏ chọn hiển thị để lưu sản phẩm ở trạng thái ẩn.</p>
            <div className="product-form-actions"><button className="primary-button" disabled={busy}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : form.isActive ? 'Đăng bán sản phẩm' : 'Lưu sản phẩm ẩn'}</button>{editing && <button type="button" className="ghost-button" disabled={busy} onClick={cancel}>Hủy sửa</button>}</div>
          </form>
          <section aria-label="Sản phẩm của gian hàng" className="publish-list">
            <div className="supplier-panel-title"><div><span className="supplier-panel-label">DANH MỤC CỦA BẠN</span><h2>{products.length} sản phẩm</h2></div><span className="supplier-count">{products.filter((item) => item.isActive).length} đang hiển thị</span></div>
            {!products.length && <div className="supplier-panel catalog-empty"><Icon name="box" /><h3>Bắt đầu với mặt hàng đầu tiên</h3><p>Điền thông tin và bấm Đăng bán sản phẩm. Hàng sẽ xuất hiện bên chủ tạp hóa.</p></div>}
            {products.map((item) => <article className="supplier-panel publish-item" key={item.id} aria-label={item.name}>
              <div className="publish-item-heading"><div><span className="supplier-panel-label">{item.packaging}</span><h3>{item.name}</h3></div><span className={`catalog-badge ${item.isActive ? '' : 'muted'}`}>{item.isActive ? 'Đang hiển thị' : 'Đang ẩn'}</span></div>
              <strong className="catalog-price">{money(item.wholesalePrice)} <small>/ {item.packaging}</small></strong>
              <p className="catalog-hint">Tồn: {item.stockQty} · MOQ: {item.moq} {item.stockQty === 0 ? '· Hết hàng' : ''}</p>
              <div className="publish-item-actions"><button className="ghost-button" disabled={busy} onClick={() => edit(item)}>Sửa sản phẩm</button><button className="ghost-button" disabled={busy || editing !== null} onClick={() => void toggle(item)}>{item.isActive ? 'Ẩn sản phẩm' : 'Đăng lại'}</button></div>
            </article>)}
          </section>
        </div>
      </>}
    </section>
  </main>;
}
