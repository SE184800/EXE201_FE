import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogProduct } from '../services/catalog.api';
import { api, getApiError, isUnauthenticated } from '../services/api';
import { getWallet, addMockFunds, type WalletInfo } from '../services/wallet.api';

const money = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
const STANDARD_DEPOSIT_RATE = 10; // Mức cọc chuẩn 10% phổ biến nhất để đảm bảo đơn hàng

export default function CheckoutDialog({
  product,
  onClose,
  onLogout,
}: {
  product: CatalogProduct;
  onClose: () => void;
  onLogout: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const [form, setForm] = useState({
    quantity: product.moq,
    recipientName: '',
    recipientPhone: '',
    deliveryAddress: '',
    note: '',
    proposedPrice: '',
    depositRate: STANDARD_DEPOSIT_RATE,
  });
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [mockAdding, setMockAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState<number | null>(null);

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

  const orderTotal = product.wholesalePrice * form.quantity + product.supplier.deliveryFee;
  const depositAmount = (orderTotal * STANDARD_DEPOSIT_RATE) / 100;
  const remainingCOD = orderTotal - depositAmount;
  const isInsufficientBalance = Boolean(
    wallet && wallet.availableBalance < depositAmount,
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (isInsufficientBalance) {
      setError(
        `Số dư ví (${money(wallet?.availableBalance ?? 0)}) không đủ để đặt cọc ${money(depositAmount)}. Vui lòng nạp thêm thử nghiệm để tiếp tục.`,
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
    const proposed = form.proposedPrice === '' ? null : Number(form.proposedPrice);
    const dealNote =
      proposed === null
        ? form.note
        : `[ĐỀ NGHỊ DEAL] Giá đề xuất: ${money(proposed)}/ ${product.packaging}.${form.note ? ` ${form.note}` : ''}`;
    const body = {
      quantity: form.quantity,
      recipientName: form.recipientName,
      recipientPhone: form.recipientPhone,
      deliveryAddress: form.deliveryAddress,
      note: dealNote,
      expectedDeliveryFee: product.supplier.deliveryFee,
      depositRate: STANDARD_DEPOSIT_RATE,
      lines: [
        { productId: product.id, quantity: form.quantity, expectedUpdatedAt: product.updatedAt },
      ],
    };
    const signature = JSON.stringify(body);
    if (request.current?.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    try {
      const { data } = await api.post('/orders', { ...body, requestId: request.current.id });
      setOrderId(data.order.id);
    } catch (error) {
      setError(getApiError(error));
      if (isUnauthenticated(error)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="inventory-dialog"
      aria-labelledby="checkout-title"
      onClose={onClose}
    >
      <header className="inventory-dialog-header">
        <h2 id="checkout-title">{orderId ? `Đã gửi đơn #${orderId}` : 'Đặt hàng từ chủ vựa'}</h2>
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

      {orderId ? (
        <div className="checkout-success-body">
          <p className="order-submitted-lead">
            Đơn hàng #{orderId} đã được tạo thành công! Khoản cọc ký quỹ {money(depositAmount)} đã được
            khóa an toàn từ Ví hệ thống. Chủ vựa sẽ kiểm tra tồn kho và địa chỉ giao hàng trước khi
            xác nhận giao.
          </p>
          <div className="inventory-actions">
            <Link to="/store/orders" className="dash-primary" onClick={onClose}>
              Xem danh sách đơn
            </Link>
            <button type="button" className="secondary-button" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="inventory-form">
          <div className="checkout-product-summary">
            <strong>{product.name}</strong>
            <p>
              Quy cách: {product.packaging} · Giá sỉ: {money(product.wholesalePrice)}
            </p>
            <p>
              Chủ vựa: {product.supplier.businessName} (Bán kính phục vụ:{' '}
              {product.supplier.deliveryRadiusKm} km)
            </p>
          </div>

          <label>
            Số lượng đặt ({product.packaging})
            <input
              type="number"
              min={product.moq}
              max={product.stockQty}
              step="1"
              required
              disabled={busy}
              value={form.quantity}
              onChange={(e) =>
                setForm({
                  ...form,
                  quantity: Math.max(
                    product.moq,
                    Math.min(product.stockQty, Number(e.target.value) || product.moq),
                  ),
                })
              }
            />
            <small>
              Tối thiểu {product.moq} × {product.packaging}; tồn hiện tại {product.stockQty}.
            </small>
          </label>
          <label>
            Người nhận
            <input
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              disabled={busy}
              value={form.recipientName}
              onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
            />
          </label>
          <label>
            Số điện thoại
            <input
              type="tel"
              required
              maxLength={30}
              autoComplete="tel"
              disabled={busy}
              value={form.recipientPhone}
              onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })}
            />
          </label>

          {/* Delivery Address with Dropdown: Default store address vs Custom address */}
          <div className="inventory-name" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Địa chỉ nhận hàng <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={addressOption}
              onChange={(e) =>
                handleAddressOptionChange(e.target.value as 'DEFAULT' | 'CUSTOM')
              }
              disabled={busy}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                background: '#fff',
                marginBottom: '8px',
                color: '#1e293b',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <option value="DEFAULT">
                📍 Địa chỉ tiệm mặc định {storeAddress ? `(${storeName ? storeName + ' - ' : ''}${storeAddress})` : '(Chưa lưu địa chỉ)'}
              </option>
              <option value="CUSTOM">➕ Giao đến địa chỉ khác...</option>
            </select>

            {addressOption === 'DEFAULT' ? (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#334155',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#166534',
                    fontWeight: 600,
                    marginBottom: '2px',
                  }}
                >
                  <span>✅ Địa chỉ cửa hàng hợp lệ:</span>
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                  {storeAddress || 'Chưa thiết lập địa chỉ tiệm trong Hồ sơ. Bạn có thể chọn "Giao đến địa chỉ khác" bên trên.'}
                </div>
                <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Địa chỉ này đảm bảo cửa hàng có địa chỉ hợp lệ tránh địa chỉ ma và dùng để đo khoảng cách giao hàng.
                </small>
              </div>
            ) : (
              <div>
                <input
                  required
                  minLength={10}
                  maxLength={500}
                  autoComplete="street-address"
                  disabled={busy}
                  placeholder="Nhập địa chỉ nhận hàng khác (Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành...)"
                  value={form.deliveryAddress}
                  onChange={(e) => {
                    setCustomAddress(e.target.value);
                    setForm({ ...form, deliveryAddress: e.target.value });
                  }}
                  style={{ width: '100%' }}
                />
                <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Tùy chọn dành cho trường hợp nhận hàng tại kho phụ hoặc nhờ người quen nhận hộ.
                </small>
              </div>
            )}
          </div>

          <label className="inventory-name">
            Giá đề xuất khi mua số lượng lớn (không bắt buộc)
            <input
              type="number"
              min="0"
              max={product.wholesalePrice}
              step="1"
              disabled={busy}
              value={form.proposedPrice}
              onChange={(e) => setForm({ ...form, proposedPrice: e.target.value })}
              placeholder={`Giá niêm yết: ${money(product.wholesalePrice)}`}
            />
            <small>Chủ vựa sẽ xem đề nghị này và phản hồi khi duyệt đơn.</small>
          </label>

          <div className="inventory-name">
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Tỷ lệ cọc ký quỹ (Cố định chuẩn sàn)
            </span>
            <div
              style={{
                padding: '9px 12px',
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
              <span>🔒</span> Cọc ký quỹ 10% tổng đơn (Ví hệ thống)
            </div>
            <small
              style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px', display: 'block' }}
            >
              Áp dụng mức cọc chuẩn 10% để cam kết đơn hàng và bảo vệ quyền lợi đôi bên. 90% còn lại
              thanh toán COD khi nhận hàng.
            </small>
          </div>

          <label className="inventory-name">
            Ghi chú
            <input
              maxLength={500}
              disabled={busy}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>

          {/* Breakdown Total Section with structured rows and clean spacing */}
          <div className="checkout-total inventory-name">
            <div className="checkout-row">
              <span className="checkout-row-label">
                Tiền hàng ({form.quantity} {product.packaging}):
              </span>
              <span className="checkout-row-value">
                {money(product.wholesalePrice * form.quantity)}
              </span>
            </div>
            <div className="checkout-row">
              <span className="checkout-row-label">Phí giao hàng:</span>
              <span className="checkout-row-value">{money(product.supplier.deliveryFee)}</span>
            </div>
            <div className="checkout-row checkout-row-divider checkout-row-total">
              <span className="checkout-row-label">Tổng cộng đơn hàng:</span>
              <strong className="checkout-row-value">{money(orderTotal)}</strong>
            </div>

            <div className="checkout-escrow-box">
              <div className="checkout-row checkout-escrow-deposit">
                <span className="checkout-row-label">
                  <span>🔒</span> Cọc ký quỹ (10%):
                </span>
                <strong className="checkout-row-value">{money(depositAmount)}</strong>
              </div>
              <div className="checkout-row checkout-wallet-available">
                <span className="checkout-row-label">Số dư ví khả dụng:</span>
                <span className="checkout-row-value">{money(wallet?.availableBalance ?? 0)}</span>
              </div>

              {isInsufficientBalance && (
                <div className="checkout-insufficient-banner">
                  <p>
                    ⚠️ Số dư ví không đủ để cọc {money(depositAmount)}. Bạn có thể nạp thử nghiệm
                    ngay bên dưới.
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
                <strong className="checkout-row-value">{money(remainingCOD)}</strong>
              </div>

              <p className="checkout-escrow-note">
                Tiền cọc được khóa trung gian an toàn trong Ví hệ thống, chỉ giải ngân cho chủ vựa
                khi bạn xác nhận đã nhận đủ hàng.
              </p>
            </div>
          </div>

          {error && (
            <p role="alert" className="error-notice inventory-name">
              {error}
            </p>
          )}
          <div className="inventory-actions">
            <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
              Để sau
            </button>
            <button className="dash-primary" disabled={busy || isInsufficientBalance}>
              {busy ? 'Đang gửi…' : 'Gửi đơn đặt hàng'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
