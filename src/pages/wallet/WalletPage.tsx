import { useCallback, useEffect, useState, type FormEvent } from 'react';
import '../catalog.css';
import './wallet.css';
import Icon from '../../components/Icon';
import { getApiError, isUnauthenticated } from '../../services/api';
import {
  confirmQrDeposit,
  createQrDepositRequest,
  createSandboxDepositRequest,
  createSandboxWithdrawalRequest,
  getDepositRequests,
  getQrConfig,
  getWallet,
  getWalletPayments,
  getWalletTransactions,
  getWithdrawalRequests,
  type DepositRequest,
  type OrderPayment,
  type QrCode,
  type QrConfig,
  type WalletOverview,
  type WalletTransaction,
  type WithdrawalRequest,
} from '../../services/wallet.api';
import WalletQrCode from './WalletQrCode';
import { dateTime, money } from './walletFormat';

type Tab = 'overview' | 'deposit' | 'withdraw' | 'transactions' | 'payments';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan ví' },
  { id: 'deposit', label: 'Nạp tiền' },
  { id: 'withdraw', label: 'Rút tiền' },
  { id: 'transactions', label: 'Lịch sử giao dịch' },
  { id: 'payments', label: 'Thanh toán đơn hàng' },
];

const TRANSACTION_LABELS: Record<string, string> = {
  DEPOSIT: 'Nạp tiền',
  WITHDRAWAL_HOLD: 'Giữ tiền rút',
  WITHDRAWAL_RELEASE: 'Hoàn lại tiền rút',
  WITHDRAWAL_PAYOUT: 'Chuyển khoản rút tiền',
  ORDER_PAYMENT: 'Thanh toán đơn hàng',
  ORDER_RECEIVE: 'Nhận tiền đơn hàng',
  REFUND: 'Hoàn tiền',
  REFUND_RECEIVED: 'Thu hồi tiền hoàn',
  SANDBOX_DEPOSIT: 'Nạp tiền ảo',
  SANDBOX_WITHDRAWAL: 'Rút tiền ảo',
  QR_DEPOSIT: 'Nạp tiền qua QR',
};

export default function WalletPage({
  onLogout,
  role,
}: {
  onLogout: () => void;
  role: 'STORE_OWNER' | 'SUPPLIER';
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [depositForm, setDepositForm] = useState({
    amount: '',
    note: '',
  });
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    note: '',
  });
  const [formError, setFormError] = useState('');
  const [qrConfig, setQrConfig] = useState<QrConfig | null>(null);
  const [qr, setQr] = useState<QrCode | null>(null);
  const [qrTicketId, setQrTicketId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wallet, ledger, depositList, withdrawalList, paymentList] = await Promise.all([
        getWallet(),
        getWalletTransactions({ page: 1 }),
        getDepositRequests({ page: 1 }),
        getWithdrawalRequests({ page: 1 }),
        getWalletPayments({ page: 1, scope: role === 'SUPPLIER' ? 'SUPPLIER' : 'BUYER' }),
      ]);
      setOverview(wallet);
      setTransactions(ledger.transactions);
      setDeposits(depositList.requests);
      setWithdrawals(withdrawalList.requests);
      setPayments(paymentList.payments);
      setError('');
    } catch (issue) {
      if (isUnauthenticated(issue)) return onLogout();
      setError(getApiError(issue));
    } finally {
      setLoading(false);
    }
  }, [onLogout, role]);

  useEffect(() => {
    document.title = 'SupplyMind AI · Ví tiền';
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // The QR account lives on the server so it can be rotated without a rebuild.
  useEffect(() => {
    let active = true;
    getQrConfig()
      .then(config => {
        if (active) setQrConfig(config);
      })
      .catch(() => {
        if (active) setQrConfig(null);
      });
    return () => {
      active = false;
    };
  }, []);

  /** Builds a QR ticket for the entered amount so the user can scan and pay. */
  async function createQr() {
    setFormError('');
    const amount = Number(depositForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Nhập số tiền lớn hơn 0.');
      return;
    }
    setBusy(true);
    try {
      const result = await createQrDepositRequest({
        amount,
        note: depositForm.note.trim() || undefined,
      });
      setQr(result.qr);
      setQrTicketId(result.request.id);
      setNotice('Đã tạo mã QR. Quét mã bằng ứng dụng ngân hàng rồi bấm "Tôi đã chuyển khoản".');
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setFormError(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

  /** Confirms the transfer and credits the wallet. */
  async function confirmQrTransfer() {
    if (qrTicketId === null) return;
    setBusy(true);
    setFormError('');
    try {
      const request = await confirmQrDeposit(qrTicketId);
      setQr(null);
      setQrTicketId(null);
      setDepositForm({ amount: '', note: '' });
      setNotice(`Đã nạp ${money(request.amount)} vào ví. Số dư được cập nhật ngay lập tức.`);
      await load();
      setTab('deposit');
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setFormError(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

  async function submitDeposit() {
    setFormError('');
    const amount = Number(depositForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Nhập số tiền lớn hơn 0.');
      return;
    }
    setBusy(true);
    try {
      await createSandboxDepositRequest({
        amount,
        note: depositForm.note.trim() || undefined,
      });
      setDepositForm({ amount: '', note: '' });
      setNotice(`Đã nạp ${money(amount)} vào ví. Số dư được cập nhật ngay lập tức.`);
      await load();
      setTab('deposit');
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setFormError(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

  async function submitWithdrawal(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    const amount = Number(withdrawForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Nhập số tiền lớn hơn 0.');
      return;
    }
    setBusy(true);
    try {
      await createSandboxWithdrawalRequest({
        amount,
        note: withdrawForm.note.trim() || undefined,
      });
      setWithdrawForm({ amount: '', note: '' });
      setNotice(`Đã rút ${money(amount)} khỏi ví. Số dư được cập nhật ngay lập tức.`);
      await load();
      setTab('withdraw');
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setFormError(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

  const balance = overview?.wallet.balance ?? 0;
  const held = overview?.wallet.heldBalance ?? 0;

  return (
    <section className="supplier-panel wallet-panel" aria-label="Quản lý ví tiền">
      <div className="supplier-panel-title">
        <div>
          <span className="supplier-panel-label">VÍ TIỀN</span>
          <h2>Ví tiền của bạn</h2>
          <p className="catalog-hint">
            Nạp tiền, rút tiền và theo dõi mọi giao dịch của bạn trong một nơi.
          </p>
        </div>
        <button className="ghost-button" disabled={loading || busy} onClick={() => void load()}>
          ↻ Làm mới
        </button>
      </div>

      <nav className="catalog-nav wallet-tabs" aria-label="Ví tiền">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'is-active' : ''}
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="supplier-success" role="status">
          {notice}
        </p>
      )}

      <div className="wallet-kpi-grid">
        <article className="wallet-kpi wallet-kpi-primary">
          <span>Số dư khả dụng</span>
          <strong>{loading ? '—' : money(balance)}</strong>
          <small>Dùng để thanh toán đơn hàng</small>
        </article>
        <article className="wallet-kpi">
          <span>Số dư đang giữ</span>
          <strong>{loading ? '—' : money(held)}</strong>
          <small>Tiền rút đang chờ xử lý</small>
        </article>
        <article className="wallet-kpi">
          <span>Yêu cầu nạp chờ duyệt</span>
          <strong>{loading ? '—' : overview?.pendingDeposits ?? 0}</strong>
          <small>Quản trị viên đang xác nhận</small>
        </article>
        <article className="wallet-kpi">
          <span>Yêu cầu rút chờ duyệt</span>
          <strong>{loading ? '—' : overview?.pendingWithdrawals ?? 0}</strong>
          <small>Tiền đã được giữ lại</small>
        </article>
      </div>

      {tab === 'overview' && (
        <div className="wallet-overview">
          <p className="catalog-hint">
            Số dư chỉ được thay đổi khi bạn nạp tiền, thanh toán đơn hàng hoặc rút tiền. Mọi thay đổi
            đều được ghi lại trong lịch sử giao dịch để đối soát.
          </p>
          <div className="wallet-quick-links">
            <button className="ghost-button" onClick={() => setTab('deposit')}>
              <Icon name="download" /> Nạp tiền
            </button>
            <button className="ghost-button" onClick={() => setTab('withdraw')}>
              <Icon name="arrow" /> Rút tiền
            </button>
            <button className="ghost-button" onClick={() => setTab('transactions')}>
              <Icon name="fileText" /> Lịch sử giao dịch
            </button>
            <button className="ghost-button" onClick={() => setTab('payments')}>
              <Icon name="check" />
              {role === 'SUPPLIER' ? 'Tiền đã nhận' : 'Thanh toán đơn hàng'}
            </button>
          </div>
        </div>
      )}

      {tab === 'deposit' && (
        <div className="wallet-two-column">
          <div className="wallet-form">
            <h3>Nạp tiền vào ví</h3>
            <p className="wallet-virtual-note">
              Toàn bộ tiền trong hệ thống là tiền ảo. Số tiền được cộng vào số dư khả dụng ngay lập
              tức, không cần chờ quản trị viên xác nhận.
            </p>
            {qr ? (
              <WalletQrCode
                payload={qr.payload}
                amount={qr.amount}
                bankName={qr.bankName}
                accountNumber={qr.accountNumber}
                accountHolder={qr.accountHolder}
                billNumber={qr.billNumber}
                onConfirm={() => void confirmQrTransfer()}
                busy={busy}
              />
            ) : (
              <form
                onSubmit={event => {
                  event.preventDefault();
                  if (qrConfig?.enabled) void createQr();
                  else void submitDeposit();
                }}
                style={{ display: 'grid', gap: 14 }}
              >
                <label className="supplier-field">
                  <span>Số tiền nạp (VNĐ)</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={depositForm.amount}
                    disabled={busy}
                    onChange={(event) =>
                      setDepositForm({ ...depositForm, amount: event.target.value })
                    }
                    placeholder="Ví dụ: 1000000"
                  />
                </label>
                <label className="supplier-field">
                  <span>Ghi chú</span>
                  <input
                    maxLength={500}
                    value={depositForm.note}
                    disabled={busy}
                    onChange={(event) =>
                      setDepositForm({ ...depositForm, note: event.target.value })
                    }
                    placeholder="Ghi chú cho lịch sử giao dịch (không bắt buộc)"
                  />
                </label>
                {formError && (
                  <p className="error-notice" role="alert">
                    {formError}
                  </p>
                )}
                <button className="primary-button" type="submit" disabled={busy}>
                  {busy
                    ? 'Đang xử lý…'
                    : qrConfig?.enabled
                      ? 'Tạo mã QR nạp tiền'
                      : 'Nạp tiền'}
                </button>
                {qrConfig?.enabled && (
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void submitDeposit()}
                  >
                    Nạp tiền nhanh (không dùng QR)
                  </button>
                )}
              </form>
            )}
          </div>
          <div className="wallet-list">
            <h3>Lịch sử nạp tiền</h3>
            {!deposits.length ? (
              <p className="inventory-empty">Chưa có giao dịch nạp tiền nào.</p>
            ) : (
              deposits.map((request) => (
                <article className="wallet-row" key={request.id}>
                  <div>
                    <strong>{money(request.amount)}</strong>
                    <small>{dateTime(request.createdAt)}</small>
                    {request.reference && <small>Mã giao dịch: {request.reference}</small>}
                  </div>
                  <span className={`wallet-status wallet-status-${request.status.toLowerCase()}`}>
                    {request.status === 'PENDING' ? 'Chờ xác nhận' : request.isSandbox ? 'Đã nạp' : request.statusLabel}
                  </span>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="wallet-two-column">
          <form className="wallet-form" onSubmit={submitWithdrawal}>
            <h3>Rút tiền từ ví</h3>
            <p className="wallet-virtual-note">
              Toàn bộ tiền trong hệ thống là tiền ảo. Số tiền được trừ khỏi số dư khả dụng ngay lập
              tức, không cần chờ quản trị viên xử lý.
            </p>
            <label className="supplier-field">
              <span>Số tiền rút (VNĐ)</span>
              <input
                type="number"
                min="1"
                step="1"
                max={balance}
                required
                value={withdrawForm.amount}
                disabled={busy}
                onChange={(event) => setWithdrawForm({ ...withdrawForm, amount: event.target.value })}
                placeholder="Ví dụ: 500000"
              />
            </label>
            <small className="catalog-hint">Số dư khả dụng: {money(balance)}</small>
            <label className="supplier-field">
              <span>Ghi chú</span>
              <input
                maxLength={500}
                value={withdrawForm.note}
                disabled={busy}
                onChange={(event) => setWithdrawForm({ ...withdrawForm, note: event.target.value })}
                placeholder="Ghi chú cho lịch sử giao dịch (không bắt buộc)"
              />
            </label>
            {formError && (
              <p className="error-notice" role="alert">
                {formError}
              </p>
            )}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Đang rút…' : 'Rút tiền'}
            </button>
          </form>
          <div className="wallet-list">
            <h3>Lịch sử rút tiền</h3>
            {!withdrawals.length ? (
              <p className="inventory-empty">Chưa có giao dịch rút tiền nào.</p>
            ) : (
              withdrawals.map((request) => (
                <article className="wallet-row" key={request.id}>
                  <div>
                    <strong>{money(request.amount)}</strong>
                    <small>{dateTime(request.createdAt)}</small>
                    {request.adminNote && <small>Ý kiến quản trị: {request.adminNote}</small>}
                  </div>
                  <span className={`wallet-status wallet-status-${request.status.toLowerCase()}`}>
                    {request.isSandbox ? 'Đã rút' : request.statusLabel}
                  </span>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="wallet-list">
          <h3>Lịch sử giao dịch ví</h3>
          {!transactions.length ? (
            <p className="inventory-empty">Chưa có giao dịch nào trong ví.</p>
          ) : (
            <div className="supplier-table-wrap">
              <table className="supplier-table">
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Số tiền</th>
                    <th>Số dư sau</th>
                    <th>Nguồn</th>
                    <th>Mã giao dịch</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        <strong>
                          {TRANSACTION_LABELS[transaction.type] || transaction.typeLabel}
                        </strong>
                        {transaction.note && <small>{transaction.note}</small>}
                      </td>
                      <td>
                        <span
                          className={
                            transaction.direction === 'CREDIT' ? 'wallet-amount-in' : 'wallet-amount-out'
                          }
                        >
                          {transaction.direction === 'CREDIT' ? '+' : '−'}
                          {money(transaction.amount)}
                        </span>
                      </td>
                      <td>{money(transaction.balanceAfter)}</td>
                      <td>
                        <span
                          className={`wallet-status wallet-status-${
                            transaction.method === 'SANDBOX' ? 'approved' : 'pending'
                          }`}
                        >
                          {transaction.method === 'SANDBOX' ? 'Tiền ảo' : 'Thường'}
                        </span>
                      </td>
                      <td>
                        <small>{transaction.reference}</small>
                      </td>
                      <td>
                        <small>{dateTime(transaction.createdAt)}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="wallet-list">
          <h3>{role === 'SUPPLIER' ? 'Tiền đã nhận từ đơn hàng' : 'Lịch sử thanh toán đơn hàng'}</h3>
          {!payments.length ? (
            <p className="inventory-empty">
              {role === 'SUPPLIER'
                ? 'Chưa có đơn hàng nào được thanh toán bằng ví.'
                : 'Chưa có đơn hàng nào được thanh toán bằng ví.'}
            </p>
          ) : (
            <div className="supplier-table-wrap">
              <table className="supplier-table">
                <thead>
                  <tr>
                    <th>Đơn hàng</th>
                    <th>Số tiền</th>
                    <th>
                      {role === 'SUPPLIER' ? 'Đã nhận' : 'Phí nền tảng'}
                    </th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <strong>Đơn #{payment.orderId}</strong>
                        <small>{role === 'SUPPLIER' ? payment.buyerName : payment.supplierName}</small>
                      </td>
                      <td>{money(payment.amount)}</td>
                      <td>
                        {role === 'SUPPLIER'
                          ? money(payment.supplierAmount ?? payment.amount)
                          : payment.commissionAmount === null
                            ? '—'
                            : money(payment.commissionAmount)}
                      </td>
                      <td>
                        <span
                          className={`wallet-status wallet-status-${
                            payment.refunded ? 'rejected' : payment.status.toLowerCase()
                          }`}
                        >
                          {payment.refunded ? 'Đã hoàn tiền' : payment.statusLabel}
                        </span>
                      </td>
                      <td>
                        <small>{dateTime(payment.paidAt)}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
