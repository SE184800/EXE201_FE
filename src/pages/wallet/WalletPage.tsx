import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './wallet.css';
import Icon from '../../components/Icon';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import {
  createQrDepositRequest,
  createWithdrawalRequest,
  getDepositRequests,
  getQrDepositTicket,
  getWallet,
  getWalletTransactions,
  type QrCode,
  type DepositRequest,
  type WalletOverview,
  type WalletTransaction,
} from '../../services/wallet.api';
import WalletQrCode from './WalletQrCode';
import { dateTime, money } from './walletFormat';
import { POPULAR_BANKS } from '../../constants/banks';

const TYPE_META: Record<
  string,
  { label: string; tagClass: string; category: 'ESCROW' | 'DEPOSIT' | 'WITHDRAW' | 'MOCK' | 'OTHER' }
> = {
  SUBSCRIPTION_PAYMENT: { label: 'Mua gói dịch vụ', tagClass: 'tag-info', category: 'OTHER' },
  INITIAL_MOCK: { label: 'Khởi tạo thử nghiệm', tagClass: 'tag-info', category: 'MOCK' },
  MOCK_ADD: { label: 'Cộng tiền thử nghiệm', tagClass: 'tag-success', category: 'MOCK' },
  MOCK_RESET: { label: 'Đặt lại thử nghiệm', tagClass: 'tag-warning', category: 'MOCK' },
  SANDBOX_DEPOSIT: { label: 'Nạp tiền thử nghiệm', tagClass: 'tag-info', category: 'MOCK' },
  SANDBOX_WITHDRAWAL: { label: 'Rút tiền thử nghiệm', tagClass: 'tag-warning', category: 'MOCK' },
  DEPOSIT: { label: 'Nạp tiền vào ví', tagClass: 'tag-success', category: 'DEPOSIT' },
  QR_DEPOSIT: { label: 'Nạp tiền qua VietQR', tagClass: 'tag-success', category: 'DEPOSIT' },
  WITHDRAWAL_HOLD: { label: 'Tạm giữ tiền rút', tagClass: 'tag-warning', category: 'WITHDRAW' },
  WITHDRAWAL_RELEASE: { label: 'Hoàn lại tiền rút', tagClass: 'tag-info', category: 'WITHDRAW' },
  WITHDRAWAL_PAYOUT: { label: 'Chuyển khoản rút tiền', tagClass: 'tag-danger', category: 'WITHDRAW' },
  ESCROW_LOCK: { label: 'Tạm khóa cọc đơn sỉ (10%)', tagClass: 'tag-warning', category: 'ESCROW' },
  ESCROW_RELEASE: { label: 'Giải phóng cọc đơn hàng', tagClass: 'tag-info', category: 'ESCROW' },
  ESCROW_RECEIVED: { label: 'Nhận cọc đơn giao xong', tagClass: 'tag-success', category: 'ESCROW' },
  ESCROW_REFUND: { label: 'Hoàn trả cọc đơn hàng', tagClass: 'tag-success', category: 'ESCROW' },
  PENALTY_CONFISCATION: { label: 'Khấu trừ cọc vi phạm', tagClass: 'tag-danger', category: 'ESCROW' },
  COMPENSATION_RECEIVED: { label: 'Nhận bồi thường cọc', tagClass: 'tag-success', category: 'ESCROW' },
  ORDER_PAYMENT: { label: 'Thanh toán tiền hàng', tagClass: 'tag-danger', category: 'OTHER' },
  ORDER_RECEIVE: { label: 'Nhận thanh toán đơn', tagClass: 'tag-success', category: 'OTHER' },
  COMMISSION_FEE: { label: 'Phí dịch vụ nền tảng', tagClass: 'tag-warning', category: 'OTHER' },
  REFUND: { label: 'Hoàn tiền vào ví', tagClass: 'tag-success', category: 'OTHER' },
  REFUND_RECEIVED: { label: 'Thu hồi tiền hoàn', tagClass: 'tag-danger', category: 'OTHER' },
};

type FilterCategory = 'ALL' | 'ESCROW' | 'DEPOSIT' | 'WITHDRAW' | 'OTHER';

const QUICK_AMOUNTS = [200000, 500000, 1000000, 2000000, 5000000, 10000000];

export default function WalletPage({
  onLogout,
  role = 'STORE_OWNER',
}: {
  onLogout: () => void;
  role?: 'STORE_OWNER' | 'SUPPLIER';
}) {
  const [searchParams] = useSearchParams();
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Transaction filter & search
  const [filter, setFilter] = useState<FilterCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTxId, setCopiedTxId] = useState<number | null>(null);

  // Deposit modal state
  const [showDepositModal, setShowDepositModal] = useState(searchParams.get('tab') === 'deposit');
  const [depositAmount, setDepositAmount] = useState('500000');
  const [depositNote, setDepositNote] = useState('Nạp tiền vào SupplyMind AI');
  const [successToast, setSuccessToast] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qr, setQr] = useState<QrCode | null>(null);
  const [qrTicketId, setQrTicketId] = useState<number | null>(null);

  // Withdraw modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    bankName: 'Vietcombank',
    bankAccountNumber: '',
    bankAccountHolder: '',
    note: '',
  });
  const [withdrawError, setWithdrawError] = useState('');
  const depositBackdropMouseDown = useRef(false);
  const withdrawBackdropMouseDown = useRef(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(''), 4500);
    return () => clearTimeout(timer);
  }, [successToast]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [walletRes, txRes, depositRes] = await Promise.all([
        getWallet(),
        getWalletTransactions({ page: 1 }),
        getDepositRequests({ page: 1 }),
      ]);
      setError('');
      setOverview(walletRes);
      setTransactions(txRes.transactions || []);
      setDeposits(depositRes.requests || []);
      window.dispatchEvent(new CustomEvent('supplymind:wallet-changed'));
    } catch (e) {
      setError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Load bank info from profile if available
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
              supp?.businessName ||
              store?.storeName ||
              data?.profile?.name ||
              '',
          }));
        }
      })
      .catch(() => { });
  }, []);

  // Create QR for official deposit
  async function handleGenerateQr(e?: FormEvent) {
    if (e) e.preventDefault();
    const parsedAmount = Number(depositAmount);
    if (!parsedAmount || parsedAmount < 10000) {
      setError('Số tiền nạp tối thiểu là 10.000 ₫.');
      return;
    }
    setQrLoading(true);
    setError('');
    try {
      const res = await createQrDepositRequest({
        amount: parsedAmount,
        note: depositNote.trim() || undefined,
      });
      setQr(res.qr);
      setQrTicketId(res.request.id);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setQrLoading(false);
    }
  }

  // Polling for QR ticket approval via SePay Webhook
  useEffect(() => {
    if (!qrTicketId || !showDepositModal) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const ticket = await getQrDepositTicket(qrTicketId);
        if (cancelled) return;
        if (ticket.status === 'APPROVED') {
          clearInterval(interval);
          setSuccessToast(`Nạp tiền thành công! Đã cộng +${money(ticket.amount)} vào ví SupplyMind AI.`);
          setNotice(`Nạp tiền thành công! Đã cộng ${money(ticket.amount)} vào ví hệ thống.`);
          setTimeout(async () => {
            if (cancelled) return;
            setShowDepositModal(false);
            setQr(null);
            setQrTicketId(null);
            await load();
          }, 1500);
        } else if (ticket.status === 'REJECTED') {
          clearInterval(interval);
          setError('Phiếu nạp tiền đã bị từ chối.');
          setShowDepositModal(false);
          setQr(null);
          setQrTicketId(null);
        }
      } catch {
        // silent retry on network hiccups
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [qrTicketId, showDepositModal, load]);

  // Submit withdrawal request
  async function handleSubmitWithdraw(e: FormEvent) {
    e.preventDefault();
    setWithdrawError('');
    const parsedAmount = Number(withdrawForm.amount);
    const available = overview?.wallet?.balance ?? 0;
    if (!parsedAmount || parsedAmount < 50000) {
      setWithdrawError('Số tiền rút tối thiểu là 50.000 ₫.');
      return;
    }
    if (parsedAmount > available) {
      setWithdrawError(`Số tiền rút vượt quá số dư khả dụng (${money(available)}).`);
      return;
    }
    if (!withdrawForm.bankAccountNumber.trim() || !withdrawForm.bankAccountHolder.trim()) {
      setWithdrawError('Vui lòng điền đầy đủ số tài khoản và tên chủ tài khoản nhận tiền.');
      return;
    }

    setBusy(true);
    try {
      await createWithdrawalRequest({
        amount: parsedAmount,
        bankName: withdrawForm.bankName,
        bankAccountNumber: withdrawForm.bankAccountNumber.trim(),
        bankAccountHolder: withdrawForm.bankAccountHolder.trim(),
        note: withdrawForm.note || undefined,
      });
      setNotice(`Đã gửi yêu cầu rút ${money(parsedAmount)}. Hệ thống sẽ xử lý giải ngân về tài khoản.`);
      setShowWithdrawModal(false);
      setWithdrawForm((prev) => ({ ...prev, amount: '', note: '' }));
      await load();
    } catch (issue) {
      setWithdrawError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, txId?: number) {
    try {
      await navigator.clipboard.writeText(text);
      if (txId !== undefined) {
        setCopiedTxId(txId);
        setTimeout(() => setCopiedTxId(null), 1800);
      }
    } catch {
      // ignore
    }
  }

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    const meta = TYPE_META[t.type];
    if (filter !== 'ALL' && meta?.category !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const refMatch = (t.reference || `TRX-${t.id}`).toLowerCase().includes(q);
      const noteMatch = (t.note || '').toLowerCase().includes(q);
      const labelMatch = (meta?.label || t.typeLabel || '').toLowerCase().includes(q);
      const amountMatch = String(Math.abs(t.amount)).includes(q);
      return refMatch || noteMatch || labelMatch || amountMatch;
    }
    return true;
  });

  const availableBalance = overview?.wallet?.balance ?? 0;
  const lockedBalance = overview?.wallet?.heldBalance ?? 0;
  const totalBalance = overview?.wallet?.total ?? 0;

  return (
    <section className="wallet-page" aria-label="Ví tiền và Ký quỹ hệ thống">
      {successToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 999999,
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '14px 22px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontWeight: 600,
            fontSize: '14.5px',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            ✓
          </span>
          <span>{successToast}</span>
        </div>
      )}
      {searchParams.get('from') === 'subscription' && (
        <div style={{ marginBottom: '16px' }}>
          <Link
            className="wallet-btn-secondary"
            to={`${role === 'SUPPLIER' ? '/supplier' : '/store'}/subscription`}
          >
            ← Quay lại mua gói dịch vụ
          </Link>
        </div>
      )}

      {/* 1. Hero Header Banner */}
      <div className="wallet-hero-card">
        <div className="wallet-hero-info">
          <div className="wallet-hero-badge">
            <Icon name="shield" />
            <span>
              {role === 'STORE_OWNER'
                ? 'KÝ QUỸ AN TOÀN · BẢO HỘ 100% TIỀN CỌC'
                : 'DOANH THU & KÝ QUỸ CHỦ VỰA'}
            </span>
          </div>
          <h1 className="wallet-hero-title">
            {role === 'STORE_OWNER'
              ? 'Ví Tiền & Ký Quỹ Đơn Hàng'
              : 'Ví Tiền & Ký Quỹ Bán Sỉ'}
          </h1>
          {role !== 'STORE_OWNER' && (
            <p className="wallet-hero-desc">
              Quản lý tiền cọc từ các tiệm tạp hóa, đối soát doanh thu bán sỉ và rút tiền về tài khoản ngân hàng dễ dàng 24/7.
            </p>
          )}
        </div>

        <div className="wallet-hero-actions">
          <button
            type="button"
            className="wallet-btn-primary"
            onClick={() => {
              setShowDepositModal(true);
              setQr(null);
              setDepositAmount('500000');
            }}
          >
            <Icon name="sparkle" />
            <span>+ Nạp tiền (VietQR)</span>
          </button>

          <button
            type="button"
            className="wallet-btn-secondary"
            onClick={() => {
              setShowWithdrawModal(true);
              setWithdrawError('');
            }}
          >
            <Icon name="download" />
            <span>Rút tiền về ngân hàng</span>
          </button>

          <button
            type="button"
            className="wallet-btn-refresh"
            onClick={load}
            disabled={loading || busy}
            title="Làm mới số dư và lịch sử giao dịch"
          >
            <span style={{ display: 'inline-block', transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>
              ↻
            </span>
            <span>{loading ? 'Đang tải…' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '12px',
            color: '#065f46',
            fontWeight: 600,
            fontSize: '13.5px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
          role="status"
        >
          <span style={{ fontSize: '16px' }}>✓</span>
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            color: '#b91c1c',
            fontWeight: 600,
            fontSize: '13.5px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
          role="alert"
        >
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* 3. Three Balance Cards */}
      <div className="wallet-grid">
        {/* Card 1: Available Balance */}
        <div className="wallet-card wallet-card-primary">
          <div>
            <div className="wallet-card-header">
              <span className="wallet-card-label">Số dư khả dụng</span>
              <div className="wallet-card-icon-box">
                <Icon name="leaf" />
              </div>
            </div>
            <div className="wallet-card-value">
              {loading ? 'Đang tải…' : money(availableBalance)}
            </div>
          </div>
          <div className="wallet-card-footer">
            <button
              type="button"
              className="wallet-card-action-link"
              onClick={() => {
                setShowDepositModal(true);
                setQr(null);
                setDepositAmount('500000');
              }}
            >
              + Nạp nhanh
            </button>
          </div>
        </div>

        {/* Card 2: Locked in Escrow */}
        <div className="wallet-card wallet-card-locked">
          <div>
            <div className="wallet-card-header">
              <span className="wallet-card-label">Tiền đang ký quỹ (Cọc)</span>
              <div className="wallet-card-icon-box">
                <Icon name="lock" />
              </div>
            </div>
            <div className="wallet-card-value">
              {loading ? 'Đang tải…' : money(lockedBalance)}
            </div>
          </div>
        </div>

        {/* Card 3: Total Balance */}
        <div className="wallet-card wallet-card-total">
          <div>
            <div className="wallet-card-header">
              <span className="wallet-card-label">Tổng số dư ví</span>
              <div className="wallet-card-icon-box">
                <Icon name="chart" />
              </div>
            </div>
            <div className="wallet-card-value">
              {loading ? 'Đang tải…' : money(totalBalance)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recent VietQR Deposit Requests */}
      {deposits.length > 0 && (
        <section className="wallet-pending-panel" aria-label="Phiếu nạp VietQR gần đây">
          <div className="wallet-pending-header">
            <h3>
              <Icon name="sparkle" />
              <span>Phiếu nạp tiền VietQR gần đây</span>
            </h3>
            <span className="wallet-pending-count">{deposits.length} phiếu</span>
          </div>
          <div className="wallet-pending-grid">
            {deposits.map((request) => (
              <div key={request.id} className="wallet-pending-item">
                <div className="wallet-pending-item-left">
                  <span className="wallet-pending-code">Mã phiếu: #{request.id}</span>
                  <span className="wallet-pending-time">{dateTime(request.createdAt)}</span>
                </div>
                <div className="wallet-pending-item-right">
                  <span className="wallet-pending-amount">+{money(request.amount)}</span>
                  {request.status === 'PENDING' && (
                    <span className="wallet-status-pill wallet-status-pending">
                      <span className="wallet-pulse-dot" />
                      <span>Đang chờ đối soát</span>
                    </span>
                  )}
                  {request.status === 'APPROVED' && (
                    <span className="wallet-status-pill wallet-status-approved">
                      <span>✓ Đã duyệt</span>
                    </span>
                  )}
                  {request.status === 'REJECTED' && (
                    <span className="wallet-status-pill wallet-status-rejected">
                      <span>✕ Từ chối{request.adminNote ? `: ${request.adminNote}` : ''}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Transaction History Panel */}
      <div className="wallet-history-card">
        <div className="wallet-history-header">
          <div className="wallet-history-title-group">
            <h3>Lịch sử biến động số dư</h3>
          </div>

          <div className="wallet-history-controls">
            {/* Search Box */}
            <div className="wallet-search-box">
              <input
                type="text"
                className="wallet-search-input"
                placeholder="Tìm mã GD, nội dung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Quick Filter Tabs */}
            <div className="wallet-filter-tabs">
              {(
                [
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'ESCROW', label: 'Ký quỹ cọc' },
                  { id: 'DEPOSIT', label: 'Nạp tiền' },
                  { id: 'WITHDRAW', label: 'Rút tiền' },
                  { id: 'OTHER', label: 'Thanh toán & Khác' },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  className={`wallet-filter-tab ${filter === btn.id ? 'is-active' : ''}`}
                  onClick={() => setFilter(btn.id)}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!filteredTransactions.length ? (
          <div className="wallet-empty-state">
            <div className="wallet-empty-icon">
              <Icon name="chart" />
            </div>
            <h4 className="wallet-empty-title">Không tìm thấy giao dịch nào</h4>
            <p className="wallet-empty-text">
              {searchQuery
                ? `Không có giao dịch nào khớp với từ khóa "${searchQuery}".`
                : 'Chưa có biến động số dư nào trong danh mục này.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                className="wallet-btn-secondary"
                onClick={() => setSearchQuery('')}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Xóa bộ lọc tìm kiếm
              </button>
            )}
          </div>
        ) : (
          <div className="wallet-table-container">
            <table className="wallet-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Thời gian</th>
                  <th style={{ width: '135px' }}>Mã GD</th>
                  <th>Loại giao dịch</th>
                  <th style={{ width: '140px' }}>Biến động</th>
                  <th style={{ width: '135px' }}>Số dư sau GD</th>
                  <th style={{ width: '110px' }}>Kênh</th>
                  <th>Nội dung / Diễn giải</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const meta = TYPE_META[tx.type] || {
                    label: tx.typeLabel || tx.type,
                    tagClass: 'tag-info',
                  };
                  const isPositive = tx.direction === 'CREDIT';
                  const absAmount = Math.abs(tx.amount);
                  const refCode = tx.reference || `TRX-${tx.id}`;

                  return (
                    <tr key={tx.id}>
                      <td className="tx-time-cell">{dateTime(tx.createdAt)}</td>
                      <td className="tx-ref-cell">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>{refCode}</span>
                          <button
                            type="button"
                            onClick={() => void copyText(refCode, tx.id)}
                            title="Sao chép mã giao dịch"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: '2px',
                              color: '#94a3b8',
                              fontSize: '11px',
                            }}
                          >
                            {copiedTxId === tx.id ? '✓' : '📋'}
                          </button>
                        </span>
                      </td>
                      <td>
                        <span className={`tx-tag ${meta.tagClass}`}>{meta.label}</span>
                      </td>
                      <td className={`tx-amount-cell ${isPositive ? 'positive' : 'negative'}`}>
                        {isPositive ? `+${money(absAmount)}` : `-${money(absAmount)}`}
                      </td>
                      <td className="tx-balance-cell">{money(tx.balanceAfter)}</td>
                      <td>
                        <span className="tx-channel-badge">
                          {tx.method === 'SANDBOX' ? 'Thử nghiệm' : 'VietQR / Ví'}
                        </span>
                      </td>
                      <td className="tx-desc-cell">
                        {tx.note || 'Giao dịch qua hệ thống SupplyMind Escrow'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nạp Tiền Qua VietQR */}
      {showDepositModal && (
        <div
          className="wallet-modal-backdrop"
          onMouseDown={(e) => {
            depositBackdropMouseDown.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (depositBackdropMouseDown.current && e.target === e.currentTarget) {
              setShowDepositModal(false);
            }
            depositBackdropMouseDown.current = false;
          }}
        >
          <div
            className="wallet-modal-card"
            style={{ maxWidth: '520px' }}
          >
            <div
              className="wallet-modal-header"
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>
                Nạp Tiền Vào Ví Hệ Thống
              </h3>
              <button
                type="button"
                className="wallet-modal-close"
                onClick={() => setShowDepositModal(false)}
                title="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="wallet-modal-body">
              {!qr ? (
                <form onSubmit={(e) => void handleGenerateQr(e)}>
                  <div className="wallet-form-group">
                    <label className="wallet-form-label">Chọn nhanh số tiền nạp:</label>
                    <div className="wallet-amount-grid">
                      {QUICK_AMOUNTS.map((amt) => {
                        const isSelected = depositAmount === String(amt);
                        return (
                          <button
                            key={amt}
                            type="button"
                            className={`wallet-amount-chip ${isSelected ? 'is-active' : ''}`}
                            onClick={() => setDepositAmount(String(amt))}
                          >
                            {money(amt)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="wallet-form-group">
                    <label htmlFor="deposit-custom-amount" className="wallet-form-label">
                      Hoặc nhập số tiền tùy ý (VNĐ):
                    </label>
                    <input
                      id="deposit-custom-amount"
                      type="number"
                      min="10000"
                      step="10000"
                      className="wallet-form-input"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Ví dụ: 500000"
                      required
                    />
                    {Number(depositAmount) > 0 && (
                      <span style={{ display: 'block', marginTop: '6px', fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                        Số tiền nạp: {money(Number(depositAmount))}
                      </span>
                    )}
                  </div>

                  <div className="wallet-form-group">
                    <label htmlFor="deposit-custom-note" className="wallet-form-label">
                      Ghi chú nạp tiền (Tùy chọn):
                    </label>
                    <input
                      id="deposit-custom-note"
                      type="text"
                      maxLength={100}
                      className="wallet-form-input"
                      value={depositNote}
                      onChange={(e) => setDepositNote(e.target.value)}
                      placeholder="Nạp tiền vào SupplyMind AI"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="wallet-btn-primary"
                    disabled={qrLoading || !Number(depositAmount)}
                    style={{ width: '100%', padding: '13px', fontSize: '14.5px' }}
                  >
                    {qrLoading ? 'Đang tạo mã VietQR…' : `Tạo mã VietQR nạp ${money(Number(depositAmount) || 0)}`}
                  </button>
                </form>
              ) : (
                <div>
                  <WalletQrCode
                    payload={qr.payload}
                    amount={qr.amount}
                    bankName={qr.bankName}
                    accountNumber={qr.accountNumber}
                    accountHolder={qr.accountHolder}
                    billNumber={qr.billNumber}
                    onClose={() => {
                      setShowDepositModal(false);
                      setQr(null);
                      setQrTicketId(null);
                    }}
                    onChangeAmount={() => setQr(null)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Yêu Cầu Rút Tiền Về Ngân Hàng */}
      {showWithdrawModal && (
        <div
          className="wallet-modal-backdrop"
          onMouseDown={(e) => {
            withdrawBackdropMouseDown.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (withdrawBackdropMouseDown.current && e.target === e.currentTarget) {
              setShowWithdrawModal(false);
            }
            withdrawBackdropMouseDown.current = false;
          }}
        >
          <div
            className="wallet-modal-card"
            style={{ maxWidth: '520px' }}
          >
            <div
              className="wallet-modal-header"
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>
                Rút Tiền Về Tài Khoản Ngân Hàng
              </h3>
              <button
                type="button"
                className="wallet-modal-close"
                onClick={() => setShowWithdrawModal(false)}
                title="Đóng"
              >
                ✕
              </button>
            </div>

            <form className="wallet-modal-body" onSubmit={(e) => void handleSubmitWithdraw(e)}>
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '12px',
                  fontSize: '13px',
                  color: '#334155',
                  marginBottom: '18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Số dư khả dụng hiện tại:</span>
                <strong style={{ color: '#059669', fontSize: '15px' }}>{money(availableBalance)}</strong>
              </div>

              {withdrawError && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#b91c1c',
                    fontSize: '13px',
                    marginBottom: '14px',
                  }}
                >
                  {withdrawError}
                </div>
              )}

              <div className="wallet-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="withdraw-amount" className="wallet-form-label" style={{ margin: 0 }}>
                    Số tiền muốn rút (VNĐ): <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  {availableBalance >= 50000 && (
                    <button
                      type="button"
                      onClick={() => setWithdrawForm({ ...withdrawForm, amount: String(availableBalance) })}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#059669',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Rút tối đa
                    </button>
                  )}
                </div>
                <input
                  id="withdraw-amount"
                  type="number"
                  min="50000"
                  max={availableBalance}
                  step="10000"
                  required
                  className="wallet-form-input"
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                  placeholder="Ví dụ: 1000000 (tối thiểu 50.000 ₫)"
                />
              </div>

              <div className="wallet-form-group">
                <label htmlFor="withdraw-bank" className="wallet-form-label">
                  Ngân hàng thụ hưởng:
                </label>
                <select
                  id="withdraw-bank"
                  className="wallet-form-select"
                  value={withdrawForm.bankName}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, bankName: e.target.value })}
                >
                  {POPULAR_BANKS.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </div>

              <div className="wallet-form-group">
                <label htmlFor="withdraw-account-number" className="wallet-form-label">
                  Số tài khoản nhận tiền: <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="withdraw-account-number"
                  type="text"
                  required
                  className="wallet-form-input"
                  value={withdrawForm.bankAccountNumber}
                  onChange={(e) =>
                    setWithdrawForm({ ...withdrawForm, bankAccountNumber: e.target.value })
                  }
                  placeholder="Nhập số tài khoản ngân hàng…"
                />
              </div>

              <div className="wallet-form-group">
                <label htmlFor="withdraw-account-holder" className="wallet-form-label">
                  Tên chủ tài khoản: <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="withdraw-account-holder"
                  type="text"
                  required
                  className="wallet-form-input"
                  value={withdrawForm.bankAccountHolder}
                  onChange={(e) =>
                    setWithdrawForm({
                      ...withdrawForm,
                      bankAccountHolder: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="NGUYEN VAN A"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div className="wallet-form-group">
                <label htmlFor="withdraw-note" className="wallet-form-label">
                  Ghi chú rút tiền (Tùy chọn):
                </label>
                <input
                  id="withdraw-note"
                  type="text"
                  maxLength={100}
                  className="wallet-form-input"
                  value={withdrawForm.note}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, note: e.target.value })}
                  placeholder="Ví dụ: Rút tiền doanh thu tuần này…"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  className="wallet-btn-secondary"
                  onClick={() => setShowWithdrawModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="wallet-btn-primary"
                  disabled={busy || !Number(withdrawForm.amount)}
                >
                  {busy ? 'Đang gửi yêu cầu…' : 'Xác nhận rút tiền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
