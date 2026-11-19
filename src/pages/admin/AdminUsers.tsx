import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import type { Account, AdminTabProps, List } from './admin.types';

type UserDeletionCheck = {
  userId: number;
  username: string;
  name: string;
  role: string;
  canDelete: boolean;
  mode: 'HARD' | 'SOFT';
  alreadyDeleted: boolean;
  reasons: string[];
  checks: {
    ordersClear: boolean;
    openOrdersCount: number;
    openOrderIds: number[];
    complaintsClear: boolean;
    openComplaintsCount: number;
    walletClear: boolean;
    walletBalance: number;
    walletHeldBalance: number;
    pendingDepositsCount: number;
    pendingWithdrawalsCount: number;
  };
  history: {
    hasTransactionHistory: boolean;
    totalOrdersCount: number;
    totalComplaintsCount: number;
    walletTxCount: number;
    depositCount: number;
    withdrawalCount: number;
    paymentCount: number;
    subPaymentCount: number;
  };
};

type UserDeletionResult = {
  success?: boolean;
  mode?: 'HARD' | 'SOFT';
  message?: string;
};

function DeleteUserDialog({
  user,
  onClose,
  onSuccess,
  onSwitchToManage,
  onLogout,
}: {
  user: Account;
  onClose: () => void;
  onSuccess?: (result: UserDeletionResult) => void;
  onSwitchToManage?: () => void;
  onLogout?: () => void;
}) {
  const [check, setCheck] = useState<UserDeletionCheck | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [checkError, setCheckError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingCheck(true);
    setCheckError('');
    setCheck(null);
    api
      .get<UserDeletionCheck>(`/admin/users/${user.id}/deletion-check`)
      .then((res) => {
        if (!cancelled) {
          setCheck(res.data);
          setLoadingCheck(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (isUnauthenticated(err) && onLogout) {
          onLogout();
          return;
        }
        setCheckError(getApiError(err));
        setLoadingCheck(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, onLogout]);

  const handleDelete = async () => {
    if (!check?.canDelete) return;
    setError('');
    setDeleting(true);
    try {
      const res = await api.delete<UserDeletionResult>(`/admin/users/${user.id}`);
      onSuccess?.(res.data);
    } catch (err) {
      if (isUnauthenticated(err) && onLogout) {
        onLogout();
        return;
      }
      setError(getApiError(err));
      setDeleting(false);
    }
  };

  const pendingMoneyRequests =
    (check?.checks.pendingDepositsCount || 0) + (check?.checks.pendingWithdrawalsCount || 0);
  const formatVnd = (amount: number) => `${amount.toLocaleString('vi-VN')} đ`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          maxWidth: '580px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
      >
        <div
          style={{
            backgroundColor: '#FAFBFC',
            padding: '16px 24px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '17px',
                fontWeight: 700,
                flexShrink: 0,
                border: '1px solid #FECACA',
              }}
            >
              !
            </span>
            <div>
              <h3 style={{ margin: 0, color: '#111827', fontSize: '16px', fontWeight: 600 }}>
                Kiểm tra điều kiện & xóa tài khoản
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#6B7280' }}>
                Người dùng: <strong style={{ color: '#1F2937' }}>{user.name}</strong> (@{user.username} · #{user.id})
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            disabled={deleting}
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#FFFFFF',
              color: '#6B7280',
              fontSize: '18px',
              lineHeight: 1,
              cursor: deleting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loadingCheck ? (
            <div
              style={{
                padding: '18px',
                borderRadius: '8px',
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                fontSize: '13.5px',
                color: '#4B5563',
              }}
            >
              Đang kiểm tra đơn hàng, khiếu nại và số dư ví của tài khoản...
            </div>
          ) : checkError ? (
            <p
              style={{
                margin: 0,
                color: '#DC2626',
                fontSize: '13px',
                backgroundColor: '#FEF2F2',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #FECACA',
              }}
            >
              {checkError}
            </p>
          ) : (
            check && (
              <>
                <div
                  style={{
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    backgroundColor: '#F9FAFB',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '2px' }}>
                    3 điều kiện bắt buộc trước khi xóa:
                  </div>

                  {[
                    {
                      label: 'Đơn hàng đang xử lý',
                      ok: check.checks.ordersClear,
                      detail: check.checks.ordersClear
                        ? '0 đơn mở'
                        : `Còn ${check.checks.openOrdersCount} đơn chưa hoàn tất/hủy`,
                    },
                    {
                      label: 'Khiếu nại / Tranh chấp',
                      ok: check.checks.complaintsClear,
                      detail: check.checks.complaintsClear
                        ? '0 khiếu nại mở'
                        : `Còn ${check.checks.openComplaintsCount} khiếu nại đang xử lý`,
                    },
                    {
                      label: 'Số dư ví & yêu cầu nạp/rút',
                      ok: check.checks.walletClear,
                      detail: check.checks.walletClear
                        ? 'Số dư 0 đ, không có lệnh chờ'
                        : `Số dư ${formatVnd(check.checks.walletBalance)}` +
                        (check.checks.walletHeldBalance !== 0
                          ? ` (tạm giữ ${formatVnd(check.checks.walletHeldBalance)})`
                          : '') +
                        (pendingMoneyRequests > 0
                          ? ` · ${pendingMoneyRequests} lệnh chờ duyệt`
                          : ''),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '9px 12px',
                        borderRadius: '6px',
                        backgroundColor: item.ok ? '#F0FDF4' : '#FEF2F2',
                        border: `1px solid ${item.ok ? '#DCFCE7' : '#FEE2E2'}`,
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#1E293B' }}>
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: item.ok ? '#166534' : '#991B1B',
                          backgroundColor: item.ok ? '#DCFCE7' : '#FEE2E2',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: item.ok ? '#16A34A' : '#DC2626',
                          }}
                        />
                        {item.ok ? 'Đạt' : 'Chưa đạt'} · {item.detail}
                      </span>
                    </div>
                  ))}
                </div>

                {check.mode === 'SOFT' ? (
                  <div
                    style={{
                      backgroundColor: '#F0F7FF',
                      border: '1px solid #BFDBFE',
                      borderRadius: '8px',
                      padding: '12px 14px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '13px', color: '#1E40AF', lineHeight: 1.55 }}>
                      <strong style={{ color: '#1E3A8A' }}>Xóa mềm (giữ lịch sử):</strong> Tài khoản sẽ bị khóa vĩnh viễn; đơn hàng và sổ cái ví vẫn được lưu trữ để phục vụ đối soát và báo cáo kế toán.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: '#F0F7FF',
                      border: '1px solid #BFDBFE',
                      borderRadius: '8px',
                      padding: '12px 14px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '13px', color: '#1E40AF', lineHeight: 1.55 }}>
                      <strong style={{ color: '#1E3A8A' }}>Xóa hoàn toàn:</strong> Tài khoản chưa phát sinh giao dịch, dữ liệu sẽ được xóa sạch và có thể tái sử dụng tên đăng nhập, email, SĐT.
                    </p>
                  </div>
                )}

                {!check.canDelete && (
                  <div
                    style={{
                      backgroundColor: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      fontSize: '13px',
                      color: '#92400E',
                      lineHeight: 1.55,
                    }}
                  >
                    <strong>Chưa thể xóa:</strong> Cần xử lý hết đơn mở, khiếu nại và đưa số dư ví về 0 đ trước khi xóa. Hoặc bấm <strong>Chuyển sang quản lý</strong> để khóa tài khoản.
                  </div>
                )}
              </>
            )
          )}

          {error && (
            <p
              style={{
                margin: 0,
                color: '#DC2626',
                fontSize: '13px',
                backgroundColor: '#FEF2F2',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #FECACA',
              }}
            >
              {error}
            </p>
          )}
        </div>

        <div
          style={{
            padding: '14px 24px',
            backgroundColor: '#F9FAFB',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            borderTop: '1px solid #E5E7EB',
          }}
        >
          {!loadingCheck && check && onSwitchToManage && (
            <button
              type="button"
              disabled={deleting}
              onClick={onSwitchToManage}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #FCD34D',
                backgroundColor: '#FFFBEB',
                color: '#92400E',
                fontWeight: 600,
                fontSize: '13.5px',
                cursor: deleting ? 'not-allowed' : 'pointer',
              }}
            >
              Chuyển sang quản lý
            </button>
          )}
          <button
            type="button"
            disabled={loadingCheck || Boolean(checkError) || !check?.canDelete || deleting}
            onClick={handleDelete}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: check?.canDelete ? 'none' : '1px solid #E5E7EB',
              backgroundColor: check?.canDelete ? '#DC2626' : '#F3F4F6',
              color: check?.canDelete ? '#FFFFFF' : '#9CA3AF',
              fontWeight: 500,
              fontSize: '13.5px',
              cursor:
                loadingCheck || Boolean(checkError) || !check?.canDelete || deleting
                  ? 'not-allowed'
                  : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {deleting
              ? 'Đang xóa...'
              : check?.mode === 'SOFT'
                ? 'Xác nhận xóa mềm'
                : 'Xác nhận xóa vĩnh viễn'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers({ onLogout }: AdminTabProps) {
  const [q, setQ] = useState(''),
    [role, setRole] = useState(''),
    [status, setStatus] = useState('');
  const [query, setQuery] = useState({ q: '', role: '', status: '', page: 1 }),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Account | null>(null),
    [deleteTarget, setDeleteTarget] = useState<Account | null>(null),
    [userToast, setUserToast] = useState('');
  const { data, error, loading } = useAdminData<List & { users: Account[] }>(
    '/admin/users',
    query,
    onLogout,
    revision,
  );
  return (
    <>
      <Heading
        eyebrow="ACCOUNT MANAGEMENT"
        title="Người dùng"
        description="Quản lý gói sử dụng, khóa tạm thời hoặc khóa vĩnh viễn chủ tạp hóa và chủ vựa. Mọi thao tác đều được lưu vào nhật ký."
      />
      {userToast && (
        <div
          role="status"
          style={{
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {userToast}
        </div>
      )}
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ q, role, status, page: 1 });
          setRevision((n) => n + 1);
        }}
      >
        <label>
          Tìm tài khoản
          <input
            placeholder="Tên, username, email, điện thoại"
            maxLength={150}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          Vai trò
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Tất cả vai trò</option>
            <option value="STORE_OWNER">Chủ tạp hóa</option>
            <option value="SUPPLIER">Chủ vựa</option>
          </select>
        </label>
        <label>
          Trạng thái
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Chưa hoạt động</option>
            <option value="SUSPENDED">Khóa tạm thời</option>
            <option value="BANNED">Khóa vĩnh viễn</option>
            <option value="DELETED">Đã xóa</option>
          </select>
        </label>
        <button className="admin-primary">Tìm kiếm</button>
      </form>
      <LoadState loading={loading} error={error} />
      {data && (
        <Panel title="Danh sách tài khoản">
          {data.users.length ? (
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tài khoản</th>
                    <th>Liên hệ</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Gói sử dụng</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name}</strong>
                        <small>
                          @{user.username} · #{user.id}
                        </small>
                      </td>
                      <td>
                        {user.email || 'Chưa có email'}
                        <small>{user.phone || 'Chưa có số điện thoại'}</small>
                      </td>
                      <td>
                        <Badge status={user.role} />
                      </td>
                      <td>
                        <Badge status={user.status} />
                        {user.status === 'SUSPENDED' && (
                          <small>Đến {dateTime(user.suspendedUntil)}</small>
                        )}
                      </td>
                      <td>
                        <Badge status={user.subscription.status} />
                        {user.subscription.accessEndsAt && (
                          <small>Đến {dateTime(user.subscription.accessEndsAt)}</small>
                        )}
                      </td>
                      <td>
                        {user.status === 'DELETED' ? (
                          <small style={{ color: '#64748B' }}>
                            {user.deletedAt ? `Đã xóa · ${dateTime(user.deletedAt)}` : 'Đã xóa · Lưu trữ sổ cái'}
                          </small>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button onClick={() => setSelected(user)}>Quản lý</button>
                            <button
                              type="button"
                              style={{
                                padding: '6px 10px',
                                backgroundColor: '#FFF1F2',
                                color: '#E11D48',
                                border: '1px solid #FECDD3',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 500,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              onClick={() => setDeleteTarget(user)}
                              title="Kiểm tra điều kiện & xóa tài khoản"
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty />
          )}
          <Pager {...data} onPage={(page) => setQuery({ ...query, page })} />
        </Panel>
      )}
      {selected && (
        <AccountDialog
          key={selected.id}
          user={selected}
          onLogout={onLogout}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setRevision((n) => n + 1);
          }}
        />
      )}
      {deleteTarget && (
        <DeleteUserDialog
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSwitchToManage={() => {
            const target = deleteTarget;
            setDeleteTarget(null);
            setSelected(target);
          }}
          onSuccess={(result) => {
            const deletedName = deleteTarget.name;
            setDeleteTarget(null);
            setRevision((n) => n + 1);
            setUserToast(result?.message || `Đã xóa tài khoản "${deletedName}" thành công.`);
            setTimeout(() => setUserToast(''), 5000);
          }}
          onLogout={onLogout}
        />
      )}
    </>
  );
}
function toDateTimeLocalInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AccountDialog({
  user,
  onClose,
  onSaved,
  onLogout,
}: AdminTabProps & { user: Account; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(user.status === 'INACTIVE' ? 'ACTIVE' : user.status),
    [reason, setReason] = useState(''),
    [until, setUntil] = useState(() =>
      user.status === 'SUSPENDED' ? toDateTimeLocalInput(user.suspendedUntil) : '',
    );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await api.patch(`/admin/users/${user.id}/status`, {
        status,
        reason: reason.trim() || 'Giải quyết vấn đề phát sinh',
        suspendedUntil: until ? new Date(until).toISOString() : null,
        expectedUpdatedAt: user.updatedAt,
      });
      onSaved();
    } catch (e) {
      setError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function unlockSubscription() {
    if (lock.current) return;
    if (
      !window.confirm(
        'Cấp miễn phí thêm 1 tháng sử dụng cho tài khoản này? Thao tác không tạo giao dịch thanh toán.',
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await api.post(`/admin/users/${user.id}/subscription/unlock`, {
        reason: reason.trim() || 'Giải quyết vấn đề phát sinh',
      });
      onSaved();
    } catch (e) {
      setError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <AdminDialog title={`Quản lý @${user.username}`} onClose={onClose} busy={busy}>
      <form onSubmit={save}>
        <p>
          {user.name} · <Badge status={user.status} />
        </p>
        {user.status === 'INACTIVE' && (
          <p className="admin-note">
            Tài khoản chưa xác minh nên đang Chưa hoạt động. Duyệt tại Xác minh đối tác để kích hoạt.
          </p>
        )}
        {user.lockReason && <p className="admin-note">Lý do gần nhất: {user.lockReason}</p>}
        <div className="admin-subscription-box">
          <div>
            <span>GÓI SỬ DỤNG</span>
            <strong>
              <Badge status={user.subscription.status} />
            </strong>
            {user.subscription.accessEndsAt && (
              <small>Quyền sử dụng đến {dateTime(user.subscription.accessEndsAt)}</small>
            )}
          </div>
          {user.subscription.status === 'EXPIRED' && (
            <button
              type="button"
              className="admin-primary"
              disabled={busy}
              onClick={() => void unlockSubscription()}
            >
              Mở khóa 1 tháng
            </button>
          )}
        </div>
        <fieldset disabled={busy}>
          <label>
            Trạng thái tài khoản
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">Cho phép hoạt động</option>
              <option value="SUSPENDED">Khóa tạm thời</option>
              <option value="BANNED">Khóa vĩnh viễn</option>
            </select>
          </label>
          {status === 'SUSPENDED' && (
            <label>
              Khóa đến (giờ trên máy của bạn)
              <input
                type="datetime-local"
                required
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </label>
          )}
          <label>
            Lý do quản trị (không bắt buộc)
            <textarea
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mặc định: Giải quyết vấn đề phát sinh"
            />
          </label>
          <p className="admin-note">
            Mở khóa gói sẽ cấp miễn phí đúng 1 tháng và không ghi nhận thanh toán. Khóa tài khoản sẽ
            kết thúc các phiên đăng nhập; mở khóa tài khoản vẫn cần đăng nhập lại.
          </p>
          {error && (
            <p role="alert" className="error-notice">
              {error}
            </p>
          )}
          <div className="admin-dialog-actions">
            <button type="button" onClick={onClose}>
              Hủy
            </button>
            <button className="admin-primary">
              {busy ? 'Đang lưu…' : 'Lưu trạng thái tài khoản'}
            </button>
          </div>
        </fieldset>
      </form>
    </AdminDialog>
  );
}