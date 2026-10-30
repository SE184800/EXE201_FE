import { useEffect } from 'react';
import '../catalog.css';
import SupplierLayout from '../../components/SupplierLayout';
import WalletPage from '../wallet/WalletPage';
import type { AuthUser } from '../../types/auth';

export default function SupplierWallet({
  user,
  onLogout,
}: {
  user?: AuthUser;
  onLogout: () => void;
}) {
  useEffect(() => {
    document.title = 'SupplyMind AI · Ví tiền chủ vựa';
  }, []);

  return (
    <SupplierLayout
      user={user || ({ id: 0, username: 'chuvua', name: 'Chủ vựa', role: 'SUPPLIER' } as AuthUser)}
      activeNav="wallet"
      onLogout={onLogout}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '32px' }}>
        <WalletPage onLogout={onLogout} role="SUPPLIER" />
      </div>
    </SupplierLayout>
  );
}
