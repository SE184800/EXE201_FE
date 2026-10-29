import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand';
import TopbarBalance from '../../components/TopbarBalance';
import Icon from '../../components/Icon';
import SupplierHeader from '../../components/SupplierHeader';
import type { AuthUser } from '../../types/auth';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import {
  getSupplierDashboard,
  type SupplierProduct,
  type SupplierProfile,
} from '../../services/supplier.api';
import {
  cancelMarketingQuote,
  createMarketingQuote,
  getProspects,
  getSupplierQuotes,
  type MarketingQuote,
  type StoreProspect,
} from '../../services/quote.api';
import {
  getSupplierConsignmentRequests,
  dispatchConsignmentRequest,
  rejectConsignmentRequest,
  type ConsignmentRequest,
  type DriverInfo,
} from '../../services/consignment.api';
import '../catalog.css';

const money = (value: number) => value.toLocaleString('vi-VN') + ' ₫';
const localDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const nextWeek = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return localDate(date);
};
type DraftLine = { product: SupplierProduct; quantity: number; unitPrice: number };
const statusLabel: Record<string, string> = {
  SENT: 'Chờ cửa hàng',
  ACCEPTED: 'Đã chấp nhận',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
};

export default function SupplierQuotes({ user, onLogout }: { user?: AuthUser; onLogout: () => void }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [stores, setStores] = useState<StoreProspect[]>([]);
  const [quotes, setQuotes] = useState<MarketingQuote[]>([]);
  const [activeTab, setActiveTab] = useState<'quotes' | 'consignments'>('quotes');
  const [consignmentRequests, setConsignmentRequests] = useState<ConsignmentRequest[]>([]);
  const [dispatchingRequest, setDispatchingRequest] = useState<ConsignmentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState({
    buyerId: 0,
    title: 'Báo giá tiếp thị trực tiếp',
    validUntil: nextWeek(),
    deliveryFee: 0,
    depositRate: 10,
    note: '',
    isConsignment: false,
    settlementPrice: 0,
    autoRestock: true,
    autoExchangeExpiry: true,
  });
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [lineForm, setLineForm] = useState({ productId: 0, quantity: 1, unitPrice: 0 });

  useEffect(() => {
    document.title = 'SupplyMind AI · Báo giá tiếp thị';
    let active = true;
    Promise.all([
      getSupplierDashboard(),
      getProspects(),
      getSupplierQuotes(),
      getSupplierConsignmentRequests().catch(() => [] as ConsignmentRequest[]),
      api
        .get<{ defaultDepositRate?: number; maxDepositRate?: number }>('/supplier/quotes/config')
        .catch(() => ({ data: { defaultDepositRate: 10, maxDepositRate: 50 } })),
    ])
      .then(([dashboard, prospects, quotePage, consignRequests, configRes]) => {
        if (!active) return;
        if (!dashboard.profile) {
          navigate('/supplier', { replace: true });
          return;
        }
        const available = dashboard.products.filter((item) => item.isActive && item.stockQty > 0);
        setProducts(available);
        setProfile(dashboard.profile);
        setStores(prospects);
        setQuotes(quotePage.quotes);
        setConsignmentRequests(consignRequests);
        const configuredDepositRate = configRes.data?.defaultDepositRate ?? 10;
        setForm((current) => ({
          ...current,
          deliveryFee: dashboard.profile?.deliveryFee || 0,
          buyerId: prospects[0]?.id || 0,
          depositRate: configuredDepositRate,
        }));
        if (available[0])
          setLineForm({
            productId: available[0].id,
            quantity: Math.max(1, available[0].moq),
            unitPrice: available[0].wholesalePrice,
          });
        setError('');
      })
      .catch((issue) => {
        if (active) {
          setError(getApiError(issue));
          if (isUnauthenticated(issue)) onLogout();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onLogout, revision]);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [lines],
  );
  const total = subtotal + form.deliveryFee;

  async function findStores() {
    setBusy(true);
    setError('');
    try {
      const result = await getProspects(search.trim());
      setStores(result);
      setForm((current) => ({
        ...current,
        buyerId: result.some((item) => item.id === current.buyerId)
          ? current.buyerId
          : result[0]?.id || 0,
      }));
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setBusy(false);
    }
  }

  function selectProduct(productId: number) {
    const product = products.find((item) => item.id === productId);
    if (product)
      setLineForm({
        productId,
        quantity: Math.max(1, product.moq),
        unitPrice: product.wholesalePrice,
      });
  }

  function addLine() {
    const product = products.find((item) => item.id === lineForm.productId);
    if (
      !product ||
      lineForm.quantity < 1 ||
      lineForm.quantity > product.stockQty ||
      (form.isConsignment ? lineForm.unitPrice < 0 : lineForm.unitPrice <= 0)
    ) {
      setError('Chọn sản phẩm, số lượng không vượt tồn và giá báo hợp lệ.');
      return;
    }
    setLines((current) => [
      ...current.filter((line) => line.product.id !== product.id),
      { product, quantity: lineForm.quantity, unitPrice: lineForm.unitPrice },
    ]);
    setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !form.buyerId || !lines.length) {
      setError('Chọn cửa hàng và thêm ít nhất một mặt hàng vào báo giá.');
      return;
    }
    if (
      !form.isConsignment &&
      form.depositRate > 0 &&
      (!profile?.bankName || !profile.bankAccountNumber || !profile.bankAccountHolder)
    ) {
      setError('Hãy vào Tổng quan chủ vựa và cấu hình tài khoản nhận cọc trước.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await createMarketingQuote({
        ...form,
        lines: lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          expectedUpdatedAt: line.product.updatedAt,
        })),
      });
      setLines([]);
      setNotice(
        form.isConsignment
          ? 'Đã gửi báo giá ký gửi tiếp thị (Vốn 0đ) đến cửa hàng. Tiệm có thể chấp nhận để nạp tự động vào kho!'
          : 'Đã gửi báo giá đến cửa hàng. Cửa hàng có thể chấp nhận, từ chối và tạo đơn từ báo giá.',
      );
      setRevision((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setBusy(false);
    }
  }

  async function cancel(quote: MarketingQuote) {
    if (!window.confirm(`Hủy báo giá #${quote.id} gửi cho ${quote.buyer?.name}?`)) return;
    setBusy(true);
    setError('');
    try {
      await cancelMarketingQuote(quote.id);
      setRevision((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="supplier-page">
      {user ? (
        <SupplierHeader
          user={user}
          activeNav="quotes"
          onLogout={onLogout}
        />
      ) : (
        <header className="supplier-header">
          <Brand />
          <div className="supplier-header-actions">
            <TopbarBalance linkTo="/supplier/wallet" />
            <Link className="ghost-button catalog-link" to="/supplier">
              ← Tổng quan chủ vựa
            </Link>
          </div>
        </header>
      )}
      <section className="supplier-main">
        <nav className="catalog-nav" aria-label="Chủ vựa">
          <Link to="/supplier">Tổng quan</Link>
          <Link to="/supplier/products">Sản phẩm đăng bán</Link>
          <Link to="/supplier/quotes" aria-current="page">
            Báo giá tiếp thị
          </Link>
          <Link to="/supplier/orders">Đơn hàng</Link>
          <Link to="/supplier/inventory">Kho hàng</Link>
          <Link to="/supplier/wallet">Ví & Ký quỹ</Link>
          <Link to="/supplier/subscription">Gói sử dụng</Link>
        </nav>
        <div className="supplier-heading">
          <div>
            <p className="form-eyebrow">TIẾP THỊ TẠI CỬA HÀNG</p>
            <h1>Tạo báo giá cho tạp hóa</h1>
            <p className="form-description">
              Chọn cửa hàng, mặt hàng, giá thương lượng và mức cọc. Báo giá được gửi thẳng vào tài
              khoản của cửa hàng.
            </p>
          </div>
          <button
            className="ghost-button"
            disabled={loading || busy}
            onClick={() => setRevision((value) => value + 1)}
          >
            ↻ Tải lại
          </button>
        </div>
        {notice && (
          <p className="supplier-success" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="error-notice" role="alert">
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px', margin: '14px 0 20px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={activeTab === 'quotes' ? 'primary-button' : 'ghost-button'}
            style={{ borderRadius: '8px', padding: '8px 16px', fontWeight: 600 }}
            onClick={() => setActiveTab('quotes')}
          >
            Tạo & Quản lý Báo giá ({quotes.length})
          </button>
          <button
            type="button"
            className={activeTab === 'consignments' ? 'primary-button' : 'ghost-button'}
            style={{ borderRadius: '8px', padding: '8px 16px', fontWeight: 600 }}
            onClick={() => setActiveTab('consignments')}
          >
            Yêu cầu bù hàng / đổi date ({consignmentRequests.filter((r) => r.status === 'PENDING' || r.status === 'DISPATCHED').length ? `${consignmentRequests.filter((r) => r.status === 'PENDING' || r.status === 'DISPATCHED').length} đang xử lý` : consignmentRequests.length})
          </button>
        </div>
        {loading ? (
          <p role="status">Đang tải dữ liệu báo giá…</p>
        ) : activeTab === 'quotes' ? (
          <div className="quote-layout">
            <form className="supplier-panel quote-form" onSubmit={submit}>
              <div className="supplier-panel-title">
                <div>
                  <span className="supplier-panel-label">BÁO GIÁ MỚI</span>
                  <h2>Thông tin gửi cửa hàng</h2>
                </div>
                <Icon name="store" />
              </div>
              <div className="quote-store-search">
                <input
                  maxLength={100}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm tên, username hoặc SĐT cửa hàng"
                />
                <button
                  type="button"
                  className="ghost-button"
                  disabled={busy}
                  onClick={() => void findStores()}
                >
                  Tìm
                </button>
              </div>
              <div className="supplier-form-grid">
                <label className="supplier-field supplier-field-full">
                  Cửa hàng nhận báo giá
                  <select
                    required
                    value={form.buyerId}
                    onChange={(event) => setForm({ ...form, buyerId: Number(event.target.value) })}
                  >
                    <option value={0}>Chọn cửa hàng</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name} · @{store.username}
                        {store.phone ? ` · ${store.phone}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="supplier-field supplier-field-full">
                  Tiêu đề
                  <input
                    required
                    minLength={2}
                    maxLength={150}
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                  />
                </label>
                <label className="supplier-field">
                  Có hiệu lực đến
                  <input
                    required
                    type="date"
                    min={localDate(new Date())}
                    value={form.validUntil}
                    onChange={(event) => setForm({ ...form, validUntil: event.target.value })}
                  />
                </label>
                <div className="supplier-field">
                  <span className="field-label" style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                    Tỷ lệ cọc ký quỹ (Cố định chuẩn sàn)
                  </span>
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      fontWeight: 600,
                      color: '#15803d',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {form.depositRate}% tổng đơn hàng (Ký quỹ qua Ví hệ thống)
                  </div>
                  <small style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Áp dụng mức cọc chuẩn {form.depositRate}% theo quy chuẩn sàn nhằm đảm bảo trách nhiệm đơn hàng, tránh bùng đơn mà không gây đọng vốn của tiệm tạp hóa.
                  </small>
                </div>
                <div className="supplier-field supplier-field-full quote-bank-summary">
                  <strong>Cơ chế ký quỹ bảo hộ</strong>
                  <span style={{ color: '#047857' }}>
                    Tiền cọc {form.depositRate}% sẽ được khóa an toàn trong Ví hệ thống của tiệm tạp hóa và tự động giải ngân vào Ví của bạn ngay khi giao hàng thành công.
                  </span>
                </div>
                <div className="supplier-field supplier-field-full" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: '#166534', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={form.isConsignment}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((prev) => ({
                          ...prev,
                          isConsignment: checked,
                          deliveryFee: checked ? 0 : prev.deliveryFee,
                          depositRate: checked ? 0 : 10,
                        }));
                        if (checked) {
                          setLineForm((prev) => ({ ...prev, unitPrice: 0 }));
                        }
                      }}
                    />
                    Chào hàng tiếp thị / Bán thử (Ký gửi vốn 0đ - Tiệm bán xong mới thanh toán)
                  </label>
                  {form.isConsignment && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                      <label>
                        <span style={{ color: '#374151', fontWeight: 500 }}>Giá sỉ thỏa thuận thu về (khi tiệm bán được):</span>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={form.settlementPrice || ''}
                          onChange={(e) => setForm({ ...form, settlementPrice: Number(e.target.value) })}
                          placeholder="Ví dụ: 25000"
                          style={{ width: '100%', padding: '6px 8px', marginTop: '4px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                        <small style={{ color: '#047857' }}>Tiệm nhận hàng không cần bỏ vốn trước. Khi bán được sẽ thanh toán theo giá này.</small>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1f2937' }}>
                        <input
                          type="checkbox"
                          checked={form.autoExchangeExpiry}
                          onChange={(e) => setForm({ ...form, autoExchangeExpiry: e.target.checked })}
                        />
                        <span>Cam kết thu hồi & đổi date mới 100% nếu hàng cận hạn sử dụng</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1f2937' }}>
                        <input
                          type="checkbox"
                          checked={form.autoRestock}
                          onChange={(e) => setForm({ ...form, autoRestock: e.target.checked })}
                        />
                        <span>Tự động điều xe giao bù đợt hàng mới khi tiệm bán gần hết</span>
                      </label>
                    </div>
                  )}
                </div>
                <label className="supplier-field supplier-field-full">
                  Phí giao hàng
                  <input
                    required
                    type="number"
                    min="0"
                    max="1000000000"
                    step="1"
                    value={form.deliveryFee}
                    onChange={(event) =>
                      setForm({ ...form, deliveryFee: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <div className="quote-line-builder">
                <label>
                  Sản phẩm
                  <select
                    value={lineForm.productId}
                    onChange={(event) => selectProduct(Number(event.target.value))}
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · còn {product.stockQty}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Số lượng
                  <input
                    type="number"
                    min="1"
                    max={products.find((item) => item.id === lineForm.productId)?.stockQty || 1}
                    value={lineForm.quantity}
                    onChange={(event) =>
                      setLineForm({ ...lineForm, quantity: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Giá báo / đơn vị
                  <input
                    type="number"
                    min={form.isConsignment ? 0 : 0.01}
                    max="1000000000"
                    step="0.01"
                    value={lineForm.unitPrice === 0 && form.isConsignment ? 0 : lineForm.unitPrice || ''}
                    onChange={(event) =>
                      setLineForm({ ...lineForm, unitPrice: Number(event.target.value) })
                    }
                  />
                </label>
                <button type="button" className="ghost-button" onClick={addLine}>
                  + Thêm mặt hàng
                </button>
              </div>
              <div className="quote-draft-lines">
                {lines.map((line) => (
                  <div key={line.product.id}>
                    <span>
                      <strong>{line.product.name}</strong>
                      <small>
                        {line.quantity} × {line.product.packaging} · {money(line.unitPrice)}
                      </small>
                    </span>
                    <b>{money(line.quantity * line.unitPrice)}</b>
                    <button
                      type="button"
                      aria-label={`Xóa ${line.product.name}`}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((item) => item.product.id !== line.product.id),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <label className="supplier-field">
                Lời nhắn / điều kiện giao hàng
                <textarea
                  maxLength={500}
                  rows={3}
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                  placeholder="Ví dụ: giao trong 2 ngày, giá áp dụng khi lấy đủ số lượng…"
                />
              </label>
              <div className="quote-total">
                <span>Tiền hàng: {money(subtotal)}</span>
                <span>Phí giao: {money(form.deliveryFee)}</span>
                <span>
                  Cọc chuyển khoản {form.depositRate}%: {money((total * form.depositRate) / 100)}
                </span>
                <strong>Tổng báo giá: {money(total)}</strong>
              </div>
              <button className="primary-button" disabled={busy || !lines.length || !form.buyerId}>
                {busy ? 'Đang gửi…' : 'Gửi báo giá cho cửa hàng'}
              </button>
            </form>
            <section className="quote-list">
              <div className="supplier-panel-title">
                <div>
                  <span className="supplier-panel-label">LỊCH SỬ TIẾP THỊ</span>
                  <h2>{quotes.length} báo giá gần đây</h2>
                </div>
              </div>
              {!quotes.length && (
                <div className="supplier-panel catalog-empty">
                  <Icon name="box" />
                  <h3>Chưa có báo giá</h3>
                  <p>Tạo báo giá đầu tiên sau khi gặp hoặc gọi điện tiếp thị cửa hàng.</p>
                </div>
              )}
              {quotes.map((quote) => (
                <article className="supplier-panel quote-card" key={quote.id}>
                  <div className="quote-card-head">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="supplier-panel-label">BÁO GIÁ #{quote.id}</span>
                        {quote.isConsignment && (
                          <span style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600 }}>
                            Ký gửi tiếp thị · Vốn 0đ
                          </span>
                        )}
                      </div>
                      <h3>{quote.title}</h3>
                      <p>
                        {quote.buyer?.name} · @{quote.buyer?.username}
                      </p>
                    </div>
                    <span className={`quote-status quote-${quote.status.toLowerCase()}`}>
                      {statusLabel[quote.status]}
                    </span>
                  </div>
                  {quote.isConsignment && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 10px', margin: '6px 0', fontSize: '0.88rem', color: '#166534' }}>
                      <strong>Gói chào hàng bán thử 0đ:</strong> Tiệm chỉ trả {money(quote.settlementPrice || 0)}/mặt hàng sau khi bán được.
                    </div>
                  )}
                  <div className="quote-items">
                    {quote.lines.map((line) => (
                      <span key={line.id}>
                        {line.productName} · {line.quantity} × {line.packaging} ·{' '}
                        {money(line.lineTotal)}
                      </span>
                    ))}
                  </div>
                  <div className="quote-card-total">
                    <span>
                      Hiệu lực đến{' '}
                      {new Date(quote.validUntil + 'T00:00:00').toLocaleDateString('vi-VN')} · Cọc{' '}
                      {quote.depositRate}%
                    </span>
                    <strong>{money(quote.total)}</strong>
                  </div>
                  {quote.responseNote && (
                    <p className="order-rejection">Phản hồi: {quote.responseNote}</p>
                  )}
                  <div className="publish-item-actions">
                    {quote.orderId && (
                      <Link className="ghost-button catalog-link" to="/supplier/orders">
                        Xem đơn #{quote.orderId}
                      </Link>
                    )}
                    {quote.status === 'SENT' && (
                      <button
                        className="ghost-button"
                        disabled={busy}
                        onClick={() => void cancel(quote)}
                      >
                        Hủy báo giá
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          </div>
        ) : (
          <section className="quote-list" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="supplier-panel-title">
              <div>
                <span className="supplier-panel-label">YÊU CẦU TỪ CÁC TIỆM TẠP HÓA</span>
                <h2>{consignmentRequests.length} yêu cầu cấp bù hàng & đổi date mới</h2>
              </div>
            </div>
            {!consignmentRequests.length ? (
              <div className="supplier-panel catalog-empty">
                <Icon name="box" />
                <h3>Chưa có yêu cầu nào</h3>
                <p>Khi các tiệm nhận hàng tiếp thị của bạn sắp hết hàng hoặc cận hạn sử dụng, yêu cầu bù/đổi hàng sẽ hiển thị tại đây.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {consignmentRequests.map((req) => (
                  <article className="supplier-panel quote-card" key={req.id}>
                    <div className="quote-card-head">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="supplier-panel-label">{req.id}</span>
                          {req.type === 'RESTOCK' ? (
                            <span style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                              Yêu cầu cấp bù hàng mới
                            </span>
                          ) : (
                            <span style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                              Yêu cầu thu hồi & đổi date mới
                            </span>
                          )}
                        </div>
                        <h3 style={{ margin: '4px 0' }}>{req.productName} · Cần {req.requestedQty} {req.unit}</h3>
                        <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>
                          Tiệm: <strong>{req.storeName}</strong> · SĐT: <a href={`tel:${req.storePhone}`} style={{ color: '#2563eb' }}>{req.storePhone}</a>
                          {req.storeAddress ? ` · Đ/c: ${req.storeAddress}` : ''}
                        </p>
                      </div>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: req.status === 'COMPLETED' ? '#dcfce7' : req.status === 'DISPATCHED' ? '#dbeafe' : req.status === 'REJECTED' ? '#f3f4f6' : '#fef3c7',
                        color: req.status === 'COMPLETED' ? '#15803d' : req.status === 'DISPATCHED' ? '#1d4ed8' : req.status === 'REJECTED' ? '#6b7280' : '#b45309',
                      }}>
                        {req.status === 'PENDING' && 'Chờ điều xe'}
                        {req.status === 'DISPATCHED' && 'Đang giao xe'}
                        {req.status === 'COMPLETED' && 'Đã hoàn tất'}
                        {req.status === 'REJECTED' && 'Đã từ chối'}
                      </span>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', margin: '8px 0', fontSize: '0.88rem' }}>
                      <div>Hiện tại tiệm còn: <strong>{req.currentQty} {req.unit}</strong></div>
                      {req.expiryDate && <div>HSD lô cũ tại tiệm: <strong>{req.expiryDate.split('-').reverse().join('/')}</strong></div>}
                      {req.note && <div style={{ marginTop: '4px', color: '#334155' }}><strong>Lý do từ tiệm:</strong> {req.note}</div>}
                    </div>

                    {req.driverInfo && (
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '8px 12px', margin: '8px 0', fontSize: '0.86rem', color: '#1e40af' }}>
                        <div style={{ fontWeight: 600 }}>Thông tin chuyến xe giao bù / đổi date:</div>
                        <div>Tài xế: <strong>{req.driverInfo.driverName}</strong> · SĐT: {req.driverInfo.driverPhone}</div>
                        <div>Phương tiện: {req.driverInfo.vehicleType} · Biển số: <strong>{req.driverInfo.licensePlate}</strong></div>
                        {req.driverInfo.estimatedDeliveryTime && <div>Giờ dự kiến: {req.driverInfo.estimatedDeliveryTime}</div>}
                        {req.newExpiryDate && <div>HSD lô mới bàn giao: <strong>{req.newExpiryDate.split('-').reverse().join('/')}</strong></div>}
                      </div>
                    )}

                    {req.status === 'PENDING' && (
                      <div className="publish-item-actions" style={{ marginTop: '8px' }}>
                        <button
                          type="button"
                          className="primary-button"
                          style={{ padding: '6px 14px', fontSize: '13px' }}
                          onClick={() => setDispatchingRequest(req)}
                        >
                          Lên xe giao bù & thu hồi date
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          style={{ padding: '6px 14px', fontSize: '13px' }}
                          onClick={async () => {
                            const reason = window.prompt('Nhập lý do từ chối:');
                            if (reason !== null) {
                              try {
                                await rejectConsignmentRequest(req.id, reason);
                                setRevision((r) => r + 1);
                              } catch (err) {
                                setError(getApiError(err));
                              }
                            }
                          }}
                        >
                          Từ chối
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </section>

      {dispatchingRequest && (
        <DispatchConsignmentModal
          request={dispatchingRequest}
          onClose={() => setDispatchingRequest(null)}
          onSubmit={async (driverInfo, newExpiryDate, notes) => {
            try {
              const res = await dispatchConsignmentRequest(dispatchingRequest.id, {
                driverInfo,
                newExpiryDate,
                supplierNotes: notes,
              });
              setNotice(res.message);
              setRevision((r) => r + 1);
            } catch (err) {
              setError(getApiError(err));
            }
          }}
        />
      )}
    </main>
  );
}

function DispatchConsignmentModal({
  request,
  onClose,
  onSubmit,
}: {
  request: ConsignmentRequest;
  onClose: () => void;
  onSubmit: (driverInfo: DriverInfo, newExpiryDate?: string, notes?: string) => Promise<void>;
}) {
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('Xe ba gác');
  const [licensePlate, setLicensePlate] = useState('');
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState('Trong hôm nay');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!driverName.trim() || !driverPhone.trim()) {
      setError('Vui lòng nhập họ tên và số điện thoại tài xế.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(
        {
          driverName: driverName.trim(),
          driverPhone: driverPhone.trim(),
          vehicleType,
          licensePlate: licensePlate.trim().toUpperCase(),
          estimatedDeliveryTime,
          deliveryNotes: supplierNotes.trim(),
        },
        newExpiryDate || undefined,
        supplierNotes || undefined,
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể điều xe.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="supplier-dialog-backdrop">
      <form className="supplier-dialog" onSubmit={handleSend} style={{ maxWidth: '540px' }}>
        <span className="supplier-panel-label">ĐIỀU XE GIAO BÙ & THU HỒI</span>
        <h2>{request.type === 'RESTOCK' ? 'Giao bù hàng tiếp thị' : 'Đổi date mới 100%'}</h2>
        <p style={{ margin: '4px 0 12px', fontSize: '0.88rem', color: '#4b5563' }}>
          Đến tiệm: <strong>{request.storeName}</strong> ({request.storePhone}) · Mặt hàng: <strong>{request.productName}</strong> (SL: {request.requestedQty} {request.unit})
        </p>

        {error && <p className="error-notice" role="alert">{error}</p>}

        <label className="supplier-dialog-field">
          <span>Họ tên tài xế:</span>
          <input
            required
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="Ví dụ: Nguyễn Văn Hùng"
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <label className="supplier-dialog-field" style={{ marginTop: '8px' }}>
          <span>Số điện thoại tài xế:</span>
          <input
            required
            type="tel"
            value={driverPhone}
            onChange={(e) => setDriverPhone(e.target.value)}
            placeholder="Ví dụ: 0912345678"
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
          <label className="supplier-dialog-field">
            <span>Loại phương tiện:</span>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="Xe ba gác">Xe ba gác</option>
              <option value="Xe máy (chở thùng)">Xe máy (chở thùng)</option>
              <option value="Xe tải 500kg">Xe tải 500kg</option>
              <option value="Xe tải 1 tấn">Xe tải 1 tấn</option>
              <option value="Xe van">Xe van</option>
            </select>
          </label>
          <label className="supplier-dialog-field">
            <span>Biển số xe:</span>
            <input
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              placeholder="Ví dụ: 59X1-12345"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </label>
        </div>

        {request.type === 'EXCHANGE_EXPIRY' && (
          <label className="supplier-dialog-field" style={{ marginTop: '8px' }}>
            <span>Hạn sử dụng (HSD) của lô mới bàn giao:</span>
            <input
              type="date"
              required
              value={newExpiryDate}
              onChange={(e) => setNewExpiryDate(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </label>
        )}

        <label className="supplier-dialog-field" style={{ marginTop: '8px' }}>
          <span>Dự kiến thời gian giao:</span>
          <input
            value={estimatedDeliveryTime}
            onChange={(e) => setEstimatedDeliveryTime(e.target.value)}
            placeholder="Ví dụ: Hôm nay lúc 14:30"
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <label className="supplier-dialog-field" style={{ marginTop: '8px' }}>
          <span>Ghi chú chuyến xe:</span>
          <textarea
            rows={2}
            value={supplierNotes}
            onChange={(e) => setSupplierNotes(e.target.value)}
            placeholder="Ví dụ: Tài xế sẽ đến đổi vỏ hoặc nhận lại sản phẩm cận date mang về..."
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <div className="supplier-dialog-actions" style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="ghost-button" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Đang điều xe…' : 'Xuất xe giao bù / đổi date'}
          </button>
        </div>
      </form>
    </div>
  );
}
