import { useEffect, useState } from 'react';
import {
  getWallet,
  getWalletTransactions,
  addMockFunds,
  resetMockBalance,
  type WalletInfo,
  type WalletTransaction,
} from '../services/wallet.api';
import { getApiError, isUnauthenticated } from '../services/api';
import Icon from '../components/Icon';
import './wallet.css';

const money = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

const TYPE_LABELS: Record<string, { label: string; class: string }> = {
  INITIAL_MOCK: { label: 'Khởi tạo thử nghiệm', class: 'tag-info' },
  MOCK_ADD: { label: 'Cộng tiền thử nghiệm', class: 'tag-success' },
  MOCK_RESET: { label: 'Đặt lại thử nghiệm', class: 'tag-warning' },
  ESCROW_LOCK: { label: 'Tạm khóa cọc đơn', class: 'tag-danger' },
  ESCROW_RELEASE: { label: 'Giải phóng cọc', class: 'tag-info' },
  ESCROW_RECEIVED: { label: 'Nhận cọc đơn hàng', class: 'tag-success' },
  ESCROW_REFUND: { label: 'Hoàn trả cọc', class: 'tag-success' },
  PENALTY_CONFISCATION: { label: 'Tịch thu phạt cọc', class: 'tag-danger' },
  COMPENSATION_RECEIVED: { label: 'Nhận bồi thường', class: 'tag-success' },
};

export default function WalletPage({ onLogout }: { onLogout: () => void }) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadWalletData();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function loadWalletData() {
    setLoading(true);
    setError('');
    try {
      const [walletRes, txRes] = await Promise.all([
        getWallet(),
        getWalletTransactions(1, 30),
      ]);
      setWallet(walletRes);
      setTransactions(txRes.transactions);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMockFunds(amount = 5000000) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await addMockFunds(amount);
      setWallet(res.wallet);
      setNotice(res.message);
      const txRes = await getWalletTransactions(1, 30);
      setTransactions(txRes.transactions);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setBusy(false);
    }
  }

  async function handleResetMockBalance() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await resetMockBalance();
      setWallet(res.wallet);
      setNotice(res.message);
      const txRes = await getWalletTransactions(1, 30);
      setTransactions(txRes.transactions);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wallet-page" aria-label="Ví tiền và Ký quỹ hệ thống">
      <div className="catalog-hero wallet-hero">
        <div>
          <p className="form-eyebrow">TÀI CHÍNH & KÝ QUỸ AN TOÀN</p>
          <h1>Ví tiền & Ký quỹ hệ thống SupplyMind</h1>
          <p>
            Quản lý số dư khả dụng, tiền cọc đơn hàng đang được bảo hộ và kiểm tra lịch sử biến động số dư.
          </p>
        </div>
        <Icon name="sparkle" />
      </div>

      {notice && (
        <p className="supplier-success" role="status">
          {notice}
        </p>
      )}

      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}

      {/* Wallet Balance Cards */}
      <div className="wallet-grid">
        <div className="wallet-card wallet-card-primary">
          <span className="wallet-card-title">Số dư khả dụng</span>
          <strong className="wallet-card-amount">
            {loading ? 'Đang tải…' : wallet ? money(wallet.availableBalance) : '0 ₫'}
          </strong>
          <span className="wallet-card-desc">Dùng để đặt cọc cam kết đơn hàng sỉ</span>
        </div>

        <div className="wallet-card wallet-card-locked">
          <span className="wallet-card-title">Đang ký quỹ (Tạm giữ)</span>
          <strong className="wallet-card-amount">
            {loading ? 'Đang tải…' : wallet ? money(wallet.lockedBalance) : '0 ₫'}
          </strong>
          <span className="wallet-card-desc">Bảo đảm các đơn đang giao / tranh chấp</span>
        </div>

        <div className="wallet-card wallet-card-total">
          <span className="wallet-card-title">Tổng số dư hệ thống</span>
          <strong className="wallet-card-amount">
            {loading ? 'Đang tải…' : wallet ? money(wallet.totalBalance) : '0 ₫'}
          </strong>
          <span className="wallet-card-desc">Khả dụng + Đang ký quỹ</span>
        </div>
      </div>

      {/* Mock Testing Simulator Controls */}
      <div className="supplier-panel wallet-mock-panel">
        <div className="mock-panel-header">
          <div>
            <h3>Chế độ thử nghiệm tiền hệ thống</h3>
            <p className="form-description">
              Hệ thống đã tự động cấp sẵn <strong>10.000.000 ₫ mô phỏng</strong> để bạn kiểm tra đầy đủ luồng đặt cọc 10%, duyệt đơn và giải phóng cọc mà không cần nạp tiền thật.
            </p>
          </div>
          <div className="mock-panel-actions">
            <button
              className="dash-primary"
              disabled={busy}
              onClick={() => handleAddMockFunds(5000000)}
            >
              <Icon name="sparkle" />
              {busy ? 'Đang nạp…' : '+ Nạp 5.000.000 ₫ thử nghiệm'}
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={handleResetMockBalance}
            >
              {busy ? 'Đang xử lý…' : '↺ Đặt lại 10.000.000 ₫'}
            </button>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="supplier-panel wallet-transactions-panel">
        <div className="transactions-header">
          <h3>Lịch sử biến động số dư</h3>
          <button className="text-button" onClick={loadWalletData} disabled={loading || busy}>
            Làm mới
          </button>
        </div>

        {transactions.length === 0 ? (
          <p className="empty-text">Chưa có giao dịch biến động số dư nào.</p>
        ) : (
          <div className="table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Loại giao dịch</th>
                  <th>Số tiền</th>
                  <th>Số dư sau GD</th>
                  <th>Nội dung</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const meta = TYPE_LABELS[tx.type] || { label: tx.type, class: 'tag-info' };
                  const isPositive = tx.amount > 0;
                  const isZero = tx.amount === 0;
                  return (
                    <tr key={tx.id}>
                      <td className="tx-time">
                        {new Date(tx.createdAt).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <span className={`tx-tag ${meta.class}`}>{meta.label}</span>
                      </td>
                      <td className={`tx-amount ${isPositive ? 'positive' : isZero ? 'neutral' : 'negative'}`}>
                        {isPositive ? `+${money(tx.amount)}` : isZero ? '0 ₫' : `-${money(Math.abs(tx.amount))}`}
                      </td>
                      <td className="tx-balance">{money(tx.balanceAfter)}</td>
                      <td className="tx-desc">{tx.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
