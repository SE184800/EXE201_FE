import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogProduct } from '../services/catalog.api';
import { api, getApiError, isUnauthenticated } from '../services/api';
const money = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
export default function CheckoutDialog({ product, onClose, onLogout }: { product: CatalogProduct; onClose: () => void; onLogout: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const [form, setForm] = useState({ quantity: product.moq, recipientName: '', recipientPhone: '', deliveryAddress: '', note: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [orderId, setOrderId] = useState<number | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const body = { ...form, expectedDeliveryFee: product.supplier.deliveryFee, lines: [{ productId: product.id, quantity: form.quantity, expectedUpdatedAt: product.updatedAt }] };
    const signature = JSON.stringify(body);
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try { const { data } = await api.post('/orders', { ...body, requestId: request.current.id }); setOrderId(data.order.id); }
    catch (error) { setError(getApiError(error)); if (isUnauthenticated(error)) onLogout(); }
    finally { lock.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} className="inventory-dialog checkout-dialog" aria-labelledby="checkout-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} onClose={onClose}>
    <div className="dialog-heading"><h2 id="checkout-title">{orderId ? `Đã gửi đơn #${orderId}` : 'Đặt hàng từ chủ vựa'}</h2><button className="dialog-close" aria-label="Đóng đặt hàng" disabled={busy} onClick={onClose}>×</button></div>
    {orderId ? <><p className="supplier-success" role="status">Chủ vựa sẽ kiểm tra tồn kho và địa chỉ giao hàng trước khi duyệt.</p><Link className="primary-button catalog-link" to="/store/orders" onClick={onClose}>Theo dõi đơn hàng</Link></> : <form className="inventory-form" onSubmit={submit}>
      <div className="inventory-name"><strong>{product.name}</strong><p>{product.supplier.businessName} · {product.packaging}</p></div>
      <label className="inventory-name">Số lượng ({product.packaging})<input type="number" required min={product.moq} max={product.stockQty} step="1" disabled={busy} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /><small>Tối thiểu {product.moq} × {product.packaging}; tồn hiện tại {product.stockQty}.</small></label>
      <label>Người nhận<input required minLength={2} maxLength={100} autoComplete="name" disabled={busy} value={form.recipientName} onChange={e => setForm({ ...form, recipientName: e.target.value })} /></label>
      <label>Số điện thoại<input type="tel" required maxLength={30} autoComplete="tel" disabled={busy} value={form.recipientPhone} onChange={e => setForm({ ...form, recipientPhone: e.target.value })} /></label>
      <label className="inventory-name">Địa chỉ nhận hàng<input required minLength={10} maxLength={500} autoComplete="street-address" disabled={busy} value={form.deliveryAddress} onChange={e => setForm({ ...form, deliveryAddress: e.target.value })} /></label>
      <label className="inventory-name">Ghi chú<input maxLength={500} disabled={busy} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
      <div className="checkout-total inventory-name"><span>Tiền hàng: {money(product.wholesalePrice * form.quantity)}</span><span>Phí giao: {money(product.supplier.deliveryFee)}</span><strong>Tổng COD: {money(product.wholesalePrice * form.quantity + product.supplier.deliveryFee)}</strong><small>Thanh toán khi nhận hàng. Đơn có hiệu lực khi chủ vựa duyệt.</small></div>
      {error && <p role="alert" className="error-notice inventory-name">{error}</p>}
      <div className="inventory-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Để sau</button><button className="dash-primary" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đơn đặt hàng'}</button></div>
    </form>}
  </dialog>;
}
