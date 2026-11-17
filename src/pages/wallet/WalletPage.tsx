import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../catalog.css';
import '../wallet.css';
import './wallet.css';
import Icon from '../../components/Icon';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import {
  createQrDepositRequest,
  createWithdrawalRequest,
  getQrDepositTicket,
  getWallet,
  getWalletTransactions,
  type QrCode,
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
  SUBSCRIPTION_PAYMENT: { label: 'Mua gói Basic', tagClass: 'tag-info', category: 'OTHER' },
  INITIAL_MOCK: { label: 'Khởi tạo thử nghiệm', tagClass: 'tag-info', category: 'MOCK' },
  MOCK_ADD: { label: 'Cộng tiền thử nghiệm', tagClass: 'tag-success', category: 'MOCK' },
  MOCK_RESET: { label: 'Đặt lại thử nghiệm', tagClass: 'tag-warning', category: 'MOCK' },
  SANDBOX_DEPOSIT: { label: 'Nạp tiền thử nghiệm', tagClass: 'tag-info', category: 'MOCK' },
  SANDBOX_WITHDRAWAL: { label: 'Rút tiền thử nghiệm', tagClass: 'tag-warning', category: 'MOCK' },
  DEPOSIT: { label: 'Nạp tiền', tagClass: 'tag-success', category: 'DEPOSIT' },
  QR_DEPOSIT: { label: 'Nạp tiền qua QR', tagClass: 'tag-success', category: 'DEPOSIT' },
  WITHDRAWAL_HOLD: { label: 'Tạm giữ tiền rút', tagClass: 'tag-warning', category: 'WITHDRAW' },
  WITHDRAWAL_RELEASE: { label: 'Hoàn lại tiền rút', tagClass: 'tag-info', category: 'WITHDRAW' },
  WITHDRAWAL_PAYOUT: { label: 'Chuyển khoản rút tiền', tagClass: 'tag-danger', category: 'WITHDRAW' },
  ESCROW_LOCK: { label: 'Tạm khóa cọc đơn hàng', tagClass: 'tag-danger', category: 'ESCROW' },
  ESCROW_RELEASE: { label: 'Giải phóng cọc đơn hàng', tagClass: 'tag-info', category: 'ESCROW' },
  ESCROW_RECEIVED: { label: 'Nhận cọc đơn giao xong', tagClass: 'tag-success', category: 'ESCROW' },
  ESCROW_REFUND: { label: 'Hoàn trả cọc đơn hàng', tagClass: 'tag-success', category: 'ESCROW' },
  PENALTY_CONFISCATION: { label: 'Khấu trừ cọc vi phạm', tagClass: 'tag-danger', category: 'ESCROW' },
  COMPENSATION_RECEIVED: { label: 'Nhận bồi thường cọc', tagClass: 'tag-success', category: 'ESCROW' },
  ORDER_PAYMENT: { label: 'Thanh toán đơn hàng', tagClass: 'tag-danger', category: 'OTHER' },
  ORDER_RECEIVE: { label: 'Nhận tiền đơn hàng', tagClass: 'tag-success', category: 'OTHER' },
  COMMISSION_FEE: { label: 'Phí hoa hồng nền tảng', tagClass: 'tag-warning', category: 'OTHER' },
  REFUND: { label: 'Hoàn tiền', tagClass: 'tag-success', category: 'OTHER' },
  REFUND_RECEIVED: { label: 'Thu hồi tiền hoàn', tagClass: 'tag-danger', category: 'OTHER' },
};

type FilterCategory = 'ALL' | 'ESCROW' | 'DEPOSIT' | 'WITHDRAW';

const ITEMS_PER_PAGE = 15;

export default function WalletPage({
  onLogout,
  role,
}: {
  onLogout: () => void;
  role?: 'STORE_OWNER' | 'SUPPLIER';
}) {
  const [searchParams] = useSearchParams();
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Transaction filter & pagination
  const [filter, setFilter] = useState<FilterCategory>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');

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
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(''), 4500);
    return () => clearTimeout(timer);
  }, [successToast]);

  const load = useCallback(async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        getWallet(),
        getWalletTransactions({ page: 1, limit: 100 }),
      ]);
      setError('');
      setOverview(walletRes);
      setTransactions(txRes.transactions || []);
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
    queueMicrotask(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; };
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
      setNotice(`Đã gửi yêu cầu rút ${money(parsedAmount)}. Hệ thống sẽ xử lý giải ngân.`);
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

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'ALL') return true;
    const meta = TYPE_META[t.type];
    return meta?.category === filter;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
      setPageInput(String(totalPages));
    }
  }, [totalPages, currentPage]);

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
        <Link className="ghost-button" to={`${role === 'SUPPLIER' ? '/supplier' : '/store'}/subscription`}>Quay lại mua gói Basic</Link>
      )}
      {/* Catalog Hero Banner */}
      <div
        className="catalog-hero wallet-hero"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <p className="form-eyebrow">TÀI CHÍNH & KÝ QUỸ AN TOÀN</p>
          <h1>Ví tiền & Ký quỹ hệ thống SupplyMind</h1>
          <p>
            Quản lý số dư khả dụng, tiền cọc đơn hàng đang được bảo hộ qua tài khoản trung gian (Escrow)
            và kiểm tra chi tiết lịch sử biến động số dư.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="dash-primary"
            onClick={() => {
              setShowDepositModal(true);
              setQr(null);
              setDepositAmount('500000');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#059669',
              borderColor: '#059669',
              color: '#ffffff',
              padding: '10px 18px',
              fontWeight: 650,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <Icon name="sparkle" /> + Nạp tiền ví (VietQR)
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setShowWithdrawModal(true);
              setWithdrawError('');
            }}
            style={{
              backgroundColor: '#ffffff',
              color: '#1e293b',
              border: '1px solid #cbd5e1',
              padding: '10px 18px',
              fontWeight: 600,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Rút tiền về tài khoản
          </button>
          <button
            type="button"
            className="text-button"
            onClick={load}
            disabled={loading || busy}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#059669',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: '8px 12px',
            }}
          >
            ↻ Làm mới
          </button>
        </div>
      </div>

      {notice && (
        <p className="supplier-success" role="status" style={{ marginBottom: '16px' }}>
          {notice}
        </p>
      )}

      {error && (
        <p className="error-notice" role="alert" style={{ marginBottom: '16px' }}>
          {error}
        </p>
      )}

      {/* 3 Wallet Balance Cards (Signature Gradient Design) */}
      <div className="wallet-grid">
        <div className="wallet-card wallet-card-primary">
          <span className="wallet-card-title">Số dư khả dụng</span>
          <strong className="wallet-card-amount">
            {loading ? 'Đang tải…' : money(availableBalance)}
          </strong>
          <span className="wallet-card-desc">
            Dùng để đặt cọc 10% cam kết đơn hàng sỉ hoặc thanh toán
          </span>
        </div>

        <div className="wallet-card wallet-card-locked">
          <span className="wallet-card-title">Đang ký quỹ (Tạm giữ cọc)</span>
          <strong className="wallet-card-amount">
            {loading ? 'Đang tải…' : money(lockedBalance)}
          </strong>
          <span className="wallet-card-desc">
            Bảo đảm an toàn cho các đơn hàng đang giao hoặc xử lý sự cố
          </span>
        </div>

        <div className="wallet-card wallet-card-total">
          <span className="wallet-card-title">Tổng số dư ví</span>
          <strong className="wallet-card-amount">
            {loading ? 'Đang tải…' : money(totalBalance)}
          </strong>
          <span className="wallet-card-desc">Số dư khả dụng + Tiền cọc đang ký quỹ</span>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="supplier-panel wallet-transactions-panel">
        <div
          className="transactions-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '14px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>Lịch sử biến động số dư</h3>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Tổng cộng {filteredTransactions.length} giao dịch
            </span>
          </div>

          {/* Quick Filter Buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(
              [
                { id: 'ALL', label: 'Tất cả' },
                { id: 'ESCROW', label: 'Ký quỹ cọc' },
                { id: 'DEPOSIT', label: 'Nạp tiền' },
                { id: 'WITHDRAW', label: 'Rút tiền' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => {
                  setFilter(btn.id);
                  setCurrentPage(1);
                  setPageInput('1');
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${filter === btn.id ? '#059669' : '#cbd5e1'}`,
                  backgroundColor: filter === btn.id ? '#ecfdf5' : '#ffffff',
                  color: filter === btn.id ? '#065f46' : '#475569',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {!filteredTransactions.length ? (
          <p className="empty-text">Chưa có giao dịch biến động số dư nào trong danh mục này.</p>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th style={{ width: '135px' }}>Thời gian</th>
                    <th style={{ width: '115px' }}>Mã GD</th>
                    <th>Loại giao dịch</th>
                    <th style={{ width: '130px' }}>Số tiền</th>
                    <th style={{ width: '130px' }}>Số dư sau GD</th>
                    <th>Nội dung</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((tx) => {
                    const meta = TYPE_META[tx.type] || {
                      label: tx.typeLabel || tx.type,
                      tagClass: 'tag-info',
                    };
                    const isPositive = tx.direction === 'CREDIT';
                    const absAmount = Math.abs(tx.amount);
                    return (
                      <tr key={tx.id}>
                        <td className="tx-time" style={{ fontSize: '12.5px', color: '#475569' }}>
                          {dateTime(tx.createdAt)}
                        </td>
                        <td style={{ fontSize: '13px', fontWeight: 650, color: '#0f172a' }}>
                          {tx.reference || `TRX-${tx.id}`}
                        </td>
                        <td>
                          <span className={`tx-tag ${meta.tagClass}`}>{meta.label}</span>
                        </td>
                        <td className={`tx-amount ${isPositive ? 'positive' : 'negative'}`}>
                          {isPositive ? `+${money(absAmount)}` : `-${money(absAmount)}`}
                        </td>
                        <td className="tx-balance">{money(tx.balanceAfter)}</td>
                        <td className="tx-desc" style={{ fontSize: '13px', color: '#334155' }}>
                          {tx.note || 'Giao dịch qua hệ thống SupplyMind Escrow'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredTransactions.length > 0 && (
              <div
                className="catalog-pagination"
                style={{
                  marginTop: '16px',
                  padding: '12px 18px',
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #e5ebe2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <button
                  type="button"
                  className="ghost-button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    fontSize: '13px',
                  }}
                  disabled={currentPage <= 1}
                  onClick={() => {
                    const target = Math.max(1, currentPage - 1);
                    setCurrentPage(target);
                    setPageInput(String(target));
                  }}
                  title="Trang trước"
                >
                  <span style={{ fontSize: '15px', lineHeight: 1 }}>←</span> Trang trước
                </button>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#55695b',
                  }}
                >
                  <span>Trang</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = parseInt(pageInput, 10);
                        if (!isNaN(val)) {
                          const clamped = Math.max(1, Math.min(totalPages, val));
                          setCurrentPage(clamped);
                          setPageInput(String(clamped));
                        } else {
                          setPageInput(String(currentPage));
                        }
                      }
                    }}
                    onBlur={() => {
                      const val = parseInt(pageInput, 10);
                      if (!isNaN(val)) {
                        const clamped = Math.max(1, Math.min(totalPages, val));
                        setCurrentPage(clamped);
                        setPageInput(String(clamped));
                      } else {
                        setPageInput(String(currentPage));
                      }
                    }}
                    style={{
                      width: '46px',
                      textAlign: 'center',
                      padding: '5px 4px',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#234739',
                      border: '1px solid #c8d7c4',
                      borderRadius: '7px',
                      background: '#f9fcf8',
                    }}
                    title="Nhập số trang và nhấn Enter để chuyển trang"
                  />
                  <span>/ {totalPages}</span>
                  <span style={{ color: '#8fa896', fontSize: '12px' }}>
                    ({filteredTransactions.length} giao dịch)
                  </span>
                </div>

                <button
                  type="button"
                  className="ghost-button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    fontSize: '13px',
                  }}
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    const target = Math.min(totalPages, currentPage + 1);
                    setCurrentPage(target);
                    setPageInput(String(target));
                  }}
                  title="Trang tiếp theo"
                >
                  Trang sau <span style={{ fontSize: '15px', lineHeight: 1 }}>→</span>
                </button>
              </div>
            )}
          </>
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
                onClick={() => setShowDepositModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <div className="wallet-modal-body" style={{ padding: '20px' }}>
              {!qr ? (
                <form onSubmit={(e) => void handleGenerateQr(e)}>
                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 650,
                        color: '#1e293b',
                        marginBottom: '8px',
                      }}
                    >
                      Chọn nhanh số tiền nạp:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {[200000, 500000, 1000000, 2000000, 5000000, 10000000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDepositAmount(String(amt))}
                          style={{
                            padding: '8px 6px',
                            borderRadius: '6px',
                            border: `1.5px solid ${depositAmount === String(amt) ? '#059669' : '#cbd5e1'}`,
                            backgroundColor: depositAmount === String(amt) ? '#ecfdf5' : '#ffffff',
                            color: depositAmount === String(amt) ? '#065f46' : '#334155',
                            fontWeight: 600,
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          {money(amt)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label
                      htmlFor="deposit-custom-amount"
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 650,
                        color: '#1e293b',
                        marginBottom: '6px',
                      }}
                    >
                      Hoặc nhập số tiền tùy chọn (VNĐ):
                    </label>
                    <input
                      id="deposit-custom-amount"
                      type="number"
                      min="10000"
                      step="10000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Ví dụ: 500000"
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

                  <div style={{ marginBottom: '16px' }}>
                    <label
                      htmlFor="deposit-custom-note"
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 650,
                        color: '#1e293b',
                        marginBottom: '6px',
                      }}
                    >
                      Ghi chú chuyển khoản (Tùy chọn):
                    </label>
                    <input
                      id="deposit-custom-note"
                      type="text"
                      maxLength={100}
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
                    disabled={qrLoading || !Number(depositAmount)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 650,
                      cursor: qrLoading || !Number(depositAmount) ? 'not-allowed' : 'pointer',
                    }}
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
                onClick={() => setShowWithdrawModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <form
              className="wallet-modal-body"
              onSubmit={(e) => void handleSubmitWithdraw(e)}
              style={{ padding: '20px' }}
            >
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#334155',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Số dư khả dụng hiện tại:</span>
                <strong style={{ color: '#059669' }}>{money(availableBalance)}</strong>
              </div>

              {withdrawError && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#b91c1c',
                    fontSize: '13px',
                    marginBottom: '14px',
                  }}
                >
                  {withdrawError}
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label
                  htmlFor="withdraw-amount"
                  style={{ display: 'block', fontSize: '13px', fontWeight: 650, color: '#1e293b', marginBottom: '6px' }}
                >
                  Số tiền muốn rút (VNĐ): <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="withdraw-amount"
                  type="number"
                  min="50000"
                  max={availableBalance}
                  step="10000"
                  required
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                  placeholder="Ví dụ: 1000000"
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

              <div style={{ marginBottom: '14px' }}>
                <label
                  htmlFor="withdraw-bank"
                  style={{ display: 'block', fontSize: '13px', fontWeight: 650, color: '#1e293b', marginBottom: '6px' }}
                >
                  Ngân hàng thụ hưởng:
                </label>
                <select
                  id="withdraw-bank"
                  value={withdrawForm.bankName}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, bankName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                  }}
                >
                  {POPULAR_BANKS.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label
                  htmlFor="withdraw-account-number"
                  style={{ display: 'block', fontSize: '13px', fontWeight: 650, color: '#1e293b', marginBottom: '6px' }}
                >
                  Số tài khoản nhận tiền: <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="withdraw-account-number"
                  type="text"
                  required
                  value={withdrawForm.bankAccountNumber}
                  onChange={(e) =>
                    setWithdrawForm({ ...withdrawForm, bankAccountNumber: e.target.value })
                  }
                  placeholder="Nhập số tài khoản ngân hàng…"
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

              <div style={{ marginBottom: '14px' }}>
                <label
                  htmlFor="withdraw-account-holder"
                  style={{ display: 'block', fontSize: '13px', fontWeight: 650, color: '#1e293b', marginBottom: '6px' }}
                >
                  Tên chủ tài khoản: <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="withdraw-account-holder"
                  type="text"
                  required
                  value={withdrawForm.bankAccountHolder}
                  onChange={(e) =>
                    setWithdrawForm({
                      ...withdrawForm,
                      bankAccountHolder: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="NGUYEN VAN A"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    textTransform: 'uppercase',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy || !Number(withdrawForm.amount)}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    cursor: busy || !Number(withdrawForm.amount) ? 'not-allowed' : 'pointer',
                    fontWeight: 650,
                  }}
                >
                  {busy ? 'Đang xử lý…' : 'Xác nhận rút tiền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
