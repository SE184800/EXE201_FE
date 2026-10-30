import { useEffect } from 'react';
import '../catalog.css';
import SupplierLayout from '../../components/SupplierLayout';
import WalletPage from '../WalletPage';
import { logout } from '../../services/auth.api';
import type { AuthUser } from '../../types/auth';

export default function SupplierWallet({
  user,
  onLogout,
}: {
  user?: AuthUser;
  onLogout: () => void;
}) {
  useEffect(() => {
    document.title = 'SupplyMind AI · Ví & Ký quỹ chủ vựa';
  }, []);

  async function handleLogout() {
    try {
      await logout();
      onLogout();
    } catch {
      onLogout();
    }
  }

  return (
    <SupplierLayout
      user={user || ({ id: 0, username: 'chuvua', name: 'Chủ vựa', role: 'SUPPLIER' } as AuthUser)}
      activeNav="wallet"
      onLogout={handleLogout}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <WalletPage onLogout={onLogout} />
      </div>
    </SupplierLayout>
  );
}
