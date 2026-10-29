import { useState } from 'react';
import SupplierHeader from '../../components/SupplierHeader';
import ProfilePage from '../ProfilePage';
import type { AuthUser } from '../../types/auth';

export default function SupplierProfilePage({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const [currentUser, setCurrentUser] = useState(user);
  const [loggingOut, setLoggingOut] = useState(false);

  function handleLogout() {
    setLoggingOut(true);
    try {
      onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="supplier-page" style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <SupplierHeader
        user={currentUser}
        activeNav="profile"
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
        <ProfilePage
          onSaved={(newName) => {
            setCurrentUser((prev) => ({ ...prev, name: newName }));
          }}
          onLogout={onLogout}
        />
      </main>
    </div>
  );
}
