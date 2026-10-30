import { useState } from 'react';
import SupplierLayout from '../../components/SupplierLayout';
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

  return (
    <SupplierLayout
      user={currentUser}
      activeNav="profile"
      onLogout={onLogout}
      pageTitle="Thông tin cá nhân & Gian hàng"
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <ProfilePage
          onSaved={(newName) => {
            setCurrentUser((prev) => ({ ...prev, name: newName }));
          }}
          onLogout={onLogout}
        />
      </div>
    </SupplierLayout>
  );
}
