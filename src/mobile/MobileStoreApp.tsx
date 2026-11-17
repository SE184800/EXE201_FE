import { useCallback, useEffect, useState } from 'react';
import { Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { api, getApiError, isUnauthenticated } from '../services/api';
import type { AuthUser } from '../types/auth';
import Icon from '../components/Icon';
import OrderList from '../components/OrderList';
import WalletPage from '../pages/wallet/WalletPage';
import ProfilePage from '../pages/ProfilePage';
import SubscriptionPage from '../pages/SubscriptionPage';
import MobileQuickSale from './MobileQuickSale';
import { normalizeSaleText, type SaleItem } from './quickSale';
import './mobile-store.css';
const notifications = registerPlugin<{ open(): Promise<void> }>('SupplyMindNotifications');
const tabs = [
  { id: 'quick-sale', name: 'Bán nhanh', icon: 'sparkle' },
  { id: 'inventory', name: 'Kho hàng', icon: 'box' },
  { id: 'orders', name: 'Đơn hàng', icon: 'check' },
  { id: 'wallet', name: 'Ví', icon: 'chart' },
] as const;

export default function MobileStoreApp({
  user,
  onLogout,
  onSignOut,
  signingOut,
}: {
  user: AuthUser;
  onLogout: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const { '*': route = '' } = useParams();
  const navigate = useNavigate();
  const active = route || 'quick-sale';
  const [items, setItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<{ items: SaleItem[] }>('/inventory');
      if (!Array.isArray(data.items)) throw Error('Dữ liệu kho không hợp lệ');
      setItems(data.items);
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      setError(getApiError(issue));
      throw issue;
    } finally {
      setLoading(false);
    }
  }, [onLogout]);
  useEffect(() => {
    const controller = new AbortController();
    void api
      .get<{ items: SaleItem[] }>('/inventory', { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data.items)) throw Error('Dữ liệu kho không hợp lệ');
        if (!controller.signal.aborted) setItems(data.items);
      })
      .catch((issue) => {
        if (controller.signal.aborted) return;
        if (isUnauthenticated(issue)) onLogout();
        setError(getApiError(issue));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [onLogout]);
  useEffect(() => {
    document.body.classList.add('mobile-store-active');
    return () => document.body.classList.remove('mobile-store-active');
  }, []);
  useEffect(() => {
    document.title = `${tabs.find((tab) => tab.id === active)?.name || 'Tài khoản'} · SupplyMind`;
    window.scrollTo(0, 0);
  }, [active]);
  const visible = items.filter(
    (item) =>
      normalizeSaleText(item.name).includes(normalizeSaleText(search)) &&
      (filter === 'all' ||
        (filter === 'low' && item.quantity <= (item.lowThreshold ?? 5)) ||
        (filter === 'expiry' && item.daysUntilExpiry != null && item.daysUntilExpiry <= 15)),
  );
  if (!tabs.some((tab) => tab.id === active) && !['profile', 'subscription'].includes(active))
    return <Navigate to="/store/quick-sale" replace />;
  return (
    <main className="mobile-store-app">
      <header className="mobile-app-header">
        <div>
          <span className="mobile-brand-mark" aria-hidden="true">
            S
          </span>
          <div>
            <strong>
              SupplyMind<span> AI</span>
            </strong>
            <small>{user.name || user.username}</small>
          </div>
        </div>
        <div className="mobile-header-actions">
          <button
            aria-label="Thông báo"
            onClick={() => {
              if (Capacitor.isNativePlatform())
                void notifications.open().catch(() => setError('Chưa mở được cài đặt thông báo.'));
              else setError('Cài đặt thông báo hệ thống có trong bản APK.');
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
            </svg>
          </button>
          <button
            aria-label="Tài khoản"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(!accountOpen)}
          >
            <Icon name="user" />
          </button>
        </div>
      </header>
      {accountOpen && (
        <section className="mobile-account-panel" aria-label="Tài khoản">
          <strong>@{user.username}</strong>
          <button
            onClick={() => {
              setAccountOpen(false);
              navigate('/store/profile');
            }}
          >
            Thông tin tài khoản
          </button>
          <button
            onClick={() => {
              setAccountOpen(false);
              navigate('/store/subscription');
            }}
          >
            Gói sử dụng
          </button>
          <button disabled={signingOut} onClick={onSignOut}>
            {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </section>
      )}
      <div className="mobile-app-content">
        {error && (
          <div className="mobile-sale-message" role="alert">
            {error}
            <button onClick={() => void refresh().catch(() => {})}>Thử lại</button>
          </div>
        )}
        {active === 'quick-sale' && (
          <MobileQuickSale
            key={user.id}
            ownerId={user.id}
            items={items}
            loading={loading}
            onRefresh={refresh}
            onLogout={onLogout}
          />
        )}
        {active === 'inventory' && (
          <section aria-label="Kho hàng">
            <div className="mobile-sale-intro">
              <span>HÀNG HÓA CỦA BẠN</span>
              <h1>Kho hàng</h1>
              <p>Xem số tồn và hạn sử dụng trước khi bán.</p>
            </div>
            <div className="mobile-stock-summary">
              <div>
                <strong>{items.length}</strong>
                <span>Mặt hàng</span>
              </div>
              <div>
                <strong>
                  {items.filter((item) => item.quantity <= (item.lowThreshold ?? 5)).length}
                </strong>
                <span>Cần bổ sung</span>
              </div>
              <div>
                <strong>
                  {
                    items.filter(
                      (item) => item.daysUntilExpiry != null && item.daysUntilExpiry <= 15,
                    ).length
                  }
                </strong>
                <span>Lưu ý hạn dùng</span>
              </div>
            </div>
            <label className="mobile-search">
              <span>Tìm trong kho</span>
              <input
                type="search"
                placeholder="Nhập tên mặt hàng…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="mobile-stock-filters">
              {[
                ['all', 'Tất cả'],
                ['low', 'Sắp hết'],
                ['expiry', 'Hạn sử dụng'],
              ].map(([id, label]) => (
                <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
              <button disabled={loading} onClick={() => void refresh().catch(() => {})}>
                {loading ? 'Đang tải…' : 'Tải lại'}
              </button>
            </div>
            {!loading && !visible.length && (
              <p className="mobile-empty">Không có mặt hàng phù hợp.</p>
            )}
            <div className="mobile-stock-list">
              {visible.map((item) => (
                <article key={item.id}>
                  <div>
                    <h2>{item.name}</h2>
                    <span>
                      {item.sellingPrice != null
                        ? item.sellingPrice.toLocaleString('vi-VN') + ' ₫ / ' + item.unit
                        : 'Chưa có giá bán'}
                    </span>
                    <small
                      className={
                        item.daysUntilExpiry != null && item.daysUntilExpiry <= 15
                          ? 'expiry-warning'
                          : ''
                      }
                    >
                      {item.expiryDate
                        ? `HSD: ${item.expiryDate.slice(0, 10).split('-').reverse().join('/')}`
                        : 'Chưa có hạn sử dụng'}
                    </small>
                  </div>
                  <div>
                    <strong>{item.quantity}</strong>
                    <span>{item.unit}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {active === 'orders' && (
          <OrderList kind="store" onLogout={onLogout} onInventoryChanged={refresh} />
        )}
        {active === 'wallet' && <WalletPage role="STORE_OWNER" onLogout={onLogout} />}
        {active === 'profile' && <ProfilePage onLogout={onLogout} onSaved={() => {}} />}
        {active === 'subscription' && <SubscriptionPage role="STORE_OWNER" onLogout={onLogout} />}
      </div>
      <nav className="mobile-app-nav" aria-label="Chức năng chính">
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            to={`/store/${tab.id}`}
            onClick={() => setAccountOpen(false)}
            className={active === tab.id ? 'selected' : ''}
          >
            <Icon name={tab.icon} />
            <span>{tab.name}</span>
          </NavLink>
        ))}
      </nav>
    </main>
  );
}
