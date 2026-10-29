import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../catalog.css';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import TopbarBalance from '../../components/TopbarBalance';
import SupplierHeader from '../../components/SupplierHeader';
import OrderList from '../../components/OrderList';
import { getApiError, isUnauthenticated } from '../../services/api';
import { logout } from '../../services/auth.api';
import {
  updateSupplierOrderStatus,
  updateSupplierOrderDriver,
  type SupplierOrder,
  type DriverInfo,
} from '../../services/supplier.api';
import type { AuthUser } from '../../types/auth';

const STATUS_ACTIONS: Record<string, { next: string; label: string }> = {
  PENDING: { next: 'APPROVED', label: 'Duyệt đơn' },
  APPROVED: { next: 'PREPARING', label: 'Bắt đầu soạn' },
  PREPARING: { next: 'SHIPPING', label: 'Bàn giao vận chuyển' },
  SHIPPING: { next: 'ISSUE_HANDLING', label: 'Chuyển tiếp nhận xử lý' },
  ISSUE_HANDLING: { next: 'DELIVERED', label: 'Xác nhận đã giao & thu COD' },
};

export default function SupplierOrders({
  user,
  onLogout,
}: {
  user?: AuthUser;
  onLogout: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [orderRevision, setOrderRevision] = useState(0);
  const [rejectingOrder, setRejectingOrder] = useState<SupplierOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [dispatchOrder, setDispatchOrder] = useState<SupplierOrder | null>(null);

  useEffect(() => {
    document.title = 'SupplyMind AI · Đơn hàng từ cửa hàng';
  }, []);

  async function handleOrderStatus(
    order: SupplierOrder,
    forcedStatus?: string,
    suppliedReason?: string,
  ) {
    if (forcedStatus === 'REJECTED' && suppliedReason === undefined) {
      setRejectingOrder(order);
      setRejectReason('');
      setRejectError('');
      return;
    }
    if (order.status === 'PREPARING' && !forcedStatus) {
      setDispatchOrder(order);
      return;
    }
    const action = forcedStatus
      ? { next: forcedStatus, label: 'Từ chối' }
      : STATUS_ACTIONS[order.status];
    if (!action) return;
    const normalizedReason = action.next === 'REJECTED' ? suppliedReason?.trim() : undefined;
    setBusy(true);
    setNotice('');
    setNoticeError(false);
    try {
      const saved = await updateSupplierOrderStatus(order.id, action.next, normalizedReason);
      setOrderRevision((n) => n + 1);
      setNotice(`Đơn #${order.id} đã chuyển sang “${saved.statusLabel}”.`);
    } catch (issue) {
      setNoticeError(true);
      if (isUnauthenticated(issue)) onLogout();
      else setNotice(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

  async function handleDispatchSubmit(
    driverData: Partial<DriverInfo>,
    shouldDispatchToShipping: boolean,
  ) {
    if (!dispatchOrder) return;
    const order = dispatchOrder;
    setBusy(true);
    setNotice('');
    setNoticeError(false);
    try {
      if (shouldDispatchToShipping && order.status === 'PREPARING') {
        const saved = await updateSupplierOrderStatus(order.id, 'SHIPPING', undefined, driverData);
        setOrderRevision((n) => n + 1);
        setNotice(`Đơn #${order.id} đã bàn giao cho tài xế ${driverData.driverName} và chuyển sang “${saved.statusLabel}”.`);
      } else {
        await updateSupplierOrderDriver(order.id, driverData);
        setOrderRevision((n) => n + 1);
        setNotice(`Đã lưu thông tin tài xế ${driverData.driverName} cho đơn #${order.id}.`);
      }
      setDispatchOrder(null);
    } catch (issue) {
      setNoticeError(true);
      if (isUnauthenticated(issue)) onLogout();
      else setNotice(getApiError(issue));
    } finally {
      setBusy(false);
    }
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

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      onLogout();
    } catch (issue) {
      setNoticeError(true);
      setNotice(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="supplier-page">
      {user ? (
        <SupplierHeader
          user={user}
          activeNav="orders"
          onLogout={handleLogout}
          loggingOut={busy}
        />
      ) : (
        <header className="supplier-header">
          <Brand />
          <div className="supplier-header-actions">
            <TopbarBalance linkTo="/supplier/wallet" />
            <button className="secondary-button" onClick={handleLogout} disabled={busy}>
              <Icon name="logout" /> Đăng xuất
            </button>
          </div>
        </header>
      )}
      <section className="supplier-main">
        <nav className="catalog-nav" aria-label="Chủ vựa">
          <Link to="/supplier">Tổng quan</Link>
          <Link to="/supplier/products">Sản phẩm đăng bán</Link>
          <Link to="/supplier/quotes">Báo giá tiếp thị</Link>
          <Link to="/supplier/orders" aria-current="page">
            Đơn hàng
          </Link>
          <Link to="/supplier/inventory">Kho hàng</Link>
          <Link to="/supplier/wallet">Ví & Ký quỹ</Link>
          <Link to="/supplier/subscription">Gói sử dụng</Link>
        </nav>
        <div className="supplier-heading">
          <div>
            <p className="form-eyebrow">QUẢN LÝ ĐƠN HÀNG</p>
            <h1>Đơn hàng từ cửa hàng</h1>
            <p className="form-description">
              Theo dõi, duyệt và cập nhật tiến độ giao các đơn đặt hàng từ tiệm tạp hóa.
            </p>
          </div>
          <button
            className="ghost-button"
            onClick={() => setOrderRevision((n) => n + 1)}
            disabled={busy}
          >
            ↻ Làm mới
          </button>
        </div>
        {notice && (
          <p
            className={noticeError ? 'error-notice' : 'supplier-success'}
            role={noticeError ? 'alert' : 'status'}
          >
            {notice}
          </p>
        )}
        <OrderList
          kind="supplier"
          onLogout={onLogout}
          revision={orderRevision}
          busy={busy}
          onStatus={handleOrderStatus}
          onEditDriver={(order) => setDispatchOrder(order)}
        />
      </section>
      {rejectingOrder && (
        <RejectDialog
          order={rejectingOrder}
          reason={rejectReason}
          error={rejectError}
          busy={busy}
          onChange={(value) => {
            setRejectReason(value);
            setRejectError('');
          }}
          onCancel={() => {
            setRejectingOrder(null);
            setRejectReason('');
            setRejectError('');
          }}
          onSubmit={submitRejection}
        />
      )}
      {dispatchOrder && (
        <DispatchDriverDialog
          order={dispatchOrder}
          initialData={dispatchOrder.driverInfo || undefined}
          busy={busy}
          onCancel={() => setDispatchOrder(null)}
          onSubmit={handleDispatchSubmit}
        />
      )}
    </main>
  );
}

function RejectDialog({
  order,
  reason,
  error,
  busy,
  onChange,
  onCancel,
  onSubmit,
}: {
  order: SupplierOrder;
  reason: string;
  error: string;
  busy: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="supplier-dialog-backdrop" role="presentation">
      <section
        className="supplier-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-dialog-title"
      >
        <span className="supplier-panel-label">ĐƠN #{order.id}</span>
        <h2 id="reject-dialog-title">Từ chối đơn hàng</h2>
        <p>Cho cửa hàng biết lý do để họ chủ động điều chỉnh đơn.</p>
        <label className="supplier-dialog-field">
          <span>Lý do từ chối</span>
          <textarea
            value={reason}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Ví dụ: Sản phẩm tạm hết hàng…"
            rows={4}
            maxLength={255}
            disabled={busy}
            autoFocus
          />
        </label>
        {error && <small className="supplier-dialog-error">{error}</small>}
        <div className="supplier-dialog-actions">
          <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>
            Hủy
          </button>
          <button
            type="button"
            className="table-button danger supplier-dialog-submit"
            onClick={onSubmit}
            disabled={busy}
          >
            {busy ? 'Đang xử lý…' : 'Xác nhận từ chối'}
          </button>
        </div>
      </section>
    </div>
  );
}

function DispatchDriverDialog({
  order,
  initialData,
  busy,
  onCancel,
  onSubmit,
}: {
  order: SupplierOrder;
  initialData?: DriverInfo | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (driverData: Partial<DriverInfo>, shouldDispatchToShipping: boolean) => void;
}) {
  const [driverName, setDriverName] = useState(initialData?.driverName || '');
  const [driverPhone, setDriverPhone] = useState(initialData?.driverPhone || '');
  const [vehicleType, setVehicleType] = useState(initialData?.vehicleType || 'Xe ba gác chở hàng');
  const [customVehicle, setCustomVehicle] = useState('');
  const [licensePlate, setLicensePlate] = useState(initialData?.licensePlate || '');
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState(
    initialData?.estimatedDeliveryTime || 'Trong 30 - 45 phút tới',
  );
  const [deliveryNotes, setDeliveryNotes] = useState(initialData?.deliveryNotes || '');
  const [error, setError] = useState('');

  const quickVehicleTypes = [
    'Xe ba gác chở hàng',
    'Xe máy giao hàng',
    'Xe tải nhỏ 500kg',
    'Xe tải 1 tấn',
    'Xe tải 1.5 tấn',
    'Xe tải 2.5 tấn',
    'Xe bán tải / Van',
    'Khác',
  ];

  const quickTimes = [
    'Trong 30 - 45 phút tới',
    'Trong 1 - 2 tiếng tới',
    'Khoảng 11:30 trưa nay',
    'Khoảng 15:00 chiều nay',
    'Sáng mai 08:30 - 09:30',
  ];

  function handleSubmit(shouldDispatch: boolean) {
    const trimmedName = driverName.trim();
    const trimmedPhone = driverPhone.trim();
    if (trimmedName.length < 2) {
      setError('Vui lòng nhập họ tên tài xế (tối thiểu 2 ký tự).');
      return;
    }
    if (!/^0\d{9}$/.test(trimmedPhone)) {
      setError('Số điện thoại tài xế không hợp lệ (cần 10 chữ số bắt đầu bằng 0).');
      return;
    }
    const finalVehicle = vehicleType === 'Khác' ? customVehicle.trim() || 'Xe giao hàng' : vehicleType;
    setError('');
    onSubmit(
      {
        driverName: trimmedName,
        driverPhone: trimmedPhone,
        vehicleType: finalVehicle,
        licensePlate: licensePlate.trim() || undefined,
        estimatedDeliveryTime: estimatedDeliveryTime.trim() || undefined,
        deliveryNotes: deliveryNotes.trim() || undefined,
      },
      shouldDispatch,
    );
  }

  return (
    <div className="supplier-dialog-backdrop" role="presentation">
      <section
        className="supplier-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-dialog-title"
        style={{ maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <span className="supplier-panel-label">ĐƠN #{order.id} · {order.buyer?.name || 'Tạp hóa'}</span>
        <h2 id="dispatch-dialog-title">
          {order.status === 'PREPARING'
            ? 'Điền thông tin tài xế & Bàn giao vận chuyển'
            : 'Cập nhật thông tin tài xế'}
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', marginBottom: '14px' }}>
          Điền thông tin tài xế và chuyến xe để tiệm tạp hóa tiện theo dõi đơn hàng và liên hệ khi xe tới.
        </p>

        {error && (
          <div className="error-notice" style={{ marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <label className="supplier-dialog-field" style={{ margin: 0 }}>
            <span>Họ tên tài xế *</span>
            <input
              type="text"
              required
              placeholder="VD: Nguyễn Văn Tuấn"
              value={driverName}
              onChange={(e) => {
                setDriverName(e.target.value);
                setError('');
              }}
              disabled={busy}
            />
          </label>

          <label className="supplier-dialog-field" style={{ margin: 0 }}>
            <span>Số điện thoại tài xế *</span>
            <input
              type="tel"
              required
              placeholder="VD: 0912345678"
              value={driverPhone}
              onChange={(e) => {
                setDriverPhone(e.target.value);
                setError('');
              }}
              disabled={busy}
            />
          </label>
        </div>

        <div style={{ marginTop: '10px' }}>
          <label className="supplier-dialog-field">
            <span>Loại phương tiện giao hàng:</span>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              disabled={busy}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              {quickVehicleTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {vehicleType === 'Khác' && (
            <input
              type="text"
              placeholder="Nhập loại phương tiện..."
              value={customVehicle}
              onChange={(e) => setCustomVehicle(e.target.value)}
              disabled={busy}
              style={{ marginTop: '6px', width: '100%' }}
            />
          )}
        </div>

        <label className="supplier-dialog-field" style={{ marginTop: '10px' }}>
          <span>Biển số xe:</span>
          <input
            type="text"
            placeholder="VD: 59X1-888.99 hoặc 51D-123.45"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value)}
            disabled={busy}
          />
        </label>

        <div style={{ marginTop: '10px' }}>
          <label className="supplier-dialog-field">
            <span>Thời gian dự kiến giao hàng:</span>
            <input
              type="text"
              placeholder="VD: Trong 30 - 45 phút tới"
              value={estimatedDeliveryTime}
              onChange={(e) => setEstimatedDeliveryTime(e.target.value)}
              disabled={busy}
            />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {quickTimes.map((t) => (
              <button
                key={t}
                type="button"
                className="ghost-button"
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  backgroundColor: estimatedDeliveryTime === t ? '#dbeafe' : '#f1f5f9',
                  borderColor: estimatedDeliveryTime === t ? '#3b82f6' : '#cbd5e1',
                  color: estimatedDeliveryTime === t ? '#1d4ed8' : '#334155',
                }}
                onClick={() => setEstimatedDeliveryTime(t)}
                disabled={busy}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <label className="supplier-dialog-field" style={{ marginTop: '10px' }}>
          <span>Ghi chú chuyến xe / dặn dò:</span>
          <textarea
            placeholder="VD: Hàng nặng có tài xế hỗ trợ bê vào cửa hàng, gọi trước khi đến 10 phút..."
            rows={3}
            maxLength={300}
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            disabled={busy}
          />
        </label>

        <div className="supplier-dialog-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>
            Hủy
          </button>
          {order.status === 'PREPARING' ? (
            <>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleSubmit(false)}
                disabled={busy}
                title="Lưu thông tin tài xế nhưng chưa chuyển sang vận chuyển"
              >
                {busy ? 'Đang lưu…' : 'Chỉ lưu thông tin'}
              </button>
              <button
                type="button"
                className="table-button primary-small"
                onClick={() => handleSubmit(true)}
                disabled={busy}
                style={{ fontWeight: 600 }}
              >
                {busy ? 'Đang xử lý…' : 'Bàn giao xe & Xuất phát'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="table-button primary-small"
              onClick={() => handleSubmit(false)}
              disabled={busy}
            >
              {busy ? 'Đang lưu…' : 'Lưu thông tin tài xế'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
