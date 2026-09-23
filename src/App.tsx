import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/login/LoginPage';
import RegisterPage from './pages/register/RegisterPage';
import WorkspacePage from './pages/WorkspacePage';
import SupplierDashboard from './pages/supplier/SupplierDashboard';
import SupplierProducts from './pages/supplier/SupplierProducts';
import AdminPage from './pages/admin/AdminPage';
import { getMe } from './services/auth.api';
import { ROLE_DETAILS, type AuthUser } from './types/auth';

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
      .finally(() => { if (active) setCheckingSession(false); });
    return () => {
      active = false;
    };
  }, []);

  const destination = user ? ROLE_DETAILS[user.role].path : '/login';
  // Keep protected deep links while /me restores the session; login stays usable
  // immediately even when a cold server is waking up.
  const restoreSession = <main className="session-screen"><p role="status">Đang khôi phục phiên đăng nhập…</p><Link to="/login">Về trang đăng nhập</Link></main>;
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={destination} replace />
            ) : (
              <LoginPage onLogin={setUser} />
            )
          }
        />
        <Route path="/register" element={user ? <Navigate to={destination} replace /> : <RegisterPage />} />
        <Route path="/supplier/products" element={user?.role === 'SUPPLIER' ? <SupplierProducts onLogout={clearUser} /> : checkingSession && !user ? restoreSession : <Navigate to={destination} replace />} />
        {Object.entries(ROLE_DETAILS).map(([role, details]) => (
          <Route
            key={role}
            path={role === 'STORE_OWNER' ? '/store/*' : role === 'ADMIN' ? '/admin/*' : details.path}
            element={
              user && user.role === role ? (
                role === 'SUPPLIER' ? <SupplierDashboard user={user} onLogout={clearUser} /> : role === 'ADMIN' ? <AdminPage user={user} onLogout={clearUser} /> : <WorkspacePage user={user} onLogout={clearUser} />
              ) : (
                checkingSession && !user ? restoreSession : <Navigate to={destination} replace />
              )
            }
          />
        ))}
        <Route path="*" element={<Navigate to={destination} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
