import { useRef, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import type { SupplierProfile } from '../../services/supplier.api';

export default function SupplierVerification({ profile, onSaved, onLogout }: { profile: SupplierProfile; onSaved: (profile: SupplierProfile) => void; onLogout: () => void }) {
  const [form, setForm] = useState({ region: profile.region || '', taxCode: profile.taxCode || '', legalRepresentative: profile.legalRepresentative || '', verificationDocumentUrl: profile.verificationDocumentUrl || '' });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false); const lock = useRef(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      const { data } = await api.put('/supplier/profile', { businessName: profile.businessName, warehouseAddress: profile.warehouseAddress, deliveryRadiusKm: profile.deliveryRadiusKm, deliveryFee: profile.deliveryFee, ...form });
      if (data.profile.verificationStatus === 'APPROVED' || data.profile.verificationStatus === 'PENDING') onSaved(data.profile);
      else {
        const submitted = await api.post('/supplier/verification');
        onSaved(submitted.data.profile);
      }
    } catch (e) { setError(getApiError(e)); if (isUnauthenticated(e)) onLogout(); } finally { lock.current = false; setBusy(false); }
  }
  const labels: Record<string, string> = { DRAFT: 'Chưa gửi hồ sơ', PENDING: 'Đang chờ quản trị viên kiểm duyệt', APPROVED: 'Gian hàng đã được xác minh', REJECTED: 'Hồ sơ cần bổ sung / quyền bán đã thu hồi' };
  return <section className="supplier-panel verification-panel"><h2>Xác minh gian hàng</h2><p className={profile.verificationStatus === 'APPROVED' ? 'supplier-success' : 'catalog-hint'}>{labels[profile.verificationStatus]}</p>{profile.verificationNote && <p className="catalog-hint">Nhận xét: {profile.verificationNote}</p>}
    <p className="catalog-hint">Bạn có thể chuẩn bị danh mục hàng. Sản phẩm chỉ hiện với chủ tạp hóa khi hồ sơ được duyệt. Thay đổi thông tin kinh doanh hoặc giấy tờ sẽ cần gửi duyệt lại.</p>
    <form onSubmit={save}><fieldset disabled={busy || profile.verificationStatus === 'PENDING'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><div className="supplier-form-grid"><label className="supplier-field">Tỉnh / thành phố của kho<input required minLength={2} maxLength={100} value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} placeholder="Ví dụ: Thành phố Hồ Chí Minh" /></label><label className="supplier-field">Mã đăng ký kinh doanh / mã số thuế<input required minLength={5} maxLength={30} pattern="[A-Za-z0-9\-]{5,30}" value={form.taxCode} onChange={e => setForm({ ...form, taxCode: e.target.value })} /></label><label className="supplier-field">Người đại diện<input required minLength={2} maxLength={100} value={form.legalRepresentative} onChange={e => setForm({ ...form, legalRepresentative: e.target.value })} /></label><label className="supplier-field">Đường dẫn giấy đăng ký kinh doanh<input required type="url" maxLength={1000} value={form.verificationDocumentUrl} onChange={e => setForm({ ...form, verificationDocumentUrl: e.target.value })} placeholder="https://…" /></label></div><p className="catalog-hint">Dùng đường dẫn HTTPS tới giấy tờ mà quản trị viên có quyền xem. Không cần cung cấp mật khẩu tài khoản hay ảnh căn cước.</p>{error && <p className="error-notice" role="alert">{error}</p>}<button className="ghost-button" type="submit">{busy ? 'Đang gửi…' : profile.verificationStatus === 'PENDING' ? 'Đã gửi, chờ duyệt' : profile.verificationStatus === 'APPROVED' ? 'Cập nhật và gửi duyệt lại nếu thay đổi' : 'Lưu và gửi hồ sơ xác minh'}</button></fieldset></form>
  </section>;
}
