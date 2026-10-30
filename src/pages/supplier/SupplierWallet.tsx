import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../catalog.css';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
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
    <main className="supplier-page">
      <header className="supplier-header">
        <Brand />
        <div className="supplier-header-actions">
          {user && (
            <span>
              <strong>{user.name}</strong>
              <small>Chủ vựa / Đại lý bỏ mối</small>
            </span>
          )}
          <Link className="ghost-button catalog-link" to="/supplier">
            ← Tổng quan chủ vựa
          </Link>
          <button className="secondary-button" onClick={onLogout}>
            <Icon name="logout" /> Đăng xuất
          </button>
        </div>
      </header>
      <section className="supplier-main">
        <nav className="catalog-nav" aria-label="Chủ vựa">
          <Link to="/supplier">Tổng quan</Link>
          <Link to="/supplier/products">Sản phẩm đăng bán</Link>
          <Link to="/supplier/quotes">Báo giá tiếp thị</Link>
          <Link to="/supplier/orders">Đơn hàng</Link>
          <Link to="/supplier/inventory">Kho hàng</Link>
          <Link to="/supplier/wallet" aria-current="page">
            Ví tiền
          </Link>
          <Link to="/supplier/subscription">Gói sử dụng</Link>
        </nav>
        <div className="supplier-heading">
          <div>
            <p className="form-eyebrow">QUẢN LÝ VÍ TIỀN</p>
            <h1>Ví tiền của bạn</h1>
            <p className="form-description">
              Nạp tiền, rút tiền và theo dõi tiền nhận được từ các đơn hàng của cửa hàng.
            </p>
          </div>
        </div>
        <WalletPage onLogout={onLogout} role="SUPPLIER" />
      </section>
    </main>
  );
}
