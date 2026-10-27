import { useEffect, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';
import type { SupplierOrder } from '../services/supplier.api';
import ExportDropdown from './ExportDropdown';
import { exportSupplierOrdersToExcel, exportSupplierOrdersToPdf } from '../utils/exportSupplier';
import { rescheduleOrder, respondRescheduleOrder } from '../services/supplier.api';
import { depositOrderWithWallet } from '../services/wallet.api';

const statuses = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PREPARING: 'Đang chuẩn bị',
  SHIPPING: 'Đang vận chuyển',
  ISSUE_HANDLING: 'Tiếp nhận xử lý',
  DELIVERED: 'Đã giao',
  REJECTED: 'Đã từ chối',
};

const actions: Record<string, string> = {
  PENDING: 'Duyệt đơn',
  APPROVED: 'Bắt đầu soạn',
  PREPARING: 'Bàn giao vận chuyển',
  SHIPPING: 'Chuyển tiếp nhận xử lý',
  ISSUE_HANDLING: 'Xác nhận đã giao & thu COD',
};

const COMPLAINT_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Chờ supplier tiếp nhận', color: '#c2410c', bg: '#fff7ed' },
  IN_REVIEW: { label: 'Supplier đang xử lý', color: '#1d4ed8', bg: '#eff6ff' },
  RESOLVED: { label: 'Đã giải quyết', color: '#15803d', bg: '#f0fdf4' },
  REJECTED: { label: 'Supplier từ chối', color: '#b91c1c', bg: '#fef2f2' },
};

const COMPLAINT_REASONS: { code: string; label: string }[] = [
  { code: 'DAMAGED', label: 'Hàng hư hỏng / bể vỡ' },
  { code: 'SHORTAGE', label: 'Thiếu hàng / thiếu số lượng' },
  { code: 'WRONG_ITEM', label: 'Giao sai sản phẩm / quy cách' },
  { code: 'EXPIRED', label: 'Hàng cận date / hết hạn' },
  { code: 'QUALITY', label: 'Lỗi chất lượng sản phẩm' },
  { code: 'LATE', label: 'Giao trễ / sai hẹn' },
  { code: 'OTHER', label: 'Khác' },
];

const REASON_LABELS: Record<string, string> = {
  DAMAGED: 'Hàng hư hỏng / bể vỡ',
  SHORTAGE: 'Thiếu hàng / thiếu số lượng',
  WRONG_ITEM: 'Giao sai sản phẩm / quy cách',
  EXPIRED: 'Hàng cận date / hết hạn',
  QUALITY: 'Lỗi chất lượng sản phẩm',
  LATE: 'Giao trễ / sai hẹn',
  OTHER: 'Khác',
};

const money = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
type Props = {
  kind: 'store' | 'supplier';
  onLogout: () => void;
  revision?: number;
  busy?: boolean;
  onStatus?: (order: SupplierOrder, forcedStatus?: string) => void;
  onEditDriver?: (order: SupplierOrder) => void;
};

export default function OrderList({ kind, onLogout, revision = 0, busy = false, onStatus, onEditDriver }: Props) {
  const [query, setQuery] = useState({ page: 1, status: '' });
  const [data, setData] = useState<{ orders: SupplierOrder[]; total: number; hasMore: boolean }>({
    orders: [],
    total: 0,
    hasMore: false,
  });
  const [error, setError] = useState('');
  const [depositNotice, setDepositNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [complaintOrder, setComplaintOrder] = useState<SupplierOrder | null>(null);
  const [complaintReason, setComplaintReason] = useState(COMPLAINT_REASONS[0].code);
  const [complaintDescription, setComplaintDescription] = useState('');
  const [complaintBusy, setComplaintBusy] = useState(false);
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintResponse, setComplaintResponse] = useState('');
  const [complaintActionBusy, setComplaintActionBusy] = useState(false);
  const [depositBusy, setDepositBusy] = useState<number | null>(null);
  const [depositDraft, setDepositDraft] = useState<{ orderId: number; reference: string } | null>(
    null,
  );
  function handleExportExcel() {
    exportSupplierOrdersToExcel(
      data.orders,
      kind === 'store' ? 'Đơn Mua Hàng Cửa Hàng' : 'Đơn Bán Sỉ Chủ Vựa',
    );
  }

  async function handleExportPdf() {
    await exportSupplierOrdersToPdf(
      data.orders,
      kind === 'store' ? 'Đơn Mua Hàng Cửa Hàng' : 'Đơn Bán Sỉ Chủ Vựa',
    );
  }

  const [refundDraft, setRefundDraft] = useState<{ orderId: number; reference: string } | null>(
    null,
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [resolutionType, setResolutionType] = useState<'DEDUCT_COD' | 'RETURN_REFUND' | 'REJECT_REFUSAL_CLAIM_DEPOSIT'>('DEDUCT_COD');
  const [deductAmount, setDeductAmount] = useState<number>(0);
  const [rescheduleOrderTarget, setRescheduleOrderTarget] = useState<SupplierOrder | null>(null);
  const [rescheduleTimeChoice, setRescheduleTimeChoice] = useState<'1_HOUR' | 'THIS_AFTERNOON' | 'TOMORROW_MORNING' | 'CUSTOM'>('1_HOUR');
  const [customRescheduleTime, setCustomRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleMessage, setRescheduleMessage] = useState('');
  const [supplierRescheduleBusy, setSupplierRescheduleBusy] = useState<number | null>(null);
  const [rejectRescheduleOrder, setRejectRescheduleOrder] = useState<SupplierOrder | null>(null);
  const [rejectRescheduleReason, setRejectRescheduleReason] = useState('');

  async function handleDepositWithWallet(order: SupplierOrder) {
    if (depositBusy !== null) return;
    setDepositBusy(order.id);
    setError('');
    setDepositNotice('');
    try {
      await depositOrderWithWallet(order.id);
      setDepositNotice(
        `Đã ký quỹ thành công ${money(order.depositAmount)} từ Ví hệ thống cho đơn #${order.id}.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDepositBusy(null);
    }
  }

  async function submitDeposit(event: FormEvent, order: SupplierOrder) {
    event.preventDefault();
    const reference = depositDraft?.orderId === order.id ? depositDraft.reference.trim() : '';
    if (depositBusy !== null || reference.length < 3) {
      setError('Nhập mã giao dịch hoặc nội dung chuyển khoản từ 3 ký tự trở lên.');
      return;
    }
    setDepositBusy(order.id);
    setError('');
    setDepositNotice('');
    try {
      await api.post(`/orders/${order.id}/deposit`, { reference });
      setDepositDraft(null);
      setDepositNotice(
        `Đã báo chuyển cọc cho đơn #${order.id}. Chủ vựa sẽ kiểm tra tài khoản và xác nhận; hiện tại đơn chưa được tính là đã thanh toán.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDepositBusy(null);
    }
  }

  async function reviewDeposit(order: SupplierOrder, action: 'CONFIRM' | 'REJECT') {
    if (depositBusy !== null) return;
    setDepositBusy(order.id);
    setError('');
    setDepositNotice('');
    try {
      await api.patch(`/supplier/orders/${order.id}/deposit`, {
        action,
        ...(action === 'REJECT' ? { reason: 'Chủ vựa chưa ghi nhận tiền cọc vào tài khoản' } : {}),
      });
      setDepositNotice(
        action === 'CONFIRM'
          ? `Đã xác nhận nhận cọc cho đơn #${order.id}. Tạp hóa sẽ thấy trạng thái “Đã nhận cọc”.`
          : `Đã báo chưa nhận được cọc của đơn #${order.id}. Tạp hóa có thể kiểm tra và gửi lại thông tin chuyển khoản.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDepositBusy(null);
    }
  }

  async function submitSandboxDeposit(order: SupplierOrder) {
    if (depositBusy !== null) return;
    setDepositBusy(order.id);
    setError('');
    setDepositNotice('');
    try {
      await api.post(`/orders/${order.id}/deposit/sandbox`);
      setDepositDraft(null);
      setDepositNotice(
        `Thanh toán sandbox cho đơn #${order.id} đã được ghi nhận. Không có tiền thật được chuyển; chủ vựa vẫn cần bấm xác nhận để hoàn tất bước cọc.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDepositBusy(null);
    }
  }

  async function submitRefund(event: FormEvent, order: SupplierOrder) {
    event.preventDefault();
    const reference = refundDraft?.orderId === order.id ? refundDraft.reference.trim() : '';
    if (depositBusy !== null || reference.length < 3) {
      setError('Nhập mã giao dịch hoàn cọc từ 3 ký tự trở lên.');
      return;
    }
    setDepositBusy(order.id);
    setError('');
    setDepositNotice('');
    try {
      await api.patch(`/supplier/orders/${order.id}/deposit`, {
        action: 'REFUND',
        reference,
      });
      setRefundDraft(null);
      setDepositNotice(
        `Đã ghi nhận hoàn cọc cho đơn #${order.id}. Tạp hóa sẽ thấy mã hoàn tiền trong đơn hàng.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDepositBusy(null);
    }
  }

  async function handleSupplierReschedule(order: SupplierOrder, action: 'ACCEPT' | 'REJECT', note?: string) {
    if (supplierRescheduleBusy !== null) return;
    setSupplierRescheduleBusy(order.id);
    setError('');
    try {
      await respondRescheduleOrder(order.id, action, note);
      setReload((n) => n + 1);
      if (action === 'REJECT') {
        setRejectRescheduleOrder(null);
        setRejectRescheduleReason('');
      }
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setSupplierRescheduleBusy(null);
    }
  }

  async function handleReschedule(event: FormEvent) {
    event.preventDefault();
    if (!rescheduleOrderTarget || rescheduleBusy) return;
    setRescheduleBusy(true);
    setRescheduleMessage('');
    const timeText = rescheduleTimeChoice === '1_HOUR'
      ? 'Sau 1 tiếng nữa'
      : rescheduleTimeChoice === 'THIS_AFTERNOON'
        ? 'Buổi chiều nay (14h00 – 16h30)'
        : rescheduleTimeChoice === 'TOMORROW_MORNING'
          ? 'Buổi sáng mai (8h00 – 11h00)'
          : customRescheduleTime.trim() || 'Thời gian đã thỏa thuận';
    try {
      await rescheduleOrder(rescheduleOrderTarget.id, timeText, rescheduleReason.trim() || undefined);
      setRescheduleMessage('Đã gửi yêu cầu dời giờ giao hàng cho chủ vựa thành công.');
      setTimeout(() => {
        setRescheduleOrderTarget(null);
        setRescheduleReason('');
        setCustomRescheduleTime('');
        setReload((n) => n + 1);
      }, 1000);
    } catch (issue) {
      setRescheduleMessage(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setRescheduleBusy(false);
    }
  }

  async function handleUploadComplaintImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setComplaintMessage('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post<{ success: boolean; imageUrl: string }>('/complaints/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedImageUrl(data.imageUrl);
    } catch (issue) {
      setComplaintMessage(getApiError(issue));
    } finally {
      setUploadingImage(false);
    }
  }

  async function submitResolution(event: FormEvent) {
    event.preventDefault();
    if (!complaintOrder?.complaint || complaintActionBusy) return;
    setComplaintActionBusy(true);
    setComplaintMessage('');
    try {
      await api.post(`/complaints/${complaintOrder.complaint.id}/resolve`, {
        resolutionType,
        deductAmount: resolutionType === 'DEDUCT_COD' ? deductAmount : undefined,
        note: complaintResponse.trim() || undefined,
      });
      setComplaintMessage('Đã xử lý sự cố đơn hàng thành công.');
      setTimeout(() => {
        setComplaintOrder(null);
        setComplaintResponse('');
        setDeductAmount(0);
        setReload((n) => n + 1);
      }, 1000);
    } catch (issue) {
      setComplaintMessage(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setComplaintActionBusy(false);
    }
  }

  async function submitComplaint(event: FormEvent) {
    event.preventDefault();
    if (!complaintOrder || complaintBusy) return;
    if (!uploadedImageUrl) {
      setComplaintMessage('Vui lòng chụp hoặc tải ảnh bằng chứng hàng bị hỏng / thiếu trước khi gửi.');
      return;
    }
    setComplaintBusy(true);
    setComplaintMessage('');
    try {
      await api.post('/complaints', {
        orderId: complaintOrder.id,
        reason: complaintReason,
        description: complaintDescription.trim() || undefined,
        imageUrl: uploadedImageUrl || undefined,
      });
      setComplaintMessage('Đã gửi báo cáo cho chủ vựa thành công. Vựa sẽ kiểm tra và phản hồi phương án xử lý.');
      setTimeout(() => {
        setComplaintOrder(null);
        setUploadedImageUrl('');
        setComplaintDescription('');
        setReload((n) => n + 1);
      }, 1000);
    } catch (issue) {
      setComplaintMessage(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setComplaintBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden && !busy) setReload((n) => n + 1);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    const abort = new AbortController();
    api
      .get(kind === 'store' ? '/orders' : '/supplier/orders', {
        params: query,
        signal: abort.signal,
      })
      .then(({ data }) => {
        if (!abort.signal.aborted) {
          setData(data);
          setError('');
        }
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setError(getApiError(error));
          if (isUnauthenticated(error)) onLogout();
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [kind, query, revision, reload, onLogout]);

  const submittedDepositCount = data.orders.filter(
    (order) => order.status === 'PENDING' && order.depositStatus === 'SUBMITTED',
  ).length;

  return (
    <section className="supplier-panel order-panel" aria-label="Danh sách đơn hàng">
      <div className="supplier-panel-title">
        <div>
          <span className="supplier-panel-label">ĐƠN HÀNG</span>
          <h2>{kind === 'store' ? 'Đơn mua của cửa hàng' : 'Đơn hàng từ cửa hàng'}</h2>
          <p className="catalog-hint">Tự cập nhật mỗi 30 giây khi bạn đang xem.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <ExportDropdown
            label="Xuất đơn"
            disabled={!data.orders.length}
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
          />
          <button
            className="ghost-button"
            disabled={loading || busy}
            onClick={() => {
              setLoading(true);
              setReload((n) => n + 1);
            }}
          >
            Tải lại đơn
          </button>
        </div>
      </div>

      {depositNotice && (
        <div className="deposit-flow-notice" role="status" aria-live="polite">
          <strong>✓ Cập nhật thanh toán thành công</strong>
          <span>{depositNotice}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setDepositNotice('')}>
            ×
          </button>
        </div>
      )}

      {kind === 'supplier' && submittedDepositCount > 0 && (
        <div className="order-deposit-alert" role="status">
          <strong>🔔 Có {submittedDepositCount} khoản cọc đang chờ bạn xác nhận</strong>
          <span>
            Kiểm tra tiền đã vào tài khoản ngân hàng, sau đó bấm “Xác nhận đã nhận cọc” trong đơn
            tương ứng.
          </span>
        </div>
      )}

      <label className="order-filter">
        Trạng thái đơn
        <select
          aria-label="Lọc trạng thái đơn"
          value={query.status}
          disabled={loading || busy}
          onChange={(e) => {
            setLoading(true);
            setQuery({ page: 1, status: e.target.value });
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(statuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span>{data.total} đơn phù hợp</span>
      </label>

      {error ? (
        <p className="error-notice" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p role="status">Đang tải đơn hàng…</p>
      ) : !data.orders.length ? (
        <p className="inventory-empty">Chưa có đơn phù hợp với bộ lọc này.</p>
      ) : (
        <div className="order-list">
          {data.orders.map((order) => (
            <article className="order-card" key={order.id} aria-label={`Đơn ${order.id}`}>
              <div className="order-card-top">
                <div>
                  <strong>Đơn #{order.id}</strong>
                  <span>
                    {new Date(order.createdAt).toLocaleString('vi-VN')} ·{' '}
                    {kind === 'store' ? order.supplier?.businessName : order.buyer.name}
                  </span>
                </div>
                <span className={`order-status order-${order.status.toLowerCase()}`}>
                  {order.statusLabel}
                </span>
              </div>

              <div className="order-items">
                {order.items.map((item) => (
                  <span key={item.id}>
                    {item.productName} · {item.quantity} × {item.packaging} ·{' '}
                    {money(item.lineTotal)}
                  </span>
                ))}
              </div>

              <p className="order-delivery">
                <strong>{order.recipientName || 'Đơn cũ chưa có người nhận'}</strong>
                {order.recipientPhone && <> · {order.recipientPhone}</>}
                <br />
                {order.deliveryAddress || 'Đơn cũ chưa lưu địa chỉ nhận'}
              </p>

              {order.note && <p className="catalog-hint">Ghi chú: {order.note}</p>}

              {/* Reschedule statuses & actions for both Store and Supplier */}
              {(() => {
                const isPending = Boolean(
                  order.note?.includes('[YÊU CẦU DỜI LỊCH GIAO') &&
                  !order.note?.includes('[VỰA ĐÃ ĐỒNG Ý DỜI LỊCH') &&
                  !order.note?.includes('[VỰA TỪ CHỐI DỜI LỊCH')
                );
                const isAccepted = Boolean(order.note?.includes('[VỰA ĐÃ ĐỒNG Ý DỜI LỊCH'));
                const isRejected = Boolean(order.note?.includes('[VỰA TỪ CHỐI DỜI LỊCH'));

                if (isPending) {
                  return kind === 'supplier' ? (
                    <div
                      style={{
                        margin: '10px 0',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🔔</span> Yêu cầu dời giờ giao từ tiệm tạp hóa
                        </strong>
                        <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 600, backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '10px' }}>
                          Cần xác nhận
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 8px', color: '#78350f' }}>
                        {order.note?.split('[YÊU CẦU DỜI LỊCH GIAO')[1]?.split(']')[0]
                          ? `[YÊU CẦU DỜI LỊCH GIAO${order.note?.split('[YÊU CẦU DỜI LỊCH GIAO')[1]?.split(']')[0]}]`
                          : 'Tiệm có việc bận đi vắng, xin dời giờ giao hàng (cam kết nhận, không bùng đơn).'}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="table-button primary-small"
                          disabled={supplierRescheduleBusy === order.id}
                          onClick={() => void handleSupplierReschedule(order, 'ACCEPT')}
                        >
                          {supplierRescheduleBusy === order.id ? 'Đang lưu…' : '✅ Đồng ý dời lịch'}
                        </button>
                        <a
                          href={`tel:${order.recipientPhone || '0908123456'}`}
                          className="ghost-button"
                          style={{ fontSize: '11px', padding: '4px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          📞 Gọi cho Tiệm (${order.recipientPhone || '0908 123 456'})
                        </a>
                        <button
                          type="button"
                          className="ghost-button"
                          style={{ color: '#b91c1c' }}
                          disabled={supplierRescheduleBusy === order.id}
                          onClick={() => {
                            setRejectRescheduleOrder(order);
                            setRejectRescheduleReason('');
                          }}
                        >
                          ❌ Không thể dời
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        margin: '8px 0',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        fontSize: '12px',
                        color: '#92400e',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <span>⏰</span>
                        <span>ĐÃ GỬI YÊU CẦU DỜI LỊCH GIAO: Đang chờ chủ vựa xác nhận.</span>
                      </div>
                      <small style={{ display: 'block', marginTop: '2px', color: '#b45309' }}>
                        Tiệm đã báo trước để tài xế chủ động tuyến đường, hoàn toàn không tính là bùng đơn.
                      </small>
                    </div>
                  );
                }

                if (isAccepted) {
                  return (
                    <div
                      style={{
                        margin: '8px 0',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        fontSize: '12px',
                        color: '#166534',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>✅</span>
                      <strong>ĐÃ THỐNG NHẤT DỜI LỊCH GIAO: Chủ vựa đã xác nhận đổi tuyến giao theo giờ hẹn của tiệm.</strong>
                    </div>
                  );
                }

                if (isRejected) {
                  return (
                    <div
                      style={{
                        margin: '8px 0',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        fontSize: '12px',
                        color: '#b91c1c',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>⚠️</span>
                      <strong>CHỦ VỰA KHÔNG THỂ DỜI LỊCH: Vui lòng sắp xếp người nhận hàng hoặc gọi trực tiếp cho vựa.</strong>
                    </div>
                  );
                }

                return null;
              })()}

              {(order.status === 'PREPARING' || order.status === 'SHIPPING') && (
                <div
                  style={{
                    margin: '10px 0',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: order.status === 'PREPARING' ? '#f0fdf4' : '#eff6ff',
                    border: `1px solid ${order.status === 'PREPARING' ? '#bbf7d0' : '#bfdbfe'}`,
                    fontSize: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <strong
                      style={{
                        color: order.status === 'PREPARING' ? '#15803d' : '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                      }}
                    >
                      <span>{order.status === 'PREPARING' ? '📦' : '🚚'}</span>
                      {order.status === 'PREPARING'
                        ? 'Đã chuẩn bị hàng xong · Sẵn sàng vận chuyển'
                        : 'Đang trên đường vận chuyển'}
                    </strong>
                    <span
                      style={{
                        color: order.status === 'PREPARING' ? '#166534' : '#1e40af',
                        fontWeight: 600,
                        backgroundColor: order.status === 'PREPARING' ? '#dcfce7' : '#dbeafe',
                        padding: '3px 8px',
                        borderRadius: '12px',
                      }}
                    >
                      {order.driverInfo?.estimatedDeliveryTime
                        ? `⏱️ Dự kiến giao: ${order.driverInfo.estimatedDeliveryTime}`
                        : order.status === 'PREPARING'
                          ? '⏱️ Dự kiến: Sắp xếp chuyến xe sớm nhất'
                          : '⏱️ Dự kiến giao: trong 30 – 45 phút tới'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '10px',
                      color: order.status === 'PREPARING' ? '#14532d' : '#1e3a8a',
                      marginTop: '6px',
                    }}
                  >
                    <div>
                      <span>📍 <strong>Kho xuất phát:</strong> </span>
                      <span>{order.supplier?.warehouseAddress || 'Kho vựa phân phối'}</span>
                      <div style={{ marginTop: '4px' }}>
                        <span>🛵 <strong>Phương tiện:</strong> </span>
                        <span
                          style={{
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '11px',
                          }}
                        >
                          {order.driverInfo?.vehicleType || 'Xe giao hàng'}
                        </span>
                        {order.driverInfo?.licensePlate && (
                          <span
                            style={{
                              marginLeft: '6px',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            Biển số: {order.driverInfo.licensePlate}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span>👤 <strong>Tài xế giao hàng:</strong> </span>
                      <strong>
                        {order.driverInfo?.driverName ||
                          (order.supplier?.businessName
                            ? `Đội giao vận ${order.supplier.businessName}`
                            : 'Đội giao vận chủ vựa')}
                      </strong>
                      <br />
                      <span>📞 <strong>Số điện thoại tài xế:</strong> </span>
                      <a
                        href={`tel:${order.driverInfo?.driverPhone || order.supplier?.phone || '0908123789'}`}
                        style={{
                          color: '#1d4ed8',
                          fontWeight: 700,
                          textDecoration: 'underline',
                        }}
                      >
                        {order.driverInfo?.driverPhone || order.supplier?.phone || '0908 123 789'}
                      </a>
                      {order.driverInfo?.deliveryNotes && (
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#475569' }}>
                          <span>📝 <strong>Ghi chú chuyến xe:</strong> <em>{order.driverInfo.deliveryNotes}</em></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '10px',
                      paddingTop: '8px',
                      borderTop: `1px dashed ${order.status === 'PREPARING' ? '#86efac' : '#93c5fd'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <span style={{ color: '#475569', fontSize: '11px' }}>
                      💡 {order.status === 'PREPARING'
                        ? 'Hàng đã chuẩn bị xong. Tiệm có thể hẹn dời giờ nhận ngay trước khi xe lăn bánh để vựa chủ động sắp chuyến.'
                        : 'Nếu bạn có việc bận đi vắng, hãy gọi tài xế hoặc bấm Hẹn dời giờ nhận để tài xế chủ động tuyến đường.'}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <a
                        href={`tel:${order.driverInfo?.driverPhone || order.supplier?.phone || '0908123789'}`}
                        className="ghost-button"
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        📞 Gọi tài xế / vựa
                      </a>
                      {kind === 'supplier' && onEditDriver && (
                        <button
                          type="button"
                          className="table-button primary-small"
                          style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#475569' }}
                          onClick={() => onEditDriver(order)}
                        >
                          ✏️ {order.driverInfo ? 'Sửa thông tin tài xế' : 'Gán tài xế'}
                        </button>
                      )}
                      {kind === 'store' && (
                        <button
                          type="button"
                          className="table-button primary-small"
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => {
                            setRescheduleOrderTarget(order);
                            setRescheduleTimeChoice('1_HOUR');
                            setCustomRescheduleTime('');
                            setRescheduleReason('');
                            setRescheduleMessage('');
                          }}
                        >
                          ⏰ Hẹn dời giờ nhận hàng
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {order.depositAmount > 0 && (
                <div className={`order-deposit order-deposit-${order.depositStatus.toLowerCase()}`}>
                  <div className="order-deposit-heading">
                    <strong>
                      Đặt cọc {order.depositRate}% · {money(order.depositAmount)}
                    </strong>
                    <span>
                      {order.depositReference === 'VÍ_HỆ_THỐNG' && order.depositStatus === 'PAID'
                        ? '🔒 Đã ký quỹ qua Ví hệ thống (An toàn)'
                        : order.depositReference === 'VÍ_HỆ_THỐNG' && order.depositStatus === 'REFUNDED'
                          ? '↩️ Đã hoàn cọc vào Ví hệ thống'
                          : order.depositStatus === 'PENDING'
                            ? 'Chờ cửa hàng chuyển cọc'
                            : order.depositStatus === 'SUBMITTED'
                              ? 'Cửa hàng đã báo chuyển · chờ chủ vựa xác nhận'
                              : order.depositStatus === 'PAID'
                                ? 'Chủ vựa đã xác nhận nhận cọc'
                                : order.depositStatus === 'REFUNDED'
                                  ? 'Đã hoàn cọc'
                                  : order.depositStatus === 'REFUND_PENDING'
                                    ? 'Chủ vựa cần hoàn lại tiền cọc'
                                    : order.depositStatus}
                    </span>
                  </div>
                  {order.depositReference === 'VÍ_HỆ_THỐNG' ? (
                    <div
                      style={{
                        margin: '6px 0',
                        fontSize: '12px',
                        color: '#047857',
                        backgroundColor: '#f0fdf4',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🔒</span> Ký quỹ đảm bảo qua Ví hệ thống (Escrow)
                      </strong>
                      <span>
                        {kind === 'store'
                          ? `Tiền cọc ${money(order.depositAmount)} đang được hệ thống giữ an toàn. Chỉ giải ngân cho chủ vựa sau khi bạn nhận hàng thành công.`
                          : `Sàn đã khóa cọc ${money(order.depositAmount)} từ Ví của cửa hàng. Tiền cọc sẽ tự động giải ngân vào Ví của bạn khi giao hàng thành công.`}
                      </span>
                      <strong style={{ color: '#1f2937', marginTop: '2px' }}>
                        Thanh toán COD khi giao: ${money(order.total - order.depositAmount)}
                      </strong>
                    </div>
                  ) : (
                    <>
                      {order.depositBankAccountNumber && (
                        <div className="order-deposit-bank">
                          <span>Chuyển trực tiếp đến</span>
                          <strong>{order.depositBankName}</strong>
                          <b>{order.depositBankAccountNumber}</b>
                          <span>{order.depositBankAccountHolder}</span>
                          <small>Nội dung gợi ý: COC DH{order.id}</small>
                        </div>
                      )}
                      {order.depositReference && (
                        <small>Mã/nội dung cửa hàng cung cấp: {order.depositReference}</small>
                      )}
                    </>
                  )}
                  {order.depositSubmittedAt && (
                    <small>
                      Tạp hóa báo đã chuyển lúc{' '}
                      {new Date(order.depositSubmittedAt).toLocaleString('vi-VN')}
                    </small>
                  )}
                  {order.depositPaidAt && (
                    <small>
                      Chủ vựa xác nhận đã nhận lúc{' '}
                      {new Date(order.depositPaidAt).toLocaleString('vi-VN')}
                    </small>
                  )}
                  {order.depositRejectionReason && order.depositStatus === 'PENDING' && (
                    <small className="order-deposit-warning">
                      Chủ vựa chưa xác nhận: {order.depositRejectionReason}
                    </small>
                  )}
                  {order.depositRefundReference && (
                    <small>Mã giao dịch hoàn cọc: {order.depositRefundReference}</small>
                  )}
                  {kind === 'store' &&
                    order.status === 'PENDING' &&
                    order.depositStatus === 'PENDING' && (
                      <>
                        {depositDraft?.orderId === order.id ? (
                          <form
                            className="order-deposit-form"
                            onSubmit={(event) => void submitDeposit(event, order)}
                          >
                            <label>
                              Mã giao dịch hoặc nội dung chuyển khoản
                              <input
                                required
                                minLength={3}
                                maxLength={100}
                                value={depositDraft.reference}
                                onChange={(event) =>
                                  setDepositDraft({
                                    orderId: order.id,
                                    reference: event.target.value,
                                  })
                                }
                                placeholder={`Ví dụ: COC DH${order.id}`}
                                autoFocus
                              />
                            </label>
                            <div className="order-deposit-actions">
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => setDepositDraft(null)}
                                disabled={depositBusy !== null}
                              >
                                Hủy
                              </button>
                              <button
                                className="table-button primary-small"
                                disabled={depositBusy !== null}
                              >
                                {depositBusy === order.id ? 'Đang gửi…' : 'Gửi xác nhận đã chuyển'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="order-deposit-actions">
                            <button
                              className="table-button primary-small"
                              disabled={depositBusy !== null}
                              onClick={() => void handleDepositWithWallet(order)}
                            >
                              {depositBusy === order.id
                                ? 'Đang ký quỹ…'
                                : `🔒 Ký quỹ từ Ví (${money(order.depositAmount)})`}
                            </button>
                            <button
                              className="ghost-button"
                              disabled={depositBusy !== null}
                              onClick={() =>
                                setDepositDraft({
                                  orderId: order.id,
                                  reference: `COC DH${order.id}`,
                                })
                              }
                            >
                              Tôi đã chuyển khoản ngoài
                            </button>
                            <button
                              className="ghost-button"
                              disabled={depositBusy !== null}
                              onClick={() => void submitSandboxDeposit(order)}
                            >
                              {depositBusy === order.id
                                ? 'Đang chạy sandbox…'
                                : 'Thanh toán thử sandbox'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  {kind === 'supplier' &&
                    order.status === 'PENDING' &&
                    order.depositStatus === 'SUBMITTED' && (
                      <div className="order-deposit-actions">
                        <button
                          className="table-button primary-small"
                          disabled={depositBusy !== null}
                          onClick={() => void reviewDeposit(order, 'CONFIRM')}
                        >
                          {depositBusy === order.id ? 'Đang xử lý…' : 'Xác nhận đã nhận cọc'}
                        </button>
                        <button
                          className="ghost-button"
                          disabled={depositBusy !== null}
                          onClick={() => void reviewDeposit(order, 'REJECT')}
                        >
                          Chưa nhận được
                        </button>
                      </div>
                    )}
                  {kind === 'supplier' && order.depositStatus === 'REFUND_PENDING' && (
                    <>
                      {refundDraft?.orderId === order.id ? (
                        <form
                          className="order-deposit-form"
                          onSubmit={(event) => void submitRefund(event, order)}
                        >
                          <label>
                            Mã giao dịch hoàn cọc
                            <input
                              required
                              minLength={3}
                              maxLength={100}
                              value={refundDraft.reference}
                              onChange={(event) =>
                                setRefundDraft({
                                  orderId: order.id,
                                  reference: event.target.value,
                                })
                              }
                              placeholder="Ví dụ: HOAN COC DH1"
                              autoFocus
                            />
                          </label>
                          <div className="order-deposit-actions">
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => setRefundDraft(null)}
                              disabled={depositBusy !== null}
                            >
                              Hủy
                            </button>
                            <button
                              className="table-button primary-small"
                              disabled={depositBusy !== null}
                            >
                              {depositBusy === order.id ? 'Đang lưu…' : 'Xác nhận đã hoàn cọc'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          className="table-button primary-small"
                          disabled={depositBusy !== null}
                          onClick={() =>
                            setRefundDraft({
                              orderId: order.id,
                              reference: `HOAN COC DH${order.id}`,
                            })
                          }
                        >
                          Ghi nhận đã hoàn cọc
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {order.complaint && (
                <div
                  style={{
                    margin: '10px 0',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#fff8f0',
                    border: '1px solid #fed7aa',
                    fontSize: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <strong
                      style={{
                        color: '#c2410c',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>⚠️</span> Báo cáo đơn hàng:{' '}
                      {REASON_LABELS[order.complaint.reason] || order.complaint.reason}
                    </strong>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        color: COMPLAINT_STATUS_MAP[order.complaint.status]?.color || '#c2410c',
                        backgroundColor:
                          COMPLAINT_STATUS_MAP[order.complaint.status]?.bg || '#fff7ed',
                        border: `1px solid ${COMPLAINT_STATUS_MAP[order.complaint.status]?.color || '#c2410c'}40`,
                      }}
                    >
                      {COMPLAINT_STATUS_MAP[order.complaint.status]?.label ||
                        order.complaint.status}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0', color: '#431407' }}>
                    <strong>Nội dung báo cáo:</strong> {order.complaint.description}
                  </p>
                  {order.complaint.imageUrl && (
                    <div style={{ margin: '8px 0' }}>
                      <a href={order.complaint.imageUrl} target="_blank" rel="noreferrer" title="Bấm để xem ảnh phóng to">
                        <img
                          src={order.complaint.imageUrl}
                          alt="Ảnh hàng hỏng / thiếu"
                          style={{ maxWidth: '140px', maxHeight: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #fed7aa' }}
                        />
                      </a>
                      <small style={{ display: 'block', color: '#78350f', fontSize: '11px', marginTop: '2px' }}>
                        🔍 Bấm vào ảnh để xem kích thước lớn
                      </small>
                    </div>
                  )}
                  {order.complaint.response ? (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        color: '#166534',
                      }}
                    >
                      <strong>💬 Phản hồi từ Supplier:</strong> {order.complaint.response}
                    </div>
                  ) : (
                    <small
                      style={{
                        color: '#9a3412',
                        fontStyle: 'italic',
                        display: 'block',
                        marginTop: '4px',
                      }}
                    >
                      {kind === 'store'
                        ? 'Đang chờ nhà cung cấp (supplier) phản hồi.'
                        : 'Chưa có phản hồi cho cửa hàng.'}
                    </small>
                  )}
                  {kind === 'supplier' && (
                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="table-button"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setComplaintOrder(order);
                          setComplaintResponse(order.complaint?.response || '');
                          setComplaintMessage('');
                        }}
                      >
                        ✍️ Xử lý báo cáo
                      </button>
                    </div>
                  )}
                </div>
              )}

              <p className="catalog-hint">
                Tiền hàng {money(order.subtotal)} + giao hàng {money(order.deliveryFee)}
              </p>

              <div className="order-card-bottom">
                <strong>
                  {order.status === 'DELIVERED'
                    ? 'Tổng đã giao'
                    : order.depositStatus === 'PAID'
                      ? 'Còn lại khi giao'
                      : 'Tổng đơn'}
                  :{' '}
                  {money(
                    order.depositStatus === 'PAID'
                      ? order.total - order.depositAmount
                      : order.total,
                  )}
                </strong>
                {kind === 'supplier' && actions[order.status] && (
                  <div className="order-actions">
                    <button
                      className="table-button primary-small"
                      disabled={
                        busy ||
                        (order.status === 'PENDING' &&
                          order.depositAmount > 0 &&
                          order.depositStatus !== 'PAID')
                      }
                      onClick={() => onStatus?.(order)}
                    >
                      {actions[order.status]}
                    </button>
                    {order.status === 'PENDING' && (
                      <button
                        className="table-button danger"
                        disabled={busy || order.depositStatus === 'SUBMITTED'}
                        title={
                          order.depositStatus === 'SUBMITTED'
                            ? 'Xử lý xác nhận cọc trước khi từ chối đơn'
                            : undefined
                        }
                        onClick={() => onStatus?.(order, 'REJECTED')}
                      >
                        Từ chối
                      </button>
                    )}
                  </div>
                )}
              </div>

              {order.status === 'REJECTED' && (
                <p className="order-rejection">Lý do từ chối: {order.rejectReason}</p>
              )}

              {kind === 'store' && order.status === 'PENDING' && (
                <p className="catalog-hint">
                  {order.depositStatus === 'PENDING'
                    ? 'Chuyển đúng số tiền cọc đến tài khoản hiển thị phía trên rồi gửi mã giao dịch.'
                    : order.depositStatus === 'SUBMITTED'
                      ? 'Đã gửi xác nhận chuyển cọc. Đang chờ chủ vựa kiểm tra tài khoản.'
                      : 'Chờ chủ vựa kiểm tra tồn kho và xác nhận khu vực giao hàng.'}
                </p>
              )}

              {/* Nút báo cáo đơn hàng khi đang ở bước tiếp nhận xử lý (ISSUE_HANDLING) */}
              {kind === 'store' && order.status === 'ISSUE_HANDLING' && !order.complaint && (
                <div
                  className="order-card-bottom"
                  style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e8eee7' }}
                >
                  <p className="catalog-hint" style={{ margin: 0 }}>
                    Đơn hàng đang ở bước <strong>tiếp nhận xử lý</strong>. Nếu phát hiện sự cố hoặc
                    lỗi hàng, bạn có thể báo cáo về nhà cung cấp.
                  </p>
                  <button
                    className="table-button danger"
                    type="button"
                    onClick={() => {
                      setComplaintOrder(order);
                      setComplaintReason(COMPLAINT_REASONS[0].code);
                      setComplaintDescription('');
                      setComplaintMessage('');
                    }}
                  >
                    ⚠️ Báo cáo đơn hàng
                  </button>
                </div>
              )}

              {/* Nút báo cáo đơn hàng khi đã giao (DELIVERED) */}
              {kind === 'store' && order.status === 'DELIVERED' && !order.complaint && (
                <div
                  className="order-card-bottom"
                  style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e8eee7' }}
                >
                  <p className="catalog-hint" style={{ margin: 0 }}>
                    Kiểm tra hàng thực nhận rồi cập nhật kho. Nếu có sự cố, bạn có thể gửi báo cáo
                    khiếu nại.
                  </p>
                  <button
                    className="table-button danger"
                    type="button"
                    onClick={() => {
                      setComplaintOrder(order);
                      setComplaintReason(COMPLAINT_REASONS[0].code);
                      setComplaintDescription('');
                      setComplaintMessage('');
                    }}
                  >
                    ⚠️ Báo cáo đơn hàng
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="catalog-pagination">
        <button
          className="ghost-button"
          disabled={loading || busy || query.page === 1}
          onClick={() => {
            setLoading(true);
            setQuery({ ...query, page: query.page - 1 });
          }}
        >
          Trang trước
        </button>
        <span>Trang {query.page}</span>
        <button
          className="ghost-button"
          disabled={loading || busy || !data.hasMore || Boolean(error)}
          onClick={() => {
            setLoading(true);
            setQuery({ ...query, page: query.page + 1 });
          }}
        >
          Trang sau
        </button>
      </div>

      {complaintOrder && (
        <div className="supplier-dialog-backdrop">
          <form
            className="supplier-dialog"
            style={{ maxWidth: kind === 'store' ? '540px' : '620px' }}
            onSubmit={kind === 'store' ? submitComplaint : submitResolution}
          >
            <h2>
              {kind === 'store'
                ? `⚠️ Báo hàng bị hỏng / thiếu (Đơn #${complaintOrder.id})`
                : `Xử lý sự cố đơn hàng #${complaintOrder.id}`}
            </h2>

            {kind === 'store' ? (
              <>
                <p className="catalog-hint" style={{ marginTop: 0 }}>
                  Chụp 1 tấm ảnh chỗ bị vỡ/hỏng hoặc chọn nhanh lý do bên dưới để chủ vựa (
                  <strong>{complaintOrder.supplier?.businessName || 'Chủ vựa'}</strong>) hỗ trợ trừ tiền
                  COD hoặc đổi trả nhanh nhất.
                </p>

                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#92400e',
                    marginBottom: '12px',
                  }}
                >
                  ⏱️ <strong>Lưu ý:</strong> Vui lòng báo sự cố trong vòng 2 giờ kể từ khi nhận hàng để được hỗ trợ đối soát với shipper và giải quyết nhanh nhất.
                </div>

                {/* Chụp ảnh / Tải ảnh */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px', fontSize: '13px' }}>
                    📷 Chụp ảnh hàng hỏng / thiếu <span style={{ color: '#dc2626' }}>(Bắt buộc)</span>:
                  </label>
                  <div
                    style={{
                      border: '2px dashed #bbf7d0',
                      borderRadius: '8px',
                      padding: '16px',
                      textAlign: 'center',
                      backgroundColor: '#f0fdf4',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={uploadingImage || complaintBusy}
                      onChange={handleUploadComplaintImage}
                      id="complaint-photo-upload"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="complaint-photo-upload" style={{ cursor: 'pointer', display: 'block' }}>
                      {uploadingImage ? (
                        <span style={{ color: '#15803d', fontWeight: 600 }}>⏳ Đang tải ảnh lên…</span>
                      ) : uploadedImageUrl ? (
                        <div>
                          <img
                            src={uploadedImageUrl}
                            alt="Ảnh chụp hàng hỏng"
                            style={{
                              maxWidth: '180px',
                              maxHeight: '130px',
                              borderRadius: '6px',
                              objectFit: 'cover',
                              border: '1px solid #86efac',
                            }}
                          />
                          <p style={{ margin: '6px 0 0', color: '#15803d', fontWeight: 600, fontSize: '12px' }}>
                            ✓ Đã tải ảnh lên. Bấm để chụp lại ảnh khác
                          </p>
                        </div>
                      ) : (
                        <div>
                          <span style={{ fontSize: '28px', display: 'block' }}>📷</span>
                          <span style={{ fontWeight: 600, color: '#166534', fontSize: '14px' }}>
                            Bấm vào đây để Chụp ảnh hoặc Chọn ảnh
                          </span>
                          <small style={{ color: '#6b7280', display: 'block', marginTop: '2px' }}>
                            Chụp rõ vị trí hàng hóa bị bể vỡ, rách thùng hoặc thiếu
                          </small>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* 3 Lựa chọn nhanh 1 chạm */}
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '13px' }}>
                    Loại sự cố gặp phải (Bấm chọn 1 chạm):
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { code: 'DAMAGED', label: '💥 Hàng bị bể vỡ / hư hỏng' },
                      { code: 'SHORTAGE', label: '📦 Giao thiếu số lượng' },
                      { code: 'WRONG_ITEM', label: '🔄 Giao sai sản phẩm' },
                      { code: 'EXPIRED', label: '⏳ Hàng cận date / hết hạn' },
                    ].map((item) => (
                      <label
                        key={item.code}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: complaintReason === item.code ? '2px solid #16a34a' : '1px solid #d1d5db',
                          backgroundColor: complaintReason === item.code ? '#f0fdf4' : '#fff',
                          cursor: 'pointer',
                          fontWeight: complaintReason === item.code ? 600 : 400,
                          fontSize: '12px',
                        }}
                      >
                        <input
                          type="radio"
                          name="complaintReason"
                          value={item.code}
                          checked={complaintReason === item.code}
                          onChange={() => setComplaintReason(item.code)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="supplier-dialog-field">
                  <span>Ghi chú thêm (Không bắt buộc):</span>
                  <input
                    type="text"
                    maxLength={500}
                    placeholder="Ví dụ: Bể 1 thùng nước ngọt lúc hạ hàng..."
                    value={complaintDescription}
                    onChange={(e) => setComplaintDescription(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                {/* Supplier Resolution View */}
                <div
                  style={{
                    marginBottom: '14px',
                    padding: '12px',
                    background: '#fff7ed',
                    borderRadius: '8px',
                    border: '1px solid #fed7aa',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong>
                      Lý do: {REASON_LABELS[complaintOrder.complaint?.reason || ''] || complaintOrder.complaint?.reason}
                    </strong>
                    <span style={{ color: '#c2410c', fontWeight: 600 }}>Cần giải quyết</span>
                  </div>
                  <p style={{ margin: '4px 0', color: '#431407' }}>
                    <strong>Mô tả từ tiệm:</strong> {complaintOrder.complaint?.description}
                  </p>
                  {complaintOrder.complaint?.imageUrl && (
                    <div style={{ marginTop: '8px' }}>
                      <strong>Ảnh chụp từ tiệm:</strong>
                      <div style={{ marginTop: '4px' }}>
                        <a href={complaintOrder.complaint.imageUrl} target="_blank" rel="noreferrer">
                          <img
                            src={complaintOrder.complaint.imageUrl}
                            alt="Ảnh bằng chứng"
                            style={{
                              maxWidth: '180px',
                              maxHeight: '130px',
                              objectFit: 'cover',
                              borderRadius: '6px',
                              border: '1px solid #fdba74',
                            }}
                          />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginBottom: '14px',
                    padding: '10px 12px',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                >
                  <strong>Tóm tắt thanh toán:</strong>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span>Tổng đơn: <strong>{money(complaintOrder.total)}</strong></span>
                    <span>Cọc ký quỹ: <strong style={{ color: '#15803d' }}>{money(complaintOrder.depositAmount)}</strong></span>
                    <span>COD cần thu: <strong>{money(complaintOrder.total - complaintOrder.depositAmount)}</strong></span>
                  </div>
                </div>

                {/* 3 Phương án xử lý dứt khoát */}
                <div style={{ marginBottom: '14px' }}>
                  <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>
                    Chọn phương án giải quyết:
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: resolutionType === 'DEDUCT_COD' ? '2px solid #16a34a' : '1px solid #d1d5db',
                        background: resolutionType === 'DEDUCT_COD' ? '#f0fdf4' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="resType"
                        checked={resolutionType === 'DEDUCT_COD'}
                        onChange={() => setResolutionType('DEDUCT_COD')}
                      />
                      <div>
                        <strong style={{ color: '#15803d' }}>
                          💰 1. Đồng ý trừ tiền vào COD (Hàng hỏng / thiếu một phần)
                        </strong>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#4b5563' }}>
                          Giảm trừ phần hàng hỏng vào tiền COD. Tiền cọc 10% vẫn giải ngân cho bạn khi hoàn tất.
                        </p>
                      </div>
                    </label>

                    {resolutionType === 'DEDUCT_COD' && (
                      <div
                        style={{
                          marginLeft: '26px',
                          padding: '10px 12px',
                          background: '#f0fdf4',
                          borderRadius: '6px',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                          Số tiền muốn giảm trừ vào COD (₫):
                        </label>
                        <input
                          type="number"
                          min="1000"
                          max={complaintOrder.total - complaintOrder.depositAmount}
                          step="1000"
                          value={deductAmount || ''}
                          onChange={(e) => setDeductAmount(Number(e.target.value))}
                          placeholder="Ví dụ: 50000"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                          }}
                        />
                        <small style={{ color: '#15803d', display: 'block', marginTop: '4px', fontWeight: 600 }}>
                          Tiền COD thực thu sau khi trừ:{' '}
                          {money(
                            Math.max(
                              0,
                              complaintOrder.total - complaintOrder.depositAmount - deductAmount,
                            ),
                          )}
                        </small>
                      </div>
                    )}

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: resolutionType === 'RETURN_REFUND' ? '2px solid #2563eb' : '1px solid #d1d5db',
                        background: resolutionType === 'RETURN_REFUND' ? '#eff6ff' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="resType"
                        checked={resolutionType === 'RETURN_REFUND'}
                        onChange={() => setResolutionType('RETURN_REFUND')}
                      />
                      <div>
                        <strong style={{ color: '#1d4ed8' }}>
                          ↩️ 2. Nhận lại hàng & Hoàn cọc 100% (Hàng hỏng nặng / Giao sai)
                        </strong>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#4b5563' }}>
                          Đồng ý hủy đơn, nhận lại hàng. Hệ thống hoàn 100% cọc về Ví của tiệm và cộng trả tồn kho.
                        </p>
                      </div>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: resolutionType === 'REJECT_REFUSAL_CLAIM_DEPOSIT' ? '2px solid #dc2626' : '1px solid #d1d5db',
                        background: resolutionType === 'REJECT_REFUSAL_CLAIM_DEPOSIT' ? '#fef2f2' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="resType"
                        checked={resolutionType === 'REJECT_REFUSAL_CLAIM_DEPOSIT'}
                        onChange={() => setResolutionType('REJECT_REFUSAL_CLAIM_DEPOSIT')}
                      />
                      <div>
                        <strong style={{ color: '#b91c1c' }}>
                          ❌ 3. Bác bỏ: Khách từ chối nhận vô cớ (Bùng đơn)
                        </strong>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#4b5563' }}>
                          Khách từ chối nhận hàng không có lý do. Tiền cọc 10% sẽ chuyển vào Ví của bạn để đền bù chi phí giao hàng.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <label className="supplier-dialog-field">
                  <span>Lời nhắn gửi đến tiệm tạp hóa (Không bắt buộc):</span>
                  <input
                    type="text"
                    maxLength={500}
                    placeholder="Ví dụ: Đã đối soát shipper, đồng ý trừ 50k vào tiền COD..."
                    value={complaintResponse}
                    onChange={(e) => setComplaintResponse(e.target.value)}
                  />
                </label>
              </>
            )}

            {complaintMessage && (
              <p
                className={
                  complaintMessage.includes('Lỗi') || complaintMessage.includes('không')
                    ? 'error-notice'
                    : 'supplier-success'
                }
              >
                {complaintMessage}
              </p>
            )}

            <div className="supplier-dialog-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setComplaintOrder(null)}
              >
                Đóng
              </button>
              {kind === 'store' ? (
                <button className="table-button danger" disabled={complaintBusy || uploadingImage || !uploadedImageUrl}>
                  {complaintBusy ? 'Đang gửi…' : '🚀 Gửi báo cáo cho Chủ vựa'}
                </button>
              ) : (
                <button
                  className="table-button primary-small"
                  disabled={complaintActionBusy || (resolutionType === 'DEDUCT_COD' && deductAmount <= 0)}
                >
                  {complaintActionBusy ? 'Đang xử lý…' : 'Xác nhận giải quyết'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
      {/* Reschedule Delivery Modal */}
      {rescheduleOrderTarget && (
        <div className="supplier-dialog-backdrop">
          <form
            className="supplier-dialog"
            style={{ maxWidth: '520px' }}
            onSubmit={handleReschedule}
          >
            <h2>⏰ Hẹn dời giờ nhận hàng (Đơn #{rescheduleOrderTarget.id})</h2>
            <p className="catalog-hint" style={{ marginTop: 0 }}>
              Thông báo trước cho tài xế và chủ vựa (
              <strong>{rescheduleOrderTarget.supplier?.businessName || 'Chủ vựa'}</strong>) nếu bạn có việc bận đột xuất để dời lịch giao, hoàn toàn không tính là bùng đơn.
            </p>

            <div style={{ margin: '14px 0' }}>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '13px' }}>
                Chọn thời gian mong muốn dời lại:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { code: '1_HOUR', label: '⏱️ Dời lại 1 tiếng nữa (Tôi đang ra ngoài có việc gấp)' },
                  { code: 'THIS_AFTERNOON', label: '🌤️ Giao vào buổi chiều nay (14h00 – 16h30)' },
                  { code: 'TOMORROW_MORNING', label: '🌅 Giao vào sáng mai (8h00 – 11h00)' },
                  { code: 'CUSTOM', label: '✏️ Tự nhập thời gian khác...' },
                ].map((item) => (
                  <label
                    key={item.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: rescheduleTimeChoice === item.code ? '2px solid #2563eb' : '1px solid #d1d5db',
                      backgroundColor: rescheduleTimeChoice === item.code ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                      fontWeight: rescheduleTimeChoice === item.code ? 600 : 400,
                      fontSize: '13px',
                    }}
                  >
                    <input
                      type="radio"
                      name="rescheduleTime"
                      value={item.code}
                      checked={rescheduleTimeChoice === item.code}
                      onChange={() => setRescheduleTimeChoice(item.code as any)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {rescheduleTimeChoice === 'CUSTOM' && (
              <label className="supplier-dialog-field">
                <span>Thời gian bạn có thể nhận hàng:</span>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Khoảng 17h30 chiều nay..."
                  value={customRescheduleTime}
                  onChange={(e) => setCustomRescheduleTime(e.target.value)}
                />
              </label>
            )}

            <label className="supplier-dialog-field">
              <span>Lý do dời giờ (Không bắt buộc):</span>
              <input
                type="text"
                placeholder="Ví dụ: Đang đi đón con / Đi lấy hàng / Đang có việc gia đình..."
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
              />
            </label>

            {rescheduleMessage && (
              <p
                className={
                  rescheduleMessage.includes('Lỗi') || rescheduleMessage.includes('không')
                    ? 'error-notice'
                    : 'supplier-success'
                }
              >
                {rescheduleMessage}
              </p>
            )}

            <div className="supplier-dialog-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setRescheduleOrderTarget(null)}
              >
                Đóng
              </button>
              <button className="table-button primary-small" disabled={rescheduleBusy}>
                {rescheduleBusy ? 'Đang gửi…' : 'Gửi yêu cầu dời giờ'}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Reject Reschedule Modal for Supplier */}
      {rejectRescheduleOrder && (
        <div className="supplier-dialog-backdrop">
          <form
            className="supplier-dialog"
            style={{ maxWidth: '480px' }}
            onSubmit={(e) => {
              e.preventDefault();
              void handleSupplierReschedule(rejectRescheduleOrder, 'REJECT', rejectRescheduleReason);
            }}
          >
            <h2>❌ Không thể dời lịch giao (Đơn #{rejectRescheduleOrder.id})</h2>
            <p className="catalog-hint" style={{ marginTop: 0 }}>
              Nhập lý do không thể dời giờ giao (ví dụ: xe đã kín tuyến, hàng đông lạnh cần giao ngay, hoặc vựa hết chuyến giao trong ngày) để thông báo cho tiệm tạp hóa.
            </p>

            <label className="supplier-dialog-field">
              <span>Lý do không thể dời:</span>
              <input
                type="text"
                required
                minLength={3}
                placeholder="Ví dụ: Xe đã kín tuyến / Hàng cần bảo quản lạnh gấp..."
                value={rejectRescheduleReason}
                onChange={(e) => setRejectRescheduleReason(e.target.value)}
              />
            </label>

            <div className="supplier-dialog-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setRejectRescheduleOrder(null)}
              >
                Hủy
              </button>
              <button
                className="table-button danger"
                disabled={supplierRescheduleBusy !== null || rejectRescheduleReason.trim().length < 3}
              >
                {supplierRescheduleBusy !== null ? 'Đang gửi…' : 'Xác nhận không thể dời'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
