import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import { logout } from '../../services/auth.api';
import type { AuthUser } from '../../types/auth';
import { AdminDialog, Badge, DateFields, Empty, LoadState, Metric, Pager } from './admin.shared';
import { dateTime, defaultPeriod, money, useAdminData } from './admin.data';
import './admin.css';

type Props = { onLogout: () => void };
type List = { total: number; page: number; hasMore: boolean };
type AccountSubscription = {
  id?: number;
  status: 'NOT_STARTED' | 'TRIAL' | 'ACTIVE' | 'EXPIRED';
  hasAccess: boolean;
  accessEndsAt: string | null;
  updatedAt: string | null;
};
type Account = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  lockReason: string | null;
  suspendedUntil: string | null;
  updatedAt: string;
  createdAt: string;
  subscription: AccountSubscription;
};
type Verification = {
  id: number;
  businessName: string;
  warehouseAddress: string;
  region: string | null;
  taxCode: string | null;
  legalRepresentative: string | null;
  verificationDocumentUrl: string | null;
  verificationStatus: string;
  verificationVersion: number;
  verificationNote: string | null;
  submittedAt: string | null;
  user: Account;
};
type Settlement = {
  id: number;
  supplierId: number;
  businessName: string;
  buyerName: string;
  subtotal: number;
  total: number;
  commissionRate: number | null;
  commissionAmount: number | null;
  deliveredAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  paymentStatus: string;
  region: string | null;
};
const navigation = [
  { path: '', label: 'Tổng quan', icon: 'store' },
  { path: 'users', label: 'Người dùng', icon: 'user' },
  { path: 'verification', label: 'Xác minh chủ vựa', icon: 'shield' },
  { path: 'finance', label: 'Hoa hồng & đối soát', icon: 'box' },
  { path: 'holidays', label: 'Ngày lễ & AI', icon: 'sparkle' },
  { path: 'ai', label: 'Hoạt động AI', icon: 'sparkle' },
  { path: 'moderation', label: 'Duyệt bài AI', icon: 'sparkle' },
  { path: 'ai-config', label: 'Cấu hình AI & Ký quỹ', icon: 'sparkle' },
  { path: 'audit', label: 'Nhật ký hệ thống', icon: 'lock' },
] as const;

export default function AdminPage({ user, onLogout }: Props & { user: AuthUser }) {
  const tab = useParams()['*'] || '';
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = 'SupplyMind AI · Quản trị nền tảng';
  }, []);
  if (!navigation.some((item) => item.path === tab)) return <Navigate to="/admin" replace />;
  async function signOut() {
    setBusy(true);
    try {
      await logout();
      onLogout();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Brand light />
        <span className="admin-console-label">QUẢN TRỊ NỀN TẢNG</span>
        <nav aria-label="Quản trị">
          {navigation.map((item) => (
            <NavLink key={item.path} to={`/admin${item.path ? '/' + item.path : ''}`} end>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <span className="admin-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>Quản trị viên</small>
          </div>
          <button aria-label="Đăng xuất" disabled={busy} onClick={() => void signOut()}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <span>
            SupplyMind AI <span className="admin-slash">/</span>{' '}
            {navigation.find((item) => item.path === tab)?.label}
          </span>
          <div className="admin-top-actions">
            <span className="admin-admin-tag">
              <Icon name="shield" /> Admin
            </span>
            <button disabled={busy} onClick={() => void signOut()}>
              Đăng xuất
            </button>
          </div>
        </header>
        <div className="admin-content">
          {error && (
            <p role="alert" className="error-notice">
              {error}
            </p>
          )}
          {tab === '' ? (
            <Overview onLogout={onLogout} />
          ) : tab === 'users' ? (
            <Users onLogout={onLogout} />
          ) : tab === 'verification' ? (
            <Verifications onLogout={onLogout} />
          ) : tab === 'finance' ? (
            <Finance onLogout={onLogout} />
          ) : tab === 'holidays' ? (
            <HolidaySettings onLogout={onLogout} />
          ) : tab === 'ai' ? (
            <AiMonitoring onLogout={onLogout} />
          ) : tab === 'moderation' ? (
            <ModerationQueue onLogout={onLogout} />
          ) : tab === 'ai-config' ? (
            <AiSystemConfig onLogout={onLogout} />
          ) : (
            <Audit onLogout={onLogout} />
          )}
        </div>
        <footer className="admin-footer">
          SupplyMind AI · Dữ liệu vận hành toàn sàn · Múi giờ Việt Nam (UTC+7)
        </footer>
      </main>
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-heading">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action}
    </div>
  );
}
function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </div>
      {children}
    </section>
  );
}

type OverviewData = {
  gmv: number;
  completedOrders: number;
  commissionAccrued: number;
  commissionReceived: number;
  commissionUnpaid: number;
  pendingVerifications: number;
  legacyOrders: number;
  users: Record<string, number>;
  daily: { day: string; gmv: number; orders: number }[];
  topProducts: {
    productId: number;
    productName: string;
    packaging: string;
    region: string | null;
    quantity: number;
    revenue: number;
  }[];
};
function Overview({ onLogout }: Props) {
  const [dates, setDates] = useState(defaultPeriod),
    [region, setRegion] = useState('');
  const [query, setQuery] = useState<Record<string, string>>(defaultPeriod),
    [revision, setRevision] = useState(0);
  const { data, error, loading } = useAdminData<OverviewData>(
    '/admin/analytics',
    query,
    onLogout,
    revision,
  );
  const max = Math.max(1, ...(data?.daily.map((d) => d.gmv) || []));
  return (
    <>
      <Heading
        eyebrow="PLATFORM OVERVIEW"
        title="Toàn cảnh nền tảng"
        description="Theo dõi giao dịch hoàn tất, dòng phí và hoạt động của các đối tác."
        action={<button onClick={() => setRevision((n) => n + 1)}>↻ Làm mới</button>}
      />
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ ...dates, region });
          setRevision((n) => n + 1);
        }}
      >
        <DateFields value={dates} onChange={setDates} />
        <label>
          Khu vực chủ vựa
          <input
            maxLength={100}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Tất cả khu vực"
          />
        </label>
        <button className="admin-primary">Xem báo cáo</button>
      </form>
      <LoadState loading={loading} error={error} />
      {data && (
        <>
          <div className="admin-metrics">
            <Metric
              label="Tổng giá trị hàng hóa (GMV)"
              value={money(data.gmv)}
              note="Đơn đã giao · không gồm phí vận chuyển"
            />
            <Metric
              label="Đơn hàng hoàn tất"
              value={data.completedOrders.toLocaleString('vi-VN')}
              note="Theo ngày giao trong kỳ"
            />
            <Metric
              label="Hoa hồng đã thu"
              value={money(data.commissionReceived)}
              note="Theo ngày xác nhận thu trong kỳ"
            />
            <Metric
              label="Hoa hồng chưa thu"
              value={money(data.commissionUnpaid)}
              note="Của các đơn đã giao trong kỳ"
            />
          </div>
          <div className="admin-overview-split">
            <Panel
              title="Giá trị giao dịch theo ngày"
              note="Tiền hàng của đơn giao thành công · di chuột hoặc chạm vào cột để xem số liệu."
            >
              {data.daily.length ? (
                <div className="admin-chart" role="img" aria-label="Biểu đồ GMV theo ngày">
                  <div className="admin-chart-bars">
                    {data.daily.map((day) => (
                      <div className="admin-bar-column" key={day.day}>
                        <div
                          className="admin-bar"
                          tabIndex={0}
                          title={`${day.day}: ${money(day.gmv)} · ${day.orders} đơn`}
                          aria-label={`${day.day}: ${money(day.gmv)}, ${day.orders} đơn`}
                          style={{ height: `${Math.max(2, (day.gmv / max) * 100)}%` }}
                        >
                          <span>
                            {money(day.gmv)}
                            <small>{day.orders} đơn</small>
                          </span>
                        </div>
                        <small>
                          {day.day.slice(8)}/{day.day.slice(5, 7)}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Empty>Chưa có đơn giao thành công trong kỳ này.</Empty>
              )}
            </Panel>
            <Panel
              title="Mạng lưới đối tác"
              note="Số tài khoản toàn hệ thống, không phụ thuộc bộ lọc báo cáo."
            >
              <div className="admin-network">
                <div>
                  <Icon name="store" />
                  <span>
                    Chủ tạp hóa<strong>{data.users.STORE_OWNER || 0}</strong>
                  </span>
                </div>
                <div>
                  <Icon name="box" />
                  <span>
                    Chủ vựa<strong>{data.users.SUPPLIER || 0}</strong>
                  </span>
                </div>
                <NavLink to="/admin/verification">
                  <span>Hồ sơ chờ duyệt</span>
                  <strong>{data.pendingVerifications} →</strong>
                </NavLink>
              </div>
              <p className="admin-note">
                Phí phát sinh trong kỳ: <b>{money(data.commissionAccrued)}</b>
              </p>
            </Panel>
          </div>
          {data.legacyOrders > 0 && (
            <p className="admin-note">
              Có {data.legacyOrders} đơn cũ chưa ghi nhận ngày giao. Các đơn này chưa được đưa vào
              báo cáo theo kỳ.
            </p>
          )}
          <Panel
            title="Mặt hàng bán sỉ nổi bật"
            note="Xếp theo giá trị hàng hóa đã giao, phân nhóm theo sản phẩm, quy cách và khu vực kho vựa."
          >
            {data.topProducts.length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mặt hàng</th>
                      <th>Khu vực chủ vựa</th>
                      <th>Số lượng</th>
                      <th>Giá trị giao dịch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((p, index) => (
                      <tr key={`${p.productId}-${index}`}>
                        <td>
                          <strong>{p.productName}</strong>
                          <small>{p.packaging}</small>
                        </td>
                        <td>{p.region || 'Chưa có khu vực'}</td>
                        <td>
                          {p.quantity.toLocaleString('vi-VN')} × {p.packaging}
                        </td>
                        <td className="admin-money">{money(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )}
          </Panel>
        </>
      )}
    </>
  );
}


function DeleteUserDialog({
  user,
  onClose,
  onSuccess,
  onLogout,
}: {
  user: Account;
  onClose: () => void;
  onSuccess?: () => void;
  onLogout?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setError('');
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${user.id}`);
      onSuccess?.();
    } catch (err) {
      if (isUnauthenticated(err) && onLogout) {
        onLogout();
        return;
      }
      setError(getApiError(err));
      setDeleting(false);
    }
  };

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
          maxWidth: '540px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFF1F2',
            padding: '18px 24px',
            borderBottom: '1px solid #FFE4E6',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span
            style={{
              backgroundColor: '#FFE4E6',
              color: '#E11D48',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            !
          </span>
          <div>
            <h3 style={{ margin: 0, color: '#9F1239', fontSize: '17px', fontWeight: 700 }}>
              Xóa tài khoản người dùng
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#BE123C' }}>
              Người dùng: <strong>{user.name}</strong> (@{user.username} · #{user.id})
            </p>
          </div>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '14px 16px',
            }}
          >
            <p style={{ margin: 0, fontSize: '13.5px', color: '#991B1B', lineHeight: 1.6 }}>
              Hành động này sẽ <strong>xóa vĩnh viễn</strong> tài khoản người dùng <strong>@{user.username}</strong> và toàn bộ dữ liệu kiểm thử liên quan (hồ sơ cửa hàng, kho hàng, hợp đồng, ví giả lập).
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '12.5px', color: '#B91C1C', lineHeight: 1.5 }}>
              Sau khi xóa, tên đăng nhập và số điện thoại/email này có thể được sử dụng để <strong>đăng ký lại tài khoản mới</strong> phục vụ mục đích kiểm thử hệ thống.
            </p>
          </div>

          {error && (
            <p style={{ margin: 0, color: '#DC2626', fontSize: '13px', backgroundColor: '#FEF2F2', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FECACA' }}>
              {error}
            </p>
          )}
        </div>

        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            borderTop: '1px solid #E2E8F0',
          }}
        >
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontWeight: 600,
              fontSize: '14px',
              cursor: deleting ? 'not-allowed' : 'pointer',
            }}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#E11D48',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '14px',
              cursor: deleting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {deleting ? 'Đang xóa...' : 'Xác nhận xóa vĩnh viễn'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Users({ onLogout }: Props) {
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
            <option value="SUSPENDED">Khóa tạm thời</option>
            <option value="BANNED">Khóa vĩnh viễn</option>
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
                            title="Xóa vĩnh viễn tài khoản người dùng"
                          >
                            Xóa
                          </button>
                        </div>
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
          onSuccess={() => {
            const deletedName = deleteTarget.name;
            setDeleteTarget(null);
            setRevision((n) => n + 1);
            setUserToast(`Đã xóa vĩnh viễn tài khoản "${deletedName}" thành công.`);
            setTimeout(() => setUserToast(''), 4000);
          }}
          onLogout={onLogout}
        />
      )}
    </>
  );
}
function AccountDialog({
  user,
  onClose,
  onSaved,
  onLogout,
}: Props & { user: Account; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(user.status),
    [reason, setReason] = useState(''),
    [until, setUntil] = useState('');
  const [showDeleteNotice, setShowDeleteNotice] = useState(false);
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
        reason,
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
    if (reason.trim().length < 3) {
      setError('Nhập lý do mở khóa từ 3 ký tự.');
      return;
    }
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
      await api.post(`/admin/users/${user.id}/subscription/unlock`, { reason });
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
            Lý do quản trị
            <textarea
              required
              minLength={3}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: Cho phép tài khoản tiếp tục demo với giáo viên"
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
          <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px dashed #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '13px', color: '#64748B', display: 'block' }}>
              Xóa tài khoản khỏi hệ thống
            </span>
            <small style={{ fontSize: '11px', color: '#94A3B8' }}>
              Luồng cần giải quyết theo lộ trình (Roadmap)
            </small>
          </div>
          <button
            type="button"
            style={{
              padding: '6px 12px',
              backgroundColor: '#FFF1F2',
              color: '#E11D48',
              border: '1px solid #FECDD3',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
            onClick={() => setShowDeleteNotice(true)}
          >
            Xóa người dùng
          </button>
        </div>
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
      {showDeleteNotice && (
        <DeleteUserDialog
          user={user}
          onClose={() => setShowDeleteNotice(false)}
          onSuccess={() => {
            setShowDeleteNotice(false);
            onSaved();
          }}
          onLogout={onLogout}
        />
      )}
    </AdminDialog>
  );
}

function Verifications({ onLogout }: Props) {
  const [status, setStatus] = useState('PENDING'),
    [q, setQ] = useState('');
  const [query, setQuery] = useState({ status: 'PENDING', q: '', page: 1 }),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Verification | null>(null);
  const { data, loading, error } = useAdminData<List & { profiles: Verification[] }>(
    '/admin/verifications',
    query,
    onLogout,
    revision,
  );
  return (
    <>
      <Heading
        eyebrow="PARTNER VERIFICATION"
        title="Xác minh chủ vựa"
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
          Tên gian hàng
          <input
            maxLength={150}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm chủ vựa / đại lý"
          />
        </label>
        <label>
          Trạng thái hồ sơ
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả hồ sơ</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="DRAFT">Chưa gửi duyệt</option>
            <option value="APPROVED">Đã xác minh</option>
            <option value="REJECTED">Cần bổ sung / đã thu hồi</option>
          </select>
        </label>
        <button className="admin-primary">Lọc hồ sơ</button>
      </form>
      <LoadState loading={loading} error={error} />
      {data && (
        <Panel title="Hồ sơ đối tác">
          {data.profiles.length ? (
            <div className="admin-verification-grid">
              {data.profiles.map((p) => (
                <article key={p.id} className="admin-verification-card">
                  <div className="admin-card-top">
                    <span className="admin-shop-icon">
                      <Icon name="store" />
                    </span>
                    <Badge status={p.verificationStatus} />
                  </div>
                  <h3>{p.businessName}</h3>
                  <p>{p.warehouseAddress}</p>
                  <dl>
                    <div>
                      <dt>Người đại diện</dt>
                      <dd>{p.legalRepresentative || 'Chưa bổ sung'}</dd>
                    </div>
                    <div>
                      <dt>Khu vực</dt>
                      <dd>{p.region || 'Chưa bổ sung'}</dd>
                    </div>
                    <div>
                      <dt>Gửi duyệt</dt>
                      <dd>{dateTime(p.submittedAt)}</dd>
                    </div>
                  </dl>
                  <button onClick={() => setSelected(p)}>
                    Xem hồ sơ <span>→</span>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <Empty>Không có hồ sơ trong trạng thái đã chọn.</Empty>
          )}
          <Pager {...data} onPage={(page) => setQuery({ ...query, page })} />
        </Panel>
      )}
      {selected && (
        <VerificationDialog
          profile={selected}
          onLogout={onLogout}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setRevision((n) => n + 1);
          }}
        />
      )}
    </>
  );
}
function VerificationDialog({
  profile: p,
  onLogout,
  onClose,
  onSaved,
}: Props & { profile: Verification; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(
    p.verificationStatus === 'APPROVED' ? 'REJECTED' : 'APPROVED',
  ),
    [note, setNote] = useState('');
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
      await api.patch(`/admin/verifications/${p.id}`, {
        status,
        note,
        version: p.verificationVersion,
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
    <AdminDialog title={p.businessName} onClose={onClose} busy={busy}>
      <dl className="admin-detail-list">
        <div>
          <dt>Tài khoản</dt>
          <dd>
            @{p.user.username} · <Badge status={p.user.status} />
          </dd>
        </div>
        <div>
          <dt>Liên hệ</dt>
          <dd>
            {p.user.email || 'Chưa có email'}
            <br />
            {p.user.phone || 'Chưa có số điện thoại'}
          </dd>
        </div>
        <div>
          <dt>Đại diện</dt>
          <dd>{p.legalRepresentative || 'Chưa bổ sung'}</dd>
        </div>
        <div>
          <dt>Mã ĐKKD / MST</dt>
          <dd>{p.taxCode || 'Chưa bổ sung'}</dd>
        </div>
        <div>
          <dt>Kho hàng</dt>
          <dd>{p.warehouseAddress}</dd>
        </div>
        <div>
          <dt>Khu vực</dt>
          <dd>{p.region || 'Chưa bổ sung'}</dd>
        </div>
        <div>
          <dt>Giấy tờ</dt>
          <dd>
            {p.verificationDocumentUrl?.startsWith('https://') ? (
              <a href={p.verificationDocumentUrl} target="_blank" rel="noopener noreferrer">
                Mở giấy tờ đối tác ↗
              </a>
            ) : (
              'Chưa bổ sung'
            )}
          </dd>
        </div>
      </dl>
      {p.verificationNote && <p className="admin-note">Nhận xét gần nhất: {p.verificationNote}</p>}
      {['PENDING', 'APPROVED'].includes(p.verificationStatus) ? (
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <label>
              Kết quả xem xét
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {p.verificationStatus === 'PENDING' && (
                  <option value="APPROVED">Chấp thuận mở bán</option>
                )}
                <option value="REJECTED">
                  {p.verificationStatus === 'APPROVED'
                    ? 'Thu hồi quyền mở bán'
                    : 'Từ chối, yêu cầu bổ sung'}
                </option>
              </select>
            </label>
            <label>
              Nhận xét / căn cứ
              <textarea
                required
                minLength={3}
                maxLength={500}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <p className="admin-note">
              Hãy kiểm tra giấy tờ và thông tin liên hệ trước khi chấp thuận. Kết quả được gửi về
              màn hình của chủ vựa.
            </p>
            {error && (
              <p role="alert" className="error-notice">
                {error}
              </p>
            )}
            <div className="admin-dialog-actions">
              <button type="button" onClick={onClose}>
                Đóng
              </button>
              <button className="admin-primary">{busy ? 'Đang lưu…' : 'Lưu kết quả'}</button>
            </div>
          </fieldset>
        </form>
      ) : (
        <p className="admin-note">Chủ vựa cần hoàn thiện và gửi lại hồ sơ trước khi được duyệt.</p>
      )}
    </AdminDialog>
  );
}

type FinanceData = List & {
  orders: Settlement[];
  totals: { subtotal: number; commission: number; unpaid: number };
  suppliers: { id: number; name: string; orders: number; commission: number }[];
};
function Finance({ onLogout }: Props) {
  const [dates, setDates] = useState(defaultPeriod),
    [supplierId, setSupplierId] = useState(''),
    [status, setStatus] = useState('');
  const [query, setQuery] = useState({ ...defaultPeriod(), supplierId: '', status: '', page: 1 }),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Settlement | null>(null);
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState('');
  const { data, loading, error } = useAdminData<FinanceData>(
    '/admin/settlements',
    query,
    onLogout,
    revision,
  );
  const settings = useAdminData<{ commissionRate: number; version: number }>(
    '/admin/settings',
    {},
    onLogout,
    revision,
  );
  async function download() {
    setExporting(true);
    setExportError('');
    try {
      const response = await api.get('/admin/settlements/export', {
        params: query,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `supplymind-doi-soat-${query.from}-${query.to}.csv`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setExportError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="COMMISSION & SETTLEMENT"
        title="Hoa hồng & đối soát"
        description="Theo dõi phí phát sinh trên đơn đã giao và xác nhận khoản thu từ từng chủ vựa."
        action={
          <button disabled={loading || !data || exporting} onClick={() => void download()}>
            {exporting ? 'Đang xuất…' : '↓ Xuất báo cáo CSV'}
          </button>
        }
      />
      <LoadState loading={settings.loading} error={settings.error} />
      {settings.data && (
        <CommissionSettings
          key={`${settings.data.version}-${revision}`}
          {...settings.data}
          onLogout={onLogout}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ ...dates, supplierId, status, page: 1 });
          setRevision((n) => n + 1);
        }}
      >
        <DateFields value={dates} onChange={setDates} />
        <label>
          Mã chủ vựa
          <input
            type="number"
            min="1"
            step="1"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            placeholder="Tất cả chủ vựa"
          />
        </label>
        <label>
          Thu phí
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="UNPAID">Chưa thu</option>
            <option value="PAID">Đã thu</option>
            <option value="NO_FEE">Miễn phí</option>
            <option value="UNTRACKED">Chưa có dữ liệu phí</option>
          </select>
        </label>
        <button className="admin-primary">Lọc đối soát</button>
      </form>
      <LoadState loading={loading} error={error || exportError} />
      {data && (
        <>
          <div className="admin-metrics three">
            <Metric label="Tiền hàng trong bộ lọc" value={money(data.totals.subtotal)} />
            <Metric label="Phí hoa hồng phát sinh" value={money(data.totals.commission)} />
            <Metric label="Còn phải thu" value={money(data.totals.unpaid)} />
          </div>
          <Panel
            title="Đối soát theo đơn"
            note="Kỳ báo cáo theo ngày giao. Xác nhận thu là ghi nhận thủ công sau khi kiểm tra chứng từ, không tự trừ tiền ngân hàng."
          >
            {data.orders.length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Đơn / Chủ vựa</th>
                      <th>Ngày giao</th>
                      <th>Tiền hàng</th>
                      <th>Phí hoa hồng</th>
                      <th>Thu phí</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>
                            #{order.id} · {order.businessName}
                          </strong>
                          <small>
                            Mã vựa #{order.supplierId} · {order.buyerName}
                          </small>
                        </td>
                        <td>{dateTime(order.deliveredAt)}</td>
                        <td>{money(order.subtotal)}</td>
                        <td>
                          <strong>
                            {order.commissionAmount === null
                              ? 'Chưa xác định'
                              : money(order.commissionAmount)}
                          </strong>
                          <small>
                            {order.commissionRate === null
                              ? 'Đơn cũ chưa chụp mức phí'
                              : `${order.commissionRate}% tiền hàng`}
                          </small>
                        </td>
                        <td>
                          <Badge status={order.paymentStatus} />
                          {order.paidAt && (
                            <small>
                              {dateTime(order.paidAt)}
                              <br />
                              {order.paymentReference}
                            </small>
                          )}
                        </td>
                        <td>
                          {order.paymentStatus === 'UNPAID' && (
                            <button onClick={() => setSelected(order)}>Xác nhận thu</button>
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
          <Panel
            title="Tổng hợp từng chủ vựa"
            note="Tổng hợp toàn bộ kết quả bộ lọc, không chỉ trang đang xem."
          >
            {data.suppliers.length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Chủ vựa</th>
                      <th>Số đơn</th>
                      <th>Phí trong bộ lọc</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.suppliers.map((s) => (
                      <tr key={s.id}>
                        <td>
                          #{s.id} · {s.name}
                        </td>
                        <td>{s.orders}</td>
                        <td>{money(s.commission)}</td>
                        <td>
                          <button
                            onClick={() => {
                              setSupplierId(String(s.id));
                              setQuery({ ...query, supplierId: String(s.id), page: 1 });
                            }}
                          >
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )}
          </Panel>
        </>
      )}
      {selected && (
        <ReceiveDialog
          order={selected}
          onLogout={onLogout}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setRevision((n) => n + 1);
          }}
        />
      )}
    </>
  );
}
function CommissionSettings({
  commissionRate,
  version,
  onLogout,
  onSaved,
}: Props & { commissionRate: number; version: number; onSaved: () => void }) {
  const [rate, setRate] = useState(String(commissionRate)),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await api.put('/admin/settings', { commissionRate: Number(rate), version });
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
    <form className="admin-rate-card" onSubmit={save}>
      <div>
        <span className="admin-mini-label">CHÍNH SÁCH PHÍ</span>
        <h2>Hoa hồng sàn</h2>
        <p>
          Áp dụng cho đơn tạo mới. Phí = tiền hàng × tỷ lệ; phát sinh khi giao thành công, không
          tính phí vận chuyển.
        </p>
      </div>
      <label>
        Tỷ lệ (%)
        <input
          required
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={rate}
          disabled={busy}
          onChange={(e) => setRate(e.target.value)}
        />
      </label>
      <button className="admin-primary" disabled={busy || Number(rate) === commissionRate}>
        {busy ? 'Đang lưu…' : 'Lưu mức phí'}
      </button>
      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
function ReceiveDialog({
  order,
  onLogout,
  onClose,
  onSaved,
}: Props & { order: Settlement; onClose: () => void; onSaved: () => void }) {
  const [reference, setReference] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await api.post(`/admin/settlements/${order.id}/receive`, { reference });
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
    <AdminDialog title={`Xác nhận thu phí · Đơn #${order.id}`} onClose={onClose} busy={busy}>
      <form onSubmit={save}>
        <p>
          Chủ vựa: <b>{order.businessName}</b>
        </p>
        <p className="admin-payment-amount">{money(order.commissionAmount || 0)}</p>
        <fieldset disabled={busy}>
          <label>
            Mã giao dịch / chứng từ thu
            <input
              required
              minLength={3}
              maxLength={150}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ví dụ: mã chuyển khoản hoặc phiếu thu"
            />
          </label>
          <p className="admin-note">
            Chỉ xác nhận sau khi đã nhận đủ khoản phí này. Nhật ký lưu người xác nhận, thời điểm và
            chứng từ.
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
            <button className="admin-primary">{busy ? 'Đang ghi nhận…' : 'Đã nhận đủ phí'}</button>
          </div>
        </fieldset>
      </form>
    </AdminDialog>
  );
}

type Holiday = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  preparationDays: number;
  demandMultiplier: number;
  categoryKeywords: string;
  description: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};
type HolidayForm = Omit<Holiday, 'id' | 'version' | 'createdAt' | 'updatedAt'>;
const localDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function blankHoliday(): HolidayForm {
  const start = new Date();
  start.setDate(start.getDate() + 14);
  return {
    name: '',
    startDate: localDate(start),
    endDate: localDate(start),
    preparationDays: 14,
    demandMultiplier: 1.2,
    categoryKeywords: '',
    description: '',
    isActive: true,
  };
}
function HolidaySettings({ onLogout }: Props) {
  const [revision, setRevision] = useState(0);
  const { data, loading, error } = useAdminData<{ holidays: Holiday[] }>(
    '/admin/holidays',
    {},
    onLogout,
    revision,
  );
  const [selected, setSelected] = useState<Holiday | 'new' | null>(null);
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const holidays = data?.holidays || [];
  const active = holidays.filter((item) => item.isActive).length;
  async function remove(item: Holiday) {
    if (!window.confirm(`Xóa cấu hình “${item.name}”?`)) return;
    setDeleting(item.id);
    setActionError('');
    try {
      await api.delete(`/admin/holidays/${item.id}`, { data: { version: item.version } });
      setRevision((value) => value + 1);
    } catch (issue) {
      setActionError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDeleting(null);
    }
  }
  return (
    <>
      <Heading
        eyebrow="AI BUSINESS RULES"
        title="Ngày lễ & nhu cầu nhập hàng"
        description="Admin quy định thời gian chuẩn bị, nhóm hàng và mức tăng nhu cầu để AI đưa vào dự báo nhập hàng."
        action={
          <button className="admin-primary" onClick={() => setSelected('new')}>
            + Thêm ngày lễ
          </button>
        }
      />
      <div className="admin-metrics three">
        <Metric
          label="Cấu hình đang dùng"
          value={active}
          note={`${holidays.length} cấu hình trong hệ thống`}
        />
        <Metric
          label="Mức tăng cao nhất"
          value={
            holidays.length
              ? `+${Math.max(...holidays.map((item) => (item.demandMultiplier - 1) * 100)).toLocaleString('vi-VN')}%`
              : '—'
          }
          note="Chỉ áp dụng cho nhóm hàng khớp từ khóa"
        />
        <Metric
          label="Thời gian chuẩn bị dài nhất"
          value={
            holidays.length
              ? `${Math.max(...holidays.map((item) => item.preparationDays))} ngày`
              : '—'
          }
          note="AI bắt đầu tính ảnh hưởng trước ngày lễ"
        />
      </div>
      <p className="admin-note">
        Ví dụ: hệ số 1,30 nghĩa là nhu cầu nền được tăng tối đa 30%. Càng xa ngày lễ, hệ số được
        giảm dần. Sản phẩm chỉ chịu ảnh hưởng khi tên có chứa một trong các từ khóa đã cấu hình.
      </p>
      <LoadState loading={loading} error={error || actionError} />
      {!loading && data && (
        <Panel
          title="Lịch cấu hình của AI"
          note="Tắt cấu hình nếu muốn giữ dữ liệu nhưng chưa cho AI sử dụng."
        >
          {holidays.length ? (
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ngày lễ</th>
                    <th>Thời gian</th>
                    <th>Quy tắc nhu cầu</th>
                    <th>Nhóm hàng áp dụng</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.description || 'Không có ghi chú'}</small>
                      </td>
                      <td>
                        {new Date(item.startDate + 'T00:00:00').toLocaleDateString('vi-VN')} –{' '}
                        {new Date(item.endDate + 'T00:00:00').toLocaleDateString('vi-VN')}
                        <small>Chuẩn bị trước {item.preparationDays} ngày</small>
                      </td>
                      <td>
                        <strong>x{item.demandMultiplier.toLocaleString('vi-VN')}</strong>
                        <small>
                          Tối đa +{((item.demandMultiplier - 1) * 100).toLocaleString('vi-VN')}%
                        </small>
                      </td>
                      <td>{item.categoryKeywords}</td>
                      <td>
                        <Badge status={item.isActive ? 'ACTIVE' : 'DRAFT'} />
                      </td>
                      <td>
                        <button disabled={deleting === item.id} onClick={() => setSelected(item)}>
                          Chỉnh sửa
                        </button>{' '}
                        <button disabled={deleting !== null} onClick={() => void remove(item)}>
                          {deleting === item.id ? 'Đang xóa…' : 'Xóa'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Chưa có ngày lễ. AI hiện chỉ dự báo theo lịch sử bán hàng và tồn kho.</Empty>
          )}
        </Panel>
      )}
      {selected && (
        <HolidayDialog
          holiday={selected === 'new' ? null : selected}
          onLogout={onLogout}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
    </>
  );
}
function HolidayDialog({
  holiday,
  onLogout,
  onClose,
  onSaved,
}: Props & { holiday: Holiday | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<HolidayForm>(() =>
    holiday
      ? {
        name: holiday.name,
        startDate: holiday.startDate,
        endDate: holiday.endDate,
        preparationDays: holiday.preparationDays,
        demandMultiplier: holiday.demandMultiplier,
        categoryKeywords: holiday.categoryKeywords,
        description: holiday.description || '',
        isActive: holiday.isActive,
      }
      : blankHoliday(),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (holiday)
        await api.put(`/admin/holidays/${holiday.id}`, { ...form, version: holiday.version });
      else await api.post('/admin/holidays', form);
      onSaved();
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <AdminDialog
      title={holiday ? `Sửa ${holiday.name}` : 'Thêm ngày lễ cho AI'}
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            Tên ngày lễ / dịp bán hàng
            <input
              required
              minLength={2}
              maxLength={150}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ví dụ: Tết Nguyên đán"
            />
          </label>
          <div className="admin-holiday-dates">
            <label>
              Từ ngày
              <input
                required
                type="date"
                value={form.startDate}
                max={form.endDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              />
            </label>
            <label>
              Đến ngày
              <input
                required
                type="date"
                min={form.startDate}
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
              />
            </label>
          </div>
          <div className="admin-holiday-dates">
            <label>
              Chuẩn bị trước (ngày)
              <input
                required
                type="number"
                min="0"
                max="60"
                step="1"
                value={form.preparationDays}
                onChange={(event) =>
                  setForm({ ...form, preparationDays: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Hệ số nhu cầu
              <input
                required
                type="number"
                min="1"
                max="5"
                step="0.01"
                value={form.demandMultiplier}
                onChange={(event) =>
                  setForm({ ...form, demandMultiplier: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label>
            Nhóm hàng / từ khóa áp dụng
            <textarea
              required
              maxLength={1000}
              rows={3}
              value={form.categoryKeywords}
              onChange={(event) => setForm({ ...form, categoryKeywords: event.target.value })}
              placeholder="bia, nước ngọt, bánh kẹo, hạt dưa"
            />
            <small>
              Cách nhau bằng dấu phẩy. AI đối chiếu các từ này với tên sản phẩm trong kho.
            </small>
          </label>
          <label>
            Ghi chú cho quản trị viên
            <textarea
              maxLength={500}
              rows={2}
              value={form.description || ''}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Nguồn quy tắc, kinh nghiệm kinh doanh hoặc lưu ý…"
            />
          </label>
          <label className="admin-holiday-check">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />{' '}
            Cho phép AI sử dụng cấu hình này
          </label>
          <p className="admin-note">
            Với hệ số x{form.demandMultiplier.toLocaleString('vi-VN')}, nhu cầu được tăng tối đa{' '}
            {Math.max(0, (form.demandMultiplier - 1) * 100).toLocaleString('vi-VN')}% khi gần ngày
            lễ.
          </p>
          {error && (
            <p className="error-notice" role="alert">
              {error}
            </p>
          )}
          <div className="admin-dialog-actions">
            <button type="button" onClick={onClose}>
              Hủy
            </button>
            <button className="admin-primary">{busy ? 'Đang lưu…' : 'Lưu cấu hình'}</button>
          </div>
        </fieldset>
      </form>
    </AdminDialog>
  );
}

type AiData = {
  configuredProvider: string | null;
  weatherIntegrated: boolean;
  recommendationRuns: number;
  acceptedRuns: number;
  acceptanceRate: number | null;
  groups: {
    provider: string;
    status: string;
    count: number;
    averageMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
  }[];
  daily: { day: string; provider: string; calls: number }[];
};
function AiMonitoring({ onLogout }: Props) {
  const [dates, setDates] = useState(defaultPeriod),
    [query, setQuery] = useState(defaultPeriod),
    [revision, setRevision] = useState(0);
  const { data, error, loading } = useAdminData<AiData>('/admin/ai', query, onLogout, revision);
  const external = data?.groups.filter((g) => g.provider !== 'RULES') || [];
  return (
    <>
      <Heading
        eyebrow="AI PERFORMANCE"
        title="Hoạt động AI"
        description="Quan sát số lượt gọi dịch vụ, lỗi và mức độ sử dụng đề xuất nhập hàng."
        action={<button onClick={() => setRevision((n) => n + 1)}>↻ Làm mới</button>}
      />
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(dates);
          setRevision((n) => n + 1);
        }}
      >
        <DateFields value={dates} onChange={setDates} />
        <button className="admin-primary">Xem thống kê</button>
      </form>
      <LoadState loading={loading} error={error} />
      {data && (
        <>
          <div className="admin-metrics">
            <Metric
              label="Lượt gọi AI bên ngoài"
              value={external.reduce((sum, g) => sum + g.count, 0)}
              note={`Cấu hình hiện tại: ${data.configuredProvider || 'Chưa bật AI'}`}
            />
            <Metric
              label="Lượt lỗi / dùng dự phòng"
              value={external
                .filter((g) => g.status === 'ERROR')
                .reduce((sum, g) => sum + g.count, 0)}
              note="Chỉ tính lần gọi dịch vụ AI thất bại"
            />
            <Metric
              label="Lượt dự báo có đề xuất"
              value={data.recommendationRuns}
              note="Loại trừ hàng mẫu và gợi ý bằng 0"
            />
            <Metric
              label="Tỷ lệ sử dụng đề xuất"
              value={data.acceptanceRate === null ? '—' : `${data.acceptanceRate}%`}
              note={`${data.acceptedRuns} lượt được lưu thành kế hoạch`}
            />
          </div>
          <p className="admin-note">
            Tỷ lệ sử dụng = số lượt dự báo có ít nhất một số lượng đề xuất được lưu đúng vào kế
            hoạch trong 24 giờ / tổng lượt dự báo có đề xuất. Đây là mức độ chấp nhận, chưa phải độ
            chính xác dự báo. Số liệu được ghi nhận từ khi bật chức năng theo dõi.
          </p>
          <div className="admin-service-strip">
            <span>
              <i className={data.configuredProvider ? 'online' : ''} /> Gemini / OpenAI:{' '}
              {data.configuredProvider || 'Chưa cấu hình khóa và model'}
            </span>
            <span>
              <i /> API thời tiết: chưa tích hợp · chưa có lượt gọi để thống kê
            </span>
          </div>
          <Panel
            title="Lưu lượng theo dịch vụ"
            note="RULES là trả lời nội bộ, không gọi Gemini/OpenAI và không được tính vào lượt gọi AI bên ngoài."
          >
            {data.groups.length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dịch vụ</th>
                      <th>Kết quả</th>
                      <th>Lượt gọi</th>
                      <th>Độ trễ trung bình</th>
                      <th>Token vào / ra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.groups.map((g) => (
                      <tr key={`${g.provider}-${g.status}`}>
                        <td>
                          <strong>{g.provider}</strong>
                        </td>
                        <td>
                          <Badge status={g.status} />
                        </td>
                        <td>{g.count}</td>
                        <td>
                          {g.status === 'STARTED'
                            ? 'Chưa kết thúc'
                            : `${g.averageMs.toLocaleString('vi-VN')} ms`}
                        </td>
                        <td>
                          {g.inputTokens ?? '—'} / {g.outputTokens ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Chưa có hoạt động trợ lý trong kỳ đã chọn.</Empty>
            )}
          </Panel>
          <Panel title="Tần suất theo ngày">
            {data.daily.length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Dịch vụ</th>
                      <th>Lượt gọi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((d) => (
                      <tr key={`${d.day}-${d.provider}`}>
                        <td>{d.day}</td>
                        <td>{d.provider}</td>
                        <td>{d.calls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )}
          </Panel>
        </>
      )}
    </>
  );
}
type Log = {
  id: number;
  actorId: number | null;
  actor: { name: string; username: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  details: Record<string, unknown>;
};
const actionLabels: Record<string, string> = {
  ACCOUNT_STATUS_CHANGED: 'Đổi trạng thái tài khoản',
  SUBSCRIPTION_UNLOCKED_BY_ADMIN: 'Admin mở khóa gói sử dụng',
  SUPPLIER_VERIFICATION_REVIEWED: 'Duyệt hồ sơ chủ vựa',
  SUPPLIER_VERIFICATION_SUBMITTED: 'Gửi hồ sơ xác minh',
  SUPPLIER_PROFILE_UPDATED: 'Cập nhật hồ sơ gian hàng',
  COMMISSION_RATE_CHANGED: 'Đổi tỷ lệ hoa hồng',
  COMMISSION_RECEIVED: 'Xác nhận thu hoa hồng',
  PRODUCT_CREATED: 'Thêm sản phẩm',
  PRODUCT_UPDATED: 'Cập nhật giá / sản phẩm',
  PRODUCT_HIDDEN: 'Ẩn sản phẩm',
  HOLIDAY_CREATED: 'Thêm cấu hình ngày lễ',
  HOLIDAY_UPDATED: 'Sửa cấu hình ngày lễ',
  HOLIDAY_DELETED: 'Xóa cấu hình ngày lễ',
  QUOTE_SENT: 'Gửi báo giá tiếp thị',
  QUOTE_ACCEPTED: 'Chấp nhận báo giá',
  QUOTE_REJECTED: 'Từ chối báo giá',
  QUOTE_CANCELLED: 'Hủy báo giá',
  DEPOSIT_SIMULATED: 'Xác nhận cọc mô phỏng (dữ liệu cũ)',
  DEPOSIT_SUBMITTED: 'Cửa hàng báo đã chuyển cọc',
  DEPOSIT_SANDBOX_SUBMITTED: 'Cửa hàng chạy thanh toán cọc sandbox',
  DEPOSIT_CONFIRMED: 'Chủ vựa xác nhận nhận cọc',
  DEPOSIT_REJECTED: 'Chủ vựa chưa nhận được cọc',
  DEPOSIT_REFUNDED: 'Chủ vựa xác nhận hoàn cọc',
  ORDER_CREATED_FROM_QUOTE: 'Tạo đơn từ báo giá',
  ORDER_CREATED: 'Tạo đơn hàng',
  ORDER_STATUS_CHANGED: 'Cập nhật tiến độ đơn',
  SUBSCRIPTION_RENEWED: 'Gia hạn gói sử dụng',
  PERSONAL_PROFILE_UPDATED: 'Đổi thông tin cá nhân',
  PASSWORD_CHANGED: 'Đổi mật khẩu',
  PASSWORD_RESET: 'Khôi phục mật khẩu',
};
function Audit({ onLogout }: Props) {
  const [dates, setDates] = useState(defaultPeriod),
    [action, setAction] = useState(''),
    [entityId, setEntityId] = useState('');
  const [query, setQuery] = useState({ ...defaultPeriod(), action: '', entityId: '', page: 1 }),
    [revision, setRevision] = useState(0);
  const { data, loading, error } = useAdminData<List & { logs: Log[] }>(
    '/admin/audit-logs',
    query,
    onLogout,
    revision,
  );
  return (
    <>
      <Heading
        eyebrow="AUDIT & SECURITY"
        title="Nhật ký hệ thống"
        description="Tra cứu ai đã thay đổi dữ liệu, thay đổi khi nào và nội dung thao tác."
      />
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ ...dates, action, entityId, page: 1 });
          setRevision((n) => n + 1);
        }}
      >
        <DateFields value={dates} onChange={setDates} />
        <label>
          Thao tác
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Tất cả thao tác</option>
            {Object.entries(actionLabels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mã đối tượng
          <input
            maxLength={50}
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="Ví dụ: mã đơn 42"
          />
        </label>
        <button className="admin-primary">Tra cứu</button>
      </form>
      <p className="admin-note">
        Nhật ký chỉ đọc, ghi nhận từ lúc triển khai; không lưu mật khẩu, khóa API hay nội dung hội
        thoại.
      </p>
      <LoadState loading={loading} error={error} />
      {data && (
        <Panel title="Lịch sử thao tác">
          {data.logs.length ? (
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Người thao tác</th>
                    <th>Hoạt động</th>
                    <th>Đối tượng</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => (
                    <tr key={log.id}>
                      <td>{dateTime(log.createdAt)}</td>
                      <td>
                        <strong>{log.actor?.name || 'Tài khoản đã xóa'}</strong>
                        <small>{log.actor ? '@' + log.actor.username : '#' + log.actorId}</small>
                      </td>
                      <td>{actionLabels[log.action] || log.action}</td>
                      <td>
                        {log.entityType} #{log.entityId}
                      </td>
                      <td>
                        <details>
                          <summary>Xem thay đổi</summary>
                          <pre className="admin-log-detail">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
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
    </>
  );
}

type ModerationItem = {
  id: number;
  supplierId: number;
  supplierName: string;
  supplierOwner: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierUsername?: string;
  supplierAddress?: string;
  supplierTaxCode?: string | null;
  supplierVerificationStatus?: string;
  name: string;
  category: string;
  packaging: string;
  wholesalePrice: number;
  stockQty: number;
  moq: number;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  moderation: {
    status: 'AUTO_APPROVED' | 'NEEDS_REVIEW' | 'AUTO_REJECTED' | 'FLAGGED';
    riskScore: number;
    reasons: string[];
    criticalReasons?: string[];
    isClean: boolean;
  };
};

function ModerationDetailDialog({
  item,
  onClose,
  onAction,
  busy,
}: {
  item: ModerationItem;
  onClose: () => void;
  onAction: (id: number, action: 'APPROVE' | 'REJECT', reason: string) => Promise<void>;
  busy: boolean;
}) {
  const [reason, setReason] = useState(
    item.moderation.reasons.length ? item.moderation.reasons.join('; ') : ''
  );

  async function handleConfirm(action: 'APPROVE' | 'REJECT') {
    const finalReason =
      reason.trim() ||
      (action === 'APPROVE'
        ? 'Admin thẩm định hợp lệ, cho phép đăng bán'
        : 'Vi phạm quy định kiểm duyệt hàng sỉ');
    await onAction(item.id, action, finalReason);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          maxWidth: '720px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          border: '1px solid #CBD5E1',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFBEB',
            padding: '18px 24px',
            borderBottom: '1px solid #FDE68A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
              }}
            >
              AI
            </span>
            <div>
              <h3 style={{ margin: 0, color: '#92400E', fontSize: '17px', fontWeight: 700 }}>
                Chi tiết bài đăng đáng nghi (Mức 2: Cần Admin duyệt)
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#B45309' }}>
                Mã sản phẩm: #{item.id} · Đăng lúc: {dateTime(item.createdAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* AI Assessment Box */}
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECDD3',
              borderRadius: '12px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ color: '#991B1B', fontSize: '14px' }}>
                  Phân tích rủi ro từ AI Engine
                </strong>
              </div>
              <span
                style={{
                  backgroundColor: item.moderation.riskScore >= 50 ? '#DC2626' : '#EA580C',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '3px 10px',
                  borderRadius: '20px',
                }}
              >
                Mức rủi ro: {item.moderation.riskScore}%
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#7F1D1D', fontWeight: 500 }}>
              Các điểm bất thường / cảnh báo vi phạm được AI gắn cờ:
            </p>
            <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: '13px', color: '#B91C1C', lineHeight: 1.6 }}>
              {item.moderation.reasons.map((r, idx) => (
                <li key={idx}><strong>{r}</strong></li>
              ))}
            </ul>
            <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#991B1B', fontStyle: 'italic' }}>
              * AI xếp loại sản phẩm vào Mức 2 (chưa cấm thẳng mà chờ Admin quyết định xem xét tính hợp pháp và bối cảnh kinh doanh).
            </p>
          </div>

          {/* Product Details Grid */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Thông tin sản phẩm đăng bán
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                backgroundColor: '#F8FAFC',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
              }}
            >
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Tên sản phẩm</small>
                <strong style={{ color: '#0F172A', fontSize: '14px' }}>{item.name}</strong>
              </div>
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Danh mục ngành hàng</small>
                <span style={{ color: '#0F172A', fontSize: '14px', fontWeight: 600 }}>{item.category}</span>
              </div>
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Quy cách đóng gói</small>
                <span style={{ color: '#0F172A', fontSize: '14px' }}>{item.packaging}</span>
              </div>
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Giá bán sỉ đề xuất</small>
                <strong style={{ color: '#16A34A', fontSize: '15px' }}>{money(item.wholesalePrice)}</strong>
              </div>
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Số lượng tồn kho</small>
                <span style={{ color: '#0F172A', fontSize: '14px' }}>{item.stockQty.toLocaleString('vi-VN')} đơn vị</span>
              </div>
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Đặt tối thiểu (MOQ)</small>
                <span style={{ color: '#0F172A', fontSize: '14px' }}>{item.moq.toLocaleString('vi-VN')}</span>
              </div>
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Trạng thái hiện tại</small>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: '2px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: item.isActive ? '#DCFCE7' : '#FEF3C7',
                    color: item.isActive ? '#15803D' : '#B45309',
                  }}
                >
                  {item.isActive ? 'Đang hiển thị' : 'Đang tạm ẩn chờ duyệt'}
                </span>
              </div>
            </div>
          </div>

          {/* Supplier Info */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Thông tin đối tác đăng bán (Chủ vựa)
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                backgroundColor: '#F8FAFC',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
              }}
            >
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Tên cơ sở / Vựa hàng</small>
                <strong style={{ color: '#0F172A', fontSize: '14px' }}>{item.supplierName}</strong>
              </div>
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Người đại diện</small>
                <span style={{ color: '#0F172A', fontSize: '14px' }}>
                  {item.supplierOwner} {item.supplierUsername && <small style={{ color: '#64748B' }}>(@{item.supplierUsername})</small>}
                </span>
              </div>
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Số điện thoại</small>
                <strong style={{ color: '#2563EB', fontSize: '14px' }}>{item.supplierPhone || '—'}</strong>
              </div>
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Email</small>
                <span style={{ color: '#0F172A', fontSize: '14px' }}>{item.supplierEmail || '—'}</span>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Địa chỉ kho hàng</small>
                <span style={{ color: '#0F172A', fontSize: '14px' }}>{item.supplierAddress || 'Chưa cập nhật'}</span>
              </div>
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Mã số thuế</small>
                <span style={{ color: '#0F172A', fontSize: '14px' }}>{item.supplierTaxCode || 'Chưa khai báo'}</span>
              </div>
              <div>
                <small style={{ color: '#64748B', display: 'block', fontSize: '12px' }}>Xác minh vựa</small>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: '2px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: item.supplierVerificationStatus === 'APPROVED' ? '#DCFCE7' : '#F1F5F9',
                    color: item.supplierVerificationStatus === 'APPROVED' ? '#15803D' : '#64748B',
                  }}
                >
                  {item.supplierVerificationStatus === 'APPROVED' ? 'Đã xác minh' : 'Chưa xác minh'}
                </span>
              </div>
            </div>
          </div>

          {/* Admin Decision Reason Input */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
              Ghi chú thẩm định của Quản trị viên (Lưu vết kiểm toán):
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do duyệt hoặc lý do từ chối (ví dụ: Hàng có đầy đủ giấy phép lưu hành; hoặc Vi phạm định giá bất thường)..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #E2E8F0',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConfirm('REJECT')}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #DC2626',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {busy ? 'Đang xử lý…' : 'Từ chối đăng bán'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConfirm('APPROVE')}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: '1px solid #16A34A',
                backgroundColor: '#16A34A',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {busy ? 'Đang xử lý…' : 'Duyệt đăng bán'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ModerationResponse = List & {
  queue: ModerationItem[];
  summary: { flaggedCount: number; autoApprovedCount: number; autoRejectedCount?: number; totalCount: number };
};

function ModerationQueue({ onLogout }: Props) {
  const [query, setQuery] = useState({ page: 1 });
  const [revision, setRevision] = useState(0);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const { data, loading, error } = useAdminData<ModerationResponse>('/admin/moderation/queue', query, onLogout, revision);

  async function handleAction(id: number, action: 'APPROVE' | 'REJECT', actionReason?: string) {
    setActionBusy(id);
    try {
      await api.post(`/admin/moderation/${id}/action`, {
        action,
        reason: actionReason || (action === 'APPROVE' ? 'Admin duyệt cho phép hiển thị' : 'Vi phạm quy định giá/nội dung sàn sỉ'),
      });
      setRevision((n) => n + 1);
    } catch (e) {
      alert(getApiError(e));
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <>
      <Heading
        eyebrow="AI AUTO-MODERATION"
        title="Hàng chờ kiểm duyệt AI"
        description="Kiểm soát các bài đăng bị cảnh báo nhẹ (Mức 2: thuốc lá, giá lệch nhẹ). Các bài vi phạm nghiêm trọng (Mức 3) đã được AI tự động cấm thẳng để giảm tải cho Admin."
        action={<button onClick={() => setRevision((n) => n + 1)}>↻ Làm mới hàng chờ</button>}
      />
      <LoadState loading={loading} error={error} />
      {data && (
        <>
          <div className="admin-metrics three">
            <Metric label="Cần Admin duyệt (Mức 2)" value={data.summary.flaggedCount} note="Cảnh báo nhẹ / 1 lỗi" />
            <Metric label="AI đã tự cấm (Mức 3)" value={data.summary.autoRejectedCount ?? 0} note="Vi phạm nặng / Giảm tải Admin" />
            <Metric label="AI duyệt tự động (Mức 1)" value={data.summary.autoApprovedCount} note="Bài đăng sạch (Clean)" />
          </div>
          <Panel title="Danh sách sản phẩm cần Admin duyệt (Mức 2: Cảnh báo nhẹ)">
            {data.queue.length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sản phẩm / Quy cách</th>
                      <th>Chủ vựa</th>
                      <th>Giá sỉ</th>
                      <th>Điểm rủi ro AI</th>
                      <th>Lý do AI cảnh báo</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.queue.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                          <br />
                          <small>
                            {item.category} · {item.packaging}
                          </small>
                        </td>
                        <td>
                          <strong>{item.supplierName}</strong>
                          <br />
                          <small>{item.supplierOwner}</small>
                        </td>
                        <td className="admin-money">{money(item.wholesalePrice)}</td>
                        <td>
                          <span
                            style={{
                              background: item.moderation.riskScore >= 50 ? '#fce8e6' : '#fef7e0',
                              color: item.moderation.riskScore >= 50 ? '#c5221f' : '#b06000',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                            }}
                          >
                            Rủi ro {item.moderation.riskScore}%
                          </span>
                        </td>
                        <td>
                          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#d93025' }}>
                            {item.moderation.reasons.map((r, idx) => (
                              <li key={idx}>{r}</li>
                            ))}
                          </ul>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-primary"
                            style={{
                              padding: '6px 12px',
                              fontSize: '13px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                            }}
                            onClick={() => setSelectedItem(item)}
                          >
                            Xem chi tiết & Xử lý
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Hiện không có bài đăng sỉ nào bị gắn cờ nghi vấn.</Empty>
            )}
            <Pager {...data} onPage={(page) => setQuery({ page })} />
          </Panel>
          {selectedItem && (
            <ModerationDetailDialog
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onAction={handleAction}
              busy={actionBusy === selectedItem.id}
            />
          )}
        </>
      )}
    </>
  );
}


type SystemConfig = {
  aiModeration: {
    autoModerationEnabled: boolean;
    strictness: 'STANDARD' | 'STRICT' | 'LENIENT';
    criticalForbiddenKeywords: string[];
    restrictedKeywords: string[];
    minSuspiciousPrice: number;
    warningLowPrice: number;
    maxSuspiciousPrice: number;
    maxMoq: number;
    warningMoq: number;
  };
  escrowDeposit: {
    defaultDepositRate: number;
    minDepositRate: number;
    maxDepositRate: number;
    requireDepositForHighValue: boolean;
    highValueThreshold: number;
    escrowHoldDays: number;
    description: string;
  };
  updatedAt: string;
  updatedBy: string | null;
};

function AiSystemConfig({ onLogout }: Props) {
  const [revision, setRevision] = useState(0);
  const { data, loading, error } = useAdminData<SystemConfig>(
    '/admin/system-config',
    {},
    onLogout,
    revision
  );

  const [form, setForm] = useState<SystemConfig | null>(null);
  const [newForbiddenWord, setNewForbiddenWord] = useState('');
  const [newRestrictedWord, setNewRestrictedWord] = useState('');
  const [forbiddenSearch, setForbiddenSearch] = useState('');
  const [restrictedSearch, setRestrictedSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Sync form with fetched data
  useEffect(() => {
    if (data) {
      setForm(JSON.parse(JSON.stringify(data)));
    }
  }, [data]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(''), 4000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  if (loading && !form) {
    return <LoadState loading={true} error="" />;
  }

  if (error && !form) {
    return <LoadState loading={false} error={error} />;
  }

  if (!form) return null;

  function handleAddForbidden() {
    const trimmed = newForbiddenWord.trim().toLowerCase();
    if (!trimmed) return;
    if (form?.aiModeration.criticalForbiddenKeywords.includes(trimmed)) {
      alert('Từ cấm này đã có trong danh sách.');
      return;
    }
    setForm((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        aiModeration: {
          ...curr.aiModeration,
          criticalForbiddenKeywords: [...curr.aiModeration.criticalForbiddenKeywords, trimmed],
        },
      };
    });
    setNewForbiddenWord('');
  }

  function handleRemoveForbidden(word: string) {
    setForm((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        aiModeration: {
          ...curr.aiModeration,
          criticalForbiddenKeywords: curr.aiModeration.criticalForbiddenKeywords.filter(
            (w) => w !== word
          ),
        },
      };
    });
  }

  function handleAddRestricted() {
    const trimmed = newRestrictedWord.trim().toLowerCase();
    if (!trimmed) return;
    if (form?.aiModeration.restrictedKeywords.includes(trimmed)) {
      alert('Từ khóa này đã có trong danh sách.');
      return;
    }
    setForm((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        aiModeration: {
          ...curr.aiModeration,
          restrictedKeywords: [...curr.aiModeration.restrictedKeywords, trimmed],
        },
      };
    });
    setNewRestrictedWord('');
  }

  function handleRemoveRestricted(word: string) {
    setForm((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        aiModeration: {
          ...curr.aiModeration,
          restrictedKeywords: curr.aiModeration.restrictedKeywords.filter((w) => w !== word),
        },
      };
    });
  }

  async function handleSaveAll() {
    if (!form) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      await api.put('/admin/system-config', form);
      setSaveSuccess('Đã lưu cấu hình AI duyệt bài và tỷ lệ ký quỹ thành công!');
      setRevision((n) => n + 1);
    } catch (e) {
      setSaveError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDefault() {
    if (!window.confirm('Bạn có chắc muốn khôi phục toàn bộ cấu hình AI và ký quỹ về mặc định ban đầu?')) {
      return;
    }
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      await api.post('/admin/system-config/reset');
      setSaveSuccess('Đã khôi phục toàn bộ cấu hình về mặc định ban đầu!');
      setRevision((n) => n + 1);
    } catch (e) {
      setSaveError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      setSaving(false);
    }
  }

  const filteredForbidden = form.aiModeration.criticalForbiddenKeywords.filter((w) =>
    !forbiddenSearch ? true : w.toLowerCase().includes(forbiddenSearch.toLowerCase())
  );

  const filteredRestricted = form.aiModeration.restrictedKeywords.filter((w) =>
    !restrictedSearch ? true : w.toLowerCase().includes(restrictedSearch.toLowerCase())
  );

  return (
    <>
      <Heading
        eyebrow="AI & ESCROW CONFIGURATION"
        title="Cấu hình AI duyệt bài & Ký quỹ sàn"
        description="Quản trị viên tùy chỉnh các từ cấm, từ khóa hạn chế, các ngưỡng nhạy cảm cho AI kiểm duyệt bài đăng và điều chỉnh tỷ lệ phần trăm ký quỹ (escrow) phù hợp với sàn thay vì để tự động hoàn toàn."
        action={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleResetDefault}
              disabled={saving}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Khôi phục mặc định
            </button>
            <button
              type="button"
              className="admin-primary"
              onClick={handleSaveAll}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
            </button>
          </div>
        }
      />

      {/* Metrics row */}
      <div className="admin-metrics four">
        <Metric
          label="Từ cấm Mức 3 (Tự cấm)"
          value={`${form.aiModeration.criticalForbiddenKeywords.length} từ`}
          note="Chất cấm, vũ khí, hàng giả, cờ bạc..."
        />
        <Metric
          label="Từ hạn chế Mức 2 (Duyệt)"
          value={`${form.aiModeration.restrictedKeywords.length} từ`}
          note="Thuốc lá, xì gà, rượu mạnh..."
        />
        <Metric
          label="Tỷ lệ ký quỹ chuẩn"
          value={`${form.escrowDeposit.defaultDepositRate}%`}
          note={`Mức trần: ${form.escrowDeposit.maxDepositRate}%`}
        />
        <Metric
          label="Trạng thái AI duyệt bài"
          value={form.aiModeration.autoModerationEnabled ? 'Đang BẬT' : 'Đã TẮT'}
          note={`Độ nghiêm ngặt: ${form.aiModeration.strictness}`}
        />
      </div>

      {saveSuccess && (
        <p
          role="status"
          style={{
            backgroundColor: '#dcfce7',
            color: '#15803d',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1px solid #bbf7d0',
            fontWeight: 600,
            marginBottom: '20px',
          }}
        >
          {saveSuccess}
        </p>
      )}

      {saveError && (
        <p role="alert" className="error-notice" style={{ marginBottom: '20px' }}>
          {saveError}
        </p>
      )}

      <div className="admin-config-container">
        {/* CARD 1: CẤU HÌNH PHẦN TRĂM KÝ QUỸ */}
        <section className="admin-config-card">
          <div className="admin-config-card-header">
            <div>
              <span className="admin-mini-label">CHÍNH SÁCH BẢO ĐẢM TÀI CHÍNH</span>
              <h2>Tỷ lệ phần trăm ký quỹ (Escrow Deposit Rate)</h2>
              <p>
                Admin điều chỉnh tỷ lệ phần trăm tiền cọc đảm bảo hợp đồng sỉ giữa tiệm tạp hóa và chủ vựa. Tiền cọc được tạm giữ an toàn trong hệ thống ký quỹ cho đến khi đơn hàng hoàn tất.
              </p>
            </div>
            
          </div>

          <div className="admin-config-grid">
            <div className="admin-config-field">
              <label htmlFor="defaultDepositRate">Tỷ lệ ký quỹ chuẩn khuyến nghị (%)</label>
              <input
                id="defaultDepositRate"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.escrowDeposit.defaultDepositRate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    escrowDeposit: {
                      ...form.escrowDeposit,
                      defaultDepositRate: Number(e.target.value),
                    },
                  })
                }
              />
              <small>Mức cọc chuẩn áp dụng mặc định khi chủ vựa gửi báo giá (VD: 10% hoặc 20%).</small>
            </div>

            <div className="admin-config-field">
              <label htmlFor="maxDepositRate">Tỷ lệ ký quỹ tối đa cho phép (%)</label>
              <input
                id="maxDepositRate"
                type="number"
                min={form.escrowDeposit.minDepositRate}
                max={100}
                step={0.5}
                value={form.escrowDeposit.maxDepositRate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    escrowDeposit: {
                      ...form.escrowDeposit,
                      maxDepositRate: Number(e.target.value),
                    },
                  })
                }
              />
              <small>Mức trần tối đa, chủ vựa không được phép yêu cầu cọc vượt ngưỡng này (VD: 50%).</small>
            </div>

            <div className="admin-config-field">
              <label htmlFor="highValueThreshold">Ngưỡng đơn giá trị cao (VNĐ)</label>
              <input
                id="highValueThreshold"
                type="number"
                min={0}
                step={500000}
                value={form.escrowDeposit.highValueThreshold}
                onChange={(e) =>
                  setForm({
                    ...form,
                    escrowDeposit: {
                      ...form.escrowDeposit,
                      highValueThreshold: Number(e.target.value),
                    },
                  })
                }
              />
              <small>Đơn hàng vượt giá trị này sẽ tự động áp dụng chính sách ký quỹ bảo đảm.</small>
            </div>

            <div className="admin-config-field">
              <label htmlFor="escrowHoldDays">Thời gian tạm giữ ký quỹ sau khi giao (ngày)</label>
              <input
                id="escrowHoldDays"
                type="number"
                min={0}
                max={30}
                value={form.escrowDeposit.escrowHoldDays}
                onChange={(e) =>
                  setForm({
                    ...form,
                    escrowDeposit: {
                      ...form.escrowDeposit,
                      escrowHoldDays: Number(e.target.value),
                    },
                  })
                }
              />
              <small>Số ngày giữ cọc để chủ tạp hóa kiểm tra hàng hóa trước khi giải tỏa hoàn tất.</small>
            </div>
          </div>
        </section>

        {/* CARD 2: QUẢN LÝ TỪ CẤM NGHIÊM TRỌNG (MỨC 3) */}
        <section className="admin-config-card">
          <div className="admin-config-card-header">
            <div>
              <span className="admin-mini-label" style={{ color: '#b91c1c' }}>MỨC 3 · TỰ ĐỘNG CẤM ĐĂNG BÁN</span>
              <h2>Quản lý Danh sách Từ cấm Nghiêm trọng</h2>
              <p>
                Khi sản phẩm có chứa bất kỳ từ cấm nào bên dưới (trong tên, danh mục, quy cách hoặc mô tả), AI sẽ ngay lập tức từ chối và cấm đăng bán thẳng để bảo vệ an toàn sàn.
              </p>
            </div>
            
          </div>

          <div className="admin-tag-input-row">
            <input
              type="text"
              placeholder="Nhập từ cấm mới (VD: tiền giả, pháo sáng, súng bắn cát...) rồi nhấn Thêm"
              value={newForbiddenWord}
              onChange={(e) => setNewForbiddenWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddForbidden();
                }
              }}
            />
            <button
              type="button"
              className="admin-primary"
              onClick={handleAddForbidden}
              disabled={!newForbiddenWord.trim()}
              style={{ padding: '9px 18px', whiteSpace: 'nowrap' }}
            >
              + Thêm từ cấm
            </button>
          </div>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
              Tổng cộng {form.aiModeration.criticalForbiddenKeywords.length} từ cấm:
            </span>
            <input
              type="text"
              placeholder="Lọc nhanh từ cấm..."
              value={forbiddenSearch}
              onChange={(e) => setForbiddenSearch(e.target.value)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                maxWidth: '200px',
              }}
            />
          </div>

          <div className="admin-tag-cloud">
            {filteredForbidden.length > 0 ? (
              filteredForbidden.map((word) => (
                <span key={word} className="admin-tag-chip critical">
                  <span>{word}</span>
                  <button
                    type="button"
                    className="admin-tag-remove-btn"
                    onClick={() => handleRemoveForbidden(word)}
                    title={`Xóa từ "${word}" khỏi danh sách từ cấm`}
                    aria-label={`Xóa ${word}`}
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px' }}>
                Không tìm thấy từ cấm nào khớp với tìm kiếm.
              </span>
            )}
          </div>
        </section>

        {/* CARD 3: QUẢN LÝ TỪ KHÓA HẠN CHẾ (MỨC 2) */}
        <section className="admin-config-card">
          <div className="admin-config-card-header">
            <div>
              <span className="admin-mini-label" style={{ color: '#b45309' }}>MỨC 2 · CẦN ADMIN DUYỆT</span>
              <h2>Quản lý Danh sách Từ khóa Hạn chế / Có điều kiện</h2>
              <p>
                Sản phẩm chứa các từ khóa này (thuốc lá, xì gà, rượu, thực phẩm chức năng...) sẽ không bị cấm ngay mà được đưa vào Hàng chờ duyệt để Admin kiểm tra giấy phép kinh doanh.
              </p>
            </div>
            
          </div>

          <div className="admin-tag-input-row">
            <input
              type="text"
              placeholder="Nhập từ khóa hạn chế mới (VD: thuốc lào, shisha, vape, rượu ngoại...) rồi nhấn Thêm"
              value={newRestrictedWord}
              onChange={(e) => setNewRestrictedWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddRestricted();
                }
              }}
            />
            <button
              type="button"
              className="admin-primary"
              onClick={handleAddRestricted}
              disabled={!newRestrictedWord.trim()}
              style={{ padding: '9px 18px', whiteSpace: 'nowrap' }}
            >
              + Thêm từ hạn chế
            </button>
          </div>

          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
              Tổng cộng {form.aiModeration.restrictedKeywords.length} từ khóa hạn chế:
            </span>
            <input
              type="text"
              placeholder="Lọc từ hạn chế..."
              value={restrictedSearch}
              onChange={(e) => setRestrictedSearch(e.target.value)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                maxWidth: '200px',
              }}
            />
          </div>

          <div className="admin-tag-cloud">
            {filteredRestricted.length > 0 ? (
              filteredRestricted.map((word) => (
                <span key={word} className="admin-tag-chip warning">
                  <span>{word}</span>
                  <button
                    type="button"
                    className="admin-tag-remove-btn"
                    onClick={() => handleRemoveRestricted(word)}
                    title={`Xóa từ "${word}" khỏi danh sách hạn chế`}
                    aria-label={`Xóa ${word}`}
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px' }}>
                Không tìm thấy từ khóa nào khớp với tìm kiếm.
              </span>
            )}
          </div>
        </section>

        {/* CARD 4: CÀI ĐẶT THUẬT TOÁN & NGƯỠNG RỦI RO AI */}
        <section className="admin-config-card">
          <div className="admin-config-card-header">
            <div>
              <span className="admin-mini-label">QUY TẮC PHÁ GIÁ & SỐ LƯỢNG ẢO</span>
              <h2>Cài đặt Thuật toán AI & Ngưỡng Rủi ro</h2>
              <p>
                Điều chỉnh các ngưỡng giá tối thiểu/tối đa và số lượng MOQ để AI phát hiện kịp thời các hành vi phá giá, tạo đơn ảo hoặc số lượng phi thực tế.
              </p>
            </div>
            
          </div>

          {/* Toggle Enable/Disable AI */}
          <div className="admin-config-toggle">
            <span>
              <strong>Kích hoạt tính năng AI kiểm duyệt tự động</strong>
              <small>Khi tắt, các bài đăng sản phẩm sỉ sẽ không bị AI kiểm tra hay chặn tự động.</small>
            </span>
            <input
              type="checkbox"
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              checked={form.aiModeration.autoModerationEnabled}
              onChange={(e) =>
                setForm({
                  ...form,
                  aiModeration: {
                    ...form.aiModeration,
                    autoModerationEnabled: e.target.checked,
                  },
                })
              }
            />
          </div>

          <div className="admin-config-grid">
            <div className="admin-config-field">
              <label htmlFor="strictness">Độ nghiêm ngặt của AI</label>
              <select
                id="strictness"
                value={form.aiModeration.strictness}
                onChange={(e) =>
                  setForm({
                    ...form,
                    aiModeration: {
                      ...form.aiModeration,
                      strictness: e.target.value as 'STANDARD' | 'STRICT' | 'LENIENT',
                    },
                  })
                }
              >
                <option value="STANDARD">Tiêu chuẩn (Khuyên dùng - Cân bằng kiểm duyệt)</option>
                <option value="STRICT">Nghiêm ngặt (Tăng độ nhạy cảnh báo 25%, kiểm soát chặt)</option>
                <option value="LENIENT">Linh hoạt (Nới lỏng, chỉ chặn vi phạm nặng)</option>
              </select>
              <small>Quyết định hệ số tính điểm rủi ro (risk score) của sản phẩm.</small>
            </div>

            <div className="admin-config-field">
              <label htmlFor="minSuspiciousPrice">Giá sỉ tối thiểu nghi vấn giá ảo / phá giá (VNĐ)</label>
              <input
                id="minSuspiciousPrice"
                type="number"
                min={0}
                step={100}
                value={form.aiModeration.minSuspiciousPrice}
                onChange={(e) =>
                  setForm({
                    ...form,
                    aiModeration: {
                      ...form.aiModeration,
                      minSuspiciousPrice: Number(e.target.value),
                    },
                  })
                }
              />
              <small>Giá sỉ thấp hơn mức này sẽ bị coi là giá ảo phá giá (Mặc định: 500đ).</small>
            </div>

            <div className="admin-config-field">
              <label htmlFor="warningLowPrice">Giá sỉ thấp bất thường cần xác minh (VNĐ)</label>
              <input
                id="warningLowPrice"
                type="number"
                min={form.aiModeration.minSuspiciousPrice}
                step={500}
                value={form.aiModeration.warningLowPrice}
                onChange={(e) =>
                  setForm({
                    ...form,
                    aiModeration: {
                      ...form.aiModeration,
                      warningLowPrice: Number(e.target.value),
                    },
                  })
                }
              />
              <small>Sản phẩm trong khoảng này sẽ cảnh báo Mức 2 để Admin xác minh.</small>
            </div>

            <div className="admin-config-field">
              <label htmlFor="maxSuspiciousPrice">Giá sỉ tối đa bất thường (VNĐ)</label>
              <input
                id="maxSuspiciousPrice"
                type="number"
                min={form.aiModeration.warningLowPrice}
                step={10000000}
                value={form.aiModeration.maxSuspiciousPrice}
                onChange={(e) =>
                  setForm({
                    ...form,
                    aiModeration: {
                      ...form.aiModeration,
                      maxSuspiciousPrice: Number(e.target.value),
                    },
                  })
                }
              />
              <small>Giá sỉ vượt trần này sẽ bị AI cấm vì nghi ngờ thông tin sai lệch.</small>
            </div>

            <div className="admin-config-field">
              <label htmlFor="maxMoq">Số lượng MOQ tối đa phi thực tế</label>
              <input
                id="maxMoq"
                type="number"
                min={1}
                step={1000}
                value={form.aiModeration.maxMoq}
                onChange={(e) =>
                  setForm({
                    ...form,
                    aiModeration: {
                      ...form.aiModeration,
                      maxMoq: Number(e.target.value),
                    },
                  })
                }
              />
              <small>Số lượng tối thiểu (MOQ) vượt ngưỡng này sẽ bị cấm (Mặc định: 50.000).</small>
            </div>

            <div className="admin-config-field">
              <label htmlFor="warningMoq">Ngưỡng MOQ cao cần kiểm tra</label>
              <input
                id="warningMoq"
                type="number"
                min={1}
                max={form.aiModeration.maxMoq}
                step={500}
                value={form.aiModeration.warningMoq}
                onChange={(e) =>
                  setForm({
                    ...form,
                    aiModeration: {
                      ...form.aiModeration,
                      warningMoq: Number(e.target.value),
                    },
                  })
                }
              />
              <small>MOQ vượt ngưỡng này sẽ cảnh báo Admin duyệt (Mặc định: 5.000).</small>
            </div>
          </div>
        </section>

        {/* BOTTOM ACTION BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={handleResetDefault}
            disabled={saving}
            style={{
              padding: '11px 20px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: 'pointer',
            }}
          >
            Khôi phục mặc định
          </button>
          <button
            type="button"
            className="admin-primary"
            onClick={handleSaveAll}
            disabled={saving}
            style={{
              padding: '11px 24px',
              fontSize: '14px',
              fontWeight: 650,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {saving ? 'Đang lưu…' : 'Lưu toàn bộ cấu hình'}
          </button>
        </div>
      </div>
    </>
  );
}
