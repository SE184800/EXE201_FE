import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Brand from './Brand';
import Icon from './Icon';
import TopbarBalance from './TopbarBalance';
import type { AuthUser } from '../types/auth';
import './SupplierHeader.css';

type SupplierHeaderProps = {
  user: AuthUser;
  activeNav?: 'dashboard' | 'products' | 'quotes' | 'orders' | 'inventory' | 'wallet' | 'profile' | 'subscription';
  onLogout: () => void;
  loggingOut?: boolean;
};

export default function SupplierHeader({
  user,
  activeNav,
  onLogout,
  loggingOut = false,
}: SupplierHeaderProps) {
  const location = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const [tabsOpen, setTabsOpen] = useState(false);
  const accountMenu = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const tabsMenu = useRef<HTMLDivElement>(null);
  const tabsTrigger = useRef<HTMLButtonElement>(null);

  const currentPath = location.pathname;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountMenu.current && !accountMenu.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
      if (tabsMenu.current && !tabsMenu.current.contains(event.target as Node)) {
        setTabsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (accountOpen) {
          setAccountOpen(false);
          accountTrigger.current?.focus();
        }
        if (tabsOpen) {
          setTabsOpen(false);
          tabsTrigger.current?.focus();
        }
      }
    }
    if (accountOpen || tabsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountOpen, tabsOpen]);

  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', path: '/supplier', icon: 'store' as const },
    { id: 'products', label: 'Sản phẩm đăng bán', path: '/supplier/products', icon: 'box' as const },
    { id: 'quotes', label: 'Báo giá tiếp thị', path: '/supplier/quotes', icon: 'sparkle' as const },
    { id: 'orders', label: 'Đơn hàng', path: '/supplier/orders', icon: 'check' as const },
    { id: 'inventory', label: 'Kho hàng', path: '/supplier/inventory', icon: 'box' as const },
    { id: 'wallet', label: 'Ví & Ký quỹ', path: '/supplier/wallet', icon: 'sparkle' as const },
  ];

  const activeItem =
    navItems.find((item) =>
      activeNav
        ? activeNav === item.id
        : (item.path === '/supplier' ? currentPath === '/supplier' : currentPath.startsWith(item.path)),
    ) || navItems[0];

  const displayName = user.name || user.username || 'Chủ vựa';
  const avatarLetter = displayName.slice(0, 1).toUpperCase();

  return (
    <header className="supplier-header">
      <div className="supplier-header-left">
        <Brand />

        {/* Tab Dropdown List Navigation */}
        <div className="supplier-tabs-dropdown" ref={tabsMenu}>
          <button
            ref={tabsTrigger}
            type="button"
            className="supplier-tabs-trigger"
            aria-expanded={tabsOpen}
            aria-controls="supplier-tabs-options"
            onClick={() => setTabsOpen(!tabsOpen)}
          >
            <Icon name={activeItem.icon} />
            <span className="supplier-tabs-current">{activeItem.label}</span>
            <svg
              className={`chevron-icon ${tabsOpen ? 'is-open' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {tabsOpen && (
            <div id="supplier-tabs-options" className="supplier-tabs-options">
              <div className="supplier-tabs-caption">DANH MỤC TRANG CHỦ VỰA</div>
              {navItems.map((item) => {
                const isActive = activeItem.id === item.id;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`supplier-tab-option ${isActive ? 'active' : ''}`}
                    onClick={() => setTabsOpen(false)}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                    {isActive && <span className="active-dot" />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Nav Links for wide screens */}
        <nav className="supplier-header-nav" aria-label="Điều hướng chủ vựa">
          {navItems.map((item) => {
            const isActive = activeNav
              ? activeNav === item.id
              : (item.path === '/supplier' ? currentPath === '/supplier' : currentPath.startsWith(item.path));
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`supplier-nav-link ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="supplier-header-right">
        <TopbarBalance linkTo="/supplier/wallet" />

        <div
          className="account-dropdown"
          ref={accountMenu}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);
          }}
        >
          <button
            ref={accountTrigger}
            type="button"
            className="account-trigger"
            aria-expanded={accountOpen}
            aria-controls="supplier-account-options"
            onClick={() => setAccountOpen(!accountOpen)}
          >
            <span className="account-avatar">{avatarLetter}</span>
            <span className="account-name">@{user.username}</span>
            <svg
              className={`chevron-icon ${accountOpen ? 'is-open' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {accountOpen && (
            <div id="supplier-account-options" className="account-options">
              <div className="account-options-user-info">
                <span className="account-options-user-name">{displayName}</span>
                <span className="account-options-user-role">Chủ vựa sỉ</span>
              </div>

              <Link
                to="/supplier/profile"
                onClick={() => setAccountOpen(false)}
              >
                <Icon name="user" />
                Thông tin cá nhân
              </Link>

              <Link
                to="/supplier/subscription"
                onClick={() => setAccountOpen(false)}
              >
                <Icon name="shield" />
                Gói sử dụng
              </Link>

              <button
                type="button"
                className="account-signout"
                onClick={() => {
                  setAccountOpen(false);
                  onLogout();
                }}
                disabled={loggingOut}
              >
                <Icon name="logout" />
                {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
