import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/login/LoginPage';
import RegisterPage from './pages/register/RegisterPage';
import WorkspacePage from './pages/WorkspacePage';
import SupplierDashboard from './pages/supplier/SupplierDashboard';
import SupplierProducts from './pages/supplier/SupplierProducts';
<<<<<<< Updated upstream
import Brand from './components/Brand';
import AdminPage from './pages/admin/AdminPage';
=======
>>>>>>> Stashed changes
import { getMe } from './services/auth.api';
import { ROLE_DETAILS, type AuthUser } from './types/auth';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
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
      });
    return () => {
      active = false;
    };
  }, []);

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
        <Route path="/supplier/products" element={user?.role === 'SUPPLIER' ? <SupplierProducts onLogout={clearUser} /> : <Navigate to={destination} replace />} />
        {Object.entries(ROLE_DETAILS).map(([role, details]) => (
          <Route
            key={role}
            path={role === 'STORE_OWNER' ? '/store/*' : role === 'ADMIN' ? '/admin/*' : details.path}
            element={
              user && user.role === role ? (
                role === 'SUPPLIER' ? <SupplierDashboard user={user} onLogout={clearUser} /> : role === 'ADMIN' ? <AdminPage user={user} onLogout={clearUser} /> : <WorkspacePage user={user} onLogout={clearUser} />
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
