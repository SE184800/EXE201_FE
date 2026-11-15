import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import SupplierLayout from '../../components/SupplierLayout';
import DatePicker from '../../components/DatePicker';
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
import '../catalog.css';

const money = (value: number) => value.toLocaleString('vi-VN') + ' ₫';
const localDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const nextWeek = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return localDate(date);
};
type DraftLine = { product: SupplierProduct; quantity: number; unitPrice: number; discountRate: number };
const discountedPrice = (price: number, rate: number) => Math.round(price * (100 - rate)) / 100;
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
  });
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [lineForm, setLineForm] = useState({ productId: 0, quantity: 1, unitPrice: 0, discountRate: 0 });
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'SupplyMind AI · Báo giá tiếp thị';
    let active = true;
    Promise.all([
      getSupplierDashboard(),
      getProspects(),
      getSupplierQuotes(),
      api
        .get<{ defaultDepositRate: number }>('/supplier/quotes/config'),
    ])
      .then(([dashboard, prospects, quotePage, configRes]) => {
        if (!active) return;
        if (!dashboard.profile) {
          navigate('/supplier', { replace: true });
          return;
        }
        const available = dashboard.products.filter((item) => item.isActive && item.stockQty > 0);
        setProducts(available);
        setProfile(dashboard.profile);
        setStores(prospects);
        setQuotes(quotePage.quotes.filter(quote => !quote.isConsignment));
        const configuredDepositRate = configRes.data?.defaultDepositRate ?? 10;
        setForm((current) => ({
          ...current,
          deliveryFee: dashboard.profile?.deliveryFee || 0,
          buyerId: prospects[0]?.id || 0,
          depositRate: configuredDepositRate,
        }));
        if (available[0])
          setLineForm({
        discountRate: 0,
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
  }, [onLogout, revision, navigate]);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * discountedPrice(line.unitPrice, line.discountRate), 0),
    [lines],
  );
  const total = subtotal + form.deliveryFee;
  const depositRate = form.depositRate;
  const selectedProduct = products.find((product) => product.id === lineForm.productId);
  const productsByName = new Map(products.map((product) => [product.name, product]));
  const unitOptions = selectedProduct
    ? products.filter((product) => product.name === selectedProduct.name &&
        (product.id === selectedProduct.id || product.packaging !== selectedProduct.packaging))
    : [];

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
        discountRate: 0,
        productId,
        quantity: Math.max(1, product.moq),
        unitPrice: product.wholesalePrice,
      });
  }

  function addLine() {
    const product = products.find((item) => item.id === lineForm.productId);
    if (
      !product ||
      !Number.isInteger(lineForm.quantity) || lineForm.quantity < 1 ||
      lineForm.quantity > product.stockQty ||
      discountedPrice(lineForm.unitPrice, lineForm.discountRate) <= 0 ||
      !Number.isFinite(lineForm.discountRate) || lineForm.discountRate < 0 || lineForm.discountRate > 100
    ) {
      setError('Chọn sản phẩm, số lượng không vượt tồn và giá báo hợp lệ.');
      return;
    }
    if (lines.some((line) => line.product.id === product.id && line.product.id !== editingProductId)) {
      setError('Quy cách này đã có trong báo giá. Bấm Sửa để cập nhật.');
      return;
    }
    const updatedLine = { product, quantity: lineForm.quantity, unitPrice: lineForm.unitPrice, discountRate: lineForm.discountRate };
    setLines((current) => editingProductId === null
      ? [...current, updatedLine]
      : current.map((line) => line.product.id === editingProductId ? updatedLine : line));
    setEditingProductId(null);
    setError('');
  }

  function editLine(line: DraftLine) {
    setEditingProductId(line.product.id);
    setLineForm({
      productId: line.product.id,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountRate: line.discountRate,
    });
    setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (editingProductId !== null) {
      setError('Lưu hoặc hủy chỉnh sửa mặt hàng trước khi gửi báo giá.');
      return;
    }
    if (busy || !form.buyerId || !lines.length) {
      setError('Chọn cửa hàng và thêm ít nhất một mặt hàng vào báo giá.');
      return;
    }
    if (
      depositRate > 0 &&
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
          discountRate: line.discountRate,
          expectedUpdatedAt: line.product.updatedAt,
        })),
      });
      setLines([]);
      setNotice('Đã gửi báo giá đến cửa hàng.');
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
    <SupplierLayout
      user={user || ({ id: 0, username: 'chuvua', name: 'Chủ vựa', role: 'SUPPLIER' } as AuthUser)}
      activeNav="quotes"
      onLogout={onLogout}
      businessName={profile?.businessName}
    >
      <div>
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
                <label className="supplier-field quote-term-field">
                  Hiệu lực đến
                  <DatePicker
                    required
                    min={localDate(new Date())}
                    value={form.validUntil}
                    onChange={(val) => setForm({ ...form, validUntil: val })}
                  />
                </label>
                <div className="supplier-field quote-term-field">
                  <span>Tiền cọc</span>
                  <div className="quote-deposit-value">
                    <span>{depositRate}% tổng đơn</span>
                  </div>
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
              <div className="quote-line-builder" id="quote-line-editor">
                <label>
                  Sản phẩm
                  <select
                    value={selectedProduct?.name ?? ''}
                    onChange={(event) => {
                      const product = productsByName.get(event.target.value);
                      if (product) selectProduct(product.id);
                    }}
                  >
                    {Array.from(productsByName.values()).map((product) => (
                      <option key={product.id} value={product.name}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Đơn vị
                  <select
                    value={selectedProduct?.id ?? ''}
                    disabled={!selectedProduct}
                    onChange={(event) => selectProduct(Number(event.target.value))}
                  >
                    {!selectedProduct && <option value="">Chọn sản phẩm trước</option>}
                    {unitOptions.map((product) => (
                      <option key={product.id} value={product.id}>{product.packaging}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Số lượng
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct?.stockQty ?? 1}
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
                    min={0.01}
                    max="1000000000"
                    step="0.01"
                    value={lineForm.unitPrice || ''}
                    onChange={(event) =>
                      setLineForm({ ...lineForm, unitPrice: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Chiết khấu (%)
                  <input type="number" min="0" max="100" step="0.01" value={lineForm.discountRate}
                    onChange={e => setLineForm({ ...lineForm, discountRate: Number(e.target.value) })} />
                </label>
                <div className="quote-line-actions">
                  <button type="button" className="ghost-button" onClick={addLine}>
                    {editingProductId === null ? '+ Thêm mặt hàng' : 'Lưu mặt hàng'}
                  </button>
                  {editingProductId !== null && (
                    <button type="button" className="ghost-button" onClick={() => {
                      setEditingProductId(null);
                      selectProduct(lineForm.productId);
                      setError('');
                    }}>Hủy sửa</button>
                  )}
                  {selectedProduct && lineForm.discountRate > 0 && (
                    <small>Giá sau giảm: {money(discountedPrice(lineForm.unitPrice, lineForm.discountRate))}</small>
                  )}
                </div>
              </div>
              <div className="quote-draft-lines">
                {lines.map((line) => (
                  <div key={line.product.id}>
                    <span>
                      <strong>{line.product.name}</strong>
                      <small>
                        {line.quantity} × {line.product.packaging} · {money(discountedPrice(line.unitPrice, line.discountRate))}
                        {line.discountRate > 0 && ` (giảm ${line.discountRate}% từ ${money(line.unitPrice)})`}
                      </small>
                    </span>
                    <b>{money(line.quantity * discountedPrice(line.unitPrice, line.discountRate))}</b>
                    <button type="button" className="quote-edit-line" aria-label={`Sửa ${line.product.name}`} onClick={() => {
                      editLine(line);
                      document.getElementById('quote-line-editor')?.scrollIntoView({ block: 'nearest' });
                    }}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      aria-label={`Xóa ${line.product.name}`}
                      disabled={editingProductId === line.product.id}
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
              <div className="quote-total">
                <span>Tiền hàng: {money(subtotal)}</span>
                <span>Phí giao: {money(form.deliveryFee)}</span>
                <span>
                  Tiền cọc {depositRate}%: {money(Math.round(total * depositRate) / 100)}
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
                  <div className="quote-items">
                    {quote.lines.map((line) => (
                      <span key={line.id}>
                        {line.productName} · {line.quantity} × {line.packaging} ·{' '}
                        {money(line.lineTotal)}
                        {!!line.discountRate && <small>Giảm {line.discountRate}% · Giá gốc {money(line.originalUnitPrice ?? line.unitPrice)} · Giá sau giảm {money(line.unitPrice)}</small>}
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
      </div>

    </SupplierLayout>
  );
}

