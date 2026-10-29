import { useCallback, useEffect, useState, type FormEvent } from 'react';
import '../catalog.css';
import './wallet.css';
import Icon from '../../components/Icon';
import { getApiError, isUnauthenticated } from '../../services/api';
import {
  createDepositRequest,
  createWithdrawalRequest,
  getDepositRequests,
  getWallet,
  getWalletPayments,
  getWalletTransactions,
  getWithdrawalRequests,
  type DepositRequest,
  type OrderPayment,
  type WalletOverview,
  type WalletTransaction,
  type WithdrawalRequest,
} from '../../services/wallet.api';

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
};

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);

const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const EMPTY_BANK = { bankName: '', bankAccountNumber: '', bankAccountHolder: '' };

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
    ...EMPTY_BANK,
    reference: '',
    note: '',
  });
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    ...EMPTY_BANK,
    note: '',
  });
  const [formError, setFormError] = useState('');

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

  async function submitDeposit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    const amount = Number(depositForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Nhập số tiền lớn hơn 0.');
      return;
    }
    setBusy(true);
    try {
      await createDepositRequest({
        amount,
        bankName: depositForm.bankName.trim(),
        bankAccountNumber: depositForm.bankAccountNumber.trim(),
        bankAccountHolder: depositForm.bankAccountHolder.trim(),
        reference: depositForm.reference.trim() || undefined,
        note: depositForm.note.trim() || undefined,
      });
      setDepositForm({ amount: '', ...EMPTY_BANK, reference: '', note: '' });
      setNotice('Đã gửi yêu cầu nạp tiền. Quản trị viên sẽ xác nhận sau khi kiểm tra tài khoản.');
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
      await createWithdrawalRequest({
        amount,
        bankName: withdrawForm.bankName.trim(),
        bankAccountNumber: withdrawForm.bankAccountNumber.trim(),
        bankAccountHolder: withdrawForm.bankAccountHolder.trim(),
        note: withdrawForm.note.trim() || undefined,
      });
      setWithdrawForm({ amount: '', ...EMPTY_BANK, note: '' });
      setNotice('Đã gửi yêu cầu rút tiền. Số tiền được giữ lại cho tới khi quản trị viên xử lý.');
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
          <form className="wallet-form" onSubmit={submitDeposit}>
            <h3>Gửi yêu cầu nạp tiền</h3>
            <p className="catalog-hint">
              Chuyển tiền vào tài khoản của hệ thống rồi ghi mã giao dịch. Quản trị viên sẽ xác
              nhận và cộng tiền vào ví của bạn.
            </p>
            <label className="supplier-field">
              <span>Số tiền nạp (VNĐ)</span>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={depositForm.amount}
                disabled={busy}
                onChange={(event) => setDepositForm({ ...depositForm, amount: event.target.value })}
              />
            </label>
            <label className="supplier-field">
              <span>Ngân hàng</span>
              <input
                required
                maxLength={100}
                value={depositForm.bankName}
                disabled={busy}
                onChange={(event) => setDepositForm({ ...depositForm, bankName: event.target.value })}
                placeholder="Ví dụ: Vietcombank"
              />
            </label>
            <label className="supplier-field">
              <span>Số tài khoản nhận tiền</span>
              <input
                required
                maxLength={34}
                value={depositForm.bankAccountNumber}
                disabled={busy}
                onChange={(event) =>
                  setDepositForm({ ...depositForm, bankAccountNumber: event.target.value })
                }
                placeholder="Số tài khoản bạn sẽ nhận tiền"
              />
            </label>
            <label className="supplier-field">
              <span>Chủ tài khoản</span>
              <input
                required
                maxLength={100}
                value={depositForm.bankAccountHolder}
                disabled={busy}
                onChange={(event) =>
                  setDepositForm({ ...depositForm, bankAccountHolder: event.target.value })
                }
                placeholder="NGUYEN VAN A"
              />
            </label>
            <label className="supplier-field">
              <span>Mã giao dịch / nội dung chuyển khoản</span>
              <input
                maxLength={100}
                value={depositForm.reference}
                disabled={busy}
                onChange={(event) =>
                  setDepositForm({ ...depositForm, reference: event.target.value })
                }
                placeholder="Ví dụ: NAP 001234"
              />
            </label>
            <label className="supplier-field">
              <span>Ghi chú</span>
              <input
                maxLength={500}
                value={depositForm.note}
                disabled={busy}
                onChange={(event) => setDepositForm({ ...depositForm, note: event.target.value })}
                placeholder="Ghi chú cho quản trị viên (không bắt buộc)"
              />
            </label>
            {formError && (
              <p className="error-notice" role="alert">
                {formError}
              </p>
            )}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Đang gửi…' : 'Gửi yêu cầu nạp tiền'}
            </button>
          </form>
          <div className="wallet-list">
            <h3>Lịch sử yêu cầu nạp tiền</h3>
            {!deposits.length ? (
              <p className="inventory-empty">Chưa có yêu cầu nạp tiền nào.</p>
            ) : (
              deposits.map((request) => (
                <article className="wallet-row" key={request.id}>
                  <div>
                    <strong>{money(request.amount)}</strong>
                    <small>
                      {dateTime(request.createdAt)} · {request.method}
                    </small>
                    {request.reference && <small>Mã giao dịch: {request.reference}</small>}
                  </div>
                  <span className={`wallet-status wallet-status-${request.status.toLowerCase()}`}>
                    {request.statusLabel}
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
            <h3>Gửi yêu cầu rút tiền</h3>
            <p className="catalog-hint">
              Số tiền được giữ lại ngay khi gửi yêu cầu và hoàn lại nếu bị từ chối hoặc chuyển khoản
              thất bại.
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
              />
            </label>
            <small className="catalog-hint">Số dư khả dụng: {money(balance)}</small>
            <label className="supplier-field">
              <span>Ngân hàng nhận tiền</span>
              <input
                required
                maxLength={100}
                value={withdrawForm.bankName}
                disabled={busy}
                onChange={(event) => setWithdrawForm({ ...withdrawForm, bankName: event.target.value })}
              />
            </label>
            <label className="supplier-field">
              <span>Số tài khoản</span>
              <input
                required
                maxLength={34}
                value={withdrawForm.bankAccountNumber}
                disabled={busy}
                onChange={(event) =>
                  setWithdrawForm({ ...withdrawForm, bankAccountNumber: event.target.value })
                }
              />
            </label>
            <label className="supplier-field">
              <span>Chủ tài khoản</span>
              <input
                required
                maxLength={100}
                value={withdrawForm.bankAccountHolder}
                disabled={busy}
                onChange={(event) =>
                  setWithdrawForm({ ...withdrawForm, bankAccountHolder: event.target.value })
                }
              />
            </label>
            <label className="supplier-field">
              <span>Ghi chú</span>
              <input
                maxLength={500}
                value={withdrawForm.note}
                disabled={busy}
                onChange={(event) => setWithdrawForm({ ...withdrawForm, note: event.target.value })}
                placeholder="Ghi chú cho quản trị viên (không bắt buộc)"
              />
            </label>
            {formError && (
              <p className="error-notice" role="alert">
                {formError}
              </p>
            )}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Đang gửi…' : 'Gửi yêu cầu rút tiền'}
            </button>
          </form>
          <div className="wallet-list">
            <h3>Lịch sử yêu cầu rút tiền</h3>
            {!withdrawals.length ? (
              <p className="inventory-empty">Chưa có yêu cầu rút tiền nào.</p>
            ) : (
              withdrawals.map((request) => (
                <article className="wallet-row" key={request.id}>
                  <div>
                    <strong>{money(request.amount)}</strong>
                    <small>
                      {dateTime(request.createdAt)} · {request.bankName} ·{' '}
                      {request.bankAccountNumber}
                    </small>
                    {request.adminNote && <small>Ý kiến quản trị: {request.adminNote}</small>}
                  </div>
                  <span className={`wallet-status wallet-status-${request.status.toLowerCase()}`}>
                    {request.statusLabel}
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
