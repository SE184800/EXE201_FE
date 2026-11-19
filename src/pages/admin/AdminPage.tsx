import { useEffect, useState } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import NotificationBell from '../../components/NotificationBell';
import { getApiError } from '../../services/api';
import { logout } from '../../services/auth.api';
import type { AuthUser } from '../../types/auth';
import type { AdminTabProps, NavGroup } from './admin.types';

// Admin Subpage Modules
import AdminOverview from './AdminOverview';
import AdminUsers from './AdminUsers';
import AdminVerifications from './AdminVerifications';
import AdminDisputes from './AdminDisputes';
import AdminWalletSection, { type AdminWalletTab } from './AdminWalletPage';
import AdminFinance from './AdminFinance';
import AdminHolidays from './AdminHolidays';
import AdminAiMonitoring from './AdminAiMonitoring';
import AdminSystemConfig from './AdminSystemConfig';
import AdminAuditLog from './AdminAuditLog';

import './admin.css';

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

export default function AdminPage({ user, onLogout }: AdminTabProps & { user: AuthUser }) {
  const tab = useParams()['*'] || '';
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'SupplyMind AI · Quản trị nền tảng';
  }, []);

  if (!navigation.some((item) => item.path === tab) && !(tab in walletTabs) && tab !== 'finance') {
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
            <AdminOverview onLogout={onLogout} />
          ) : tab === 'users' ? (
            <AdminUsers onLogout={onLogout} />
          ) : tab === 'verification' ? (
            <AdminVerifications onLogout={onLogout} />
          ) : tab === 'disputes' ? (
            <AdminDisputes onLogout={onLogout} />
          ) : tab === 'finance' ? (
            <AdminFinance onLogout={onLogout} />
          ) : tab in walletTabs ? (
            <AdminWalletSection tab={walletTabs[tab]} onLogout={onLogout} />
          ) : tab === 'holidays' ? (
            <AdminHolidays onLogout={onLogout} />
          ) : tab === 'ai' ? (
            <AdminAiMonitoring onLogout={onLogout} />
          ) : tab === 'ai-config' ? (
            <AdminSystemConfig onLogout={onLogout} />
          ) : (
            <AdminAuditLog onLogout={onLogout} />
          )}
        </div>
        <footer className="admin-footer">
          SupplyMind AI · Dữ liệu vận hành toàn sàn · Múi giờ Việt Nam (UTC+7)
        </footer>
      </main>
    </div>
  );
}
