import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getApiError, isUnauthenticated } from '../../services/api';
import { AdminDialog, Empty, LoadState, Metric, Pager } from './admin.shared';
import { dateTime, money } from './admin.data';
import {
  getAdminPayments,
  getAdminWithdrawal,
  getAdminWithdrawals,
  refundOrder,
  rejectWithdrawal,
  type OrderPayment,
  type WithdrawalRequest,
} from '../../services/wallet.api';

type Props = { onLogout: () => void };

export type AdminWalletTab = 'overview' | 'withdrawals' | 'payments';

const tabs: { key: AdminWalletTab; label: string }[] = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'withdrawals', label: 'Yêu cầu rút tiền' },
  { key: 'payments', label: 'Thanh toán đơn hàng' },
];

/** Sub navigation shared by every wallet panel. */
function WalletTabs({ current }: { current: AdminWalletTab }) {
  return (
    <nav className="admin-wallet-tabs" aria-label="Quản lý ví tiền">
      {tabs.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.key === 'overview' ? '/admin/wallet' : `/admin/wallet/${tab.key}`}
          end
          className={({ isActive }) => (isActive || current === tab.key ? 'active' : undefined)}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="admin-heading">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action}
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** Entry point rendered by the admin shell for every wallet sub tab. */
export default function AdminWalletSection({ tab, onLogout }: Props & { tab: AdminWalletTab }) {
  return (
    <>
      <WalletTabs current={tab} />
      {tab === 'withdrawals' ? (
        <WithdrawalRequests onLogout={onLogout} />
      ) : tab === 'payments' ? (
        <OrderPayments onLogout={onLogout} />
      ) : (
        <WalletOverview onLogout={onLogout} />
      )}
    </>
  );
}

/** Landing panel: pending counts and shortcuts for the admin. */
function WalletOverview({ onLogout }: Props) {
  const [revision, setRevision] = useState(0);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [withdrawalList, paymentList] = await Promise.all([
        getAdminWithdrawals({ page: 1 }),
        getAdminPayments({ page: 1 }),
      ]);
      setWithdrawals(withdrawalList.requests);
      setPayments(paymentList.payments);
      setError('');
    } catch (issue) {
      if (isUnauthenticated(issue)) return onLogout();
      setError(getApiError(issue));
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, revision]);

  const pendingWithdrawals = withdrawals.filter((item) => item.status === 'PENDING');
  const pendingWithdrawalAmount = pendingWithdrawals.reduce((sum, item) => sum + item.amount, 0);
  const totalPaidOrders = payments.length;
  const totalPaidAmount = payments.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <Heading
        eyebrow="WALLET MANAGEMENT"
        title="Quản lý ví & Ký quỹ"
        description="Duyệt và hoàn tất yêu cầu rút tiền của cửa hàng và chủ vựa, theo dõi thanh toán đơn hàng và tiền cọc ký quỹ."
        action={
          <button disabled={loading} onClick={() => setRevision((n) => n + 1)}>
            ↻ Làm mới
          </button>
        }
      />
      <LoadState loading={loading} error={error} />
      <div className="admin-metrics">
        <Metric
          label="Yêu cầu rút chờ duyệt"
          value={pendingWithdrawals.length}
          note="Cần xử lý chuyển khoản"
        />
        <Metric
          label="Tiền rút chờ chuyển"
          value={money(pendingWithdrawalAmount)}
          note="Đang tạm giữ chờ giải ngân"
        />
        <Metric
          label="Đơn hàng đã thanh toán ví"
          value={`${totalPaidOrders.toLocaleString('vi-VN')} đơn`}
          note="Giao dịch thanh toán thành công"
        />
        <Metric
          label="Tổng tiền thanh toán đơn"
          value={money(totalPaidAmount)}
          note="Dòng tiền thanh toán qua ví sàn"
        />
      </div>
    </>
  );
}

function getVietQrBankSlug(bankName: string): string {
  if (!bankName) return 'ACB';
  const clean = bankName.trim().toUpperCase();
  const map: Record<string, string> = {
    'MB': 'MB',
    'MBBANK': 'MB',
    'NGÂN HÀNG QUÂN ĐỘI': 'MB',
    'VCB': 'VCB',
    'VIETCOMBANK': 'VCB',
    'NGOẠI THƯƠNG': 'VCB',
    'TCB': 'TCB',
    'TECHCOMBANK': 'TCB',
    'KỸ THƯƠNG': 'TCB',
    'ACB': 'ACB',
    'Á CHÂU': 'ACB',
    'VPB': 'VPB',
    'VPBANK': 'VPB',
    'VIỆT NAM THỊNH VƯỢNG': 'VPB',
    'TPB': 'TPB',
    'TPBANK': 'TPB',
    'TIÊN PHONG': 'TPB',
    'STB': 'STB',
    'SACOMBANK': 'STB',
    'SÀI GÒN THƯƠNG TÍN': 'STB',
    'BIDV': 'BIDV',
    'ĐẦU TƯ VÀ PHÁT TRIỂN': 'BIDV',
    'CTG': 'CTG',
    'VIETINBANK': 'CTG',
    'CÔNG THƯƠNG': 'CTG',
    'AGRIBANK': 'AGRIBANK',
    'NÔNG NGHIỆP': 'AGRIBANK',
    'VIB': 'VIB',
    'QUỐC TẾ': 'VIB',
    'HDB': 'HDB',
    'HDBANK': 'HDB',
    'SHB': 'SHB',
    'OCB': 'OCB',
    'MSB': 'MSB',
    'TIMO': 'TIMO',
    'CAKE': 'CAKE',
  };
  for (const [key, slug] of Object.entries(map)) {
    if (clean.includes(key)) return slug;
  }
  return clean.replace(/\s+/g, '');
}

function WithdrawalRequests({ onLogout }: Props) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<WithdrawalRequest | null>(null);
  const [qrPayout, setQrPayout] = useState<WithdrawalRequest | null>(null);
  const [qrError, setQrError] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');

  function copyToClipboard(val: string, field: string) {
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(val);
    }
    setCopiedField(field);
    window.setTimeout(() => setCopiedField((cur) => (cur === field ? null : cur)), 2000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminWithdrawals({ page, status: status || undefined });
      setRequests(result.requests);
      setTotal(result.total);
      setHasMore(result.hasMore);
      setError('');
    } catch (issue) {
      if (isUnauthenticated(issue)) return onLogout();
      setError(getApiError(issue));
    } finally {
      setLoading(false);
    }
  }, [onLogout, page, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, revision]);

  // Tự động kiểm tra trạng thái khi mở modal chuyển tiền:
  // Khi SePay bắn webhook hoàn tất đơn, tự động thông báo và đóng cửa sổ
  useEffect(() => {
    if (!qrPayout) return;
    const payoutId = qrPayout.id;
    const interval = window.setInterval(async () => {
      try {
        const updated = await getAdminWithdrawal(payoutId);
        if (updated && updated.status === 'COMPLETED') {
          setNotice('Chuyển tiền thành công!');
          setQrPayout(null);
          setRevision((n) => n + 1);
        }
      } catch {
        // ignore polling error
      }
    }, 1500);
    return () => window.clearInterval(interval);
  }, [qrPayout]);

  async function reject() {
    if (!rejecting || working !== null) return;
    if (adminNote.trim().length < 3) {
      setError('Cần nhập lý do từ chối từ 3 ký tự trở lên.');
      return;
    }
    setWorking(rejecting.id);
    setError('');
    try {
      await rejectWithdrawal(rejecting.id, { adminNote: adminNote.trim() });
      setNotice('Đã từ chối yêu cầu rút tiền. Số tiền đã được hoàn lại ví.');
      setRejecting(null);
      setAdminNote('');
      setRevision((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
    } finally {
      setWorking(null);
    }
  }


  return (
    <>
      <Heading
        eyebrow="WALLET MANAGEMENT · RÚT TIỀN"
        title="Yêu cầu rút tiền"
        description="Duyệt yêu cầu rút tiền, ghi nhận chuyển khoản hoặc hoàn lại tiền khi chuyển khoản thất bại."
        action={
          <button disabled={loading} onClick={() => setRevision((n) => n + 1)}>
            ↻ Làm mới
          </button>
        }
      />
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setRevision((n) => n + 1);
        }}
      >
        <label>
          Trạng thái
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="COMPLETED">Hoàn tất</option>
            <option value="REJECTED">Đã từ chối</option>
            <option value="FAILED">Thất bại</option>
          </select>
        </label>
        <button className="admin-primary">Lọc yêu cầu</button>
      </form>
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      <LoadState loading={loading} error={error} />
      <Panel title="Danh sách yêu cầu rút tiền">
        {requests.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Số tiền</th>
                  <th>Tài khoản nhận</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <strong>{request.userName}</strong>
                      <small>@{request.username}</small>
                    </td>
                    <td>
                      <strong>{money(request.amount)}</strong>
                    </td>
                    <td>
                      <strong>{request.bankName}</strong>
                      <small>
                        {request.bankAccountNumber} · {request.bankAccountHolder}
                      </small>
                    </td>
                    <td>
                      <span className="admin-badge">{request.statusLabel}</span>
                    </td>
                    <td>
                      <small>{dateTime(request.createdAt)}</small>
                    </td>
                    <td>
                      {['PENDING', 'APPROVED'].includes(request.status) ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="admin-primary"
                            style={{
                              background: '#15803d',
                              borderColor: '#15803d',
                              color: '#ffffff',
                              fontWeight: 600,
                              padding: '6px 12px',
                            }}
                            onClick={() => {
                              setQrPayout(request);
                              setQrError(false);
                            }}
                          >
                            Xác nhận
                          </button>
                          <button
                            style={{
                              background: '#ffffff',
                              borderColor: '#ef4444',
                              color: '#dc2626',
                              fontWeight: 600,
                              padding: '6px 12px',
                            }}
                            disabled={working !== null}
                            onClick={() => {
                              setRejecting(request);
                              setAdminNote('');
                            }}
                          >
                            Từ chối
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Chưa có yêu cầu rút tiền phù hợp.</Empty>
        )}
        <Pager page={page} total={total} hasMore={hasMore} onPage={setPage} />
      </Panel>

      {rejecting && (
        <AdminDialog
          title={`Từ chối yêu cầu rút tiền #${rejecting.id}`}
          busy={working !== null}
          onClose={() => setRejecting(null)}
        >
          <div className="admin-dialog-body">
            <p>Số tiền đang giữ sẽ được hoàn lại số dư khả dụng của người dùng.</p>
            <label>
              Lý do từ chối
              <textarea
                rows={3}
                maxLength={500}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Ví dụ: Tài khoản nhận tiền không chính xác"
              />
            </label>
            <div className="admin-dialog-actions">
              <button
                type="button"
                disabled={working !== null}
                onClick={() => setRejecting(null)}
              >
                Hủy
              </button>
              <button
                className="admin-primary"
                style={{ background: '#dc2626', borderColor: '#dc2626', color: '#ffffff', fontWeight: 600 }}
                disabled={working !== null}
                onClick={() => void reject()}
              >
                {working === rejecting.id ? 'Đang xử lý…' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </AdminDialog>
      )}

      {qrPayout && (() => {
        const bankSlug = getVietQrBankSlug(qrPayout.bankName);
        const hasValidBank = Boolean(bankSlug && qrPayout.bankAccountNumber?.trim());
        const qrUrl = hasValidBank
          ? `https://img.vietqr.io/image/${bankSlug}-${qrPayout.bankAccountNumber.trim()}-compact2.png?amount=${qrPayout.amount}&addInfo=RUT%20${qrPayout.id}&accountName=${encodeURIComponent(qrPayout.bankAccountHolder)}`
          : '';
        return (
          <AdminDialog
            title={`Thông tin chuyển tiền · Đơn #${qrPayout.id}`}
            busy={working !== null}
            onClose={() => setQrPayout(null)}
          >
            <div className="admin-dialog-body" style={{ maxWidth: '440px' }}>
              {/* Hiển thị mã QR lên đầu hoặc thông báo nếu không tạo được mã QR */}
              {!hasValidBank || qrError ? (
                <div
                  style={{
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#9a3412',
                    lineHeight: '1.5',
                    textAlign: 'center',
                  }}
                >
                  ⚠️ <strong>Không tạo được mã QR</strong> cho tài khoản ngân hàng này.
                  <br />
                  Vui lòng chuyển khoản thủ công theo <strong>thông tin tài khoản</strong> bên dưới.
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    background: '#ffffff',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <img
                    src={qrUrl}
                    alt={`VietQR ${qrPayout.id}`}
                    onError={() => setQrError(true)}
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      borderRadius: '6px',
                      display: 'block',
                      margin: '0 auto',
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gap: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Ngân hàng nhận:</span>
                  <strong style={{ color: '#0f172a' }}>{qrPayout.bankName} ({bankSlug})</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Số tài khoản:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '14px' }}>
                      {qrPayout.bankAccountNumber}
                    </strong>
                    <button
                      type="button"
                      style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', border: '1px solid #cbd5e1' }}
                      onClick={() => copyToClipboard(qrPayout.bankAccountNumber, 'acc')}
                    >
                      {copiedField === 'acc' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Chủ tài khoản:</span>
                  <strong style={{ color: '#0f172a', textTransform: 'uppercase' }}>
                    {qrPayout.bankAccountHolder}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Số tiền cần chuyển:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: '#dc2626', fontSize: '15px' }}>
                      {money(qrPayout.amount)}
                    </strong>
                    <button
                      type="button"
                      style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', border: '1px solid #cbd5e1' }}
                      onClick={() => copyToClipboard(String(qrPayout.amount), 'amount')}
                    >
                      {copiedField === 'amount' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Nội dung chuyển khoản:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: '#2563eb', fontFamily: 'monospace', fontSize: '14px' }}>
                      RUT {qrPayout.id}
                    </strong>
                    <button
                      type="button"
                      style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', border: '1px solid #cbd5e1' }}
                      onClick={() => copyToClipboard(`RUT ${qrPayout.id}`, 'content')}
                    >
                      {copiedField === 'content' ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>
              </div>

              <div
                className="admin-dialog-actions"
                style={{
                  marginTop: '12px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  disabled={working !== null}
                  onClick={() => setQrPayout(null)}
                >
                  Đóng
                </button>
              </div>
            </div>
          </AdminDialog>
        );
      })()}
    </>
  );
}

/** Lists every wallet payment so the admin can audit and trigger refunds. */
function OrderPayments({ onLogout }: Props) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState<number | null>(null);
  const [refunding, setRefunding] = useState<OrderPayment | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminPayments({ page });
      setPayments(result.payments);
      setTotal(result.total);
      setHasMore(result.hasMore);
      setError('');
    } catch (issue) {
      if (isUnauthenticated(issue)) return onLogout();
      setError(getApiError(issue));
    } finally {
      setLoading(false);
    }
  }, [onLogout, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, revision]);

  async function confirmRefund() {
    if (!refunding || working !== null) return;
    if (reason.trim().length < 3) {
      setError('Cần nhập lý do hoàn tiền từ 3 ký tự trở lên.');
      return;
    }
    setWorking(refunding.id);
    setError('');
    try {
      await refundOrder(refunding.orderId, { reason: reason.trim() });
      setNotice(`Đã hoàn tiền đơn hàng #${refunding.orderId}.`);
      setRefunding(null);
      setReason('');
      setRevision((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
    } finally {
      setWorking(null);
    }
  }

  return (
    <>
      <Heading
        eyebrow="WALLET MANAGEMENT · THANH TOÁN"
        title="Thanh toán đơn hàng"
        description="Theo dõi các đơn hàng đã thanh toán bằng ví và hoàn tiền khi cần."
        action={
          <button disabled={loading} onClick={() => setRevision((n) => n + 1)}>
            ↻ Làm mới
          </button>
        }
      />
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      <LoadState loading={loading} error={error} />
      <Panel title="Lịch sử thanh toán bằng ví">
        {payments.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Đơn hàng</th>
                  <th>Người mua</th>
                  <th>Chủ vựa</th>
                  <th>Số tiền</th>
                  {/* <th>Hoa hồng</th> */}
                  <th>Trạng thái</th>
                  <th>Ngày thanh toán</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>#{payment.orderId}</strong>
                      <small>{payment.reference}</small>
                    </td>
                    <td>
                      <strong>{payment.buyerName}</strong>
                    </td>
                    <td>
                      <strong>{payment.supplierName}</strong>
                    </td>
                    <td>
                      <strong>{money(payment.amount)}</strong>
                    </td>
                    {/* <td>
                      <small>
                        {payment.commissionAmount === null
                          ? '—'
                          : money(payment.commissionAmount)}
                      </small>
                    </td> */}
                    <td>
                      <span className="admin-badge">{payment.statusLabel}</span>
                    </td>
                    <td>
                      <small>{dateTime(payment.paidAt)}</small>
                    </td>
                    <td>
                      {payment.refunded ? (
                        <small>Đã hoàn tiền</small>
                      ) : (
                        <button
                          disabled={working !== null}
                          onClick={() => {
                            setRefunding(payment);
                            setReason('');
                          }}
                        >
                          Hoàn tiền
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Chưa có đơn hàng nào thanh toán bằng ví.</Empty>
        )}
        <Pager page={page} total={total} hasMore={hasMore} onPage={setPage} />
      </Panel>

      {refunding && (
        <AdminDialog
          title={`Hoàn tiền đơn hàng #${refunding.orderId}`}
          busy={working !== null}
          onClose={() => setRefunding(null)}
        >
          <div className="admin-dialog-body">
            <p>
              Hoàn <b>{money(refunding.amount)}</b> về ví của {refunding.buyerName}. Nếu đơn đã
              thanh toán cho chủ vựa, hệ thống sẽ thu hồi tương ứng.
            </p>
            <label>
              Lý do hoàn tiền
              <textarea
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: Đơn hàng bị hủy do thiếu hàng"
              />
            </label>
            <div className="admin-dialog-actions">
              <button
                className="admin-primary"
                disabled={working !== null}
                onClick={() => void confirmRefund()}
              >
                {working === refunding.id ? 'Đang xử lý…' : 'Xác nhận hoàn tiền'}
              </button>
            </div>
          </div>
        </AdminDialog>
      )}
    </>
  );
}
