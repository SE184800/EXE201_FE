import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Brand from '../../components/Brand';
import TopbarBalance from '../../components/TopbarBalance';
import Icon from '../../components/Icon';
import { getApiError, isUnauthenticated } from '../../services/api';
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

export default function SupplierQuotes({ onLogout }: { onLogout: () => void }) {
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [stores, setStores] = useState<StoreProspect[]>([]);
  const [quotes, setQuotes] = useState<MarketingQuote[]>([]);
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
  });
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [lineForm, setLineForm] = useState({ productId: 0, quantity: 1, unitPrice: 0 });

  useEffect(() => {
    document.title = 'SupplyMind AI · Báo giá tiếp thị';
    let active = true;
    Promise.all([getSupplierDashboard(), getProspects(), getSupplierQuotes()])
      .then(([dashboard, prospects, quotePage]) => {
        if (!active) return;
        const available = dashboard.products.filter((item) => item.isActive && item.stockQty > 0);
        setProducts(available);
        setProfile(dashboard.profile);
        setStores(prospects);
        setQuotes(quotePage.quotes);
        setForm((current) => ({
          ...current,
          deliveryFee: dashboard.profile?.deliveryFee || 0,
          buyerId: prospects[0]?.id || 0,
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
      lineForm.unitPrice <= 0
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
        'Đã gửi báo giá đến cửa hàng. Cửa hàng có thể chấp nhận, từ chối và tạo đơn từ báo giá.',
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
      <header className="supplier-header">
        <Brand />
        <div className="supplier-header-actions">
          <TopbarBalance linkTo="/supplier/wallet" />
          <Link className="ghost-button catalog-link" to="/supplier">
            ← Tổng quan chủ vựa
          </Link>
        </div>
      </header>
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
        {loading ? (
          <p role="status">Đang tải dữ liệu báo giá…</p>
        ) : (
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
                    <span>🔒</span> 10% tổng đơn hàng (Ký quỹ qua Ví hệ thống)
                  </div>
                  <small style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Áp dụng mức cọc chuẩn 10% theo quy chuẩn sàn nhằm đảm bảo trách nhiệm đơn hàng, tránh bùng đơn mà không gây đọng vốn của tiệm tạp hóa.
                  </small>
                </div>
                <div className="supplier-field supplier-field-full quote-bank-summary">
                  <strong>Cơ chế ký quỹ bảo hộ</strong>
                  <span style={{ color: '#047857' }}>
                    🔒 Tiền cọc 10% sẽ được khóa an toàn trong Ví hệ thống của tiệm tạp hóa và tự động giải ngân vào Ví của bạn ngay khi giao hàng thành công.
                  </span>
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
                    min="0.01"
                    max="1000000000"
                    step="0.01"
                    value={lineForm.unitPrice || ''}
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
                      <span className="supplier-panel-label">BÁO GIÁ #{quote.id}</span>
                      <h3>{quote.title}</h3>
                      <p>
                        {quote.buyer?.name} · @{quote.buyer?.username}
                      </p>
                    </div>
                    <span className={`quote-status quote-${quote.status.toLowerCase()}`}>
                      {statusLabel[quote.status]}
                    </span>
                  </div>
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
        )}
      </section>
    </main>
  );
}
