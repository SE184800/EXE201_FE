import { useState } from 'react';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import {
  AdminDialog,
  Badge,
  Empty,
  Heading,
  LoadState,
  Pager,
  Panel,
} from './admin.shared';
import { dateTime, useAdminData } from './admin.data';
import type { AdminTabProps, List, Verification } from './admin.types';

export default function AdminVerifications({ onLogout }: AdminTabProps) {
  const [status, setStatus] = useState(''),
    [q, setQ] = useState('');
  const [query, setQuery] = useState({ status: '', q: '', page: 1 }),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Verification | null>(null);

  // Quick Action & Rejection Modal State
  const [rejecting, setRejecting] = useState<Verification | null>(null);
  const [rejectReasonSelect, setRejectReasonSelect] = useState('Mã số thuế không trùng khớp');
  const [rejectCustomReason, setRejectCustomReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  const { data, loading, error } = useAdminData<List & { profiles: Verification[] }>(
    '/admin/verifications',
    query,
    onLogout,
    revision,
  );

  async function handleQuickApprove(item: Verification) {
    if (actionBusy) return;
    setActionBusy(true);
    setActionNotice('');
    try {
      await api.patch('/admin/verifications/' + item.id, {
        status: 'APPROVED',
        note: '',
        version: item.verificationVersion,
        role: item.role,
      });
      setActionNotice('Đã xác minh hồ sơ "' + item.businessName + '". Hệ thống đã gửi email thông báo.');
      setRevision((n) => n + 1);
      if (selected && selected.id === item.id) setSelected(null);
    } catch (err) {
      alert(getApiError(err));
      if (isUnauthenticated(err)) onLogout();
    } finally {
      setActionBusy(false);
    }
  }

  async function handleConfirmReject() {
    if (!rejecting || actionBusy) return;
    const finalReason = rejectReasonSelect === 'Khác' ? rejectCustomReason.trim() : rejectReasonSelect;
    if (!finalReason || finalReason.length < 3) {
      alert('Vui lòng nhập lý do từ chối chi tiết (tối thiểu 3 ký tự).');
      return;
    }
    setActionBusy(true);
    setActionNotice('');
    try {
      await api.patch('/admin/verifications/' + rejecting.id, {
        status: 'REJECTED',
        note: finalReason,
        version: rejecting.verificationVersion,
        role: rejecting.role,
      });
      setActionNotice('Đã chuyển trạng thái hồ sơ "' + rejecting.businessName + '" thành Cần điều chỉnh và gửi email thông báo.');
      setRejecting(null);
      setRejectReasonSelect('Mã số thuế không trùng khớp');
      setRejectCustomReason('');
      setRevision((n) => n + 1);
      if (selected && selected.id === rejecting.id) setSelected(null);
    } catch (err) {
      alert(getApiError(err));
      if (isUnauthenticated(err)) onLogout();
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <>
      <Heading
        eyebrow="PARTNER VERIFICATION"
        title="Xác minh chủ vựa & chủ tạp hóa"
        description="Kiểm tra thông tin và giấy tờ đối tác trước khi cho phép mở bán trên sàn."
      />
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ status, q, page: 1 });
          setRevision((n) => n + 1);
        }}
      >
        <label>
          Tên đối tác
          <input
            maxLength={150}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên, SĐT hoặc MST"
          />
        </label>
        <label>
          Trạng thái hồ sơ
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả hồ sơ</option>
            <option value="PENDING">Đang chờ duyệt</option>
            <option value="DRAFT">Chưa ký thỏa thuận</option>
            <option value="APPROVED">Đã xác minh</option>
            <option value="REJECTED">Cần điều chỉnh</option>
          </select>
        </label>
        <button className="admin-primary">Lọc hồ sơ</button>
      </form>

      {actionNotice && (
        <div
          role="status"
          style={{
            margin: '12px 0',
            padding: '12px 16px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px',
            color: '#15803d',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          {actionNotice}
        </div>
      )}

      <LoadState loading={loading} error={error} />
      {data && (
        <Panel title="Danh sách hồ sơ đối tác">
          {data.profiles.length ? (
            <div className="admin-verification-grid">
              {data.profiles.map((p) => {
                const roleBadgeText = p.role === 'SUPPLIER' ? 'Chủ vựa' : 'Chủ tạp hóa';
                const roleBadgeBg = p.role === 'SUPPLIER' ? '#ede9fe' : '#e0f2fe';
                const roleBadgeColor = p.role === 'SUPPLIER' ? '#6d28d9' : '#0369a1';
                const displayPhone = p.phone || p.user?.phone || 'Chưa có SĐT';

                return (
                  <article key={p.role + '-' + p.id} className="admin-verification-card">
                    <div className="admin-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: roleBadgeBg,
                            color: roleBadgeColor,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {roleBadgeText}
                        </span>
                        <Badge status={p.verificationStatus} />
                      </div>
                      <small style={{ color: '#64748b', fontSize: '11.5px' }}>{dateTime(p.submittedAt)}</small>
                    </div>

                    <h3 style={{ margin: '10px 0 4px 0', fontSize: '16px', fontWeight: 650, color: '#0f172a' }}>
                      {p.businessName}
                    </h3>
                    <div style={{ fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                      <strong>Số điện thoại:</strong> {displayPhone}
                    </div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12.5px', color: '#64748b', lineHeight: 1.45 }}>
                      {p.warehouseAddress || 'Chưa cập nhật địa chỉ'}
                    </p>

                    {p.verificationStatus === 'REJECTED' && p.verificationNote && (
                      <div
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fee2e2',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#991b1b',
                          marginBottom: '10px',
                        }}
                      >
                        <strong>Lý do:</strong> {p.verificationNote}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                        marginTop: 'auto',
                        paddingTop: '12px',
                        borderTop: '1px solid #f1f5f9',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelected(p)}
                        style={{
                          flex: 1,
                          minWidth: '90px',
                          padding: '7px 10px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty>Không có hồ sơ trong trạng thái đã chọn.</Empty>
          )}
          <Pager {...data} onPage={(page) => setQuery({ ...query, page })} />
        </Panel>
      )}

      {/* Detail Dialog */}
      {selected && (
        <VerificationDialog
          profile={selected}
          onClose={() => setSelected(null)}
          onApprove={() => handleQuickApprove(selected)}
          onReject={() => {
            setRejecting(selected);
            setRejectReasonSelect('Mã số thuế không trùng khớp');
            setRejectCustomReason('');
          }}
        />
      )}

      {/* Rejection Modal with Preset Reasons & Custom Reason */}
      {rejecting && (
        <AdminDialog
          title={'Từ chối hồ sơ: ' + rejecting.businessName}
          onClose={() => setRejecting(null)}
          busy={actionBusy}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmReject();
            }}
          >
            <fieldset disabled={actionBusy}>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
                  Vui lòng chọn lý do từ chối hồ sơ của <strong>{rejecting.businessName}</strong> ({rejecting.role === 'SUPPLIER' ? 'Chủ vựa' : 'Chủ tạp hóa'}).
                  Hệ thống sẽ chuyển trạng thái đơn sang <strong>Cần điều chỉnh</strong> và gửi email thông báo chi tiết đến đối tác.
                </p>

                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px', color: '#334155' }}>
                  Lý do từ chối:
                </label>
                <select
                  value={rejectReasonSelect}
                  onChange={(e) => setRejectReasonSelect(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    marginBottom: '12px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="Mã số thuế không trùng khớp">Mã số thuế không trùng khớp</option>
                  <option value="Thông tin tài khoản có vấn đề">Thông tin tài khoản có vấn đề</option>
                  <option value="Khác">Khác</option>
                </select>

                {rejectReasonSelect === 'Khác' && (
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px', color: '#334155' }}>
                      Nhập lý do chi tiết:
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Nhập lý do chi tiết"
                      value={rejectCustomReason}
                      onChange={(e) => setRejectCustomReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="admin-dialog-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setRejecting(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="admin-primary"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {actionBusy ? 'Đang xử lý…' : 'Xác nhận'}
                </button>
              </div>
            </fieldset>
          </form>
        </AdminDialog>
      )}
    </>
  );
}

function VerificationDialog({
  profile: p,
  onClose,
  onApprove,
  onReject,
}: {
  profile: Verification;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const roleLabel = p.role === 'SUPPLIER' ? 'Chủ vựa' : 'Chủ tạp hóa';
  const roleBadgeBg = p.role === 'SUPPLIER' ? '#ede9fe' : '#e0f2fe';
  const roleBadgeColor = p.role === 'SUPPLIER' ? '#6d28d9' : '#0369a1';

  return (
    <AdminDialog title={`Chi tiết hồ sơ đối tác: ${p.businessName}`} onClose={onClose} busy={false}>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: '6px',
            backgroundColor: roleBadgeBg,
            color: roleBadgeColor,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {roleLabel}
        </span>
        <Badge status={p.verificationStatus} />
        {p.isAddressVerified && (
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#15803d', backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '4px' }}>
            Đã xác minh bản đồ
          </span>
        )}
      </div>

      <dl className="admin-detail-list">
        <div>
          <dt>Cơ sở kinh doanh</dt>
          <dd>
            <strong style={{ fontSize: '15px', color: '#0f172a' }}>{p.businessName}</strong>
          </dd>
        </div>
        <div>
          <dt>Tài khoản người dùng</dt>
          <dd>
            <strong>{p.user.name}</strong> (@{p.user.username}) · <Badge status={p.user.status} />
          </dd>
        </div>
        <div>
          <dt>Thông tin liên hệ</dt>
          <dd>
            <div>Email: <strong>{p.user.email || 'Chưa cập nhật'}</strong></div>
            <div>SĐT: <strong>{p.phone || p.user.phone || 'Chưa cập nhật'}</strong></div>
          </dd>
        </div>
        <div>
          <dt>Người đại diện hợp pháp</dt>
          <dd>{p.legalRepresentative || p.bankAccountHolder || p.user.name || 'Chưa bổ sung'}</dd>
        </div>
        <div>
          <dt>Mã số thuế (MST / ĐKKD)</dt>
          <dd>
            {p.taxCode ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '14px', letterSpacing: '0.05em', color: '#0f172a' }}>{p.taxCode}</strong>
                <a
                  href={'https://masothue.com/search?q=' + encodeURIComponent(p.taxCode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '12px',
                    color: '#2563eb',
                    textDecoration: 'underline',
                    fontWeight: 600,
                  }}
                >
                  [Tra cứu mã số thuế trên masothue.com]
                </a>
              </span>
            ) : (
              <span style={{ color: '#dc2626' }}>Chưa bổ sung mã số thuế</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Địa chỉ hoạt động</dt>
          <dd>
            <div>{p.warehouseAddress || 'Chưa cập nhật địa chỉ'}</div>
            {p.alleyDetail && (
              <div style={{ marginTop: '4px', fontSize: '12.5px', color: '#64748b' }}>
                Đặc điểm đường vào: {p.alleyDetail}
              </div>
            )}
            {p.latitude && p.longitude && (
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#0284c7' }}>
                Tọa độ GPS: {p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}
              </div>
            )}
          </dd>
        </div>
        <div>
          <dt>Tài khoản ngân hàng đối soát</dt>
          <dd>
            {p.bankName ? (
              <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div>Ngân hàng: <strong>{p.bankName}</strong></div>
                <div>Số tài khoản: <strong style={{ letterSpacing: '0.04em' }}>{p.bankAccountNumber || 'Chưa nhập'}</strong></div>
                {p.bankAccountHolder && <div>Chủ tài khoản: <strong>{p.bankAccountHolder}</strong></div>}
              </div>
            ) : (
              <span style={{ color: '#dc2626' }}>Chưa thiết lập tài khoản thanh toán</span>
            )}
          </dd>
        </div>
        {p.bankQrImageUrl && (
          <div>
            <dt>Mã QR thanh toán</dt>
            <dd>
              <a href={p.bankQrImageUrl} target="_blank" rel="noopener noreferrer" title="Nhấp để xem ảnh đầy đủ">
                <img
                  src={p.bankQrImageUrl}
                  alt="QR thanh toán ngân hàng"
                  style={{ maxHeight: '130px', maxWidth: '130px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '4px' }}
                />
              </a>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Nhấp ảnh để mở kích thước đầy đủ</div>
            </dd>
          </div>
        )}
        {p.submittedAt && (
          <div>
            <dt>Thời gian gửi duyệt</dt>
            <dd>{new Date(p.submittedAt).toLocaleString('vi-VN')}</dd>
          </div>
        )}
        {p.reviewedAt && (
          <div>
            <dt>Thời gian thẩm định gần nhất</dt>
            <dd>{new Date(p.reviewedAt).toLocaleString('vi-VN')}</dd>
          </div>
        )}
      </dl>

      {p.verificationStatus === 'REJECTED' && p.verificationNote && (
        <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', fontSize: '13px', color: '#991b1b' }}>
          <strong>Lý do:</strong> {p.verificationNote}
        </div>
      )}

      {p.verificationStatus === 'PENDING' && (
        <div className="admin-dialog-actions" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onReject}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontWeight: 650,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
            }}
          >
            Từ chối
          </button>
          <button
            type="button"
            onClick={onApprove}
            style={{
              padding: '10px 22px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              fontWeight: 650,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
            }}
          >
            Xác nhận
          </button>
        </div>
      )}
    </AdminDialog>
  );
}
