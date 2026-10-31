import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Icon from '../components/Icon';
import CheckoutDialog from '../components/CheckoutDialog';
import ProductImage from '../components/ProductImage';
import { PRODUCT_CATEGORIES, type CatalogProduct } from '../services/catalog.api';
import { getApiError, isUnauthenticated } from '../services/api';
import { getCatalog, getCatalogSuppliers, type CatalogPage } from '../services/catalog.api';
import type { SupplierProfile } from '../services/supplier.api';
import './catalog.css';

export default function StoreCatalog({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<CatalogPage>({ products: [], page: 1, hasMore: false });
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<CatalogProduct[]>(() => {
    try {
      const saved = localStorage.getItem('supplymind_catalog_selected_products');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [checkoutProducts, setCheckoutProducts] = useState<CatalogProduct[] | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('supplymind_catalog_selected_products', JSON.stringify(selectedProducts));
    } catch {}
  }, [selectedProducts]);

  const uniqueSupplierCount = useMemo(() => {
    return new Set(selectedProducts.map((p) => p.supplier.id)).size;
  }, [selectedProducts]);

  function toggleSelect(product: CatalogProduct) {
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      }
      return [...prev, product];
    });
  }
  const [category, setCategory] = useState(''),
    [minPrice, setMinPrice] = useState(''),
    [maxPrice, setMaxPrice] = useState(''),
    [inStock, setInStock] = useState(false);
  const [q, setQ] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [filter, setFilter] = useState({
    q: '',
    supplierId: '',
    page: 1,
    category: '',
    minPrice: '',
    maxPrice: '',
    inStock: '',
  });
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'SupplyMind AI · Tìm nguồn sỉ';
    const abort = new AbortController();
    Promise.all([
      getCatalog({ ...filter, supplierId: filter.supplierId || undefined }, abort.signal),
      getCatalogSuppliers(abort.signal),
    ])
      .then(([catalog, vendors]) => {
        if (!abort.signal.aborted) {
          setData(catalog);
          setSuppliers(vendors);
          setError('');
        }
      })
      .catch((issue: unknown) => {
        if (!abort.signal.aborted) {
          setError(getApiError(issue));
          if (isUnauthenticated(issue)) onLogout();
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [filter, revision, onLogout]);

  function search(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setFilter({
      q: q.trim(),
      supplierId,
      page: 1,
      category,
      minPrice,
      maxPrice,
      inStock: inStock ? 'true' : '',
    });
  }
  return (
    <section className="store-catalog" aria-label="Tìm nguồn sỉ">
      <div className="catalog-hero">
        <div>
          <p className="form-eyebrow">KẾT NỐI NGUỒN HÀNG</p>
          <h1>Tìm nguồn sỉ cho cửa hàng</h1>
          <p>
            Khám phá sản phẩm và gian hàng đang đăng bán. So sánh giá, quy cách và số lượng đặt tối
            thiểu.
          </p>
        </div>
        <Icon name="store" />
      </div>
      <form className="supplier-panel catalog-search" onSubmit={search}>
        <label>
          Tìm sản phẩm hoặc chủ vựa
          <input
            type="search"
            maxLength={150}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Ví dụ: gạo, nước ngọt, đại lý Minh Phát…"
          />
        </label>
        <label>
          Chủ vựa
          <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">Tất cả chủ vựa</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.businessName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Danh mục
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Tất cả danh mục</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Giá từ
          <input
            type="number"
            min="0"
            step="0.01"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="0 ₫"
          />
        </label>
        <label>
          Giá đến
          <input
            type="number"
            min={minPrice || 0}
            step="0.01"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Không giới hạn"
          />
        </label>
        <label className="catalog-stock-filter">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />{' '}
          Chỉ hàng còn tồn
        </label>
        <button className="primary-button" disabled={loading}>
          Tìm kiếm
        </button>
      </form>
      <div className="catalog-results-heading">
        <p>
          {loading
            ? 'Đang tải nguồn hàng…'
            : error
              ? 'Chưa tải được nguồn hàng'
              : `${data.products.length} sản phẩm trên trang ${data.page}`}
        </p>
        <button
          className="ghost-button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setRevision((value) => value + 1);
          }}
        >
          Tải lại nguồn hàng
        </button>
      </div>
      {error ? (
        <p className="error-notice" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p className="supplier-panel" role="status">
          Đang tìm sản phẩm từ các chủ vựa…
        </p>
      ) : !data.products.length ? (
        <section className="supplier-panel catalog-empty">
          <Icon name="box" />
          <h2>
            {filter.q || filter.supplierId
              ? 'Không có sản phẩm phù hợp'
              : 'Chưa có sản phẩm đăng bán'}
          </h2>
          <p>
            {filter.q || filter.supplierId
              ? 'Thử từ khóa khác hoặc xem tất cả chủ vựa.'
              : 'Khi chủ vựa đăng sản phẩm, bạn sẽ thấy nguồn hàng tại đây.'}
          </p>
          {(filter.q || filter.supplierId || filter.page > 1) && (
            <button
              className="ghost-button"
              onClick={() => {
                setQ('');
                setSupplierId('');
                setLoading(true);
                setCategory('');
                setMinPrice('');
                setMaxPrice('');
                setInStock(false);
                setFilter({
                  q: '',
                  supplierId: '',
                  page: 1,
                  category: '',
                  minPrice: '',
                  maxPrice: '',
                  inStock: '',
                });
              }}
            >
              Xem tất cả sản phẩm
            </button>
          )}
        </section>
      ) : (
        <div className="catalog-grid">
          {data.products.map((product) => {
            const isSelected = selectedProducts.some((p) => p.id === product.id);
            const isOutOfStock = product.stockQty === 0;
            const isBelowMoq = product.stockQty < product.moq;
            return (
              <article
                className={`catalog-card ${isSelected ? 'is-selected' : ''}`}
                key={product.id}
                aria-label={product.name}
              >
                <div className="catalog-card-header-row">
                  <label className="catalog-select-label">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isBelowMoq}
                      onChange={() => toggleSelect(product)}
                    />
                    <span>{isSelected ? 'Đã chọn' : 'Chọn đặt'}</span>
                  </label>
                  <span className={`catalog-badge ${isOutOfStock ? 'muted' : ''}`}>
                    {isOutOfStock
                      ? 'Hết hàng'
                      : isBelowMoq
                        ? 'Tồn dưới MOQ'
                        : 'Còn hàng'}
                  </span>
                </div>
                <ProductImage url={product.imageUrl} name={product.name} />
                <div className="catalog-card-top">
                  <span className="supplier-panel-label">{product.category}</span>
                </div>
              <span className="supplier-panel-label">{product.packaging}</span>
              <h2>{product.name}</h2>
              <strong className="catalog-price">
                {product.wholesalePrice.toLocaleString('vi-VN')} ₫{' '}
                <small>/ {product.packaging}</small>
              </strong>
              {product.previousPrice !== null && product.priceChangePercent !== null && (
                <div
                  className={`catalog-price-change ${product.priceWarning ? 'warning' : product.priceChangePercent < 0 ? 'discount' : ''}`}
                >
                  <strong>
                    {product.priceChangePercent > 0
                      ? `Giá tăng ${product.priceChangePercent.toLocaleString('vi-VN')}%`
                      : product.priceChangePercent < 0
                        ? `Giá giảm ${Math.abs(product.priceChangePercent).toLocaleString('vi-VN')}%`
                        : 'Giá không đổi'}
                  </strong>
                  <span>
                    Giá trước: {product.previousPrice.toLocaleString('vi-VN')} ₫
                    {product.priceChangedAt
                      ? ` · cập nhật ${new Date(product.priceChangedAt).toLocaleDateString('vi-VN')}`
                      : ''}
                  </span>
                  {product.priceChangeReason && (
                    <span>Lý do từ chủ vựa: {product.priceChangeReason}</span>
                  )}
                  {product.holidayPriceContext && (
                    <small>
                      Giá được tăng trong giai đoạn chuẩn bị {product.holidayPriceContext.name} (còn{' '}
                      {product.holidayPriceContext.daysUntil} ngày).
                    </small>
                  )}
                  {product.priceWarning && !product.holidayPriceContext && (
                    <small>
                      Giá tăng mạnh. Hãy kiểm tra hoặc thương lượng với chủ vựa trước khi đặt.
                    </small>
                  )}
                  {product.priceWarning && (
                    <small>
                      Hãy kiểm tra lịch sử giá hoặc thương lượng với chủ vựa trước khi đặt.
                    </small>
                  )}
                </div>
              )}
              <dl className="catalog-facts">
                <div>
                  <dt>Đặt tối thiểu</dt>
                  <dd>
                    {product.moq} × {product.packaging}
                  </dd>
                </div>
                <div>
                  <dt>Tồn tại vựa</dt>
                  <dd>
                    {product.stockQty} × {product.packaging}
                  </dd>
                </div>
              </dl>
              <div className="catalog-vendor">
                <strong>{product.supplier.businessName}</strong>
                <p>{product.supplier.warehouseAddress}</p>
                <small>Bán kính giao hàng: {product.supplier.deliveryRadiusKm} km</small>
                {product.supplier.phone && (
                  <a className="catalog-phone" href={`tel:${product.supplier.phone}`}>
                    Liên hệ chủ vựa: {product.supplier.phone}
                  </a>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    setQ('');
                    setSupplierId(String(product.supplier.id));
                    setLoading(true);
                    setFilter({
                      ...filter,
                      q: '',
                      supplierId: String(product.supplier.id),
                      page: 1,
                    });
                  }}
                >
                  Xem hàng của vựa này →
                </button>
              </div>
              <button
                className="primary-button"
                disabled={product.stockQty < product.moq}
                onClick={() => setCheckoutProducts([product])}
              >
                Đặt hàng từ vựa
              </button>
            </article>
          );
        })}
        </div>
      )}
      {!error && (
        <div className="catalog-pagination">
          <button
            className="ghost-button"
            disabled={loading || filter.page === 1}
            onClick={() => {
              setLoading(true);
              setFilter({ ...filter, page: filter.page - 1 });
            }}
          >
            Trang trước
          </button>
          <span>Trang {filter.page}</span>
          <button
            className="ghost-button"
            disabled={loading || !data.hasMore}
            onClick={() => {
              setLoading(true);
              setFilter({ ...filter, page: filter.page + 1 });
            }}
          >
            Trang sau
          </button>
        </div>
      )}
      {selectedProducts.length > 0 && (
        <aside className="catalog-selection-bar" role="region" aria-label="Danh sách đặt hàng">
          <div className="catalog-selection-info">
            <strong>Đã chọn {selectedProducts.length} mặt hàng</strong>
            <span>
              Từ {uniqueSupplierCount} chủ vựa ({uniqueSupplierCount} đơn hàng sẽ được tạo độc lập)
            </span>
          </div>
          <div className="catalog-selection-actions">
            <button
              type="button"
              className="catalog-selection-clear-btn"
              onClick={() => {
                setSelectedProducts([]);
                try {
                  localStorage.removeItem('supplymind_catalog_selected_products');
                } catch {}
              }}
            >
              Bỏ chọn tất cả
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setCheckoutProducts(selectedProducts)}
            >
              Đặt {selectedProducts.length} mặt hàng ({uniqueSupplierCount} đơn hàng) →
            </button>
          </div>
        </aside>
      )}
      {checkoutProducts && checkoutProducts.length > 0 && (
        <CheckoutDialog
          products={checkoutProducts}
          onClose={() => setCheckoutProducts(null)}
          onOrderSuccess={() => {
            setCheckoutProducts(null);
            setSelectedProducts([]);
            try {
              localStorage.removeItem('supplymind_catalog_selected_products');
            } catch {}
          }}
          onLogout={onLogout}
        />
      )}
    </section>
  );
}
