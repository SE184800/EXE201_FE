import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogProduct } from '../services/catalog.api';
import { api, getApiError, isUnauthenticated } from '../services/api';
import { getWallet, addMockFunds, type WalletInfo } from '../services/wallet.api';

const roundToThousand = (val: number) => Math.round(val / 1000) * 1000;
const money = (n: number) => Math.round(n).toLocaleString('vi-VN') + ' ₫';
const STANDARD_DEPOSIT_RATE = 10; // Mức cọc chuẩn 10% bảo chứng hệ thống

interface CreatedOrderSummary {
  id: number;
  supplierName: string;
  total: number;
  depositAmount: number;
  itemCount: number;
}

export default function CheckoutDialog({
  product,
  products,
  onClose,
  onLogout,
}: {
  product?: CatalogProduct | null;
  products?: CatalogProduct[];
  onClose: () => void;
  onLogout: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);

  // Normalize list of products
  const initialList = useMemo(() => {
    if (products && products.length > 0) return products;
    if (product) return [product];
    return [];
  }, [product, products]);

  const [items, setItems] = useState<CatalogProduct[]>(initialList);
  const [quantities, setQuantities] = useState<Record<number, number>>(() => {
    const q: Record<number, number> = {};
    for (const item of initialList) {
      q[item.id] = item.moq;
    }
    return q;
  });

  const [form, setForm] = useState({
    recipientName: '',
    recipientPhone: '',
    deliveryAddress: '',
    note: '',
    proposedPrice: '',
  });

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [mockAdding, setMockAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createdOrders, setCreatedOrders] = useState<CreatedOrderSummary[]>([]);

  // Address selection state
  const [storeAddress, setStoreAddress] = useState('');
  const [storeName, setStoreName] = useState('');
  const [addressOption, setAddressOption] = useState<'DEFAULT' | 'CUSTOM'>('DEFAULT');
  const [customAddress, setCustomAddress] = useState('');

  useEffect(() => {
    dialog.current?.showModal();
    getWallet()
      .then(setWallet)
      .catch(() => {});

    api
      .get<{ profile: any }>('/profile')
      .then(({ data }) => {
        const p = data.profile;
        const sAddr = p?.storeProfile?.storeAddress || '';
        const sName = p?.storeProfile?.storeName || '';
        setStoreAddress(sAddr);
        setStoreName(sName);
        setForm((prev) => ({
          ...prev,
          recipientName: prev.recipientName || p?.name || '',
          recipientPhone: prev.recipientPhone || p?.phone || '',
          deliveryAddress: prev.deliveryAddress || sAddr,
        }));
      })
      .catch(() => {});
  }, []);

  function handleAddressOptionChange(option: 'DEFAULT' | 'CUSTOM') {
    setAddressOption(option);
    if (option === 'DEFAULT') {
      setForm((prev) => ({ ...prev, deliveryAddress: storeAddress }));
    } else {
      setForm((prev) => ({ ...prev, deliveryAddress: customAddress }));
    }
  }

  async function handleQuickAddMock() {
    setMockAdding(true);
    try {
      const res = await addMockFunds(5000000);
      setWallet(res.wallet);
    } catch {
      // ignore
    } finally {
      setMockAdding(false);
    }
  }

  function handleQuantityChange(productId: number, val: number, minMoq: number, maxStock: number) {
    const safeVal = Math.max(minMoq, Math.min(maxStock, val || minMoq));
    setQuantities((prev) => ({ ...prev, [productId]: safeVal }));
  }

  function handleRemoveItem(productId: number) {
    setItems((prev) => prev.filter((p) => p.id !== productId));
  }

  // Group items by supplier (since each order must belong to one supplier)
  const supplierGroups = useMemo(() => {
    const map = new Map<number, { supplier: CatalogProduct['supplier']; items: CatalogProduct[] }>();
    for (const item of items) {
      const sId = item.supplier.id;
      if (!map.has(sId)) {
        map.set(sId, { supplier: item.supplier, items: [] });
      }
      map.get(sId)!.items.push(item);
    }
    return Array.from(map.values());
  }, [items]);

  // Calculate totals per supplier and overall
  const orderCalculations = useMemo(() => {
    return supplierGroups.map((group) => {
      const goodsSubtotal = roundToThousand(
        group.items.reduce((sum, item) => {
          const qty = quantities[item.id] || item.moq;
          return sum + item.wholesalePrice * qty;
        }, 0)
      );
      const rawDeliveryFee = Number(group.supplier.deliveryFee);
      // Mặc định phí giao hàng tiêu chuẩn 25.000 ₫ nếu vựa chưa cấu hình hoặc = 0đ
      const deliveryFee = roundToThousand(rawDeliveryFee > 0 ? rawDeliveryFee : 25000);
      const orderTotal = roundToThousand(goodsSubtotal + deliveryFee);
      const depositAmount = roundToThousand((orderTotal * STANDARD_DEPOSIT_RATE) / 100);
      const remainingCOD = orderTotal - depositAmount;

      return {
        supplier: group.supplier,
        items: group.items,
        goodsSubtotal,
        deliveryFee,
        orderTotal,
        depositAmount,
        remainingCOD,
      };
    });
  }, [supplierGroups, quantities]);

  const totalAllOrders = orderCalculations.reduce((sum, o) => sum + o.orderTotal, 0);
  const totalDepositRequired = orderCalculations.reduce((sum, o) => sum + o.depositAmount, 0);
  const totalRemainingCOD = totalAllOrders - totalDepositRequired;

  const isInsufficientBalance = Boolean(
    wallet && wallet.availableBalance < totalDepositRequired,
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (items.length === 0) {
      setError('Vui lòng chọn ít nhất một mặt hàng để đặt.');
      return;
    }
    if (isInsufficientBalance) {
      setError(
        `Số dư ví (${money(wallet?.availableBalance ?? 0)}) không đủ để đặt cọc ${money(totalDepositRequired)}. Vui lòng nạp thêm thử nghiệm để tiếp tục.`,
      );
      return;
    }
    if (!form.deliveryAddress || form.deliveryAddress.trim().length < 10) {
      setError('Vui lòng cung cấp địa chỉ nhận hàng chi tiết ít nhất 10 ký tự.');
      return;
    }

    lock.current = true;
    setBusy(true);
    setError('');

    const results: CreatedOrderSummary[] = [];

    try {
      for (const calc of orderCalculations) {
        const lines = calc.items.map((p) => ({
          productId: p.id,
          quantity: quantities[p.id] || p.moq,
          expectedUpdatedAt: p.updatedAt,
        }));

        const body = {
          recipientName: form.recipientName.trim(),
          recipientPhone: form.recipientPhone.trim(),
          deliveryAddress: form.deliveryAddress.trim(),
          note: form.note.trim(),
          expectedDeliveryFee: calc.deliveryFee,
          depositRate: STANDARD_DEPOSIT_RATE,
          lines,
          requestId: crypto.randomUUID(),
        };

        const { data } = await api.post('/orders', body);
        results.push({
          id: data.order.id,
          supplierName: calc.supplier.businessName,
          total: calc.orderTotal,
          depositAmount: calc.depositAmount,
          itemCount: lines.length,
        });
      }

      setCreatedOrders(results);
    } catch (err) {
      setError(getApiError(err));
      if (isUnauthenticated(err)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const isMultiOrder = supplierGroups.length > 1;

  return (
    <dialog
      ref={dialog}
      className="checkout-dialog"
      aria-labelledby="checkout-title"
      onClose={onClose}
    >
      <header className="checkout-dialog-header">
        <h2 id="checkout-title">
          {createdOrders.length > 0
            ? `Đã tạo ${createdOrders.length} đơn hàng thành công`
            : isMultiOrder
              ? `Tạo ${supplierGroups.length} đơn hàng từ ${supplierGroups.length} chủ vựa`
              : 'Đặt hàng từ chủ vựa'}
        </h2>
        <button
          type="button"
          className="dialog-close"
          aria-label="Đóng"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>

      {createdOrders.length > 0 ? (
        <div className="checkout-success-body">
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          >
            <strong style={{ color: '#166534', fontSize: '15px', display: 'block', marginBottom: '6px' }}>
              Đặt hàng thành công ({createdOrders.length} đơn hàng)!
            </strong>
            <p style={{ margin: 0, fontSize: '13px', color: '#15803d', lineHeight: 1.5 }}>
              Tổng tiền cọc ký quỹ <strong>{money(totalDepositRequired)}</strong> đã được giữ an toàn trong Ví hệ thống (Escrow).
              Các chủ vựa sẽ đối soát kho và điều phối xe giao đến tiệm của bạn.
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Danh sách đơn đã tạo:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {createdOrders.map((ord) => (
                <div
                  key={ord.id}
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <strong>Đơn hàng #{ord.id}</strong> · {ord.supplierName} ({ord.itemCount} mặt hàng)
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>{money(ord.total)}</span>
                    <span style={{ fontSize: '11.5px', color: '#166534', display: 'block' }}>
                      Cọc 10%: {money(ord.depositAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="inventory-actions">
            <Link to="/store/orders" className="dash-primary" onClick={onClose}>
              Xem danh sách Đơn mua hàng
            </Link>
            <button type="button" className="secondary-button" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="checkout-form">
          {items.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
              Chưa có sản phẩm nào được chọn. Vui lòng quay lại danh mục để chọn hàng.
            </p>
          ) : (
            <>
              {/* Informative notice for multi-order grouping */}
              {isMultiOrder && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    color: '#1e40af',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Đơn hàng đa nguồn:</strong> Bạn đang đặt hàng từ{' '}
                  <strong>{supplierGroups.length} chủ vựa khác nhau</strong>. Hệ thống sẽ tự động tạo{' '}
                  <strong>{supplierGroups.length} đơn hàng riêng biệt</strong> để từng chủ vựa xuất kho và điều phối chuyến xe giao tận nơi.
                </div>
              )}

              {/* Items List grouped by Supplier */}
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Danh sách mặt hàng đặt mua ({items.length} mặt hàng từ {supplierGroups.length} vựa):
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {orderCalculations.map((calc, groupIdx) => (
                    <div key={calc.supplier.id} className="checkout-supplier-card">
                      {/* Supplier Group Header */}
                      <div className="checkout-supplier-header">
                        <div>
                          <span style={{ color: '#5b7060', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                            ĐƠN #{groupIdx + 1} TỪ CHỦ VỰA:
                          </span>{' '}
                          <strong>{calc.supplier.businessName}</strong>
                        </div>
                        <span>
                          Phí giao xe: <strong>{money(calc.deliveryFee)}</strong>
                        </span>
                      </div>

                      {/* Items in this group */}
                      <div>
                        {calc.items.map((prod) => {
                          const currentQty = quantities[prod.id] || prod.moq;
                          const lineTotal = prod.wholesalePrice * currentQty;

                          return (
                            <div key={prod.id} className="checkout-item-card">
                              <div className="checkout-item-info">
                                <div className="checkout-item-name">{prod.name}</div>
                                <div className="checkout-item-meta">
                                  Giá sỉ: <strong>{money(prod.wholesalePrice)}</strong> / {prod.packaging} · Đặt tối thiểu: {prod.moq} (Kho còn: {prod.stockQty})
                                </div>
                              </div>

                              {/* Quantity Control Stepper */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="checkout-qty-stepper">
                                  <button
                                    type="button"
                                    className="checkout-qty-btn"
                                    disabled={busy || currentQty <= prod.moq}
                                    onClick={() => handleQuantityChange(prod.id, currentQty - 1, prod.moq, prod.stockQty)}
                                    title="Giảm số lượng"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={prod.moq}
                                    max={prod.stockQty}
                                    step="1"
                                    disabled={busy}
                                    value={currentQty}
                                    onChange={(e) => handleQuantityChange(prod.id, Number(e.target.value), prod.moq, prod.stockQty)}
                                    className="checkout-qty-input"
                                  />
                                  <button
                                    type="button"
                                    className="checkout-qty-btn"
                                    disabled={busy || currentQty >= prod.stockQty}
                                    onClick={() => handleQuantityChange(prod.id, currentQty + 1, prod.moq, prod.stockQty)}
                                    title="Tăng số lượng"
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="checkout-item-price">
                                  {money(lineTotal)}
                                </div>

                                {items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(prod.id)}
                                    className="checkout-item-delete"
                                    title="Xóa mặt hàng này khỏi đơn"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Group Summary Footer */}
                      <div className="checkout-supplier-footer">
                        <span>
                          Tiền hàng: <strong>{money(calc.goodsSubtotal)}</strong> + Giao xe: <strong>{money(calc.deliveryFee)}</strong>
                        </span>
                        <span style={{ color: '#0f172a' }}>
                          Tổng đơn #{groupIdx + 1}: <strong>{money(calc.orderTotal)}</strong> (Cọc 10%: <strong>{money(calc.depositAmount)}</strong>)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipient Information Form */}
              <div className="checkout-form-row">
                <div className="checkout-form-field">
                  <label>
                    Người nhận hàng <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    disabled={busy}
                    value={form.recipientName}
                    onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                    placeholder="Tên chủ tiệm hoặc người nhận hàng"
                  />
                </div>
                <div className="checkout-form-field">
                  <label>
                    Số điện thoại nhận hàng <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={30}
                    autoComplete="tel"
                    disabled={busy}
                    value={form.recipientPhone}
                    onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })}
                    placeholder="Số điện thoại liên hệ khi tài xế đến"
                  />
                </div>
              </div>

              {/* Delivery Address Selection */}
              <div className="checkout-form-field">
                <label>
                  Địa chỉ nhận hàng <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={addressOption}
                  onChange={(e) => handleAddressOptionChange(e.target.value as 'DEFAULT' | 'CUSTOM')}
                  disabled={busy}
                >
                  <option value="DEFAULT">
                    Địa chỉ tiệm mặc định ({storeName ? `${storeName} - ` : ''}{storeAddress || 'Chưa lưu địa chỉ tiệm trong hồ sơ'})
                  </option>
                  <option value="CUSTOM">Giao đến địa chỉ khác...</option>
                </select>

                {addressOption === 'CUSTOM' && (
                  <div style={{ marginTop: '6px' }}>
                    <input
                      required
                      minLength={10}
                      maxLength={500}
                      autoComplete="street-address"
                      disabled={busy}
                      placeholder="Nhập địa chỉ nhận hàng khác (Số nhà, tên đường, phường/xã, quận/huyện...)"
                      value={form.deliveryAddress}
                      onChange={(e) => {
                        setCustomAddress(e.target.value);
                        setForm({ ...form, deliveryAddress: e.target.value });
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Note input */}
              <div className="checkout-form-field">
                <label>Ghi chú cho các chuyến xe giao</label>
                <input
                  maxLength={500}
                  disabled={busy}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Ví dụ: Giao vào buổi sáng trước 11h, gọi trước khi xuất xe..."
                />
              </div>

              {/* Escrow Deposit & Wallet Summary */}
              <div className="checkout-escrow-box" style={{ marginTop: '6px' }}>
                <div className="checkout-row checkout-escrow-deposit">
                  <span className="checkout-row-label">
                    {isMultiOrder
                      ? `Tổng tiền cọc ký quỹ 10% (${supplierGroups.length} đơn hàng):`
                      : 'Tổng tiền cọc ký quỹ (10% bảo chứng):'}
                  </span>
                  <strong className="checkout-row-value">{money(totalDepositRequired)}</strong>
                </div>
                <div className="checkout-row checkout-wallet-available">
                  <span className="checkout-row-label">Số dư ví khả dụng:</span>
                  <span className="checkout-row-value">{money(wallet?.availableBalance ?? 0)}</span>
                </div>

                {isInsufficientBalance && (
                  <div className="checkout-insufficient-banner">
                    <p>
                      Số dư ví không đủ để cọc {money(totalDepositRequired)}. Bạn có thể nạp thử nghiệm ngay bên dưới.
                    </p>
                    <button
                      type="button"
                      className="table-button primary-small"
                      disabled={mockAdding}
                      onClick={handleQuickAddMock}
                      style={{ fontSize: '11px', padding: '4px 10px', marginTop: '2px' }}
                    >
                      {mockAdding ? 'Đang cộng…' : '+ Nạp 5 triệu thử nghiệm (Mock)'}
                    </button>
                  </div>
                )}

                <div className="checkout-row checkout-row-divider checkout-cod-row">
                  <span className="checkout-row-label">Còn lại thanh toán COD khi nhận hàng:</span>
                  <strong className="checkout-row-value">{money(totalRemainingCOD)}</strong>
                </div>

                <p className="checkout-escrow-note">
                  Toàn bộ tiền cọc 10% được giữ trung gian an toàn trong Ví hệ thống (Escrow), chỉ tự động giải ngân cho chủ vựa khi bạn xác nhận đã nhận đủ hàng đạt chuẩn.
                </p>
              </div>

              {error && (
                <p role="alert" className="error-notice">
                  {error}
                </p>
              )}

              <div className="inventory-actions" style={{ marginTop: '8px' }}>
                <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="dash-primary"
                  disabled={busy || isInsufficientBalance || items.length === 0}
                >
                  {busy
                    ? 'Đang tạo đơn…'
                    : isMultiOrder
                      ? `Xác nhận tạo ${supplierGroups.length} đơn hàng (Cọc: ${money(totalDepositRequired)})`
                      : `Gửi đơn đặt hàng (Cọc: ${money(totalDepositRequired)})`}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </dialog>
  );
}
