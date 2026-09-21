import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/login/LoginPage';
import RegisterPage from './pages/register/RegisterPage';
import WorkspacePage from './pages/WorkspacePage';
import SupplierDashboard from './pages/supplier/SupplierDashboard';
import Brand from './components/Brand';
import { getMe } from './services/auth.api';
import { getApiError, isUnauthenticated } from './services/api';
import { ROLE_DETAILS, type AuthUser } from './types/auth';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const clearUser = useCallback(() => setUser(null), []);

  useEffect(() => {
    let active = true;
    getMe()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((issue: unknown) => {
        if (active && !isUnauthenticated(issue)) setError(getApiError(issue));
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (checking || error)
    return (
      <main className="session-screen">
        <Brand />
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="primary-button"
              onClick={() => {
                setError('');
                setChecking(true);
                setAttempt(attempt + 1);
              }}
            >
              Kết nối lại
            </button>
            <button className="text-button" onClick={() => setError('')}>
              Về trang đăng nhập
            </button>
          </>
        ) : (
          <p role="status">Đang kiểm tra phiên đăng nhập…</p>
        )}
      </main>
    );
  const destination = user ? ROLE_DETAILS[user.role].path : '/login';
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
        {Object.entries(ROLE_DETAILS).map(([role, details]) => (
          <Route
            key={role}
            path={details.path}
            element={
              user && user.role === role ? (
                role === 'SUPPLIER' ? <SupplierDashboard user={user} onLogout={clearUser} /> : <WorkspacePage user={user} onLogout={clearUser} />
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
