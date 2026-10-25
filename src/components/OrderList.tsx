import { useEffect, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';
import type { SupplierOrder } from '../services/supplier.api';
import ExportDropdown from './ExportDropdown';
import { exportSupplierOrdersToExcel, exportSupplierOrdersToPdf } from '../utils/exportSupplier';

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
};

export default function OrderList({ kind, onLogout, revision = 0, busy = false, onStatus }: Props) {
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

  async function updateComplaint(status: string) {
    if (!complaintOrder?.complaint || complaintActionBusy) return;
    setComplaintActionBusy(true);
    try {
      await api.patch(`/complaints/${complaintOrder.complaint.id}`, {
        status,
        response: complaintResponse,
      });
      setComplaintOrder(null);
      setComplaintResponse('');
      setReload((n) => n + 1);
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
    setComplaintBusy(true);
    setComplaintMessage('');
    try {
      await api.post('/complaints', {
        orderId: complaintOrder.id,
        reason: complaintReason,
        description: complaintDescription,
      });
      setComplaintMessage('Đã gửi báo cáo về nhà cung cấp. Supplier sẽ tiếp nhận xử lý.');
      setTimeout(() => {
        setComplaintOrder(null);
        setReload((n) => n + 1);
      }, 900);
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

              {order.depositAmount > 0 && (
                <div className={`order-deposit order-deposit-${order.depositStatus.toLowerCase()}`}>
                  <div className="order-deposit-heading">
                    <strong>
                      Đặt cọc {order.depositRate}% · {money(order.depositAmount)}
                    </strong>
                    <span>
                      {order.depositStatus === 'PENDING'
                        ? 'Chờ cửa hàng chuyển cọc'
                        : order.depositStatus === 'SUBMITTED'
                          ? 'Cửa hàng đã báo chuyển · chờ chủ vựa xác nhận'
                          : order.depositStatus === 'PAID'
                            ? 'Chủ vựa đã xác nhận nhận cọc'
                            : order.depositStatus === 'REFUND_PENDING'
                              ? 'Chủ vựa cần hoàn lại tiền cọc'
                              : order.depositStatus === 'REFUNDED'
                                ? 'Đã hoàn cọc'
                                : order.depositStatus}
                    </span>
                  </div>
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
                              onClick={() =>
                                setDepositDraft({
                                  orderId: order.id,
                                  reference: `COC DH${order.id}`,
                                })
                              }
                            >
                              Tôi đã chuyển cọc
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
                            <small>Sandbox không chuyển tiền thật.</small>
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
            onSubmit={
              kind === 'store'
                ? submitComplaint
                : (e) => {
                    e.preventDefault();
                    void updateComplaint('RESOLVED');
                  }
            }
          >
            <h2>
              {kind === 'store'
                ? `Báo cáo sự cố đơn hàng #${complaintOrder.id}`
                : `Xử lý báo cáo đơn #${complaintOrder.id}`}
            </h2>

            {kind === 'store' ? (
              <>
                <p className="catalog-hint" style={{ marginTop: 0 }}>
                  Báo cáo này sẽ được gửi trực tiếp đến nhà cung cấp (
                  {complaintOrder.supplier?.businessName || 'Supplier'}) để tiếp nhận và xử lý.
                </p>
                <label className="supplier-dialog-field">
                  <span>Lý do báo cáo</span>
                  <select
                    value={complaintReason}
                    onChange={(e) => setComplaintReason(e.target.value)}
                  >
                    {COMPLAINT_REASONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="supplier-dialog-field">
                  <span>Chi tiết sự cố / lỗi gặp phải</span>
                  <textarea
                    required
                    minLength={3}
                    maxLength={1000}
                    rows={4}
                    placeholder="Mô tả cụ thể hàng hóa bị lỗi, số lượng chênh lệch hoặc vấn đề cần supplier giải quyết..."
                    value={complaintDescription}
                    onChange={(e) => setComplaintDescription(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <div
                  style={{
                    marginBottom: '14px',
                    padding: '10px 12px',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                >
                  <p style={{ margin: '0 0 6px 0' }}>
                    <strong>Lý do từ cửa hàng:</strong>{' '}
                    {REASON_LABELS[complaintOrder.complaint?.reason || ''] ||
                      complaintOrder.complaint?.reason}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Nội dung:</strong> {complaintOrder.complaint?.description}
                  </p>
                </div>
                <label className="supplier-dialog-field">
                  <span>Phản hồi cho cửa hàng</span>
                  <textarea
                    required
                    minLength={3}
                    maxLength={1000}
                    rows={4}
                    value={complaintResponse}
                    onChange={(e) => setComplaintResponse(e.target.value)}
                    placeholder="Nhập phương án xử lý hoặc phản hồi gửi đến cửa hàng (ví dụ: đổi trả hàng, hoàn tiền, bổ sung kiện hàng...)..."
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
                <button className="table-button danger" disabled={complaintBusy}>
                  {complaintBusy ? 'Đang gửi…' : 'Gửi báo cáo về Supplier'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="table-button"
                    disabled={complaintActionBusy}
                    onClick={() => void updateComplaint('IN_REVIEW')}
                  >
                    Tiếp nhận xử lý
                  </button>
                  <button className="table-button primary-small" disabled={complaintActionBusy}>
                    Đã giải quyết
                  </button>
                  <button
                    type="button"
                    className="table-button danger"
                    disabled={complaintActionBusy}
                    onClick={() => void updateComplaint('REJECTED')}
                  >
                    Từ chối báo cáo
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
