import { useEffect, useState } from 'react';
import '../catalog.css';
import SupplierLayout from '../../components/SupplierLayout';
import OrderList from '../../components/OrderList';
import { POPULAR_BANKS } from '../../constants/banks';
import { validateQrCodeImage } from '../../utils/qrValidator';
import { api } from '../../services/api';
import { calculateDeliveryFee } from '../../utils/geo';
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
  type SupplierProfile,
} from '../../services/supplier.api';
import type { AuthUser } from '../../types/auth';

const money = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

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
  const [showBankModal, setShowBankModal] = useState(false);

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
    lossAmount?: number;
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
      {showBankModal && (
        <SupplierBankAccountDialog
          onClose={() => setShowBankModal(false)}
          onSaved={(msg) => {
            setNotice(msg);
            setNoticeError(false);
            setOrderRevision((n) => n + 1);
          }}
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

const STANDARD_DELIVERY_HOURS = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];
const STANDARD_DELIVERY_MINUTES = ['00', '15', '30', '45'];

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

  
  // Tính toán khoảng cách và thời gian di chuyển thực tế từ vựa đến tiệm
  const deliveryCalc = calculateDeliveryFee({
    storeAddress: order.deliveryAddress || '',
    supplierWarehouseAddress: order.supplier?.warehouseAddress || '',
  });
  const distanceKm = deliveryCalc.distanceKm || 3.0;
  // Ước tính vận tốc xe giao hàng trong đô thị: 20 km/h, tối thiểu 15 phút di chuyển
  const driveMinutes = Math.max(15, Math.ceil((distanceKm / 20) * 60));
  // Thời gian chuẩn bị kho tối thiểu: 2 tiếng (120 phút) + thời gian chạy xe
  const minLeadMinutes = 120 + driveMinutes;
  const now = new Date();
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, '0');
  const localDay = String(now.getDate()).padStart(2, '0');
  const todayStr = `${localYear}-${localMonth}-${localDay}`;

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const earliestDeliveryMinutes = nowMinutes + minLeadMinutes;
  // Giờ làm việc chuẩn: 08:00 (480 phút) đến 17:00 (1020 phút)
  const canDeliverToday = earliestDeliveryMinutes <= 17 * 60;
  const minDeliveryDate = canDeliverToday ? todayStr : tomorrowStr;

  // Tính giờ mặc định ban đầu
  let initialDeliveryHour: string;
  let initialDeliveryMinute: string;
  if (canDeliverToday) {
    const clampedEarliest = Math.max(8 * 60, earliestDeliveryMinutes);
    const rounded = Math.ceil(clampedEarliest / 15) * 15;
    const h = Math.min(17, Math.floor(rounded / 60));
    const m = h === 17 ? 0 : rounded % 60;
    initialDeliveryHour = String(h).padStart(2, '0');
    initialDeliveryMinute = String(m).padStart(2, '0');
  } else {
    initialDeliveryHour = '08';
    initialDeliveryMinute = '30';
  }

  const [deliveryDate, setDeliveryDate] = useState(minDeliveryDate);
  const [deliveryTime, setDeliveryTime] = useState(`${initialDeliveryHour}:${initialDeliveryMinute}`);
  const [currDeliveryHour = initialDeliveryHour, currDeliveryMinute = initialDeliveryMinute] = deliveryTime ? deliveryTime.split(':') : [initialDeliveryHour, initialDeliveryMinute];

  function getAvailableHours(selectedDate: string) {
    if (selectedDate !== todayStr) {
      return STANDARD_DELIVERY_HOURS;
    }
    return STANDARD_DELIVERY_HOURS.filter((hStr) => {
      const h = parseInt(hStr, 10);
      if (h === 17) return h * 60 >= earliestDeliveryMinutes;
      return (h + 1) * 60 > earliestDeliveryMinutes;
    });
  }

  function getAvailableMinutes(selectedDate: string, selectedHour: string) {
    const h = parseInt(selectedHour, 10);
    if (h === 17) return ['00'];
    if (selectedDate !== todayStr) return STANDARD_DELIVERY_MINUTES;
    const valid = STANDARD_DELIVERY_MINUTES.filter((mStr) => {
      return h * 60 + parseInt(mStr, 10) >= earliestDeliveryMinutes;
    });
    return valid.length > 0 ? valid : ['00'];
  }

  const availableHours = getAvailableHours(deliveryDate);
  const availableMinutes = getAvailableMinutes(deliveryDate, currDeliveryHour);

  function handleDateChange(newDate: string) {
    setDeliveryDate(newDate);
    const hours = getAvailableHours(newDate);
    let nextHour = currDeliveryHour;
    if (!hours.includes(nextHour)) {
      nextHour = hours[0] || '08';
    }
    const minutes = getAvailableMinutes(newDate, nextHour);
    let nextMinute = currDeliveryMinute;
    if (!minutes.includes(nextMinute)) {
      nextMinute = minutes[0] || '00';
    }
    setDeliveryTime(`${nextHour}:${nextMinute}`);
  }

  function handleHourChange(newHour: string) {
    const minutes = getAvailableMinutes(deliveryDate, newHour);
    let nextMinute = currDeliveryMinute;
    if (!minutes.includes(nextMinute)) {
      nextMinute = minutes[0] || '00';
    }
    setDeliveryTime(`${newHour}:${nextMinute}`);
  }

  const earliestTimeTodayDisplay = canDeliverToday ? `${initialDeliveryHour}:${initialDeliveryMinute}` : '';
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
    return `Ngày ${dateFormatted} lúc ${deliveryTime}`;
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
    // Kiểm tra không chọn ngày trong quá khứ hoặc ngày đã hết giờ nhận
    if (deliveryDate < minDeliveryDate) {
      setError(
        canDeliverToday
          ? 'Ngày giao hàng không thể ở trong quá khứ.'
          : 'Hôm nay đã hết khung giờ nhận giao (kết thúc lúc 17:00). Vui lòng chọn lịch từ ngày mai.'
      );
      return;
    }

    if (!deliveryTime) {
      setError('Vui lòng chọn giờ giao hàng.');
      return;
    }

    const [h, m] = deliveryTime.split(':').map(Number);
    if (h < 8 || h > 17 || (h === 17 && m > 0)) {
      setError('Thời gian giao hàng phải nằm trong khung giờ làm việc chuẩn (08:00 - 17:00).');
      return;
    }

    // Kiểm tra thời gian cách tối thiểu 2 tiếng chuẩn bị + thời gian di chuyển
    if (deliveryDate === todayStr) {
      const chosenMinutes = h * 60 + m;
      if (chosenMinutes < earliestDeliveryMinutes) {
        setError(
          `Giờ giao đến phải cách hiện tại ít nhất 2 tiếng chuẩn bị kho và ${driveMinutes} phút xe chạy (sớm nhất hôm nay là ${earliestTimeTodayDisplay}). Vui lòng chọn từ ${earliestTimeTodayDisplay} trở đi hoặc chuyển sang ngày mai.`
        );
        return;
      }
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

        {/* 2. Lịch và Khung thời gian giao hàng chuẩn 08:00 - 17:00 */}
        <div style={{ marginTop: '14px', padding: '14px 16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 750, color: '#0f172a' }}>
                Lịch hẹn giao hàng
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '12px' }}>
                Giờ chuẩn: 08:00 - 17:00
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
              Khoảng cách: <strong>~{distanceKm.toFixed(1)} km</strong> (~{driveMinutes} phút xe chạy)
            </span>
          </div>

          {!canDeliverToday ? (
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#92400e', lineHeight: 1.45 }}>
              <strong>Lưu ý khung giờ:</strong> Hiện tại đã hết giờ nhận giao hàng trong ngày hôm nay (kết thúc lúc 17:00). Lịch giao sớm nhất được xếp từ <strong>08:00 sáng mai</strong>.
            </div>
          ) : (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#166534', lineHeight: 1.45 }}>
              Quy chuẩn giao: Tối thiểu 2 tiếng chuẩn bị kho + {driveMinutes} phút xe chạy. Sớm nhất hôm nay: <strong>từ {earliestTimeTodayDisplay}</strong>.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ display: 'block', margin: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 650, color: '#334155', display: 'block', marginBottom: '5px' }}>
                Chọn ngày giao:
              </span>
              <input
                type="date"
                min={minDeliveryDate}
                value={deliveryDate}
                onChange={(e) => handleDateChange(e.target.value)}
                disabled={busy}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '13px', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
              />
            </label>

            <div style={{ margin: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 650, color: '#334155', display: 'block', marginBottom: '5px' }}>
                Chọn giờ giao đến tiệm:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <select
                  value={currDeliveryHour}
                  onChange={(e) => handleHourChange(e.target.value)}
                  disabled={busy}
                  style={{ width: '100%', padding: '8px 6px', borderRadius: '6px', border: '1px solid #94a3b8', backgroundColor: '#ffffff', fontSize: '13px', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  {availableHours.map((h) => (
                    <option key={h} value={h}>{h} giờ</option>
                  ))}
                </select>
                <select
                  value={currDeliveryMinute}
                  onChange={(e) => setDeliveryTime(`${currDeliveryHour}:${e.target.value}`)}
                  disabled={busy}
                  style={{ width: '100%', padding: '8px 6px', borderRadius: '6px', border: '1px solid #94a3b8', backgroundColor: '#ffffff', fontSize: '13px', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  {availableMinutes.map((m) => (
                    <option key={m} value={m}>{m} phút</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '12.5px', color: '#0f172a' }}>
            Dự kiến giao đến tiệm: <strong style={{ color: '#15803d' }}>{computeEstimatedDeliveryTime()}</strong>
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

function parseItemPackaging(packagingStr?: string) {
  if (!packagingStr) return { multiplier: 1, unit: 'đơn vị' };
  const m = packagingStr.match(/(?:thùng|két|hộp|lốc|khay|kiện)\s+(\d+)\s*([a-zA-ZÀ-ỹ]+)/i);
  if (m) {
    return { multiplier: parseInt(m[1], 10), unit: m[2].trim() };
  }
  return { multiplier: 1, unit: 'đơn vị' };
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
    lossAmount?: number;
  }) => void;
}) {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [looseItems, setLooseItems] = useState<Record<number, { isLoose: boolean; looseQty: number | string }>>({});
  const [damageType, setDamageType] = useState('DAMAGED_TRANSIT');
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState('DEDUCT_COD');
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
      setLooseItems({});
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

  function handleLooseQtyChange(productId: number, rawVal: string, maxLoose: number) {
    let digits = rawVal.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      digits = digits.replace(/^0+/, '');
    }
    let qty: number | string = digits;
    if (digits !== '') {
      const num = parseInt(digits, 10);
      if (num > maxLoose) {
        qty = maxLoose;
      } else {
        qty = num;
      }
    }
    setLooseItems((prev) => ({
      ...prev,
      [productId]: { isLoose: true, looseQty: qty },
    }));
  }

  function getEffectiveLooseQty(looseQty: number | string | undefined, maxLoose: number): number {
    if (typeof looseQty === 'number' && looseQty > 0) return Math.min(looseQty, maxLoose);
    if (typeof looseQty === 'string' && looseQty.trim() !== '') {
      const n = parseInt(looseQty, 10);
      if (n > 0) return Math.min(n, maxLoose);
    }
    return 1;
  }

  function toggleLooseMode(productId: number) {
    setLooseItems((prev) => {
      const current = prev[productId];
      const isLoose = !current?.isLoose;
      return {
        ...prev,
        [productId]: { isLoose, looseQty: current?.looseQty || 1 },
      };
    });
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

  const totalCalculatedLoss = Object.entries(selectedItems).reduce((sum, [pIdStr, qty]) => {
    const item = order.items.find((it) => it.productId === Number(pIdStr));
    if (!item) return sum;
    const packInfo = parseItemPackaging(item.packaging);
    const loose = looseItems[item.productId];
    const isLoose = loose?.isLoose && packInfo.multiplier > 1;
    if (isLoose) {
      const eff = getEffectiveLooseQty(loose.looseQty, packInfo.multiplier * item.quantity);
      return sum + (eff / (packInfo.multiplier * item.quantity)) * item.lineTotal;
    }
    return sum + (qty / item.quantity) * item.lineTotal;
  }, 0);

  function handleSubmit() {
    const entries = Object.entries(selectedItems);
    if (entries.length === 0) {
      setError('Vui lòng tích chọn ít nhất 1 mặt hàng gặp sự cố hư hỏng.');
      return;
    }

    let calculatedLoss = 0;
    const damagedItems = entries
      .map(([productIdStr, qty]) => {
        const item = order.items.find((it) => it.productId === Number(productIdStr));
        if (!item) return null;
        const packInfo = parseItemPackaging(item.packaging);
        const loose = looseItems[item.productId];
        const isLoose = loose?.isLoose && packInfo.multiplier > 1;

        let displayName = item.productName;
        let displayPkg = item.packaging;
        let finalQty = qty;

        if (isLoose) {
          const effectiveLoose = getEffectiveLooseQty(loose.looseQty, packInfo.multiplier * item.quantity);
          displayName = `${item.productName} (Hỏng lẻ ${effectiveLoose}/${packInfo.multiplier} ${packInfo.unit})`;
          displayPkg = `${effectiveLoose} ${packInfo.unit}`;
          finalQty = Math.max(1, Math.round(effectiveLoose / packInfo.multiplier) || 1);
          calculatedLoss += (effectiveLoose / (packInfo.multiplier * item.quantity)) * item.lineTotal;
        } else {
          calculatedLoss += (qty / item.quantity) * item.lineTotal;
        }

        return {
          productId: item.productId,
          productName: displayName,
          packaging: displayPkg,
          quantity: finalQty,
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
      lossAmount: Math.round(calculatedLoss),
    });
  }

  return (
    <div className="supplier-dialog-backdrop" role="presentation">
      <section
        className="supplier-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-dialog-title"
        style={{ maxWidth: '620px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
      >
        <div style={{ flexShrink: 0 }}>
          <span className="supplier-panel-label" style={{ color: '#dc2626' }}>
            SỰ CỐ VẬN CHUYỂN · ĐƠN #{order.id}
          </span>
          <h2 id="incident-dialog-title" style={{ color: '#991b1b', margin: '4px 0' }}>
            Lập báo cáo sự cố hư hại hàng khi giao
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', marginBottom: '12px' }}>
            Tài xế trong lúc giao gặp sự cố làm hỏng hàng. Chọn mặt hàng bị hỏng (nguyên thùng hoặc hỏng lẻ gói/lon bên trong) và phương án xử lý luồng tiền.
          </p>

          {error && (
            <div className="error-notice" style={{ marginBottom: '12px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Scrollable Form Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', minHeight: '120px' }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {order.items.map((item) => {
                const isSelected = selectedItems[item.productId] !== undefined;
                const packInfo = parseItemPackaging(item.packaging);
                const hasSubUnits = packInfo.multiplier > 1;
                const looseState = looseItems[item.productId] || { isLoose: false, looseQty: 1 };

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? '#fef2f2' : '#f8fafc',
                      border: `1px solid ${isSelected ? '#fecaca' : '#e2e8f0'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
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

                      {isSelected && !looseState.isLoose && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>SL thùng hỏng:</span>
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={selectedItems[item.productId]}
                            onChange={(e) =>
                              handleQuantityChange(item.productId, Number(e.target.value), item.quantity)
                            }
                            style={{
                              width: '56px',
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

                    {/* Loose items selector if packaging contains sub-units (e.g. thùng 24 gói) */}
                    {isSelected && hasSubUnits && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#7f1d1d' }}>
                          <input
                            type="checkbox"
                            checked={looseState.isLoose}
                            onChange={() => toggleLooseMode(item.productId)}
                          />
                          <span>Chỉ hỏng lẻ {packInfo.unit} bên trong (không hỏng cả thùng nguyên)</span>
                        </label>

                        {looseState.isLoose && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11.5px', color: '#991b1b', fontWeight: 600 }}>SL {packInfo.unit} bị hư:</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="Nhập SL"
                              value={looseState.looseQty === '' ? '' : looseState.looseQty}
                              onChange={(e) =>
                                handleLooseQtyChange(item.productId, e.target.value, packInfo.multiplier * item.quantity)
                              }
                              onBlur={() => {
                                if (looseState.looseQty === '' || looseState.looseQty === 0) {
                                  handleLooseQtyChange(item.productId, '1', packInfo.multiplier * item.quantity);
                                }
                              }}
                              style={{
                                width: '64px',
                                padding: '4px 6px',
                                textAlign: 'center',
                                borderRadius: '4px',
                                border: '1px solid #f87171',
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#991b1b',
                                backgroundColor: '#ffffff',
                              }}
                            />
                            <span style={{ fontSize: '11.5px', color: '#64748b' }}>/ {packInfo.multiplier * item.quantity} {packInfo.unit}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Loại sự cố */}
          <div style={{ marginBottom: '12px' }}>
            <label className="supplier-dialog-field" style={{ margin: 0 }}>
              <span>Nguyên nhân sự cố:</span>
              <select
                value={damageType}
                onChange={(e) => setDamageType(e.target.value)}
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

          {totalCalculatedLoss > 0 && (
            <div style={{ marginBottom: '12px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12.5px', color: '#991b1b', fontWeight: 600 }}>Giá trị thiệt hại ước tính:</span>
              <strong style={{ fontSize: '14.5px', color: '#b91c1c' }}>{money(Math.round(totalCalculatedLoss))}</strong>
            </div>
          )}

          {/* 4. Phương án xử lý luồng tiền */}
          <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: '13px', fontWeight: 650, color: '#166534', display: 'block', marginBottom: '8px' }}>
              Phương án xử lý luồng tiền bồi thường:
            </span>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginBottom: '8px', fontSize: '13px' }}>
              <input
                type="radio"
                name="incidentAction"
                checked={action === 'DEDUCT_COD'}
                onChange={() => setAction('DEDUCT_COD')}
                style={{ marginTop: '3px' }}
              />
              <span>
                <strong>Trừ thẳng tiền hàng hỏng vào COD khi nhận hàng (Khuyên dùng)</strong>
                <small style={{ display: 'block', color: '#15803d', marginTop: '2px' }}>
                  Tiệm chỉ trả tiền cho các món nguyên vẹn. Khoản tiền hàng hỏng được trừ trực tiếp trên tiền mặt tài xế thu khi giao.
                </small>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginBottom: '8px', fontSize: '13px' }}>
              <input
                type="radio"
                name="incidentAction"
                checked={action === 'REPLACE_0VND'}
                onChange={() => setAction('REPLACE_0VND')}
                style={{ marginTop: '3px' }}
              />
              <span>
                <strong>Tiếp tục giao hàng lành & Tự động tạo đơn bù 0đ (Giao chuyến sau)</strong>
                <small style={{ display: 'block', color: '#15803d', marginTop: '2px' }}>
                  Tiệm nhận phần lành, hệ thống tự động khởi tạo đơn mới giá 0đ chứa các món hàng bị hư hỏng để giao bù miễn phí ở chuyến xe tiếp theo.
                </small>
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="radio"
                name="incidentAction"
                checked={action === 'RETURN_ALL'}
                onChange={() => setAction('RETURN_ALL')}
                style={{ marginTop: '3px' }}
              />
              <span>
                <strong>Thu hồi toàn bộ hàng về kho & Hoàn 100% tiền cọc</strong>
                <small style={{ display: 'block', color: '#64748b', marginTop: '2px' }}>
                  Tài xế mang toàn bộ hàng về kho vựa. Tiền cọc trong Escrow hoàn trả 100% về ví tiệm tạp hóa.
                </small>
              </span>
            </label>
          </div>

          <label className="supplier-dialog-field" style={{ marginBottom: '8px' }}>
            <span>Ghi chú thêm về sự cố:</span>
            <textarea
              placeholder="VD: Thùng bị móp cạnh làm vỡ 6 gói bánh bên trong, các gói còn lại nguyên vẹn..."
              rows={2}
              maxLength={300}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>

        {/* Modal Actions Footer (Fixed at bottom) */}
        <div className="supplier-dialog-actions" style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
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
            {busy ? 'Đang xử lý…' : action === 'DEDUCT_COD' ? 'Xác nhận trừ tiền COD' : action === 'REPLACE_0VND' ? 'Xác nhận & Tạo đơn bù 0đ' : 'Xác nhận thu hồi đơn'}
          </button>
        </div>
      </section>
    </div>
  );
}

function SupplierBankAccountDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [bankName, setBankName] = useState('Vietcombank');
  const [customBankName, setCustomBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankQrImageUrl, setBankQrImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [error, setError] = useState('');
  const [qrError, setQrError] = useState('');

  useEffect(() => {
    let ignore = false;
    api.get<{ profile: SupplierProfile }>('/supplier/profile').then((res) => {
      if (ignore) return;
      const p = res.data?.profile;
      if (p) {
        if (p.bankName) {
          if (POPULAR_BANKS.includes(p.bankName)) {
            setBankName(p.bankName);
          } else {
            setBankName('Khác');
            setCustomBankName(p.bankName);
          }
        }
        if (p.bankAccountNumber) setBankAccountNumber(p.bankAccountNumber);
        if (p.bankAccountHolder) setBankAccountHolder(p.bankAccountHolder);
      }
      setLoading(false);
    }).catch(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, []);

  async function handleQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrError('');

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setQrError('Chỉ chấp nhận file ảnh định dạng JPG, PNG hoặc WEBP.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setQrError('Kích thước ảnh mã QR không được vượt quá 3MB.');
      return;
    }

    setUploadingQr(true);
    try {
      const qrCheck = await validateQrCodeImage(file);
      if (!qrCheck.isValid) {
        setQrError(
          qrCheck.message ||
            'Ảnh được đăng lên không phải là mã QR. Vui lòng chụp hoặc tải lại đúng ảnh mã QR thanh toán của ngân hàng.'
        );
        return;
      }
      const formData = new FormData();
      formData.append('qrImage', file);
      const res = await api.post<{ success: boolean; imageUrl: string }>('/profile/upload-bank-qr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.imageUrl) {
        setBankQrImageUrl(res.data.imageUrl);
      }
    } catch (err) {
      setQrError(getApiError(err));
    } finally {
      setUploadingQr(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const finalBankName = bankName === 'Khác' ? customBankName.trim() : bankName;
    if (!finalBankName || finalBankName.length < 2) {
      setError('Vui lòng chọn hoặc nhập tên ngân hàng hợp lệ.');
      return;
    }
    const cleanAcc = bankAccountNumber.trim().replace(/\s+/g, '');
    if (!/^[A-Za-z0-9]{4,34}$/.test(cleanAcc)) {
      setError('Số tài khoản ngân hàng cần từ 4 đến 34 chữ số hoặc chữ cái, không chứa khoảng trắng.');
      return;
    }
    const cleanHolder = bankAccountHolder.trim().toUpperCase();
    if (!cleanHolder || cleanHolder.length < 2) {
      setError('Vui lòng nhập tên chủ tài khoản (in hoa không dấu).');
      return;
    }

    setSaving(true);
    try {
      await api.put('/supplier/profile', {
        bankName: finalBankName,
        bankAccountNumber: cleanAcc,
        bankAccountHolder: cleanHolder,
      });
      onSaved('Đã cập nhật thông tin tài khoản ngân hàng nhận tiền của vựa thành công.');
      onClose();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="supplier-dialog-backdrop" role="presentation">
      <section
        className="supplier-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bank-dialog-title"
        style={{ maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <span className="supplier-panel-label">TÀI KHOẢN THANH TOÁN VỰA</span>
        <h2 id="bank-dialog-title">Thông tin tài khoản nhận tiền</h2>
        <p className="catalog-hint" style={{ marginTop: 0 }}>
          Thông tin ngân hàng này sẽ hiển thị cho tiệm tạp hóa khi quét mã VietQR thanh toán tiền hàng trực tiếp cho bạn khi xe giao đến tiệm.
        </p>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Đang tải thông tin tài khoản...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <p className="error-notice" role="alert">{error}</p>}

            <label className="supplier-dialog-field">
              <span>Ngân hàng nhận tiền: *</span>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={saving}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', backgroundColor: '#ffffff' }}
              >
                {POPULAR_BANKS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>

            {bankName === 'Khác' && (
              <label className="supplier-dialog-field">
                <span>Nhập tên ngân hàng của bạn: *</span>
                <input
                  type="text"
                  required
                  placeholder="VD: Shinhan Bank, Woori Bank, PVcomBank..."
                  value={customBankName}
                  onChange={(e) => setCustomBankName(e.target.value)}
                  disabled={saving}
                  maxLength={100}
                />
              </label>
            )}

            <label className="supplier-dialog-field">
              <span>Số tài khoản ngân hàng: *</span>
              <input
                type="text"
                required
                placeholder="VD: 0071001234567"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                disabled={saving}
                maxLength={34}
                style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}
              />
              <small style={{ color: '#64748b', fontSize: '11.5px', marginTop: '2px', display: 'block' }}>
                Từ 4 đến 34 chữ số hoặc chữ cái, không dấu và không khoảng trắng.
              </small>
            </label>

            <label className="supplier-dialog-field">
              <span>Tên chủ tài khoản: *</span>
              <input
                type="text"
                required
                placeholder="VD: NGUYEN VAN A"
                value={bankAccountHolder}
                onChange={(e) => setBankAccountHolder(e.target.value.toUpperCase())}
                disabled={saving}
                maxLength={100}
                style={{ textTransform: 'uppercase' }}
              />
            </label>

            <div style={{ margin: '14px 0', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '13px', fontWeight: 650, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                Ảnh mã QR nhận tiền (Tùy chọn):
              </span>
              <small style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                Hệ thống tự động kiểm tra ảnh tải lên phải đúng là mã QR ngân hàng.
              </small>

              {qrError && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '12px', marginBottom: '8px' }}>
                  {qrError}
                </div>
              )}

              {bankQrImageUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                  <img
                    src={bankQrImageUrl}
                    alt="Mã QR vựa"
                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <div>
                    <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600, display: 'block' }}>Đã xác thực mã QR thành công</span>
                    <button
                      type="button"
                      className="ghost-button"
                      style={{ fontSize: '11px', padding: '2px 8px', marginTop: '4px', color: '#dc2626' }}
                      onClick={() => setBankQrImageUrl('')}
                    >
                      Xóa ảnh QR
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    id="supplier-qr-file-input"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleQrUpload}
                    disabled={uploadingQr || saving}
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: '12.5px', padding: '6px 14px' }}
                    onClick={() => document.getElementById('supplier-qr-file-input')?.click()}
                    disabled={uploadingQr || saving}
                  >
                    {uploadingQr ? 'Đang kiểm tra ảnh QR...' : 'Tải lên ảnh mã QR'}
                  </button>
                </div>
              )}
            </div>

            <div className="supplier-dialog-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>
                Đóng
              </button>
              <button type="submit" className="table-button primary-small" disabled={saving} style={{ backgroundColor: '#166534', fontWeight: 700 }}>
                {saving ? 'Đang lưu…' : 'Xác nhận lưu tài khoản'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
