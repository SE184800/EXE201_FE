import { useEffect, useState } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';
import type { SupplierOrder } from '../services/supplier.api';

const statuses = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', PREPARING: 'Đang chuẩn bị', SHIPPING: 'Đang vận chuyển', DELIVERED: 'Đã giao', REJECTED: 'Đã từ chối' };
const actions: Record<string, string> = { PENDING: 'Duyệt đơn', APPROVED: 'Bắt đầu soạn', PREPARING: 'Bàn giao vận chuyển', SHIPPING: 'Xác nhận đã giao & thu COD' };
const money = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
type Props = { kind: 'store' | 'supplier'; onLogout: () => void; revision?: number; busy?: boolean; onStatus?: (order: SupplierOrder, forcedStatus?: string) => void };

export default function OrderList({ kind, onLogout, revision = 0, busy = false, onStatus }: Props) {
  const [query, setQuery] = useState({ page: 1, status: '' });
  const [data, setData] = useState<{ orders: SupplierOrder[]; total: number; hasMore: boolean }>({ orders: [], total: 0, hasMore: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
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
  return <section className="supplier-panel order-panel" aria-label="Danh sách đơn hàng">
    <div className="supplier-panel-title"><div><span className="supplier-panel-label">ĐƠN HÀNG</span><h2>{kind === 'store' ? 'Đơn mua của cửa hàng' : 'Đơn hàng từ cửa hàng'}</h2><p className="catalog-hint">Tự cập nhật mỗi 30 giây khi bạn đang xem.</p></div><button className="ghost-button" disabled={loading || busy} onClick={() => { setLoading(true); setReload(n => n + 1); }}>Tải lại đơn</button></div>
    <label className="order-filter">Trạng thái đơn<select aria-label="Lọc trạng thái đơn" value={query.status} disabled={loading || busy} onChange={e => { setLoading(true); setQuery({ page: 1, status: e.target.value }); }}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span>{data.total} đơn phù hợp</span></label>
    {error ? <p className="error-notice" role="alert">{error}</p> : loading ? <p role="status">Đang tải đơn hàng…</p> : !data.orders.length ? <p className="inventory-empty">Chưa có đơn phù hợp với bộ lọc này.</p> : <div className="order-list">{data.orders.map(order => <article className="order-card" key={order.id} aria-label={`Đơn ${order.id}`}>
      <div className="order-card-top"><div><strong>Đơn #{order.id}</strong><span>{new Date(order.createdAt).toLocaleString('vi-VN')} · {kind === 'store' ? order.supplier?.businessName : order.buyer.name}</span></div><span className={`order-status order-${order.status.toLowerCase()}`}>{order.statusLabel}</span></div>
      <div className="order-items">{order.items.map(item => <span key={item.id}>{item.productName} · {item.quantity} × {item.packaging} · {money(item.lineTotal)}</span>)}</div>
      <p className="order-delivery"><strong>{order.recipientName || 'Đơn cũ chưa có người nhận'}</strong>{order.recipientPhone && <> · {order.recipientPhone}</>}<br />{order.deliveryAddress || 'Đơn cũ chưa lưu địa chỉ nhận'}</p>
      {order.note && <p className="catalog-hint">Ghi chú: {order.note}</p>}
      <p className="catalog-hint">Tiền hàng {money(order.subtotal)} + giao hàng {money(order.deliveryFee)}</p>
      <div className="order-card-bottom"><strong>{order.status === 'DELIVERED' ? 'Tổng đã giao' : 'Tổng COD'}: {money(order.total)}</strong>{kind === 'supplier' && actions[order.status] && <div className="order-actions"><button className="table-button primary-small" disabled={busy} onClick={() => onStatus?.(order)}>{actions[order.status]}</button>{order.status === 'PENDING' && <button className="table-button danger" disabled={busy} onClick={() => onStatus?.(order, 'REJECTED')}>Từ chối</button>}</div>}</div>
      {order.status === 'REJECTED' && <p className="order-rejection">Lý do từ chối: {order.rejectReason}</p>}
      {kind === 'store' && order.status === 'PENDING' && <p className="catalog-hint">Chờ chủ vựa kiểm tra tồn kho và xác nhận khu vực giao hàng.</p>}
      {kind === 'store' && order.status === 'DELIVERED' && <p className="catalog-hint">Kiểm tra hàng thực nhận rồi ghi nhận tại Nhập / bán hàng để cập nhật kho.</p>}
    </article>)}</div>}
    <div className="catalog-pagination"><button className="ghost-button" disabled={loading || busy || query.page === 1} onClick={() => { setLoading(true); setQuery({ ...query, page: query.page - 1 }); }}>Trang trước</button><span>Trang {query.page}</span><button className="ghost-button" disabled={loading || busy || !data.hasMore || Boolean(error)} onClick={() => { setLoading(true); setQuery({ ...query, page: query.page + 1 }); }}>Trang sau</button></div>
  </section>;
}
