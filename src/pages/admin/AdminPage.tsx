import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import Brand from '../../components/Brand';
import DatePicker from '../../components/DatePicker';
import Icon from '../../components/Icon';
import NotificationBell from '../../components/NotificationBell';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import { logout } from '../../services/auth.api';
import type { AuthUser } from '../../types/auth';
import { AdminDialog, Badge, DateFields, Empty, LoadState, Metric, Pager } from './admin.shared';
import { dateTime, defaultPeriod, money, useAdminData } from './admin.data';
import AdminWalletSection, { type AdminWalletTab } from './AdminWalletPage';
import AdminDisputes from './AdminDisputes';
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
  deletedAt?: string | null;
  updatedAt: string;
  createdAt: string;
  subscription: AccountSubscription;
};
type Verification = {
  id: number;
  userId?: number;
  role?: string;
  roleLabel?: string;
  phone?: string;
  businessName: string;
  warehouseAddress: string;
  region: string | null;
  taxCode: string | null;
  legalRepresentative: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankQrImageUrl?: string | null;
  verificationDocumentUrl: string | null;
  verificationStatus: string;
  verificationVersion: number;
  verificationNote: string | null;
  submittedAt: string | null;
  reviewedAt?: string | null;
  locationType?: string | null;
  alleyDetail?: string | null;
  isAddressVerified?: boolean;
  latitude?: number | null;
  longitude?: number | null;
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
type NavItem = {
  path: string;
  label: string;
  icon: 'store' | 'user' | 'shield' | 'box' | 'chart' | 'sparkle' | 'lock' | 'calendar';
};

type NavGroup = {
  section: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    section: 'TỔNG QUAN HỆ THỐNG',
    items: [
      { path: '', label: 'Bảng điều khiển', icon: 'chart' },
    ],
  },
  {
    section: 'ĐỐI TÁC & TRANH CHẤP',
    items: [
      { path: 'users', label: 'Tài khoản người dùng', icon: 'user' },
      { path: 'verification', label: 'Xác minh chủ vựa (KYC)', icon: 'shield' },
      { path: 'disputes', label: 'Phân xử khiếu nại', icon: 'shield' },
    ],
  },
  {
    section: 'TÀI CHÍNH & VÍ KÝ QUỸ',
    items: [
      { path: 'wallet', label: 'Quản lý ví & Ký quỹ', icon: 'chart' },
    ],
  },
  {
    section: 'TRÍ TUỆ NHÂN TẠO & KIỂM DUYỆT',
    items: [
      { path: 'ai', label: 'Giám sát hoạt động AI', icon: 'sparkle' },
    ],
  },
  {
    section: 'HỆ THỐNG & CẤU HÌNH',
    items: [
      { path: 'ai-config', label: 'Cấu hình tham số sàn', icon: 'store' },
      { path: 'holidays', label: 'Lịch sự kiện & Ngày lễ', icon: 'calendar' },
      { path: 'audit', label: 'Nhật ký kiểm toán', icon: 'lock' },
    ],
  },
];

const navigation = navGroups.flatMap((group) => group.items);

/** Wallet sub tabs live under the `wallet` navigation entry. */
const walletTabs: Record<string, AdminWalletTab> = {
  wallet: 'overview',
  'wallet/withdrawals': 'withdrawals',
  'wallet/payments': 'payments',
};

export default function AdminPage({ user, onLogout }: Props & { user: AuthUser }) {
  const tab = useParams()['*'] || '';
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = 'SupplyMind AI · Quản trị nền tảng';
  }, []);
  if (!navigation.some((item) => item.path === tab) && !(tab in walletTabs)) {
    return <Navigate to="/admin" replace />;
  }
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
          {navGroups.map((group) => (
            <div key={group.section} className="admin-nav-group">
              <span className="admin-nav-group-title">{group.section}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={`/admin${item.path ? '/' + item.path : ''}`}
                  end={item.path === ''}
                  className={({ isActive }) =>
                    isActive ||
                      (item.path !== '' && (tab === item.path || tab.startsWith(item.path + '/')))
                      ? 'active'
                      : undefined
                  }
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <span className="admin-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>Quản trị viên</small>
          </div>
          <button aria-label="Đăng xuất" disabled={busy} onClick={() => void signOut()} title="Đăng xuất">
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <span className="admin-breadcrumb">
              SupplyMind B2B <span className="admin-slash">/</span>{' '}
              <strong>
                {tab in walletTabs
                  ? 'Quản lý ví tiền'
                  : navigation.find((item) => item.path === tab)?.label || 'Bảng điều khiển'}
              </strong>
            </span>
            <div className="admin-system-status">
              <span className="admin-status-dot pulse" />
              <span>Hệ thống: Trực tuyến</span>
            </div>
          </div>
          <div className="admin-top-actions">
            <NotificationBell />
            <div className="admin-datetime-chip">
              <Icon name="calendar" />
              <span>
                {new Date().toLocaleDateString('vi-VN', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </div>
            <span className="admin-admin-tag">
              <Icon name="shield" /> Super Admin
            </span>
            <button className="admin-logout-btn" disabled={busy} onClick={() => void signOut()} title="Đăng xuất khỏi hệ thống">
              <Icon name="logout" />
              <span>Đăng xuất</span>
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
          ) : tab === 'disputes' ? (
            <AdminDisputes onLogout={onLogout} />
          ) : tab === 'finance' ? (
            <Finance onLogout={onLogout} />
          ) : tab in walletTabs ? (
            <AdminWalletSection tab={walletTabs[tab]} onLogout={onLogout} />
          ) : tab === 'holidays' ? (
            <HolidaySettings onLogout={onLogout} />
          ) : tab === 'ai' ? (
            <AiMonitoring onLogout={onLogout} />
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
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-heading">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        {description && <span>{description}</span>}
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

type OverviewTransaction = {
  id: number;
  orderCode: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  deliveredAt: string | null;
  region: string;
  buyerName: string;
  buyerPhone: string | null;
  supplierName: string;
  itemCount: number;
};

type OverviewData = {
  from: string;
  to: string;
  gmv: number;
  completedOrders: number;
  commissionAccrued: number;
  commissionReceived: number;
  commissionUnpaid: number;
  pendingVerifications: number;
  legacyOrders: number;
  users: Record<string, number>;
  daily: { day: string; gmv: number; orders: number }[];
  topProducts?: {
    productId: number;
    productName: string;
    packaging: string;
    region: string | null;
    quantity: number;
    revenue: number;
  }[];
  transactions?: OverviewTransaction[];
};

type DailyPoint = {
  day: string;
  dayLabel: string;
  weekdayLabel: string;
  fullDate: string;
  gmv: number;
  orders: number;
};

function formatWeekday(dateStr: string): string {
  try {
    const dt = new Date(dateStr + 'T00:00:00');
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[dt.getDay()] || '';
  } catch {
    return '';
  }
}

function getNiceMaxScale(maxValue: number): number {
  if (maxValue <= 100000) return 100000;
  if (maxValue <= 500000) return Math.ceil(maxValue / 100000) * 100000;
  if (maxValue <= 2000000) return Math.ceil(maxValue / 250000) * 250000;
  if (maxValue <= 10000000) return Math.ceil(maxValue / 1000000) * 1000000;
  return Math.ceil(maxValue / 5000000) * 5000000;
}

function DailyAnalyticsChart({
  daily,
  totalGmv,
  totalOrders,
}: {
  daily: { day: string; gmv: number; orders: number }[];
  from?: string;
  to?: string;
  totalGmv: number;
  totalOrders: number;
}) {
  const [chartMode, setChartMode] = useState<'bar' | 'area'>('bar');
  const [hoveredPoint, setHoveredPoint] = useState<DailyPoint | null>(null);

  const points: DailyPoint[] = useMemo(() => {
    if (!daily || daily.length === 0) return [];
    return [...daily]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => {
        const dayMonth = `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`;
        const weekday = formatWeekday(d.day);
        return {
          day: d.day,
          dayLabel: dayMonth,
          weekdayLabel: weekday,
          fullDate: `${weekday}, ngày ${dayMonth}/${d.day.slice(0, 4)}`,
          gmv: d.gmv,
          orders: d.orders,
        };
      });
  }, [daily]);

  const maxGmvRaw = Math.max(1, ...points.map((p) => p.gmv));
  const maxScale = useMemo(() => getNiceMaxScale(maxGmvRaw), [maxGmvRaw]);

  const peakDay = useMemo(() => {
    return points.reduce(
      (max, d) => (d.gmv > max.gmv ? d : max),
      { day: '', dayLabel: '', weekdayLabel: '', fullDate: '', gmv: 0, orders: 0 },
    );
  }, [points]);

  const yTicks = [
    maxScale,
    Math.round(maxScale * 0.75),
    Math.round(maxScale * 0.5),
    Math.round(maxScale * 0.25),
    0,
  ];

  const svgWidth = 720;
  const svgHeight = 240;
  const paddingLeft = 70;
  const paddingRight = 35;
  const paddingTop = 42;
  const paddingBottom = 46;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const N = points.length;
  const slotWidth = N > 0 ? plotWidth / N : plotWidth;
  const barWidth = Math.min(54, Math.max(22, slotWidth * 0.55));

  const getX = (index: number) => {
    if (N <= 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (index + 0.5) * slotWidth;
  };

  const getY = (value: number) => {
    const ratio = Math.min(1, Math.max(0, value / maxScale));
    return paddingTop + plotHeight - ratio * plotHeight;
  };

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.gmv).toFixed(1)}`)
      .join(' ');
  }, [points, maxScale, slotWidth]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = getX(0).toFixed(1);
    const lastX = getX(points.length - 1).toFixed(1);
    const bottomY = (paddingTop + plotHeight).toFixed(1);
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePath, points, slotWidth]);

  if (daily.length === 0) {
    return (
      <div className="admin-empty-chart">
        <Icon name="chart" />
        <p>Chưa có giao dịch sỉ nào phát sinh trong khoảng thời gian này.</p>
        <small>Các giao dịch giữa chủ tiệm tạp hóa và chủ vựa sẽ tự động tổng hợp vào biểu đồ.</small>
      </div>
    );
  }

  return (
    <div className="admin-smart-chart-container">
      <div className="admin-chart-topbar">
        <div className="admin-chart-kpis">
          <div className="admin-chart-kpi-item">
            <span>Tổng giao dịch</span>
            <strong>{money(totalGmv)}</strong>
          </div>
          <div className="admin-chart-kpi-divider" />
          <div className="admin-chart-kpi-item">
            <span>Số đơn hoàn tất</span>
            <strong>{totalOrders} đơn</strong>
          </div>
          {peakDay.gmv > 0 && (
            <>
              <div className="admin-chart-kpi-divider" />
              <div className="admin-chart-kpi-item">
                <span>Đỉnh doanh số / ngày</span>
                <strong className="text-emerald">{money(peakDay.gmv)}</strong>
              </div>
              <div className="admin-chart-kpi-divider" />
              <div className="admin-chart-kpi-item">
                <span>Số ngày giao dịch</span>
                <strong>{points.length} ngày</strong>
              </div>
            </>
          )}
        </div>

        <div className="admin-chart-switcher">
          <button
            type="button"
            className={`admin-chart-mode-btn ${chartMode === 'bar' ? 'active' : ''}`}
            onClick={() => setChartMode('bar')}
          >
             Cột số liệu
          </button>
          <button
            type="button"
            className={`admin-chart-mode-btn ${chartMode === 'area' ? 'active' : ''}`}
            onClick={() => setChartMode('area')}
          >
            Đường xu hướng
          </button>
        </div>
      </div>

      <div className="admin-chart-svg-wrapper">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="admin-smart-svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity="0.32" />
              <stop offset="65%" stopColor="#22c55e" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
            <linearGradient id="barGradientActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>

          {yTicks.map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke={val === 0 ? '#cbd5e1' : '#e2e8f0'}
                  strokeDasharray={val === 0 ? 'none' : '4 4'}
                  strokeWidth={val === 0 ? '1.5' : '1'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontWeight="500"
                >
                  {val >= 1000000 ? `${(val / 1000000).toFixed(1)}Tr ₫` : val > 0 ? `${Math.round(val / 1000)}k ₫` : '0 ₫'}
                </text>
              </g>
            );
          })}

          {chartMode === 'area' && (
            <>
              {points.length > 1 && (
                <>
                  <path d={areaPath} fill="url(#areaGradient)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
              {points.map((p, i) => {
                const cx = getX(i);
                const cy = getY(p.gmv);
                const isHovered = hoveredPoint?.day === p.day;

                return (
                  <g
                    key={p.day}
                    className="admin-chart-point-group"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {isHovered && (
                      <line
                        x1={cx}
                        y1={paddingTop}
                        x2={cx}
                        y2={paddingTop + plotHeight}
                        stroke="#16a34a"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : 4.5}
                      fill="#16a34a"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={cx}
                      y={cy - 10}
                      textAnchor="middle"
                      fill="#15803d"
                      fontSize="10.5"
                      fontWeight="650"
                    >
                      {money(p.gmv)}
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {chartMode === 'bar' && (
            <>
              {points.map((p, i) => {
                const cx = getX(i);
                const cy = getY(p.gmv);
                const barHeight = Math.max(4, paddingTop + plotHeight - cy);
                const isHovered = hoveredPoint?.day === p.day;

                return (
                  <g
                    key={p.day}
                    className="admin-chart-bar-group"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={cx - barWidth}
                      y={paddingTop}
                      width={barWidth * 2}
                      height={plotHeight}
                      fill="transparent"
                    />

                    <rect
                      x={cx - barWidth / 2}
                      y={cy}
                      width={barWidth}
                      height={barHeight}
                      rx="6"
                      ry="6"
                      fill={isHovered ? 'url(#barGradientActive)' : 'url(#barGradient)'}
                      filter="drop-shadow(0px 2px 4px rgba(22, 163, 74, 0.2))"
                    />

                    <text
                      x={cx}
                      y={cy - 19}
                      textAnchor="middle"
                      fill="#059669"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {p.orders} đơn
                    </text>
                    <text
                      x={cx}
                      y={cy - 6}
                      textAnchor="middle"
                      fill="#166534"
                      fontSize="11"
                      fontWeight="700"
                    >
                      {money(p.gmv)}
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {points.map((p, i) => {
            const cx = getX(i);
            const isHovered = hoveredPoint?.day === p.day;

            return (
              <g key={`axis-label-${p.day}`}>
                <text
                  x={cx}
                  y={paddingTop + plotHeight + 17}
                  textAnchor="middle"
                  fill={isHovered ? '#16a34a' : '#1e293b'}
                  fontSize="11"
                  fontWeight="650"
                >
                  {p.dayLabel}
                </text>
                <text
                  x={cx}
                  y={paddingTop + plotHeight + 31}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="9.5"
                  fontWeight="500"
                >
                  {p.weekdayLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredPoint && (
          <div
            className="admin-chart-tooltip"
            style={{
              left: `${(getX(points.findIndex((p) => p.day === hoveredPoint.day)) / svgWidth) * 100}%`,
              top: '10px',
            }}
          >
            <span className="tooltip-date">{hoveredPoint.fullDate}</span>
            <strong className="tooltip-amount">{money(hoveredPoint.gmv)}</strong>
            <span className="tooltip-orders">
              {hoveredPoint.orders} giao dịch hoàn tất
            </span>
          </div>
        )}
      </div>

    </div>
  );
}

function Overview({ onLogout }: Props) {
  const [dates, setDates] = useState(defaultPeriod);
  const [region, setRegion] = useState('');
  const [query, setQuery] = useState<Record<string, string>>(defaultPeriod);
  const [revision, setRevision] = useState(0);

  const { data, error, loading } = useAdminData<OverviewData>(
    '/admin/analytics',
    query,
    onLogout,
    revision,
  );

  const totalDailyGmv = data?.daily.reduce((sum, d) => sum + d.gmv, 0) || 0;
  const totalDailyOrders = data?.daily.reduce((sum, d) => sum + d.orders, 0) || 0;

  return (
    <div className="admin-overview-view">
      <Heading
        eyebrow="PLATFORM OVERVIEW"
        title="Toàn cảnh vận hành sàn B2B"
        description="Theo dõi dữ liệu giao dịch sỉ thời gian thực giữa chủ tiệm tạp hóa và nhà cung cấp chủ vựa."
        action={
          <button className="admin-refresh-btn" onClick={() => setRevision((n) => n + 1)}>
            ↻ Làm mới
          </button>
        }
      />

      <div className="admin-overview-toolbar">
        <form
          className="admin-filters admin-filters-inline"
          onSubmit={(e) => {
            e.preventDefault();
            const fallback = defaultPeriod();
            const from = dates.from || fallback.from;
            const to = dates.to || fallback.to;
            setQuery({ from, to, region });
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
      </div>

      <LoadState loading={loading} error={error} />

      {data && (
        <>
          <div className="admin-metrics">
            <Metric
              label="Tổng giá trị giao dịch (GMV)"
              value={money(data.gmv)}
              note="Doanh số đơn sỉ đã giao & hoàn tất"
            />
            <Metric
              label="Đơn hàng hoàn tất"
              value={`${data.completedOrders.toLocaleString('vi-VN')} đơn`}
              note="Giao dịch sỉ hoàn tất thành công"
            />
            <article className="admin-metric">
              <span>Mạng lưới đối tác sàn</span>
              <div className="admin-metric-dual">
                <div>
                  <strong>{data.users.STORE_OWNER || 0}</strong>
                  <small>Tiệm tạp hóa</small>
                </div>
                <div className="admin-metric-divider" />
                <div>
                  <strong>{data.users.SUPPLIER || 0}</strong>
                  <small>Chủ vựa</small>
                </div>
              </div>
              <small>Tài khoản đối tác đang hoạt động</small>
            </article>
            <article className="admin-metric">
              <span>Hồ sơ vựa chờ thẩm định</span>
              <strong className={data.pendingVerifications > 0 ? 'text-amber' : ''}>
                {data.pendingVerifications} hồ sơ
              </strong>
              <small>
                <NavLink to="/admin/verification" className="admin-link-accent">
                  Xem hồ sơ chờ duyệt →
                </NavLink>
              </small>
            </article>
          </div>

          <div className="admin-overview-split">
            <Panel
              title="Giá trị giao dịch theo ngày"
              note={
                data.daily.length > 0
                  ? `Dữ liệu giao dịch sỉ thời gian thực giữa Tạp Hóa & Chủ Vựa`
                  : undefined
              }
            >
              <DailyAnalyticsChart
                daily={data.daily}
                from={data.from}
                to={data.to}
                totalGmv={totalDailyGmv}
                totalOrders={totalDailyOrders}
              />
            </Panel>

            <Panel title="Tổng quan kết nối">
              <div className="admin-network">
                <div>
                  <Icon name="store" />
                  <span>
                    Chủ tiệm tạp hóa<strong>{data.users.STORE_OWNER || 0}</strong>
                  </span>
                </div>
                <div>
                  <Icon name="box" />
                  <span>
                    Chủ vựa cung ứng<strong>{data.users.SUPPLIER || 0}</strong>
                  </span>
                </div>
                <NavLink to="/admin/verification" className="admin-network-action">
                  <span>Hồ sơ vựa chờ thẩm định (KYC)</span>
                  <strong>{data.pendingVerifications} →</strong>
                </NavLink>
              </div>
              <div className="admin-network-footer">
                <small>Dữ liệu vận hành tự động đồng bộ theo múi giờ Việt Nam (UTC+7)</small>
              </div>
            </Panel>
          </div>

          {data.legacyOrders > 0 && (
            <p className="admin-note">
              Có {data.legacyOrders} đơn cũ chưa ghi nhận ngày giao. Các đơn này chưa được đưa vào
              báo cáo theo kỳ.
            </p>
          )}

          <Panel
            title="Giao dịch thực tế giữa Tạp hóa & Chủ vựa"
            note="Danh sách đơn đặt hàng sỉ trực tiếp giữa chủ tiệm tạp hóa và nhà cung cấp chủ vựa trong kỳ"
          >
            {data.transactions && data.transactions.length > 0 ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Tiệm tạp hóa (Người mua)</th>
                      <th>Chủ vựa (Nhà bán sỉ)</th>
                      <th>Quy mô</th>
                      <th>Giá trị giao dịch</th>
                      <th>Trạng thái</th>
                      <th>Thời gian giao dịch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <span className="admin-order-code">{tx.orderCode}</span>
                        </td>
                        <td>
                          <div className="admin-party-info">
                            <strong>{tx.buyerName}</strong>
                            {tx.buyerPhone && <small>{tx.buyerPhone}</small>}
                          </div>
                        </td>
                        <td>
                          <div className="admin-party-info">
                            <strong>{tx.supplierName}</strong>
                            {tx.region && tx.region !== '—' && (
                              <span className="admin-region-pill">{tx.region}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span>{tx.itemCount} sản phẩm</span>
                        </td>
                        <td className="admin-money">
                          <strong>{money(tx.subtotal || tx.total)}</strong>
                        </td>
                        <td>
                          <Badge status={tx.status} />
                        </td>
                        <td>
                          <span className="admin-tx-time">
                            {dateTime(tx.deliveredAt || tx.createdAt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-tx-empty">
                <Icon name="box" />
                <p>Chưa có giao dịch sỉ nào phát sinh giữa tạp hóa và chủ vựa trong khoảng thời gian này.</p>
                <small>Khi chủ tiệm tạp hóa đặt hàng từ chủ vựa, chi tiết giao dịch sẽ hiển thị tự động tại đây.</small>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}


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
            backgroundColor: '#FFF1F2',
            padding: '18px 24px',
            borderBottom: '1px solid #FFE4E6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                Kiểm tra điều kiện & xóa tài khoản
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#BE123C' }}>
                Người dùng: <strong>{user.name}</strong> (@{user.username} · #{user.id})
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            disabled={deleting}
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid #FECDD3',
              backgroundColor: '#FFFFFF',
              color: '#9F1239',
              fontSize: '20px',
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

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loadingCheck ? (
            <div
              style={{
                padding: '18px',
                borderRadius: '10px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                fontSize: '13.5px',
                color: '#475569',
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
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    backgroundColor: '#F8FAFC',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                    3 điều kiện bắt buộc trước khi xóa
                  </div>

                  {[
                    {
                      label: 'Đơn hàng đang xử lý',
                      ok: check.checks.ordersClear,
                      detail: check.checks.ordersClear
                        ? 'Đạt · 0 đơn mở'
                        : `Chưa đạt · Còn ${check.checks.openOrdersCount} đơn chưa hoàn tất/hủy`,
                    },
                    {
                      label: 'Khiếu nại / Tranh chấp',
                      ok: check.checks.complaintsClear,
                      detail: check.checks.complaintsClear
                        ? 'Đạt · 0 khiếu nại mở'
                        : `Chưa đạt · Còn ${check.checks.openComplaintsCount} khiếu nại đang xử lý`,
                    },
                    {
                      label: 'Số dư ví & yêu cầu nạp/rút',
                      ok: check.checks.walletClear,
                      detail: check.checks.walletClear
                        ? 'Đạt · Số dư 0 đ, không có lệnh nạp/rút chờ xử lý'
                        : `Chưa đạt · Số dư ${formatVnd(check.checks.walletBalance)}` +
                        (check.checks.walletHeldBalance !== 0
                          ? ` (tạm giữ ${formatVnd(check.checks.walletHeldBalance)})`
                          : '') +
                        (pendingMoneyRequests > 0
                          ? ` · ${pendingMoneyRequests} lệnh nạp/rút chờ xử lý`
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
                        padding: '8px 10px',
                        borderRadius: '8px',
                        backgroundColor: item.ok ? '#ECFDF5' : '#FEF2F2',
                        border: `1px solid ${item.ok ? '#A7F3D0' : '#FECACA'}`,
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: item.ok ? '#047857' : '#B91C1C',
                          textAlign: 'right',
                        }}
                      >
                        {item.detail}
                      </span>
                    </div>
                  ))}
                </div>

                {check.mode === 'SOFT' ? (
                  <div
                    style={{
                      backgroundColor: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      borderRadius: '10px',
                      padding: '12px 14px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '13px', color: '#92400E', lineHeight: 1.55 }}>
                      <strong>Xóa mềm (giữ lịch sử):</strong> Tài khoản bị khóa đăng nhập vĩnh viễn;
                      đơn hàng và sổ cái ví vẫn được giữ lại để đối soát.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '10px',
                      padding: '12px 14px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '13px', color: '#991B1B', lineHeight: 1.55 }}>
                      <strong>Xóa vĩnh viễn:</strong> Tài khoản chưa có giao dịch, dữ liệu sẽ bị xóa hoàn toàn
                      và có thể dùng lại tên đăng nhập, email, SĐT để đăng ký mới.
                    </p>
                  </div>
                )}

                {!check.canDelete && (
                  <div
                    style={{
                      backgroundColor: '#FFF7ED',
                      border: '1px solid #FED7AA',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      fontSize: '13px',
                      color: '#9A3412',
                      lineHeight: 1.55,
                    }}
                  >
                    <strong>Chưa thể xóa:</strong> Cần xử lý hết đơn mở, khiếu nại và đưa ví về 0 đ trước,
                    hoặc bấm <strong>Chuyển sang quản lý</strong> để khóa tài khoản.
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
            padding: '16px 24px',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            borderTop: '1px solid #E2E8F0',
          }}
        >
          {!loadingCheck && check && onSwitchToManage && (
            <button
              type="button"
              disabled={deleting}
              onClick={onSwitchToManage}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid #D97706',
                backgroundColor: '#FFFBEB',
                color: '#B45309',
                fontWeight: 600,
                fontSize: '14px',
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
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#E11D48',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '14px',
              opacity: loadingCheck || Boolean(checkError) || !check?.canDelete || deleting ? 0.5 : 1,
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
}: Props & { user: Account; onClose: () => void; onSaved: () => void }) {
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

function Verifications({ onLogout }: Props) {
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
              boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
            }}
          >
            Xác nhận
          </button>
        </div>
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
        />
        <Metric
          label="Mức tăng cao nhất"
          value={
            holidays.length
              ? `+${Math.max(...holidays.map((item) => (item.demandMultiplier - 1) * 100)).toLocaleString('vi-VN')}%`
              : '—'
          }
        />
        <Metric
          label="Thời gian chuẩn bị dài nhất"
          value={
            holidays.length
              ? `${Math.max(...holidays.map((item) => item.preparationDays))} ngày`
              : '—'
          }
        />
      </div>
      <LoadState loading={loading} error={error || actionError} />
      {!loading && data && (
        <Panel
          title="Lịch cấu hình của AI"
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
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
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
                        {item.startDate === item.endDate
                          ? new Date(item.endDate + 'T00:00:00').toLocaleDateString('vi-VN')
                          : `${new Date(item.startDate + 'T00:00:00').toLocaleDateString('vi-VN')} – ${new Date(item.endDate + 'T00:00:00').toLocaleDateString('vi-VN')}`}
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
                        <Badge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <button
                            className="admin-btn-edit"
                            disabled={deleting === item.id}
                            onClick={() => setSelected(item)}
                          >
                            Chỉnh sửa
                          </button>
                          <button
                            className="admin-btn-delete"
                            disabled={deleting !== null}
                            onClick={() => void remove(item)}
                          >
                            {deleting === item.id ? 'Đang xóa…' : 'Xóa'}
                          </button>
                        </div>
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
  const [isRange, setIsRange] = useState<boolean>(() =>
    holiday ? holiday.startDate !== holiday.endDate : false,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const payload = isRange ? form : { ...form, startDate: form.endDate };
    if (isRange && payload.startDate > payload.endDate) {
      setError('Ngày bắt đầu không được sau ngày kết thúc.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (holiday)
        await api.put(`/admin/holidays/${holiday.id}`, { ...payload, version: holiday.version });
      else await api.post('/admin/holidays', payload);
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
          <div className="admin-holiday-type-selector">
            <label>
              <input
                type="radio"
                name="holiday_range_type"
                checked={!isRange}
                onChange={() => {
                  setIsRange(false);
                  setForm((prev) => ({ ...prev, startDate: prev.endDate }));
                }}
              />
              <span>Lễ 1 ngày</span>
            </label>
            <label>
              <input
                type="radio"
                name="holiday_range_type"
                checked={isRange}
                onChange={() => setIsRange(true)}
              />
              <span>Kỳ nghỉ nhiều ngày (như Tết, 30/4 - 1/5)</span>
            </label>
          </div>
          {!isRange ? (
            <label>
              Ngày diễn ra lễ
              <DatePicker
                required
                value={form.endDate}
                onChange={(val) => setForm({ ...form, startDate: val, endDate: val })}
              />
            </label>
          ) : (
            <div className="admin-holiday-dates">
              <label>
                Từ ngày
                <DatePicker
                  required
                  value={form.startDate}
                  max={form.endDate}
                  onChange={(val) => setForm({ ...form, startDate: val })}
                />
              </label>
              <label>
                Đến ngày
                <DatePicker
                  required
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(val) => setForm({ ...form, endDate: val })}
                />
              </label>
            </div>
          )}
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
            />
            <Metric
              label="Lượt lỗi / dùng dự phòng"
              value={external
                .filter((g) => g.status === 'ERROR')
                .reduce((sum, g) => sum + g.count, 0)}
            />
            <Metric
              label="Lượt dự báo có đề xuất"
              value={data.recommendationRuns}
            />
            <Metric
              label="Tỷ lệ sử dụng đề xuất"
              value={data.acceptanceRate === null ? '—' : `${data.acceptanceRate}%`}
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
  DEPOSIT_REJECTED: 'Chủ vựa từ chối cọc',
  DEPOSIT_REFUNDED: 'Chủ vựa xác nhận hoàn cọc',
  ORDER_CREATED_FROM_QUOTE: 'Tạo đơn từ báo giá',
  ORDER_CREATED: 'Tạo đơn hàng',
  ORDER_STATUS_CHANGED: 'Cập nhật tiến độ đơn',
  SUBSCRIPTION_RENEWED: 'Gia hạn gói sử dụng',
  PERSONAL_PROFILE_UPDATED: 'Đổi thông tin cá nhân',
  PASSWORD_CHANGED: 'Đổi mật khẩu',
  PASSWORD_RESET: 'Khôi phục mật khẩu',
  ORDER_SETTLED_TO_SUPPLIER: 'Quyết toán tiền đơn hàng cho chủ vựa',
  ORDER_REFUNDED: 'Hoàn tiền đơn hàng',
  ORDER_PAID_WITH_WALLET: 'Thanh toán đơn hàng bằng ví',
  DEPOSIT_REQUESTED: 'Tạo yêu cầu nạp tiền',
  QR_DEPOSIT_REQUESTED: 'Tạo mã QR nạp tiền',
  QR_DEPOSIT_CONFIRMED: 'Xác nhận nạp tiền qua QR',
  SEPAY_WEBHOOK_DEPOSIT_CONFIRMED: 'Hệ thống SePay tự động nạp tiền',
  DEPOSIT_APPROVED: 'Duyệt yêu cầu nạp tiền',
  SANDBOX_DEPOSIT_CREATED: 'Nạp tiền thử nghiệm (Sandbox)',
  WITHDRAWAL_REQUESTED: 'Tạo yêu cầu rút tiền',
  WITHDRAWAL_APPROVED: 'Duyệt yêu cầu rút tiền',
  WITHDRAWAL_REJECTED: 'Từ chối yêu cầu rút tiền',
  WITHDRAWAL_COMPLETED: 'Hoàn tất chuyển khoản rút tiền',
  WITHDRAWAL_FAILED: 'Thất bại khi chuyển tiền rút',
  SANDBOX_WITHDRAWAL_CREATED: 'Rút tiền thử nghiệm (Sandbox)',
  SYSTEM_CONFIG_UPDATED: 'Cập nhật tham số sàn',
  SYSTEM_CONFIG_RESET: 'Khôi phục tham số mặc định',
  FORBIDDEN_KEYWORD_ADDED: 'Thêm từ khóa cấm',
  FORBIDDEN_KEYWORD_REMOVED: 'Xóa từ khóa cấm',
  RESTRICTED_KEYWORD_ADDED: 'Thêm từ khóa cảnh báo',
  RESTRICTED_KEYWORD_REMOVED: 'Xóa từ khóa cảnh báo',
  STOCK_MOVEMENT: 'Biến động tồn kho',
  INVENTORY_UPDATED: 'Cập nhật kho tiệm',
  INVENTORY_CREATED: 'Thêm hàng vào kho',
  INVENTORY_RECEIVED: 'Nhập hàng vào kho',
  INVENTORY_IMPORTED: 'Nhập hàng vào kho',
};

const entityLabels: Record<string, string> = {
  ORDER: 'Đơn hàng',
  SUBSCRIPTION: 'Gói sử dụng',
  USER: 'Tài khoản',
  SUPPLIER: 'Chủ vựa',
  PRODUCT: 'Sản phẩm',
  DEPOSIT_REQUEST: 'Yêu cầu nạp',
  WITHDRAWAL_REQUEST: 'Yêu cầu rút',
  SETTING: 'Tham số sàn',
  HOLIDAY: 'Lịch sự kiện',
  QUOTE: 'Báo giá',
  SYSTEM: 'Hệ thống',
  INVENTORY: 'Kho tiệm',
};

const fieldTranslations: Record<string, string> = {
  strictness: 'Mức kiểm duyệt',
  autoModerationEnabled: 'Tự động kiểm duyệt',
  forbiddenWordsCount: 'Số từ cấm',
  restrictedWordsCount: 'Số từ cảnh báo',
  defaultDepositRate: 'Tỷ lệ cọc mặc định',
  maxDepositRate: 'Tỷ lệ cọc tối đa',
  orderAutoCancelHours: 'Thời hạn tự hủy đơn',
  complaintWindowHours: 'Thời hạn khiếu nại',
  maxConsignmentItems: 'Sản phẩm ký gửi tối đa',
  minDepositAmount: 'Mức nạp tối thiểu',
  name: 'Tên',
  action: 'Hành động',
  status: 'Trạng thái',
  price: 'Giá',
  stock: 'Tồn kho',
  active: 'Hoạt động',
  packaging: 'Quy cách',
};

const valueTranslations: Record<string, string> = {
  true: 'Bật',
  false: 'Tắt',
  STANDARD: 'Tiêu chuẩn',
  STRICT: 'Nghiêm ngặt',
  LENIENT: 'Nới lỏng',
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngưng hoạt động',
  SUSPENDED: 'Tạm khóa',
  BANNED: 'Bị cấm',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

function formatLogSummary(details: Record<string, unknown>): ReactNode {
  if (!details || Object.keys(details).length === 0) {
    return <span className="text-muted">—</span>;
  }

  // 1. Quyết toán tiền đơn hàng
  if (details.amount !== undefined && details.grossAmount !== undefined) {
    const net = Number(details.amount) || 0;
    const gross = Number(details.grossAmount) || 0;
    const comm = Number(details.commissionAmount) || 0;
    return (
      <div className="admin-log-summary">
        <div>
          Thực nhận: <strong>{money(net)}</strong>
        </div>
        <small>
          Tổng đơn: {money(gross)} · Phí sàn: {money(comm)}
        </small>
      </div>
    );
  }

  // 2. Gói sử dụng / gia hạn / mở khóa
  if (details.periodEnd) {
    const amt = Number(details.amount) || 0;
    const methodStr = details.method === 'WALLET' ? 'Ví tiền' : details.method ? String(details.method) : '';
    const endDt = new Date(String(details.periodEnd)).toLocaleDateString('vi-VN');
    const rawReason = details.reason || details.note || details.adminNote;
    const reason = rawReason ? String(rawReason) : '';
    return (
      <div className="admin-log-summary">
        <div>
          {amt > 0 ? (
            <>
              <strong>{money(amt)}</strong>
              {methodStr && ` · ${methodStr}`}
            </>
          ) : (
            <strong>Gia hạn / Mở khóa</strong>
          )}
        </div>
        <small>Hạn dùng: {endDt}{reason ? ` · Lý do: ${reason}` : ''}</small>
      </div>
    );
  }

  // 3. Thay đổi cấu hình ngày lễ
  if (details.name && (details.startDate || details.endDate)) {
    return (
      <div className="admin-log-summary">
        <div>
          Sự kiện: <strong>{String(details.name)}</strong>
        </div>
        <small>Thời gian: {String(details.startDate || '')} → {String(details.endDate || '')}</small>
      </div>
    );
  }

  // 4. Biến động kho hàng (STOCK_MOVEMENT)
  if (details.type !== undefined && details.before !== undefined && details.after !== undefined) {
    const b = Number(details.before) || 0;
    const a = Number(details.after) || 0;
    const type = String(details.type);
    let title = `Tồn kho: ${b} → ${a}`;
    if (type === 'SALE') {
      title = `Bán lẻ: Tồn ${b} → Còn ${a}`;
    } else if (type === 'RECEIPT') {
      title = `Nhập kho: Tồn ${b} → Tăng lên ${a}`;
    } else if (type === 'ADJUSTMENT') {
      title = `Kiểm kê điều chỉnh: ${b} → ${a}`;
    } else if (type === 'EXPIRED_DISCARD') {
      title = `Hủy hàng hết hạn: Tồn ${b} → Còn ${a}`;
    }

    const price = details.unitSalePrice !== undefined && Number(details.unitSalePrice) > 0
      ? `Đơn giá: ${money(Number(details.unitSalePrice))}`
      : '';

    return (
      <div className="admin-log-summary">
        <div><strong>{title}</strong></div>
        {price && <small>{price}</small>}
      </div>
    );
  }

  // 5. Cập nhật thông tin hàng hóa kho tiệm (INVENTORY_UPDATED)
  if (details.before && details.after && typeof details.before === 'object' && typeof details.after === 'object') {
    const b = details.before as Record<string, unknown>;
    const a = details.after as Record<string, unknown>;

    const changes: string[] = [];
    if (a.name && b.name && a.name !== b.name) {
      changes.push(`Đổi tên: ${String(a.name)}`);
    }
    if (a.sellingPrice !== undefined && b.sellingPrice !== undefined && a.sellingPrice !== b.sellingPrice) {
      changes.push(`Giá bán: ${money(Number(b.sellingPrice) || 0)} → ${money(Number(a.sellingPrice) || 0)}`);
    }
    if (a.quantity !== undefined && b.quantity !== undefined && a.quantity !== b.quantity) {
      changes.push(`Tồn: ${b.quantity} → ${a.quantity} ${String(a.unit || b.unit || '')}`);
    }
    if (a.unit && b.unit && a.unit !== b.unit) {
      changes.push(`Đơn vị: ${String(b.unit)} → ${String(a.unit)}`);
    }

    if (changes.length > 0) {
      return (
        <div className="admin-log-summary">
          <div><strong>{changes[0]}</strong></div>
          {changes.length > 1 && <small>{changes.slice(1).join(' · ')}</small>}
        </div>
      );
    }

    const prodName = String(a.name || b.name || '');
    const priceStr = a.sellingPrice !== undefined ? `Giá: ${money(Number(a.sellingPrice) || 0)}` : '';
    const qtyStr = a.quantity !== undefined ? `Tồn: ${a.quantity} ${String(a.unit || b.unit || '')}` : '';
    return (
      <div className="admin-log-summary">
        <div>Cập nhật hàng: <strong>{prodName || 'Sản phẩm'}</strong></div>
        <small>{[priceStr, qtyStr].filter(Boolean).join(' · ')}</small>
      </div>
    );
  }

  // 6. Thêm hàng vào kho tiệm (INVENTORY_CREATED)
  if (details.name && details.sellingPrice !== undefined && details.quantity !== undefined) {
    return (
      <div className="admin-log-summary">
        <div>Thêm hàng: <strong>{String(details.name)}</strong></div>
        <small>Tồn ban đầu: {String(details.quantity)} · Giá bán: {money(Number(details.sellingPrice) || 0)}</small>
      </div>
    );
  }

  // 7. Nhập kho hàng tiệm (INVENTORY_RECEIVED)
  if (details.total !== undefined && details.quantity !== undefined) {
    return (
      <div className="admin-log-summary">
        <div>Nhập thêm: <strong>+{String(details.quantity)}</strong></div>
        <small>Tổng tồn sau nhập: {String(details.total)}{details.supplierName ? ` · Nguồn: ${String(details.supplierName)}` : ''}</small>
      </div>
    );
  }

  // 8. Thay đổi trạng thái (before -> after)
  if (details.before !== undefined && details.after !== undefined) {
    const rawReason = details.reason || details.note || details.adminNote;
    const reason = rawReason ? String(rawReason) : '';
    const beforeStr = typeof details.before === 'object' ? 'Dữ liệu cũ' : String(details.before);
    const afterStr = typeof details.after === 'object' ? 'Dữ liệu mới' : String(details.after);
    return (
      <div className="admin-log-summary">
        <div>
          <span>{beforeStr}</span>
          {' → '}
          <strong>{afterStr}</strong>
        </div>
        {reason ? <small>Lý do: {reason}</small> : null}
      </div>
    );
  }

  // 5. Giao dịch số tiền đơn lẻ
  if (details.amount !== undefined) {
    const amt = Number(details.amount) || 0;
    const methodStr = details.method === 'VIET_QR' ? 'VietQR' : details.method === 'BANK_TRANSFER' ? 'Chuyển khoản' : '';
    const rawNote = details.adminNote || details.reason || details.note;
    const note = rawNote ? String(rawNote) : '';
    return (
      <div className="admin-log-summary">
        <div>
          Số tiền: <strong>{money(amt)}</strong>
          {methodStr && ` · ${methodStr}`}
        </div>
        {note ? <small>Ghi chú: {note}</small> : null}
      </div>
    );
  }

  // 6. Cập nhật tham số sàn (SYSTEM_CONFIG_UPDATED)
  if (details.strictness !== undefined || details.autoModerationEnabled !== undefined) {
    const isAuto = details.autoModerationEnabled === true ? 'Bật' : 'Tắt';
    const strictMap: Record<string, string> = {
      STANDARD: 'Tiêu chuẩn',
      STRICT: 'Nghiêm ngặt',
      LENIENT: 'Nới lỏng',
    };
    const strictStr = strictMap[String(details.strictness)] || String(details.strictness || 'Tiêu chuẩn');
    const forbidden = details.forbiddenWordsCount !== undefined ? `${details.forbiddenWordsCount} từ cấm` : '';
    const deposit = details.defaultDepositRate !== undefined ? `Cọc: ${details.defaultDepositRate}%` : '';

    return (
      <div className="admin-log-summary">
        <div>
          Kiểm duyệt AI: <strong>{isAuto} ({strictStr})</strong>
        </div>
        <small>{[forbidden, deposit].filter(Boolean).join(' · ')}</small>
      </div>
    );
  }

  // 7. Khôi phục tham số mặc định
  if (details.action === 'RESET_TO_DEFAULT') {
    return (
      <div className="admin-log-summary">
        <strong>Khôi phục tham số mặc định</strong>
      </div>
    );
  }

  // 8. Thêm/xóa từ khóa hoặc cấu hình
  if (details.word) {
    return (
      <div className="admin-log-summary">
        <span>Từ khóa: <strong>{String(details.word)}</strong></span>
      </div>
    );
  }

  // Loại trừ các mã kỹ thuật nội bộ khỏi tóm tắt
  const technicalKeys = new Set([
    'userId',
    'actorId',
    'paymentId',
    'supplierUserId',
    'paymentCreated',
    'periodStart',
    'reference',
  ]);
  const friendlyEntries = Object.entries(details).filter(([k]) => !technicalKeys.has(k));
  if (friendlyEntries.length > 0) {
    return (
      <div className="admin-log-summary">
        <small>
          {friendlyEntries
            .slice(0, 3)
            .map(([k, v]) => {
              const label = fieldTranslations[k] || k;
              const valStr = valueTranslations[String(v)] || String(v);
              return `${label}: ${valStr}`;
            })
            .join(' · ')}
        </small>
      </div>
    );
  }

  return <span className="text-muted">—</span>;
}
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
                        {log.actor ? (
                          <>
                            <strong>{log.actor.name}</strong>
                            <small>@{log.actor.username}</small>
                          </>
                        ) : log.actorId ? (
                          <>
                            <strong>Tài khoản đã xóa</strong>
                            <small>#{log.actorId}</small>
                          </>
                        ) : (
                          <>
                            <strong>Hệ thống tự động</strong>
                            <small>Tác vụ nền</small>
                          </>
                        )}
                      </td>
                      <td>{actionLabels[log.action] || log.action}</td>
                      <td>
                        <strong>{entityLabels[log.entityType] || log.entityType}</strong>
                        {log.entityId && log.entityId !== 'SYSTEM' && <small> #{log.entityId}</small>}
                        {log.entityId === 'SYSTEM' && <small> (Hệ thống)</small>}
                      </td>
                      <td>{formatLogSummary(log.details)}</td>
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
  orderAndDelivery?: {
    orderAutoCancelHours?: number;
    complaintWindowHours?: number;
    deliveryAllowedStartHour?: number;
    deliveryAllowedEndHour?: number;
    autoCompleteDeliveredHours?: number;
    allowWeekendDelivery?: boolean;
  };
  consignment?: {
    maxConsignmentItemsPerStore?: number;
    settlementCycleDays?: number;
    allowConsignmentForUnverified?: boolean;
  };
  walletLimits?: {
    minDepositAmount?: number;
    minWithdrawalAmount?: number;
    maxDailyWithdrawalAmount?: number;
    autoApproveWithdrawalThreshold?: number;
  };
  systemNotice?: {
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
    maintenanceUntil?: string | null;
  };
  updatedAt: string;
  updatedBy: string | null;
};

type ConfigTabKey = 'all' | 'order' | 'escrow' | 'consignment' | 'wallet' | 'ai' | 'notice';

function AiSystemConfig({ onLogout }: Props) {
  const [revision, setRevision] = useState(0);
  const [configTab, setConfigTab] = useState<ConfigTabKey>('all');
  const { data, loading, error } = useAdminData<SystemConfig>(
    '/admin/system-config',
    {},
    onLogout,
    revision
  );

  const [draft, setDraft] = useState<{ source: SystemConfig; value: SystemConfig } | null>(null);
  const rawForm = draft && draft.source === data ? draft.value : (data ?? null);

  function setForm(update: SetStateAction<SystemConfig | null>) {
    setDraft((previous) => {
      const current = previous && previous.source === data ? previous.value : (data ?? null);
      const next = typeof update === 'function' ? update(current) : update;
      return next && data ? { source: data, value: next } : null;
    });
  }

  const [newForbiddenWord, setNewForbiddenWord] = useState('');
  const [forbiddenSearch, setForbiddenSearch] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(''), 4000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  if (loading && !rawForm) {
    return <LoadState loading={true} error="" />;
  }

  if (error && !rawForm) {
    return <LoadState loading={false} error={error} />;
  }

  if (!rawForm) return null;

  // Normalize with safe defaults
  const form: SystemConfig = {
    ...rawForm,
    orderAndDelivery: {
      orderAutoCancelHours: rawForm.orderAndDelivery?.orderAutoCancelHours ?? 4,
      complaintWindowHours: rawForm.orderAndDelivery?.complaintWindowHours ?? 24,
      deliveryAllowedStartHour: rawForm.orderAndDelivery?.deliveryAllowedStartHour ?? 5,
      deliveryAllowedEndHour: rawForm.orderAndDelivery?.deliveryAllowedEndHour ?? 21,
      autoCompleteDeliveredHours: rawForm.orderAndDelivery?.autoCompleteDeliveredHours ?? 48,
      allowWeekendDelivery: rawForm.orderAndDelivery?.allowWeekendDelivery ?? true,
    },
    consignment: {
      maxConsignmentItemsPerStore: rawForm.consignment?.maxConsignmentItemsPerStore ?? 5,
      settlementCycleDays: rawForm.consignment?.settlementCycleDays ?? 7,
      allowConsignmentForUnverified: rawForm.consignment?.allowConsignmentForUnverified ?? false,
    },
    walletLimits: {
      minDepositAmount: rawForm.walletLimits?.minDepositAmount ?? 50000,
      minWithdrawalAmount: rawForm.walletLimits?.minWithdrawalAmount ?? 100000,
      maxDailyWithdrawalAmount: rawForm.walletLimits?.maxDailyWithdrawalAmount ?? 50000000,
      autoApproveWithdrawalThreshold: rawForm.walletLimits?.autoApproveWithdrawalThreshold ?? 2000000,
    },
    systemNotice: {
      maintenanceMode: rawForm.systemNotice?.maintenanceMode ?? false,
      maintenanceMessage:
        rawForm.systemNotice?.maintenanceMessage ??
        'Hệ thống SupplyMind đang bảo trì nâng cấp hệ thống định kỳ. Quý khách vui lòng quay lại sau.',
      maintenanceUntil: rawForm.systemNotice?.maintenanceUntil ?? null,
    },
  };

  function handleAddForbidden() {
    const trimmed = newForbiddenWord.trim().toLowerCase();
    if (!trimmed) return;
    if (form.aiModeration.criticalForbiddenKeywords.includes(trimmed)) {
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
          criticalForbiddenKeywords: curr.aiModeration.criticalForbiddenKeywords.filter((w) => w !== word),
        },
      };
    });
  }

  async function handleSaveAll() {
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      await api.put('/admin/system-config', form);
      setSaveSuccess('Đã lưu toàn bộ cấu hình tham số sàn và chính sách vận hành thành công!');
      setRevision((n) => n + 1);
    } catch (e) {
      setSaveError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmReset() {
    setShowResetConfirm(false);
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      await api.post('/admin/system-config/reset');
      setSaveSuccess('Đã khôi phục toàn bộ cấu hình về mặc định ban đầu thành công!');
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

  return (
    <>
      <Heading
        eyebrow="SYSTEM CONFIGURATION & POLICIES"
        title="Cấu hình Tham số Sàn & Chính sách Vận hành"
        description="Trung tâm can thiệp và kiểm soát toàn diện: SLA giao nhận, tỷ lệ cọc ký quỹ Escrow, chính sách ký gửi tiếp thị, hạn mức ví nạp/rút, từ cấm kiểm duyệt AI và thông báo bảo trì toàn sàn."
        action={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
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
              {saving ? 'Đang lưu…' : 'Lưu toàn bộ cấu hình'}
            </button>
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="admin-metrics four" style={{ marginBottom: '18px' }}>
        <Metric
          label="SLA Tự Hủy Đơn Sỉ"
          value={`${form.orderAndDelivery?.orderAutoCancelHours} giờ`}
        />
        <Metric
          label="Ký quỹ Escrow Chuẩn"
          value={`${form.escrowDeposit.defaultDepositRate}%`}
        />
        <Metric
          label="Ký Gửi Tiếp Thị Tối Đa"
          value={`${form.consignment?.maxConsignmentItemsPerStore} mặt hàng`}
        />
        <Metric
          label="Duyệt Rút Tự Động"
          value={`${((form.walletLimits?.autoApproveWithdrawalThreshold || 0) / 1000000).toLocaleString('vi-VN')} tr ₫`}
        />
      </div>

      {/* Navigation Tabs for Configuration */}
      <div className="admin-config-tabs">
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'all' ? 'active' : ''}`}
          onClick={() => setConfigTab('all')}
        >
          Tất cả cấu hình
        </button>
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'order' ? 'active' : ''}`}
          onClick={() => setConfigTab('order')}
        >
          1. Đơn hàng & SLA giao hàng
        </button>
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'escrow' ? 'active' : ''}`}
          onClick={() => setConfigTab('escrow')}
        >
          2. Ký quỹ & Đặt cọc sỉ
        </button>
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'consignment' ? 'active' : ''}`}
          onClick={() => setConfigTab('consignment')}
        >
          3. Hàng ký gửi tiếp thị
        </button>
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'wallet' ? 'active' : ''}`}
          onClick={() => setConfigTab('wallet')}
        >
          4. Hạn mức Ví & Nạp rút
        </button>
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'ai' ? 'active' : ''}`}
          onClick={() => setConfigTab('ai')}
        >
          5. Kiểm duyệt AI & Từ cấm
        </button>
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'notice' ? 'active' : ''}`}
          onClick={() => setConfigTab('notice')}
        >
          6. Thông báo sàn & Bảo trì
        </button>
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
        {/* CARD 1: CẤU HÌNH ĐƠN HÀNG & SLA GIAO HÀNG */}
        {(configTab === 'all' || configTab === 'order') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label" style={{ color: '#0284c7' }}>SLA VẬN HÀNH & ĐƠN HÀNG</span>
              <h2>Chính sách Đặt hàng & SLA Giao hàng</h2>
              <p>
                Thiết lập giới hạn thời gian chủ vựa tiếp nhận đơn sỉ, thời hạn cho phép tiệm khiếu nại và khung giờ giao hàng trong ngày.
              </p>
            </div>

            <div className="admin-config-grid">
              <div className="admin-config-field">
                <label htmlFor="orderAutoCancelHours">Thời hạn vựa tiếp nhận đơn trước khi tự hủy (giờ)</label>
                <input
                  id="orderAutoCancelHours"
                  type="number"
                  min={1}
                  max={72}
                  value={form.orderAndDelivery?.orderAutoCancelHours}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      orderAndDelivery: {
                        ...form.orderAndDelivery,
                        orderAutoCancelHours: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="complaintWindowHours">Thời hạn khiếu nại sau khi nhận hàng (giờ)</label>
                <input
                  id="complaintWindowHours"
                  type="number"
                  min={1}
                  max={168}
                  value={form.orderAndDelivery?.complaintWindowHours}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      orderAndDelivery: {
                        ...form.orderAndDelivery,
                        complaintWindowHours: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="autoCompleteDeliveredHours">Thời hạn tự động hoàn tất đơn sau khi giao (giờ)</label>
                <input
                  id="autoCompleteDeliveredHours"
                  type="number"
                  min={12}
                  max={168}
                  value={form.orderAndDelivery?.autoCompleteDeliveredHours}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      orderAndDelivery: {
                        ...form.orderAndDelivery,
                        autoCompleteDeliveredHours: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label>Khung giờ giao hàng cho phép trong ngày</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    placeholder="Từ (giờ)"
                    style={{ width: '100px' }}
                    value={form.orderAndDelivery?.deliveryAllowedStartHour}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        orderAndDelivery: {
                          ...form.orderAndDelivery,
                          deliveryAllowedStartHour: Number(e.target.value),
                        },
                      })
                    }
                  />
                  <span>đến</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    placeholder="Đến (giờ)"
                    style={{ width: '100px' }}
                    value={form.orderAndDelivery?.deliveryAllowedEndHour}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        orderAndDelivery: {
                          ...form.orderAndDelivery,
                          deliveryAllowedEndHour: Number(e.target.value),
                        },
                      })
                    }
                  />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>giờ hàng ngày</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px' }} className="admin-config-toggle">
              <span>
                <strong>Cho phép chuyến xe giao hàng vào cuối tuần (Thứ Bảy & Chủ Nhật)</strong>
              </span>
              <input
                type="checkbox"
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                checked={form.orderAndDelivery?.allowWeekendDelivery}
                onChange={(e) =>
                  setForm({
                    ...form,
                    orderAndDelivery: {
                      ...form.orderAndDelivery,
                      allowWeekendDelivery: e.target.checked,
                    },
                  })
                }
              />
            </div>
          </section>
        )}

        {/* CARD 2: CẤU HÌNH PHẦN TRĂM KÝ QUỸ ESCROW */}
        {(configTab === 'all' || configTab === 'escrow') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label">CHÍNH SÁCH BẢO ĐẢM TÀI CHÍNH</span>
              <h2>Tỷ lệ phần trăm ký quỹ (Escrow Deposit Rate)</h2>
              <p>
                Admin điều chỉnh tỷ lệ phần trăm tiền cọc đảm bảo hợp đồng sỉ giữa tiệm tạp hóa và chủ vựa. Tiền cọc được tạm giữ an toàn trong hệ thống ký quỹ cho đến khi đơn hàng hoàn tất.
              </p>
            </div>

            <div className="admin-config-grid">
              <div className="admin-config-field">
                <label htmlFor="defaultDepositRate">Tỷ lệ cọc áp dụng cho báo giá mới (%)</label>
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
              </div>
            </div>
          </section>
        )}

        {/* CARD 3: CẤU HÌNH HÀNG KÝ GỬI TIẾP THỊ */}
        {(configTab === 'all' || configTab === 'consignment') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label" style={{ color: '#0d9488' }}>MÔ HÌNH HÀNG TIẾP THỊ 0Đ</span>
              <h2>Chính sách Hàng Ký Gửi & Bán Thử</h2>
              <p>
                Quản lý quy định đưa hàng vào bán thử tại tiệm tạp hóa không cần vốn nhập trước, hạn chế rủi ro nợ xấu và chu kỳ đối soát thanh toán.
              </p>
            </div>

            <div className="admin-config-grid">
              <div className="admin-config-field">
                <label htmlFor="maxConsignmentItemsPerStore">Số lượng mặt hàng ký gửi tối đa tại 1 tiệm</label>
                <input
                  id="maxConsignmentItemsPerStore"
                  type="number"
                  min={1}
                  max={50}
                  value={form.consignment?.maxConsignmentItemsPerStore}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      consignment: {
                        ...form.consignment,
                        maxConsignmentItemsPerStore: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="settlementCycleDays">Chu kỳ nhắc nhở đối soát định kỳ (ngày)</label>
                <input
                  id="settlementCycleDays"
                  type="number"
                  min={1}
                  max={60}
                  value={form.consignment?.settlementCycleDays}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      consignment: {
                        ...form.consignment,
                        settlementCycleDays: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </div>

            <div style={{ marginTop: '16px' }} className="admin-config-toggle">
              <span>
                <strong>Yêu cầu Chủ vựa phải hoàn tất Xác minh uy tín (Approved) mới được đưa hàng ký gửi</strong>
              </span>
              <input
                type="checkbox"
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                checked={!form.consignment?.allowConsignmentForUnverified}
                onChange={(e) =>
                  setForm({
                    ...form,
                    consignment: {
                      ...form.consignment,
                      allowConsignmentForUnverified: !e.target.checked,
                    },
                  })
                }
              />
            </div>
          </section>
        )}

        {/* CARD 4: CẤU HÌNH HẠN MỨC VÍ & NẠP RÚT */}
        {(configTab === 'all' || configTab === 'wallet') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label" style={{ color: '#7c3aed' }}>KIỂM SOÁT TÀI CHÍNH & VÍ ĐIỆN TỬ</span>
              <h2>Hạn mức Ví & Kiểm soát Nạp / Rút Tiền</h2>
              <p>
                Thiết lập hạn mức nạp rút tối thiểu, tối đa mỗi ngày và ngưỡng duyệt tự động nhằm phòng ngừa rủi ro chiếm đoạt ví và rửa tiền.
              </p>
            </div>

            <div className="admin-config-grid">
              <div className="admin-config-field">
                <label htmlFor="minDepositAmount">Số tiền nạp tối thiểu mỗi giao dịch (VNĐ)</label>
                <input
                  id="minDepositAmount"
                  type="number"
                  min={10000}
                  step={10000}
                  value={form.walletLimits?.minDepositAmount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      walletLimits: {
                        ...form.walletLimits,
                        minDepositAmount: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="minWithdrawalAmount">Số tiền rút tối thiểu mỗi giao dịch (VNĐ)</label>
                <input
                  id="minWithdrawalAmount"
                  type="number"
                  min={10000}
                  step={10000}
                  value={form.walletLimits?.minWithdrawalAmount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      walletLimits: {
                        ...form.walletLimits,
                        minWithdrawalAmount: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="maxDailyWithdrawalAmount">Hạn mức rút tiền tối đa mỗi ngày (VNĐ/tài khoản)</label>
                <input
                  id="maxDailyWithdrawalAmount"
                  type="number"
                  min={500000}
                  step={5000000}
                  value={form.walletLimits?.maxDailyWithdrawalAmount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      walletLimits: {
                        ...form.walletLimits,
                        maxDailyWithdrawalAmount: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="autoApproveWithdrawalThreshold">Ngưỡng tự động duyệt lệnh rút tiền (VNĐ)</label>
                <input
                  id="autoApproveWithdrawalThreshold"
                  type="number"
                  min={0}
                  step={500000}
                  value={form.walletLimits?.autoApproveWithdrawalThreshold}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      walletLimits: {
                        ...form.walletLimits,
                        autoApproveWithdrawalThreshold: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </div>
          </section>
        )}

        {/* CARD 5: CẤU HÌNH THÔNG BÁO SÀN & BẢO TRÌ */}
        {(configTab === 'all' || configTab === 'notice') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label" style={{ color: '#ea580c' }}>TRẠNG THÁI NỀN TẢNG</span>
              <h2>Chế độ Bảo trì Hệ thống</h2>
              <p>
                Kích hoạt chế độ bảo trì kỹ thuật toàn sàn và thiết lập thời gian kết thúc dự kiến để tự động mở lại.
              </p>
            </div>

            <div className="admin-config-toggle">
              <span>
                <strong>Bật chế độ bảo trì hệ thống toàn sàn (Maintenance Mode)</strong>
              </span>
              <input
                type="checkbox"
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                checked={form.systemNotice?.maintenanceMode}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm({
                    ...form,
                    systemNotice: {
                      ...form.systemNotice,
                      maintenanceMode: checked,
                      maintenanceUntil: checked
                        ? form.systemNotice?.maintenanceUntil || new Date(Date.now() + 60 * 60000).toISOString()
                        : null,
                    },
                  });
                }}
              />
            </div>

            {form.systemNotice?.maintenanceMode && (
              <>
                <div className="admin-config-field" style={{ marginBottom: '16px' }}>
                  <label htmlFor="maintenanceMessage">Lời nhắn thông báo bảo trì hiển thị cho người dùng</label>
                  <textarea
                    id="maintenanceMessage"
                    rows={3}
                    value={form.systemNotice?.maintenanceMessage}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        systemNotice: {
                          ...form.systemNotice,
                          maintenanceMessage: e.target.value,
                        },
                      })
                    }
                  />
                </div>

                <div
                  className="admin-config-field"
                  style={{
                    marginBottom: '20px',
                    padding: '14px 16px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <label
                    htmlFor="maintenanceUntil"
                    style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ⏰ Thời gian kết thúc bảo trì dự kiến (Tự động mở lại hệ thống sau mốc này)
                  </label>
                  <p style={{ margin: '4px 0 10px', fontSize: '12.5px', color: '#64748b' }}>
                    Chọn thời điểm trong tương lai. Màn hình bảo trì sẽ hiển thị bộ đếm ngược. Khi hết giờ, hệ thống sẽ tự động chuyển về trạng thái hoạt động bình thường mà không cần Admin phải tắt thủ công.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      id="maintenanceUntil"
                      type="datetime-local"
                      value={
                        form.systemNotice?.maintenanceUntil
                          ? new Date(new Date(form.systemNotice.maintenanceUntil).getTime() - new Date().getTimezoneOffset() * 60000)
                              .toISOString()
                              .slice(0, 16)
                          : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                        setForm({
                          ...form,
                          systemNotice: {
                            ...form.systemNotice,
                            maintenanceUntil: val,
                          },
                        });
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        maxWidth: '240px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[
                        { label: '+30 phút', mins: 30 },
                        { label: '+1 giờ', mins: 60 },
                        { label: '+2 giờ', mins: 120 },
                        { label: '+4 giờ', mins: 240 },
                      ].map((preset) => (
                        <button
                          key={preset.mins}
                          type="button"
                          onClick={() => {
                            const d = new Date(Date.now() + preset.mins * 60000);
                            setForm({
                              ...form,
                              systemNotice: {
                                ...form.systemNotice,
                                maintenanceUntil: d.toISOString(),
                              },
                            });
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            color: '#334155',
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                      {form.systemNotice?.maintenanceUntil && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              ...form,
                              systemNotice: {
                                ...form.systemNotice,
                                maintenanceUntil: null,
                              },
                            });
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: '#fee2e2',
                            border: '1px solid #fca5a5',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            color: '#b91c1c',
                          }}
                        >
                          ✕ Bỏ hẹn giờ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* CARD 6: CÀI ĐẶT THUẬT TOÁN & NGƯỠNG RỦI RO AI */}
        {(configTab === 'all' || configTab === 'ai') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label">QUY TẮC PHÁ GIÁ & SỐ LƯỢNG ẢO</span>
              <h2>Cài đặt Thuật toán AI & Ngưỡng Rủi ro</h2>
              <p>
                Điều chỉnh các ngưỡng giá tối thiểu/tối đa và số lượng MOQ để AI phát hiện kịp thời các hành vi phá giá, tạo đơn ảo hoặc số lượng phi thực tế.
              </p>
            </div>

            <div className="admin-config-toggle">
              <span>
                <strong>Kích hoạt tính năng AI kiểm duyệt tự động</strong>
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
              </div>
            </div>
          </section>
        )}

        {/* CARD 7: QUẢN LÝ TỪ CẤM NGHIÊM TRỌNG */}
        {(configTab === 'all' || configTab === 'ai') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label" style={{ color: '#b91c1c' }}>TỰ ĐỘNG CẤM ĐĂNG BÁN</span>
              <h2>Quản lý Danh sách Từ cấm Nghiêm trọng</h2>
              <p>
                Khi sản phẩm có chứa bất kỳ từ cấm nào bên dưới (trong tên, danh mục, quy cách hoặc mô tả), AI sẽ ngay lập tức từ chối và cấm đăng bán thẳng để bảo vệ an toàn sàn.
              </p>
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
        )}

        {/* BOTTOM ACTION BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '14px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
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

      {/* MODAL XÁC NHẬN KHÔI PHỤC MẶC ĐỊNH (THAY THẾ WINDOW.CONFIRM BROWSER DIALOG) */}
      {showResetConfirm && (
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
            if (e.target === e.currentTarget && !saving) setShowResetConfirm(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0',
            }}
          >
            <div
              style={{
                padding: '18px 24px 14px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>
                Xác nhận khôi phục mặc định
              </h3>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={saving}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '22px',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: '0 0 14px 0', fontSize: '14px', color: '#334155', lineHeight: 1.55 }}>
                Bạn có chắc chắn muốn khôi phục toàn bộ tham số sàn và chính sách vận hành về giá trị mặc định ban đầu?
              </p>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  color: '#92400E',
                  lineHeight: 1.5,
                }}
              >
                <strong>Lưu ý:</strong> Toàn bộ các thông số SLA giao hàng, tỷ lệ ký quỹ Escrow, hạn mức ví nạp/rút và cấu hình từ cấm AI sẽ được thiết lập lại về cấu hình gốc của hệ thống.
              </div>
            </div>

            <div
              style={{
                padding: '16px 24px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={saving}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={saving}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                }}
              >
                {saving ? 'Đang khôi phục…' : 'Xác nhận khôi phục'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
