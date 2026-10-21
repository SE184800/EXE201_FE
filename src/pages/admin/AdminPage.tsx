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

function Users({ onLogout }: Props) {
  const [q, setQ] = useState(''),
    [role, setRole] = useState(''),
    [status, setStatus] = useState('');
  const [query, setQuery] = useState({ q: '', role: '', status: '', page: 1 }),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Account | null>(null);
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
                        <button onClick={() => setSelected(user)}>Quản lý</button>
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
  name: string;
  category: string;
  packaging: string;
  wholesalePrice: number;
  stockQty: number;
  moq: number;
  isActive: boolean;
  createdAt: string;
  moderation: {
    status: 'AUTO_APPROVED' | 'NEEDS_REVIEW' | 'AUTO_REJECTED' | 'FLAGGED';
    riskScore: number;
    reasons: string[];
    criticalReasons?: string[];
    isClean: boolean;
  };
};

type ModerationResponse = List & {
  queue: ModerationItem[];
  summary: { flaggedCount: number; autoApprovedCount: number; autoRejectedCount?: number; totalCount: number };
};

function ModerationQueue({ onLogout }: Props) {
  const [query, setQuery] = useState({ page: 1 });
  const [revision, setRevision] = useState(0);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const { data, loading, error } = useAdminData<ModerationResponse>('/admin/moderation/queue', query, onLogout, revision);

  async function handleAction(id: number, action: 'APPROVE' | 'REJECT') {
    setActionBusy(id);
    try {
      await api.post(`/admin/moderation/${id}/action`, {
        action,
        reason: action === 'APPROVE' ? 'Admin duyệt cho phép hiển thị' : 'Vi phạm quy định giá/nội dung sàn sỉ',
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
                            ⚠️ Rủi ro {item.moderation.riskScore}%
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
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="admin-primary"
                              style={{
                                background: '#137333',
                                borderColor: '#137333',
                                padding: '4px 10px',
                                fontSize: '12px',
                              }}
                              disabled={actionBusy === item.id}
                              onClick={() => void handleAction(item.id, 'APPROVE')}
                            >
                              Duyệt
                            </button>
                            <button
                              style={{
                                background: '#d93025',
                                color: '#fff',
                                border: 'none',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                              disabled={actionBusy === item.id}
                              onClick={() => void handleAction(item.id, 'REJECT')}
                            >
                              Từ chối
                            </button>
                          </div>
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
        </>
      )}
    </>
  );
}
