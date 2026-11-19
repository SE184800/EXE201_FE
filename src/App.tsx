import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/landing/LandingPage';
import LoginPage from './pages/login/LoginPage';
import RegisterPage from './pages/register/RegisterPage';
import WorkspacePage from './pages/WorkspacePage';
import SupplierDashboard from './pages/supplier/SupplierDashboard';
import SupplierProducts from './pages/supplier/SupplierProducts';
import SupplierOrders from './pages/supplier/SupplierOrders';
import SupplierInventory from './pages/supplier/SupplierInventory';
import SupplierQuotes from './pages/supplier/SupplierQuotes';
import SupplierWallet from './pages/supplier/SupplierWallet';
import SupplierRevenue from './pages/supplier/SupplierRevenue';
import AdminPage from './pages/admin/AdminPage';
import SubscriptionPage from './pages/SubscriptionPage';
import SupplierProfilePage from './pages/supplier/SupplierProfilePage';
import ContractKeyPage from './pages/ContractKeyPage';
import { getMe, logout } from './services/auth.api';
import { ROLE_DETAILS, type AuthUser } from './types/auth';
import { isMobileApp } from './mobile/platform';
import SystemNoticeBanner from './components/SystemNoticeBanner';
import UnverifiedToast from './components/UnverifiedToast';


function LogoutToast() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    function checkLogoutNotice() {
      try {
        if (sessionStorage.getItem('idle_logged_out')) {
          sessionStorage.removeItem('idle_logged_out');
          setNotice('Phiên đăng nhập đã kết thúc sau 15 phút không hoạt động để bảo mật thông tin.');
        } else if (sessionStorage.getItem('maintenance_logged_out')) {
          sessionStorage.removeItem('maintenance_logged_out');
          setNotice('Hệ thống đang bảo trì kỹ thuật. Phiên đăng nhập đã được tự động kết thúc để đảm bảo an toàn.');
        } else if (sessionStorage.getItem('just_logged_out')) {
          sessionStorage.removeItem('just_logged_out');
          setNotice('Đã đăng xuất thành công. Hẹn gặp lại bạn!');
        }
      } catch {
        // ignore
      }
    }

    checkLogoutNotice();
    window.addEventListener('app:logged_out', checkLogoutNotice);
    return () => {
      window.removeEventListener('app:logged_out', checkLogoutNotice);
    };
  }, []);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  if (!notice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 99999,
        backgroundColor: notice.includes('15 phút') ? '#d97706' : '#10B981',
        color: '#FFFFFF',
        padding: '12px 20px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontWeight: 600,
        fontSize: '14px',
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          fontSize: '12px',
        }}
      >
        OK
      </span>
      <span>{notice}</span>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const isSessionActive = () =>
    isMobileApp() ||
    sessionStorage.getItem('supplymind_active_tab') === 'true' ||
    localStorage.getItem('supplymind_active_tab') === 'true';

  const [checkingSession, setCheckingSession] = useState(isSessionActive);

  const handleSetUser = useCallback((u: AuthUser | null) => {
    if (u) {
      sessionStorage.setItem('supplymind_active_tab', 'true');
      localStorage.setItem('supplymind_active_tab', 'true');
    } else {
      sessionStorage.removeItem('supplymind_active_tab');
      localStorage.removeItem('supplymind_active_tab');
    }
    setUser(u);
  }, []);

  const clearUser = useCallback(() => {
    sessionStorage.removeItem('supplymind_active_tab');
    localStorage.removeItem('supplymind_active_tab');
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    if (!isSessionActive()) {
      return;
    }

    getMe()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        sessionStorage.removeItem('supplymind_active_tab');
        localStorage.removeItem('supplymind_active_tab');
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Tự động đăng xuất sau 15 phút không có thao tác để đảm bảo bảo mật
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_MS = 15 * 60 * 1000;
    let timer: NodeJS.Timeout;

    const onTimeout = async () => {
      try {
        sessionStorage.removeItem('supplymind_active_tab');
        sessionStorage.setItem('idle_logged_out', 'true');
        await logout();
      } catch {
        // ignore
      } finally {
        setUser(null);
      }
    };

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(onTimeout, INACTIVITY_MS);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [user]);

  const destination = user ? (isMobileApp() && user.role === 'STORE_OWNER' ? '/store/quick-sale' : ROLE_DETAILS[user.role].path) : (isMobileApp() ? '/login' : '/');
  // Keep protected deep links while /me restores the session; login stays usable
  // immediately even when a cold server is waking up.
  const restoreSession = (
    <main className="session-screen">
      <p role="status">Đang khôi phục phiên đăng nhập…</p>
      <Link to="/login">Về trang đăng nhập</Link>
    </main>
  );
  return (
    <BrowserRouter>
      <SystemNoticeBanner user={user} onLogout={clearUser} />
      <LogoutToast />
      <UnverifiedToast />
      <Routes>
        <Route
          path="/"
          element={isMobileApp() ? (checkingSession ? restoreSession : <Navigate to={destination} replace />) : <LandingPage user={user} onLogout={clearUser} />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to={destination} replace /> : <LoginPage onLogin={handleSetUser} />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to={destination} replace /> : <RegisterPage />}
        />
        <Route path="/contract-key" element={<ContractKeyPage />} />
        <Route
          path="/supplier/inventory"
          element={
            user?.role === 'SUPPLIER' ? (
              <SupplierInventory user={user} onLogout={clearUser} />
            ) : checkingSession && !user ? (
              restoreSession
            ) : (
              <Navigate to={destination} replace />
            )
          }
        />
        <Route
          path="/supplier/products"
          element={
            user?.role === 'SUPPLIER' ? (
              <SupplierProducts user={user} onLogout={clearUser} />
            ) : checkingSession && !user ? (
              restoreSession
            ) : (
              <Navigate to={destination} replace />
            )
          }
        />
        <Route
          path="/supplier/quotes"
          element={
            user?.role === 'SUPPLIER' ? (
              <SupplierQuotes user={user} onLogout={clearUser} />
            ) : checkingSession && !user ? (
              restoreSession
            ) : (
              <Navigate to={destination} replace />
            )
          }
        />
        <Route
          path="/supplier/wallet"
          element={
            user?.role === 'SUPPLIER' ? (
              <SupplierWallet user={user} onLogout={clearUser} />
            ) : checkingSession && !user ? (
              restoreSession
            ) : (
              <Navigate to={destination} replace />
            )
          }
        />
        <Route
          path="/supplier/profile"
          element={
            user?.role === 'SUPPLIER' ? (
              <SupplierProfilePage user={user} onLogout={clearUser} />
            ) : checkingSession && !user ? (
              restoreSession
            ) : (
              <Navigate to={destination} replace />
            )
          }
        />
        <Route
          path="/supplier/subscription"
          element={
            user?.role === 'SUPPLIER' ? (
              <SubscriptionPage role="SUPPLIER" user={user} onLogout={clearUser} />
            ) : checkingSession && !user ? (
              restoreSession
            ) : (
              <Navigate to={destination} replace />
            )
          }
        />
        <Route
          path="/supplier/wallet"
          element={
            user?.role === 'SUPPLIER' ? (
              <SupplierWallet user={user} onLogout={clearUser} />
            ) : checkingSession && !user ? (
              restoreSession
            ) : (
              <Navigate to={destination} replace />
            )
          }
        />
        <Route
          path="/supplier/orders"
          element={
            user?.role === 'SUPPLIER' ? (
              <SupplierOrders user={user} onLogout={clearUser} />
            ) : checkingSession && !user ? (
              restoreSession
            ) : (
              <Navigate to={destination} replace />
            )
          }
        />
        <Route
          path="/supplier/revenue"
          element={
            user?.role === 'SUPPLIER' ? (
              <SupplierRevenue user={user} onLogout={clearUser} />
            ) : checkingSession && !user ? (
              restoreSession
            ) : (
              <Navigate to={destination} replace />
            )
          }
        />
        {Object.entries(ROLE_DETAILS).map(([role, details]) => (
          <Route
            key={role}
            path={
              role === 'STORE_OWNER' ? '/store/*' : role === 'ADMIN' ? '/admin/*' : details.path
            }
            element={
              user && user.role === role ? (
                role === 'SUPPLIER' ? (
                  <SupplierDashboard user={user} onLogout={clearUser} />
                ) : role === 'ADMIN' ? (
                  <AdminPage user={user} onLogout={clearUser} />
                ) : (
                  <WorkspacePage user={user} onLogout={clearUser} />
                )
              ) : checkingSession && !user ? (
                restoreSession
              ) : (
                <Navigate to={destination} replace />
              )
            }
          />
        ))}
        <Route path="*" element={<Navigate to={destination} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
