import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Brand from './Brand';
import Icon from './Icon';
import TopbarBalance from './TopbarBalance';
import type { AuthUser } from '../types/auth';
import { api } from '../services/api';
import '../pages/store-inventory.css';

export type SupplierTab =
  | 'dashboard'
  | 'products'
  | 'quotes'
  | 'orders'
  | 'inventory'
  | 'wallet'
  | 'profile'
  | 'subscription';

interface SupplierLayoutProps {
  user: AuthUser;
  onLogout: () => void;
  activeNav: SupplierTab;
  pageTitle?: string;
  businessName?: string;
  children: React.ReactNode;
}

const supplierTabs = [
  { id: 'dashboard', label: 'Tổng quan', path: '/supplier', icon: 'store' as const },
  { id: 'products', label: 'Sản phẩm đăng bán', path: '/supplier/products', icon: 'box' as const },
  { id: 'quotes', label: 'Báo giá tiếp thị', path: '/supplier/quotes', icon: 'sparkle' as const },
  { id: 'orders', label: 'Đơn hàng', path: '/supplier/orders', icon: 'check' as const },
  { id: 'inventory', label: 'Kho hàng', path: '/supplier/inventory', icon: 'box' as const },
  { id: 'wallet', label: 'Ví & Ký quỹ', path: '/supplier/wallet', icon: 'sparkle' as const },
] as const;

export default function SupplierLayout({
  user,
  onLogout,
  activeNav,
  pageTitle,
  businessName,
  children,
}: SupplierLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const mobileMenu = useRef<HTMLElement>(null);
  const accountMenu = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);

  const [shopName, setShopName] = useState(businessName || 'Gian hàng sỉ của bạn');

  useEffect(() => {
    if (businessName) {
      setShopName(businessName);
      return;
    }
    let active = true;
    api
      .get<{ profile: { supplierProfile?: { businessName?: string } } }>('/profile')
      .then(({ data }) => {
        if (active && data?.profile?.supplierProfile?.businessName) {
          setShopName(data.profile.supplierProfile.businessName);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [businessName]);

  useEffect(() => {
    if (!accountOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenu.current?.contains(event.target)) {
        setAccountOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        accountTrigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [mobileMenuOpen]);

  const currentTab = supplierTabs.find((t) => t.id === activeNav);
  const currentTitle =
    pageTitle ||
    currentTab?.label ||
    (activeNav === 'profile' ? 'Thông tin cá nhân' : activeNav === 'subscription' ? 'Gói sử dụng' : 'Chủ vựa');
  const displayName = user.name || user.username || 'Chủ vựa';

  return (
    <main className="store-dashboard">
      <aside
        ref={mobileMenu}
        className={`store-sidebar${mobileMenuOpen ? ' mobile-menu-open' : ''}`}
      >
        <div className="sidebar-mobile-row">
          <button
            type="button"
            className="mobile-menu-toggle"
            aria-label={mobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-expanded={mobileMenuOpen}
            aria-controls="supplier-mobile-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="sidebar-brand">
            <Brand />
            <span>WHOLESALE WORKSPACE</span>
          </div>
        </div>

        <div className="sidebar-shop">
          <span className="shop-symbol">
            <Icon name="store" />
          </span>
          <div>
            <strong>{shopName}</strong>
            <small>Không gian chủ vựa</small>
          </div>
          <span className="online-dot" />
        </div>

        <p className="nav-caption">QUẢN LÝ GIAN HÀNG</p>
        <nav id="supplier-mobile-navigation" aria-label="Điều hướng chủ vựa">
          {supplierTabs.map((tab) => (
            <Link
              key={tab.id}
              to={tab.path}
              aria-current={activeNav === tab.id ? 'page' : undefined}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-tip">
          <span className="tip-icon">
            <Icon name="sparkle" />
          </span>
          <strong>
            Kênh sỉ thông minh.
            <br />
            Phủ sóng tạp hóa.
          </strong>
          <p>Đưa nguồn hàng tươi ngon, giá sỉ tốt đến hàng trăm tiệm tạp hóa.</p>
        </div>

        <div className="sidebar-bottom">
          <span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{displayName}</strong>
            <small>Chủ vựa sỉ</small>
          </div>
          <button
            aria-label="Đăng xuất"
            title="Đăng xuất"
            onClick={onLogout}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Đóng menu điều hướng"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="store-main">
        <header className="store-topbar">
          <div>
            <span className="breadcrumb">Không gian làm việc</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{currentTitle}</strong>
          </div>
          <div className="topbar-right">
            <TopbarBalance linkTo="/supplier/wallet" />
            <span className="today-label">
              {new Date().toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
            <div
              className="account-dropdown"
              ref={accountMenu}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);
              }}
            >
              <button
                ref={accountTrigger}
                className="topbar-account account-trigger"
                aria-expanded={accountOpen}
                aria-controls="supplier-account-options"
                onClick={() => setAccountOpen(!accountOpen)}
              >
                <span className="account-avatar">{displayName.slice(0, 1).toUpperCase()}</span>
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
                  >
                    <Icon name="logout" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dashboard-content" style={{ padding: '24px 38px' }}>
          {children}
        </div>
      </div>
    </main>
  );
}
