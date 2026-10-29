import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../catalog.css';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import TopbarBalance from '../../components/TopbarBalance';
import SupplierHeader from '../../components/SupplierHeader';
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'SupplyMind AI · Ví & Ký quỹ chủ vựa';
  }, []);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      onLogout();
    } catch {
      onLogout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="supplier-page">
      {user ? (
        <SupplierHeader
          user={user}
          activeNav="wallet"
          onLogout={handleLogout}
          loggingOut={busy}
        />
      ) : (
        <header className="supplier-header">
          <Brand />
          <div className="supplier-header-actions">
            <TopbarBalance linkTo="/supplier/wallet" />
            <button className="secondary-button" onClick={handleLogout} disabled={busy}>
              <Icon name="logout" /> Đăng xuất
            </button>
          </div>
        </header>
      )}

      <section className="supplier-main">
        <nav className="catalog-nav" aria-label="Chủ vựa">
          <Link to="/supplier">Tổng quan</Link>
          <Link to="/supplier/products">Sản phẩm đăng bán</Link>
          <Link to="/supplier/quotes">Báo giá tiếp thị</Link>
          <Link to="/supplier/orders">Đơn hàng</Link>
          <Link to="/supplier/inventory">Kho hàng</Link>
          <Link to="/supplier/wallet" aria-current="page">
            Ví & Ký quỹ
          </Link>
          <Link to="/supplier/subscription">Gói sử dụng</Link>
        </nav>

        <WalletPage onLogout={onLogout} />
      </section>
    </main>
  );
}
