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
import AdminPage from './pages/admin/AdminPage';
import SubscriptionPage from './pages/SubscriptionPage';
import SupplierProfilePage from './pages/supplier/SupplierProfilePage';
import { getMe } from './services/auth.api';
import { ROLE_DETAILS, type AuthUser } from './types/auth';


function LogoutToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function checkLogoutNotice() {
      try {
        if (sessionStorage.getItem('just_logged_out')) {
          sessionStorage.removeItem('just_logged_out');
          setShow(true);
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
    if (show) {
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 99999,
        backgroundColor: '#10B981',
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
      <span>Đã đăng xuất thành công. Hẹn gặp lại bạn!</span>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const clearUser = useCallback(() => setUser(null), []);

  useEffect(() => {
    let active = true;
    getMe()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        // A failed probe must not hide the login screen while a cold database
        // or a serverless function is waking up.
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const destination = user ? ROLE_DETAILS[user.role].path : '/';
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
      <LogoutToast />
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to={destination} replace /> : <LandingPage />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to={destination} replace /> : <LoginPage onLogin={setUser} />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to={destination} replace /> : <RegisterPage />}
        />
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
