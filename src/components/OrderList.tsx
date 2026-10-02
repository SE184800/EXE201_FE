import { useEffect, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';
import type { SupplierOrder } from '../services/supplier.api';

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
  const [data, setData] = useState<{ orders: SupplierOrder[]; total: number; hasMore: boolean }>({ orders: [], total: 0, hasMore: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [complaintOrder, setComplaintOrder] = useState<SupplierOrder | null>(null);
  const [complaintReason, setComplaintReason] = useState(COMPLAINT_REASONS[0].code);
  const [complaintDescription, setComplaintDescription] = useState('');
  const [complaintBusy, setComplaintBusy] = useState(false);
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintResponse, setComplaintResponse] = useState('');
  const [complaintActionBusy, setComplaintActionBusy] = useState(false);

  async function updateComplaint(status: string) {
    if (!complaintOrder?.complaint || complaintActionBusy) return;
    setComplaintActionBusy(true);
    try {
      await api.patch(`/complaints/${complaintOrder.complaint.id}`, { status, response: complaintResponse });
      setComplaintOrder(null);
      setComplaintResponse('');
      setReload(n => n + 1);
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
      await api.post('/complaints', { orderId: complaintOrder.id, reason: complaintReason, description: complaintDescription });
      setComplaintMessage('Đã gửi báo cáo về nhà cung cấp. Supplier sẽ tiếp nhận xử lý.');
      setTimeout(() => {
        setComplaintOrder(null);
        setReload(n => n + 1);
      }, 900);
    } catch (issue) {
      setComplaintMessage(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setComplaintBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden && !busy) setReload(n => n + 1); }, 30000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    const abort = new AbortController();
    api.get(kind === 'store' ? '/orders' : '/supplier/orders', { params: query, signal: abort.signal })
      .then(({ data }) => { if (!abort.signal.aborted) { setData(data); setError(''); } })
      .catch(error => { if (!abort.signal.aborted) { setError(getApiError(error)); if (isUnauthenticated(error)) onLogout(); } })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [kind, query, revision, reload, onLogout]);

  return (
    <section className="supplier-panel order-panel" aria-label="Danh sách đơn hàng">
      <div className="supplier-panel-title">
        <div>
          <span className="supplier-panel-label">ĐƠN HÀNG</span>
          <h2>{kind === 'store' ? 'Đơn mua của cửa hàng' : 'Đơn hàng từ cửa hàng'}</h2>
          <p className="catalog-hint">Tự cập nhật mỗi 30 giây khi bạn đang xem.</p>
        </div>
        <button className="ghost-button" disabled={loading || busy} onClick={() => { setLoading(true); setReload(n => n + 1); }}>
          Tải lại đơn
        </button>
      </div>

      <label className="order-filter">
        Trạng thái đơn
        <select
          aria-label="Lọc trạng thái đơn"
          value={query.status}
          disabled={loading || busy}
          onChange={e => { setLoading(true); setQuery({ page: 1, status: e.target.value }); }}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(statuses).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span>{data.total} đơn phù hợp</span>
      </label>

      {error ? (
        <p className="error-notice" role="alert">{error}</p>
      ) : loading ? (
        <p role="status">Đang tải đơn hàng…</p>
      ) : !data.orders.length ? (
        <p className="inventory-empty">Chưa có đơn phù hợp với bộ lọc này.</p>
      ) : (
        <div className="order-list">
          {data.orders.map(order => (
            <article className="order-card" key={order.id} aria-label={`Đơn ${order.id}`}>
              <div className="order-card-top">
                <div>
                  <strong>Đơn #{order.id}</strong>
                  <span>{new Date(order.createdAt).toLocaleString('vi-VN')} · {kind === 'store' ? order.supplier?.businessName : order.buyer.name}</span>
                </div>
                <span className={`order-status order-${order.status.toLowerCase()}`}>{order.statusLabel}</span>
              </div>

              <div className="order-items">
                {order.items.map(item => (
                  <span key={item.id}>
                    {item.productName} · {item.quantity} × {item.packaging} · {money(item.lineTotal)}
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

              {order.complaint && (
                <div style={{
                  margin: '10px 0',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#fff8f0',
                  border: '1px solid #fed7aa',
                  fontSize: '12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <strong style={{ color: '#c2410c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚠️</span> Báo cáo đơn hàng: {REASON_LABELS[order.complaint.reason] || order.complaint.reason}
                    </strong>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      color: COMPLAINT_STATUS_MAP[order.complaint.status]?.color || '#c2410c',
                      backgroundColor: COMPLAINT_STATUS_MAP[order.complaint.status]?.bg || '#fff7ed',
                      border: `1px solid ${COMPLAINT_STATUS_MAP[order.complaint.status]?.color || '#c2410c'}40`,
                    }}>
                      {COMPLAINT_STATUS_MAP[order.complaint.status]?.label || order.complaint.status}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0', color: '#431407' }}>
                    <strong>Nội dung báo cáo:</strong> {order.complaint.description}
                  </p>
                  {order.complaint.response ? (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                    }}>
                      <strong>💬 Phản hồi từ Supplier:</strong> {order.complaint.response}
                    </div>
                  ) : (
                    <small style={{ color: '#9a3412', fontStyle: 'italic', display: 'block', marginTop: '4px' }}>
                      {kind === 'store' ? 'Đang chờ nhà cung cấp (supplier) phản hồi.' : 'Chưa có phản hồi cho cửa hàng.'}
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

              <p className="catalog-hint">Tiền hàng {money(order.subtotal)} + giao hàng {money(order.deliveryFee)}</p>

              <div className="order-card-bottom">
                <strong>{order.status === 'DELIVERED' ? 'Tổng đã giao' : 'Tổng COD'}: {money(order.total)}</strong>
                {kind === 'supplier' && actions[order.status] && (
                  <div className="order-actions">
                    <button className="table-button primary-small" disabled={busy} onClick={() => onStatus?.(order)}>
                      {actions[order.status]}
                    </button>
                    {order.status === 'PENDING' && (
                      <button className="table-button danger" disabled={busy} onClick={() => onStatus?.(order, 'REJECTED')}>
                        Từ chối
                      </button>
                    )}
                  </div>
                )}
              </div>

              {order.status === 'REJECTED' && <p className="order-rejection">Lý do từ chối: {order.rejectReason}</p>}

              {kind === 'store' && order.status === 'PENDING' && (
                <p className="catalog-hint">Chờ chủ vựa kiểm tra tồn kho và xác nhận khu vực giao hàng.</p>
              )}

              {/* Nút báo cáo đơn hàng khi đang ở bước tiếp nhận xử lý (ISSUE_HANDLING) */}
              {kind === 'store' && order.status === 'ISSUE_HANDLING' && !order.complaint && (
                <div className="order-card-bottom" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e8eee7' }}>
                  <p className="catalog-hint" style={{ margin: 0 }}>
                    Đơn hàng đang ở bước <strong>tiếp nhận xử lý</strong>. Nếu phát hiện sự cố hoặc lỗi hàng, bạn có thể báo cáo về nhà cung cấp.
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
                <div className="order-card-bottom" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e8eee7' }}>
                  <p className="catalog-hint" style={{ margin: 0 }}>
                    Kiểm tra hàng thực nhận rồi cập nhật kho. Nếu có sự cố, bạn có thể gửi báo cáo khiếu nại.
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
          onClick={() => { setLoading(true); setQuery({ ...query, page: query.page - 1 }); }}
        >
          Trang trước
        </button>
        <span>Trang {query.page}</span>
        <button
          className="ghost-button"
          disabled={loading || busy || !data.hasMore || Boolean(error)}
          onClick={() => { setLoading(true); setQuery({ ...query, page: query.page + 1 }); }}
        >
          Trang sau
        </button>
      </div>

      {complaintOrder && (
        <div className="supplier-dialog-backdrop">
          <form
            className="supplier-dialog"
            onSubmit={kind === 'store' ? submitComplaint : e => { e.preventDefault(); void updateComplaint('RESOLVED'); }}
          >
            <h2>
              {kind === 'store' ? `Báo cáo sự cố đơn hàng #${complaintOrder.id}` : `Xử lý báo cáo đơn #${complaintOrder.id}`}
            </h2>

            {kind === 'store' ? (
              <>
                <p className="catalog-hint" style={{ marginTop: 0 }}>
                  Báo cáo này sẽ được gửi trực tiếp đến nhà cung cấp ({complaintOrder.supplier?.businessName || 'Supplier'}) để tiếp nhận và xử lý.
                </p>
                <label className="supplier-dialog-field">
                  <span>Lý do báo cáo</span>
                  <select value={complaintReason} onChange={e => setComplaintReason(e.target.value)}>
                    {COMPLAINT_REASONS.map(r => (
                      <option key={r.code} value={r.code}>{r.label}</option>
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
                    onChange={e => setComplaintDescription(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}>
                  <p style={{ margin: '0 0 6px 0' }}><strong>Lý do từ cửa hàng:</strong> {REASON_LABELS[complaintOrder.complaint?.reason || ''] || complaintOrder.complaint?.reason}</p>
                  <p style={{ margin: 0 }}><strong>Nội dung:</strong> {complaintOrder.complaint?.description}</p>
                </div>
                <label className="supplier-dialog-field">
                  <span>Phản hồi cho cửa hàng</span>
                  <textarea
                    required
                    minLength={3}
                    maxLength={1000}
                    rows={4}
                    value={complaintResponse}
                    onChange={e => setComplaintResponse(e.target.value)}
                    placeholder="Nhập phương án xử lý hoặc phản hồi gửi đến cửa hàng (ví dụ: đổi trả hàng, hoàn tiền, bổ sung kiện hàng...)..."
                  />
                </label>
              </>
            )}

            {complaintMessage && (
              <p className={complaintMessage.includes('Lỗi') || complaintMessage.includes('không') ? 'error-notice' : 'supplier-success'}>
                {complaintMessage}
              </p>
            )}

            <div className="supplier-dialog-actions">
              <button type="button" className="ghost-button" onClick={() => setComplaintOrder(null)}>
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

