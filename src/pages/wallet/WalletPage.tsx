import { useCallback, useEffect, useState, type FormEvent } from 'react';
import '../catalog.css';
import './wallet.css';
import Icon from '../../components/Icon';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import {
  confirmQrDeposit,
  createQrDepositRequest,
  createSandboxDepositRequest,
  createSandboxWithdrawalRequest,
  createWithdrawalRequest,
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
  WITHDRAWAL_HOLD: 'Tạm giữ tiền rút',
  WITHDRAWAL_RELEASE: 'Hoàn lại tiền rút',
  WITHDRAWAL_PAYOUT: 'Chuyển khoản rút tiền',
  ORDER_PAYMENT: 'Thanh toán đơn hàng',
  ORDER_RECEIVE: 'Nhận tiền đơn hàng',
  REFUND: 'Hoàn tiền',
  REFUND_RECEIVED: 'Thu hồi tiền hoàn',
  SANDBOX_DEPOSIT: 'Nạp tiền thử nghiệm',
  SANDBOX_WITHDRAWAL: 'Rút tiền thử nghiệm',
  QR_DEPOSIT: 'Nạp tiền qua QR',
  ESCROW_LOCK: 'Tạm khóa cọc đơn hàng',
  ESCROW_RELEASE: 'Giải phóng cọc đơn hàng',
  ESCROW_RECEIVED: 'Nhận cọc đơn giao xong',
  ESCROW_REFUND: 'Hoàn trả cọc đơn hàng',
  PENALTY_CONFISCATION: 'Khấu trừ cọc vi phạm',
  COMPENSATION_RECEIVED: 'Nhận bồi thường cọc',
};

import { POPULAR_BANKS } from '../../constants/banks';

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

  const [withdrawMode, setWithdrawMode] = useState<'OFFICIAL' | 'SANDBOX'>('OFFICIAL');
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    bankName: 'Vietcombank',
    customBankName: '',
    bankAccountNumber: '',
    bankAccountHolder: '',
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

  // Load server-side VietQR configuration
  useEffect(() => {
    let active = true;
    getQrConfig()
      .then((config) => {
        if (active) setQrConfig(config);
      })
      .catch(() => {
        if (active) setQrConfig(null);
      });
    return () => {
      active = false;
    };
  }, []);

  // Pre-fill bank information from user profile if available
  useEffect(() => {
    api
      .get<{
        profile?: {
          name?: string;
          supplierProfile?: {
            bankName?: string;
            bankAccountNumber?: string;
            bankAccountHolder?: string;
            businessName?: string;
          };
          storeProfile?: {
            bankName?: string;
            bankAccountNumber?: string;
            bankAccountHolder?: string;
            storeName?: string;
          };
        };
      }>('/profile')
      .then(({ data }) => {
        const supp = data?.profile?.supplierProfile;
        const store = data?.profile?.storeProfile;
        const bankInfo = supp?.bankAccountNumber ? supp : store?.bankAccountNumber ? store : null;
        if (bankInfo) {
          setWithdrawForm((prev) => ({
            ...prev,
            bankName: prev.bankName || bankInfo.bankName || 'Vietcombank',
            bankAccountNumber: prev.bankAccountNumber || bankInfo.bankAccountNumber || '',
            bankAccountHolder:
              prev.bankAccountHolder ||
              bankInfo.bankAccountHolder ||
              (supp?.businessName || store?.storeName) ||
              data?.profile?.name ||
              '',
          }));
        } else if (data?.profile?.name) {
          const name = data.profile.name;
          setWithdrawForm((prev) => ({
            ...prev,
            bankAccountHolder: prev.bankAccountHolder || name || '',
          }));
        }
      })
      .catch(() => {});
  }, []);

  /** Builds a QR ticket for the entered amount so the user can scan and pay. */
  async function createQr() {
    setFormError('');
    const amount = Number(depositForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Vui lòng nhập số tiền nạp lớn hơn 0.');
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
      setNotice('Đã tạo mã QR nạp tiền. Quét mã bằng ứng dụng ngân hàng rồi bấm "Tôi đã chuyển khoản".');
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
      setNotice(`Đã nạp ${money(request.amount)} vào ví thành công. Số dư được cập nhật ngay lập tức.`);
      await load();
      setTab('deposit');
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setFormError(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

  /** Credits simulated money instantly for testing and demo purposes. */
  async function submitDeposit() {
    setFormError('');
    const amount = Number(depositForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Vui lòng nhập số tiền nạp thử nghiệm lớn hơn 0.');
      return;
    }
    setBusy(true);
    try {
      await createSandboxDepositRequest({
        amount,
        note: depositForm.note.trim() || 'Nạp tiền thử nghiệm',
      });
      setDepositForm({ amount: '', note: '' });
      setNotice(`Đã nạp thử nghiệm ${money(amount)} vào ví. Số dư khả dụng được cộng ngay lập tức.`);
      await load();
      setTab('deposit');
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setFormError(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

  /** Submits withdrawal request: official flow with admin review or sandbox demo. */
  async function submitWithdrawal(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    const amount = Number(withdrawForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Vui lòng nhập số tiền rút lớn hơn 0.');
      return;
    }
    if (amount > balance) {
      setFormError(`Số dư khả dụng (${money(balance)}) không đủ để rút số tiền này.`);
      return;
    }

    if (withdrawMode === 'OFFICIAL') {
      const selectedBank =
        withdrawForm.bankName === 'Khác'
          ? withdrawForm.customBankName.trim()
          : withdrawForm.bankName.trim();
      const accountNumber = withdrawForm.bankAccountNumber.trim().replace(/\s+/g, '');
      const accountHolder = withdrawForm.bankAccountHolder.trim().toUpperCase();

      if (selectedBank.length < 2) {
        setFormError('Vui lòng chọn hoặc nhập tên ngân hàng nhận tiền.');
        return;
      }
      if (!/^[A-Za-z0-9]{4,34}$/.test(accountNumber)) {
        setFormError('Số tài khoản ngân hàng cần từ 4 đến 34 ký tự (chữ hoặc số, không khoảng trắng).');
        return;
      }
      if (accountHolder.length < 2) {
        setFormError('Vui lòng nhập họ và tên chủ tài khoản thụ hưởng.');
        return;
      }

      setBusy(true);
      try {
        await createWithdrawalRequest({
          amount,
          bankName: selectedBank,
          bankAccountNumber: accountNumber,
          bankAccountHolder: accountHolder,
          note: withdrawForm.note.trim() || undefined,
        });
        setWithdrawForm((prev) => ({ ...prev, amount: '', note: '' }));
        setNotice(
          `Đã tạo yêu cầu rút ${money(amount)} về tài khoản ${selectedBank} (${accountNumber}). Số tiền này được chuyển vào mục "Đang tạm giữ" để chờ Admin chuyển khoản.`
        );
        await load();
        setTab('withdraw');
      } catch (issue) {
        if (isUnauthenticated(issue)) onLogout();
        else setFormError(getApiError(issue));
      } finally {
        setBusy(false);
      }
    } else {
      // Sandbox withdrawal (Demo testing)
      setBusy(true);
      try {
        await createSandboxWithdrawalRequest({
          amount,
          note: withdrawForm.note.trim() || 'Rút tiền thử nghiệm',
        });
        setWithdrawForm((prev) => ({ ...prev, amount: '', note: '' }));
        setNotice(`Đã rút thử nghiệm ${money(amount)} khỏi ví. Số dư khả dụng đã được trừ ngay lập tức.`);
        await load();
        setTab('withdraw');
      } catch (issue) {
        if (isUnauthenticated(issue)) onLogout();
        else setFormError(getApiError(issue));
      } finally {
        setBusy(false);
      }
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
          Làm mới
        </button>
      </div>

      <nav className="catalog-nav wallet-tabs" aria-label="Ví tiền">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'is-active' : ''}
            onClick={() => {
              setTab(item.id);
              setFormError('');
              setNotice('');
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {notice && (
        <p className="supplier-success" role="status" style={{ margin: '14px 0' }}>
          {notice}
        </p>
      )}

      {error && (
        <p className="error-notice" role="alert" style={{ margin: '14px 0' }}>
          {error}
        </p>
      )}

      {tab === 'overview' && (
        <div className="wallet-overview">
          <div className="wallet-kpi-grid">
            <div className="wallet-kpi wallet-kpi-primary">
              <span>Số dư khả dụng</span>
              <strong>{loading ? '…' : money(balance)}</strong>
              <small>Có thể dùng để ký quỹ đơn hoặc rút tiền</small>
            </div>
            <div className="wallet-kpi">
              <span>Đang tạm giữ / Ký quỹ</span>
              <strong>{loading ? '…' : money(held)}</strong>
              <small>Đang giữ cho đơn hàng hoặc lệnh rút chờ duyệt</small>
            </div>
            <div className="wallet-kpi">
              <span>Tổng tài sản ví</span>
              <strong>{loading ? '…' : money(overview?.wallet.total ?? (balance + held))}</strong>
              <small>Số dư khả dụng + Đang ký quỹ</small>
            </div>
            <div className="wallet-kpi">
              <span>Yêu cầu đang chờ duyệt</span>
              <strong>
                {loading
                  ? '…'
                  : `${overview?.pendingDeposits ?? 0} nạp · ${overview?.pendingWithdrawals ?? 0} rút`}
              </strong>
              <small>Phiếu nạp/rút đang chờ xác nhận</small>
            </div>
          </div>

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
              Hỗ trợ nạp tiền qua mã VietQR an toàn, hoặc sử dụng tính năng nạp tiền thử nghiệm phục vụ mục đích kiểm thử và demo đồ án.
            </p>

            {qr ? (
              <div>
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
                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={busy}
                    onClick={() => {
                      setQr(null);
                      setQrTicketId(null);
                    }}
                  >
                    Hủy / Chọn số tiền khác
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
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
                    min="1000"
                    step="1000"
                    required
                    value={depositForm.amount}
                    disabled={busy}
                    onChange={(event) =>
                      setDepositForm({ ...depositForm, amount: event.target.value })
                    }
                    placeholder="Ví dụ: 1000000"
                  />
                </label>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[200000, 500000, 1000000, 2000000, 5000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className="ghost-button"
                      style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px' }}
                      onClick={() => setDepositForm({ ...depositForm, amount: String(amt) })}
                    >
                      +{money(amt)}
                    </button>
                  ))}
                </div>

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
                      ? 'Tạo mã QR nạp tiền (VietQR)'
                      : 'Nạp tiền (Mô phỏng)'}
                </button>

                {qrConfig?.enabled && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px 14px',
                      backgroundColor: '#f8fafc',
                      border: '1px dashed #cbd5e1',
                      borderRadius: '8px',
                    }}
                  >
                    <strong style={{ fontSize: '12.5px', color: '#334155', display: 'block' }}>
                      Chế độ thử nghiệm (Dành cho Demo / Báo cáo đồ án):
                    </strong>
                    <p style={{ fontSize: '11.5px', color: '#64748b', margin: '4px 0 10px', lineHeight: 1.5 }}>
                      Cộng trực tiếp số tiền mô phỏng vào số dư ví ngay lập tức mà không cần mở ứng dụng ngân hàng thật để quét mã.
                    </p>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void submitDeposit()}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontWeight: 650,
                        color: '#0f172a',
                      }}
                    >
                      + Nạp nhanh thử nghiệm (Sandbox Demo)
                    </button>
                  </div>
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
                    <small style={{ color: request.isSandbox ? '#64748b' : '#0369a1' }}>
                      Phương thức: {request.method === 'VIET_QR' ? 'Quét mã VietQR' : request.isSandbox ? 'Nạp tiền thử nghiệm (Sandbox)' : request.method}
                    </small>
                    {request.reference && <small>Mã giao dịch: {request.reference}</small>}
                  </div>
                  <span className={`wallet-status wallet-status-${request.status.toLowerCase()}`}>
                    {request.status === 'PENDING'
                      ? 'Chờ xác nhận'
                      : request.isSandbox
                        ? 'Đã nạp (Thử nghiệm)'
                        : request.statusLabel}
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
              Quy trình rút tiền chuẩn chỉnh: Tiền rút sẽ được tạm khóa và gửi phiếu yêu cầu tới Quản trị viên để kiểm tra và chuyển khoản ngân hàng.
            </p>

            <div style={{ marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 650,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                Chọn phương thức rút tiền:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setWithdrawMode('OFFICIAL');
                    setFormError('');
                  }}
                  style={{
                    padding: '9px 10px',
                    borderRadius: '7px',
                    border: `2px solid ${withdrawMode === 'OFFICIAL' ? '#166534' : '#e2e8f0'}`,
                    backgroundColor: withdrawMode === 'OFFICIAL' ? '#f0fdf4' : '#ffffff',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <strong
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      color: withdrawMode === 'OFFICIAL' ? '#14532d' : '#334155',
                    }}
                  >
                    Về tài khoản ngân hàng
                  </strong>
                  <small style={{ color: '#64748b', fontSize: '10.5px' }}>
                    Quy trình duyệt chính thức
                  </small>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWithdrawMode('SANDBOX');
                    setFormError('');
                  }}
                  style={{
                    padding: '9px 10px',
                    borderRadius: '7px',
                    border: `2px solid ${withdrawMode === 'SANDBOX' ? '#b45309' : '#e2e8f0'}`,
                    backgroundColor: withdrawMode === 'SANDBOX' ? '#fffbeb' : '#ffffff',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <strong
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      color: withdrawMode === 'SANDBOX' ? '#92400e' : '#334155',
                    }}
                  >
                    Rút thử nghiệm (Sandbox)
                  </strong>
                  <small style={{ color: '#64748b', fontSize: '10.5px' }}>
                    Dành cho Demo / Trừ ngay
                  </small>
                </button>
              </div>
            </div>

            {withdrawMode === 'OFFICIAL' ? (
              <>
                <label className="supplier-field">
                  <span>Ngân hàng nhận tiền</span>
                  <select
                    value={withdrawForm.bankName}
                    disabled={busy}
                    onChange={(e) =>
                      setWithdrawForm({ ...withdrawForm, bankName: e.target.value })
                    }
                  >
                    {POPULAR_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>

                {withdrawForm.bankName === 'Khác' && (
                  <label className="supplier-field">
                    <span>Nhập tên ngân hàng khác</span>
                    <input
                      required
                      placeholder="Ví dụ: Shinhan Bank, OCB..."
                      value={withdrawForm.customBankName}
                      disabled={busy}
                      onChange={(e) =>
                        setWithdrawForm({ ...withdrawForm, customBankName: e.target.value })
                      }
                    />
                  </label>
                )}

                <label className="supplier-field">
                  <span>Số tài khoản ngân hàng</span>
                  <input
                    required
                    placeholder="Ví dụ: 1903678912345"
                    value={withdrawForm.bankAccountNumber}
                    disabled={busy}
                    onChange={(e) =>
                      setWithdrawForm({ ...withdrawForm, bankAccountNumber: e.target.value })
                    }
                  />
                </label>

                <label className="supplier-field">
                  <span>Tên chủ tài khoản (In hoa không dấu)</span>
                  <input
                    required
                    placeholder="Ví dụ: NGUYEN VAN A"
                    value={withdrawForm.bankAccountHolder}
                    disabled={busy}
                    onChange={(e) =>
                      setWithdrawForm({
                        ...withdrawForm,
                        bankAccountHolder: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </label>
              </>
            ) : (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#fffbeb',
                  borderRadius: '7px',
                  border: '1px solid #fde68a',
                  fontSize: '11.5px',
                  color: '#92400e',
                  lineHeight: 1.5,
                }}
              >
                <strong>Chế độ rút thử nghiệm:</strong> Số tiền rút sẽ được trừ trực tiếp khỏi số dư ví ngay lập tức phục vụ demo kiểm thử mà không cần điền tài khoản ngân hàng.
              </div>
            )}

            <label className="supplier-field">
              <span>Số tiền rút (VNĐ)</span>
              <input
                type="number"
                min="1000"
                step="1000"
                max={balance}
                required
                value={withdrawForm.amount}
                disabled={busy}
                onChange={(event) =>
                  setWithdrawForm({ ...withdrawForm, amount: event.target.value })
                }
                placeholder="Ví dụ: 500000"
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small className="catalog-hint" style={{ margin: 0 }}>
                Số dư khả dụng: <strong style={{ color: '#166534' }}>{money(balance)}</strong>
              </small>
              {balance > 0 && (
                <button
                  type="button"
                  className="ghost-button"
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                  onClick={() => setWithdrawForm({ ...withdrawForm, amount: String(balance) })}
                >
                  Rút tất cả
                </button>
              )}
            </div>

            <label className="supplier-field">
              <span>Ghi chú rút tiền</span>
              <input
                maxLength={500}
                value={withdrawForm.note}
                disabled={busy}
                onChange={(event) =>
                  setWithdrawForm({ ...withdrawForm, note: event.target.value })
                }
                placeholder="Ghi chú cho yêu cầu rút tiền (không bắt buộc)"
              />
            </label>

            {formError && (
              <p className="error-notice" role="alert">
                {formError}
              </p>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={busy}
              style={{
                backgroundColor: withdrawMode === 'OFFICIAL' ? '#166534' : '#b45309',
              }}
            >
              {busy
                ? 'Đang xử lý…'
                : withdrawMode === 'OFFICIAL'
                  ? 'Gửi yêu cầu rút tiền'
                  : 'Rút tiền thử nghiệm ngay'}
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
                    {request.isSandbox ? (
                      <small style={{ color: '#64748b' }}>Rút tiền thử nghiệm (Sandbox Demo)</small>
                    ) : (
                      <small style={{ color: '#0369a1', fontWeight: 600 }}>
                        {request.bankName} · STK: {request.bankAccountNumber} ({request.bankAccountHolder})
                      </small>
                    )}
                    {request.note && <small>Ghi chú: {request.note}</small>}
                    {request.adminNote && (
                      <small style={{ color: '#b91c1c' }}>Ý kiến quản trị: {request.adminNote}</small>
                    )}
                  </div>
                  <span className={`wallet-status wallet-status-${request.status.toLowerCase()}`}>
                    {request.isSandbox
                      ? 'Đã rút (Thử nghiệm)'
                      : request.status === 'PENDING'
                        ? 'Chờ Admin chuyển khoản'
                        : request.status === 'APPROVED'
                          ? 'Đã duyệt'
                          : request.status === 'COMPLETED'
                            ? 'Đã chuyển tiền'
                            : request.status === 'REJECTED'
                              ? 'Bị từ chối (Đã hoàn tiền)'
                              : request.statusLabel}
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
                          {transaction.method === 'SANDBOX' ? 'Thử nghiệm' : 'Chính thức'}
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
