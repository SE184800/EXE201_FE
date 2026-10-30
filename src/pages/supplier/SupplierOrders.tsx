import { useEffect, useState } from 'react';
import '../catalog.css';
import SupplierLayout from '../../components/SupplierLayout';
import OrderList from '../../components/OrderList';
import { getApiError, isUnauthenticated } from '../../services/api';
import { logout } from '../../services/auth.api';
import {
  updateSupplierOrderStatus,
  updateSupplierOrderDriver,
  getSavedDrivers,
  reportSupplierIncident,
  type SupplierOrder,
  type DriverInfo,
  type SavedDriver,
} from '../../services/supplier.api';
import type { AuthUser } from '../../types/auth';

const STATUS_ACTIONS: Record<string, { next: string; label: string }> = {
  PENDING: { next: 'PREPARING', label: 'Duyệt đơn & Bắt đầu soạn hàng' },
  APPROVED: { next: 'PREPARING', label: 'Bắt đầu soạn đơn' },
  PREPARING: { next: 'SHIPPING', label: 'Bàn giao vận chuyển' },
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
  const [incidentOrder, setIncidentOrder] = useState<SupplierOrder | null>(null);

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
        setNotice(
          `Đơn #${order.id} đã bàn giao cho tài xế ${driverData.driverName} và chuyển sang “${saved.statusLabel}”.`,
        );
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

  async function handleIncidentSubmit(payload: {
    damagedItems: Array<{ productId: number; productName: string; packaging?: string; quantity: number }>;
    damageType: string;
    damageTypeLabel?: string;
    evidenceImageUrl?: string | null;
    notes?: string | null;
    action: string;
  }) {
    if (!incidentOrder) return;
    const orderId = incidentOrder.id;
    setBusy(true);
    setNotice('');
    setNoticeError(false);
    try {
      const result = await reportSupplierIncident(orderId, payload);
      setOrderRevision((n) => n + 1);
      setNotice(result.message || `Đã lập báo cáo sự cố vận chuyển cho đơn #${orderId}.`);
      setIncidentOrder(null);
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
    <SupplierLayout
      user={user || ({ id: 0, username: 'chuvua', name: 'Chủ vựa', role: 'SUPPLIER' } as AuthUser)}
      activeNav="orders"
      onLogout={handleLogout}
    >
      <div>
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
            Làm mới
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
          onReportIncident={(order) => setIncidentOrder(order)}
        />
      </div>
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
      {incidentOrder && (
        <SupplierIncidentDialog
          order={incidentOrder}
          busy={busy}
          onCancel={() => setIncidentOrder(null)}
          onSubmit={handleIncidentSubmit}
        />
      )}
    </SupplierLayout>
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
  const [savedDrivers, setSavedDrivers] = useState<SavedDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  const [driverName, setDriverName] = useState(initialData?.driverName || '');
  const [driverPhone, setDriverPhone] = useState(initialData?.driverPhone || '');
  const [vehicleType, setVehicleType] = useState(initialData?.vehicleType || 'Xe ba gác chở hàng');
  const [customVehicle, setCustomVehicle] = useState('');
  const [licensePlate, setLicensePlate] = useState(initialData?.licensePlate || '');

  // Calendar date & flexible time frame picker
  const todayStr = new Date().toISOString().split('T')[0];
  const [deliveryDate, setDeliveryDate] = useState(todayStr);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('MORNING');
  const [customTimeSlot, setCustomTimeSlot] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState(initialData?.deliveryNotes || '');
  const [error, setError] = useState('');

  const TIME_SLOT_OPTIONS = [
    { code: 'EARLY_MORNING', label: 'Sáng sớm (06:00 - 08:00)' },
    { code: 'MORNING', label: 'Buổi sáng (08:00 - 10:30)' },
    { code: 'MIDDAY', label: 'Buổi trưa (11:00 - 12:30)' },
    { code: 'AFTERNOON_EARLY', label: 'Đầu chiều (13:30 - 15:30)' },
    { code: 'AFTERNOON_LATE', label: 'Cuối chiều (15:30 - 18:00)' },
    { code: 'EVENING', label: 'Buổi tối (18:00 - 20:30)' },
    { code: 'EXPRESS', label: 'Giao hỏa tốc (Trong 30 - 45 phút tới)' },
    { code: 'CUSTOM', label: 'Khác (Tự nhập khung giờ)' },
  ];

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

  useEffect(() => {
    void getSavedDrivers().then((drivers) => {
      setSavedDrivers(drivers);
      if (initialData?.driverPhone) {
        const found = drivers.find((d) => d.driverPhone === initialData.driverPhone);
        if (found) setSelectedDriverId(found.id);
      }
    });
  }, [initialData]);

  function handleSelectSavedDriver(driverId: string) {
    setSelectedDriverId(driverId);
    if (!driverId || driverId === 'CUSTOM') {
      return;
    }
    const driver = savedDrivers.find((d) => d.id === driverId);
    if (driver) {
      setDriverName(driver.driverName);
      setDriverPhone(driver.driverPhone);
      setVehicleType(driver.vehicleType || 'Xe ba gác chở hàng');
      setLicensePlate(driver.licensePlate || '');
      if (driver.deliveryNotes) setDeliveryNotes(driver.deliveryNotes);
      setError('');
    }
  }

  function computeEstimatedDeliveryTime(): string {
    const [year, month, day] = deliveryDate.split('-');
    const dateFormatted = `${day}/${month}/${year}`;
    let timeLabel = '';
    if (selectedTimeSlot === 'CUSTOM') {
      timeLabel = customTimeSlot.trim() || 'Thời gian theo thỏa thuận';
    } else {
      const found = TIME_SLOT_OPTIONS.find((s) => s.code === selectedTimeSlot);
      timeLabel = found ? found.label : selectedTimeSlot;
    }
    return `Ngày ${dateFormatted} · ${timeLabel}`;
  }

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
    const finalDeliveryTime = computeEstimatedDeliveryTime();

    setError('');
    onSubmit(
      {
        driverName: trimmedName,
        driverPhone: trimmedPhone,
        vehicleType: finalVehicle,
        licensePlate: licensePlate.trim() || undefined,
        estimatedDeliveryTime: finalDeliveryTime,
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
        style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <span className="supplier-panel-label">ĐƠN #{order.id} · {order.buyer?.name || 'Tạp hóa'}</span>
        <h2 id="dispatch-dialog-title">
          {order.status === 'PREPARING'
            ? 'Gán thông tin tài xế & Chuẩn bị giao hàng'
            : 'Cập nhật thông tin tài xế'}
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', marginBottom: '14px' }}>
          Chọn tài xế đã lưu hoặc nhập mới, và chọn ngày/khung giờ giao hàng linh hoạt đến cửa hàng.
        </p>

        {error && (
          <div className="error-notice" style={{ marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {/* 1. Chọn tài xế đã lưu hoặc nhập mới */}
        <div style={{ marginBottom: '12px' }}>
          <label className="supplier-dialog-field" style={{ margin: 0 }}>
            <span>Chọn nhanh tài xế từng giao:</span>
            <select
              value={selectedDriverId}
              onChange={(e) => handleSelectSavedDriver(e.target.value)}
              disabled={busy}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #94a3b8',
                backgroundColor: '#f8fafc',
                fontWeight: 500,
              }}
            >
              <option value="">-- Chọn tài xế từ danh bạ đã lưu --</option>
              {savedDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.driverName} · {d.vehicleType} ({d.driverPhone})
                </option>
              ))}
              <option value="CUSTOM">+ Nhập tài xế khác (mới)</option>
            </select>
          </label>
        </div>

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

        {/* 2. Lịch và Khung thời gian giao hàng linh hoạt */}
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <span style={{ fontSize: '13px', fontWeight: 650, color: '#166534', display: 'block', marginBottom: '8px' }}>
            Lịch giao & Khung giờ giao hàng linh hoạt:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <label className="supplier-dialog-field" style={{ margin: 0 }}>
              <span style={{ color: '#166534' }}>Chọn ngày giao:</span>
              <input
                type="date"
                min={todayStr}
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                disabled={busy}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #86efac' }}
              />
            </label>

            <label className="supplier-dialog-field" style={{ margin: 0 }}>
              <span style={{ color: '#166534' }}>Chọn khung giờ giao:</span>
              <select
                value={selectedTimeSlot}
                onChange={(e) => setSelectedTimeSlot(e.target.value)}
                disabled={busy}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #86efac', backgroundColor: '#ffffff' }}
              >
                {TIME_SLOT_OPTIONS.map((slot) => (
                  <option key={slot.code} value={slot.code}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedTimeSlot === 'CUSTOM' && (
            <input
              type="text"
              placeholder="VD: Trong khoảng 14h15 - 15h00..."
              value={customTimeSlot}
              onChange={(e) => setCustomTimeSlot(e.target.value)}
              disabled={busy}
              style={{ marginTop: '8px', width: '100%' }}
            />
          )}

          <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#15803d', fontWeight: 500 }}>
            Hiển thị cho cửa hàng: <strong>{computeEstimatedDeliveryTime()}</strong>
          </div>
        </div>

        <label className="supplier-dialog-field" style={{ marginTop: '10px' }}>
          <span>Ghi chú chuyến xe / dặn dò:</span>
          <textarea
            placeholder="VD: Hàng nặng có tài xế hỗ trợ bê vào cửa hàng, gọi trước khi đến 10 phút..."
            rows={2}
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
                {busy ? 'Đang xử lý…' : 'Bắt đầu giao & Xuất phát'}
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

function SupplierIncidentDialog({
  order,
  busy,
  onCancel,
  onSubmit,
}: {
  order: SupplierOrder;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    damagedItems: Array<{ productId: number; productName: string; packaging?: string; quantity: number }>;
    damageType: string;
    damageTypeLabel?: string;
    evidenceImageUrl?: string | null;
    notes?: string | null;
    action: string;
  }) => void;
}) {
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [damageType, setDamageType] = useState('DAMAGED_TRANSIT');
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState('REPLACE_0VND');
  const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
  const [error, setError] = useState('');

  const DAMAGE_TYPES = [
    { code: 'DAMAGED_TRANSIT', label: 'Hư hỏng bể vỡ do va chạm khi vận chuyển' },
    { code: 'SPILL_CRUSH', label: 'Đổ tràn / bẹp dúm thùng kiện hàng' },
    { code: 'WATER_SOAKED', label: 'Ướt nước / ngấm mưa' },
    { code: 'SPOILED', label: 'Hàng biến chất / hư hại do nhiệt độ' },
    { code: 'OTHER', label: 'Khác' },
  ];

  function toggleAll() {
    const isAll = Object.keys(selectedItems).length === order.items.length;
    if (isAll) {
      setSelectedItems({});
    } else {
      const map: Record<number, number> = {};
      order.items.forEach((it) => {
        map[it.productId] = it.quantity;
      });
      setSelectedItems(map);
    }
  }

  function handleQuantityChange(productId: number, qty: number, maxQty: number) {
    const cleanQty = Math.max(1, Math.min(qty, maxQty));
    setSelectedItems((prev) => ({ ...prev, [productId]: cleanQty }));
  }

  function toggleItem(productId: number, maxQty: number) {
    setSelectedItems((prev) => {
      const copy = { ...prev };
      if (copy[productId] !== undefined) {
        delete copy[productId];
      } else {
        copy[productId] = maxQty;
      }
      return copy;
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setEvidenceImages((prev) => [...prev, base64].slice(0, 3));
      }
    };
    reader.readAsDataURL(files[0]);
  }

  function handleSubmit() {
    const entries = Object.entries(selectedItems);
    if (entries.length === 0) {
      setError('Vui lòng tích chọn ít nhất 1 mặt hàng gặp sự cố hư hỏng.');
      return;
    }

    const damagedItems = entries
      .map(([productIdStr, qty]) => {
        const item = order.items.find((it) => it.productId === Number(productIdStr));
        if (!item) return null;
        return {
          productId: item.productId,
          productName: item.productName,
          packaging: item.packaging,
          quantity: qty,
        };
      })
      .filter(Boolean) as Array<{ productId: number; productName: string; packaging?: string; quantity: number }>;

    const damageTypeObj = DAMAGE_TYPES.find((d) => d.code === damageType);

    setError('');
    onSubmit({
      damagedItems,
      damageType,
      damageTypeLabel: damageTypeObj?.label,
      evidenceImageUrl: evidenceImages.length > 0 ? evidenceImages.join('|||') : null,
      notes: notes.trim() || undefined,
      action,
    });
  }

  return (
    <div className="supplier-dialog-backdrop" role="presentation">
      <section
        className="supplier-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-dialog-title"
        style={{ maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <span className="supplier-panel-label" style={{ color: '#dc2626' }}>
          SỰ CỐ VẬN CHUYỂN · ĐƠN #{order.id}
        </span>
        <h2 id="incident-dialog-title" style={{ color: '#991b1b' }}>
          Lập báo cáo sự cố hư hại hàng khi giao
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', marginBottom: '14px' }}>
          Tài xế trong lúc giao gặp sự cố làm hỏng hàng. Chọn mặt hàng bị hỏng để tiếp tục giao phần còn lại hoặc nhận lại hàng và tự động tạo đơn giao bù 0đ.
        </p>

        {error && (
          <div className="error-notice" style={{ marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {/* 1. Checklist các mặt hàng trong đơn */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 650, color: '#1e293b' }}>
              Chọn các mặt hàng bị hư hỏng ({Object.keys(selectedItems).length}/{order.items.length}):
            </span>
            <button
              type="button"
              className="ghost-button"
              style={{ fontSize: '11px', padding: '2px 8px' }}
              onClick={toggleAll}
            >
              {Object.keys(selectedItems).length === order.items.length ? 'Bỏ chọn' : 'Chọn tất cả'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {order.items.map((item) => {
              const isSelected = selectedItems[item.productId] !== undefined;
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? '#fef2f2' : '#f8fafc',
                    border: `1px solid ${isSelected ? '#fecaca' : '#e2e8f0'}`,
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItem(item.productId, item.quantity)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '13px', color: isSelected ? '#991b1b' : '#1e293b' }}>
                      <strong>{item.productName}</strong> ({item.packaging})
                    </span>
                  </label>

                  {isSelected && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>SL hỏng:</span>
                      <input
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={selectedItems[item.productId]}
                        onChange={(e) =>
                          handleQuantityChange(item.productId, Number(e.target.value), item.quantity)
                        }
                        style={{
                          width: '60px',
                          padding: '4px 6px',
                          textAlign: 'center',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12.5px',
                        }}
                      />
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>/ {item.quantity}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Loại hư hỏng */}
        <div style={{ marginBottom: '12px' }}>
          <label className="supplier-dialog-field" style={{ margin: 0 }}>
            <span>Loại sự cố / hư hỏng:</span>
            <select
              value={damageType}
              onChange={(e) => setDamageType(e.target.value)}
              disabled={busy}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              {DAMAGE_TYPES.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* 3. Ảnh chụp bằng chứng */}
        <div style={{ marginBottom: '12px' }}>
          <label className="supplier-dialog-field" style={{ margin: 0 }}>
            <span>Ảnh chụp bằng chứng hàng hư hỏng (tối đa 3 ảnh):</span>
            <input type="file" accept="image/*" onChange={handleFileSelect} disabled={busy} />
          </label>
          {evidenceImages.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              {evidenceImages.map((src, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <img
                    src={src}
                    alt={`Ảnh bằng chứng ${idx + 1}`}
                    style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #fed7aa' }}
                  />
                  <button
                    type="button"
                    onClick={() => setEvidenceImages((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Phương án xử lý */}
        <div style={{ marginBottom: '12px', padding: '10px 12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <span style={{ fontSize: '13px', fontWeight: 650, color: '#166534', display: 'block', marginBottom: '6px' }}>
            Phương án giải quyết của Chủ vựa:
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '4px', fontSize: '13px' }}>
            <input
              type="radio"
              name="incidentAction"
              checked={action === 'REPLACE_0VND'}
              onChange={() => setAction('REPLACE_0VND')}
            />
            <span>
              <strong>Tiếp tục giao hàng lành & Tự động tạo đơn bù 0đ (Giao bổ sung)</strong>
              <small style={{ display: 'block', color: '#15803d' }}>
                Hệ thống tự động khởi tạo đơn mới giá 0đ chứa các món hàng bị hư hỏng để giao chuyến sau.
              </small>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', marginTop: '6px' }}>
            <input
              type="radio"
              name="incidentAction"
              checked={action === 'RETURN_ALL'}
              onChange={() => setAction('RETURN_ALL')}
            />
            <span>
              <strong>Thu hồi toàn bộ hàng về kho</strong>
              <small style={{ display: 'block', color: '#64748b' }}>
                Tài xế mang toàn bộ hàng về kho vựa để kiểm đếm lại.
              </small>
            </span>
          </label>
        </div>

        <label className="supplier-dialog-field">
          <span>Ghi chú thêm về sự cố:</span>
          <textarea
            placeholder="VD: Xe máy va quẹt nhẹ làm vỡ 2 lốc nước ngọt, thùng bia vẫn nguyên vẹn..."
            rows={2}
            maxLength={300}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
        </label>

        <div className="supplier-dialog-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>
            Hủy
          </button>
          <button
            type="button"
            className="table-button danger"
            onClick={handleSubmit}
            disabled={busy}
            style={{ fontWeight: 650 }}
          >
            {busy ? 'Đang xử lý…' : 'Xác nhận sự cố & Tạo đơn giao bù 0đ'}
          </button>
        </div>
      </section>
    </div>
  );
}
