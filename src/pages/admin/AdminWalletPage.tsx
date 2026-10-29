import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getApiError, isUnauthenticated } from '../../services/api';
import { AdminDialog, Empty, LoadState, Metric, Pager } from './admin.shared';
import { dateTime, money } from './admin.data';
import {
  approveDeposit,
  approveWithdrawal,
  completeWithdrawal,
  failWithdrawal,
  getAdminDeposit,
  getAdminDeposits,
  getAdminPayments,
  getAdminWithdrawal,
  getAdminWithdrawals,
  refundOrder,
  rejectDeposit,
  rejectWithdrawal,
  type DepositRequest,
  type OrderPayment,
  type WithdrawalRequest,
} from '../../services/wallet.api';

type Props = { onLogout: () => void };

export type AdminWalletTab = 'overview' | 'deposits' | 'withdrawals' | 'payments';

const tabs: { key: AdminWalletTab; label: string }[] = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'deposits', label: 'Yêu cầu nạp tiền' },
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
      {tab === 'deposits' ? (
        <DepositRequests onLogout={onLogout} />
      ) : tab === 'withdrawals' ? (
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
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depositList, withdrawalList] = await Promise.all([
        getAdminDeposits({ page: 1 }),
        getAdminWithdrawals({ page: 1 }),
      ]);
      setDeposits(depositList.requests);
      setWithdrawals(withdrawalList.requests);
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

  const pendingDeposits = deposits.filter((item) => item.status === 'PENDING');
  const pendingWithdrawals = withdrawals.filter((item) => item.status === 'PENDING');
  const pendingDepositAmount = pendingDeposits.reduce((sum, item) => sum + item.amount, 0);
  const pendingWithdrawalAmount = pendingWithdrawals.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <Heading
        eyebrow="WALLET MANAGEMENT"
        title="Quản lý ví tiền"
        description="Xác nhận yêu cầu nạp tiền, duyệt và hoàn tất yêu cầu rút tiền của cửa hàng và chủ vựa."
        action={
          <button disabled={loading} onClick={() => setRevision((n) => n + 1)}>
            ↻ Làm mới
          </button>
        }
      />
      <LoadState loading={loading} error={error} />
      <div className="admin-metrics three">
        <Metric label="Yêu cầu nạp chờ duyệt" value={pendingDeposits.length} />
        <Metric label="Tiền nạp chờ duyệt" value={money(pendingDepositAmount)} />
        <Metric label="Yêu cầu rút chờ duyệt" value={pendingWithdrawals.length} />
      </div>
      <div className="admin-metrics three">
        <Metric label="Tiền rút đang giữ" value={money(pendingWithdrawalAmount)} />
        <Metric label="Tổng yêu cầu nạp" value={deposits.length} />
        <Metric label="Tổng yêu cầu rút" value={withdrawals.length} />
      </div>
      <Panel title="Danh sách nhanh" note="Mở các mục con để xử lý từng yêu cầu.">
        <div className="admin-quick-links">
          <NavLink to="/admin/wallet/deposits">Yêu cầu nạp tiền →</NavLink>
          <NavLink to="/admin/wallet/withdrawals">Yêu cầu rút tiền →</NavLink>
          <NavLink to="/admin/wallet/payments">Thanh toán đơn hàng →</NavLink>
        </div>
      </Panel>
    </>
  );
}

function DepositRequests({ onLogout }: Props) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [requests, setRequests] = useState<DepositRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState<number | null>(null);
  const [detail, setDetail] = useState<DepositRequest | null>(null);
  const [rejecting, setRejecting] = useState<DepositRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [reference, setReference] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminDeposits({ page, status: status || undefined });
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

  async function confirm(request: DepositRequest) {
    if (working !== null) return;
    setWorking(request.id);
    setError('');
    try {
      await approveDeposit(request.id, {
        reference: reference.trim() || undefined,
        adminNote: adminNote.trim() || undefined,
      });
      setNotice(`Đã cộng ${money(request.amount)} vào ví của ${request.userName ?? 'người dùng'}.`);
      setDetail(null);
      setAdminNote('');
      setReference('');
      setRevision((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
    } finally {
      setWorking(null);
    }
  }

  async function reject() {
    if (!rejecting || working !== null) return;
    if (adminNote.trim().length < 3) {
      setError('Cần nhập lý do từ chối từ 3 ký tự trở lên.');
      return;
    }
    setWorking(rejecting.id);
    setError('');
    try {
      await rejectDeposit(rejecting.id, { adminNote: adminNote.trim() });
      setNotice('Đã từ chối yêu cầu nạp tiền.');
      setRejecting(null);
      setAdminNote('');
      setRevision((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
    } finally {
      setWorking(null);
    }
  }

  async function openDetail(request: DepositRequest) {
    try {
      setDetail(await getAdminDeposit(request.id));
    } catch (issue) {
      setError(getApiError(issue));
    }
  }

  return (
    <>
      <Heading
        eyebrow="WALLET MANAGEMENT · NẠP TIỀN"
        title="Yêu cầu nạp tiền"
        description="Kiểm tra tài khoản nhận tiền và mã giao dịch trước khi cộng tiền vào ví người dùng."
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
            <option value="REJECTED">Đã từ chối</option>
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
      <Panel title="Danh sách yêu cầu nạp tiền" note="Chỉ xác nhận khi tiền đã vào tài khoản hệ thống.">
        {requests.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Số tiền</th>
                  <th>Nguồn</th>
                  <th>Tài khoản nhận</th>
                  <th>Mã giao dịch</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
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
                      <span
                        className={`admin-badge ${request.isSandbox ? 'good' : ''}`}
                      >
                        {request.isSandbox ? 'Tiền ảo' : 'Thường'}
                      </span>
                    </td>
                    <td>
                      <strong>{request.bankName}</strong>
                      <small>
                        {request.bankAccountNumber} · {request.bankAccountHolder}
                      </small>
                    </td>
                    <td>
                      <small>{request.reference || '—'}</small>
                    </td>
                    <td>
                      <span className="admin-badge">{request.statusLabel}</span>
                    </td>
                    <td>
                      <small>{dateTime(request.createdAt)}</small>
                    </td>
                    <td>
                      <button onClick={() => void openDetail(request)}>Chi tiết</button>
                      {request.status === 'PENDING' && (
                        <button
                          disabled={working !== null}
                          onClick={() => {
                            setRejecting(request);
                            setAdminNote('');
                          }}
                        >
                          Từ chối
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Chưa có yêu cầu nạp tiền phù hợp.</Empty>
        )}
        <Pager page={page} total={total} hasMore={hasMore} onPage={setPage} />
      </Panel>

      {detail && (
        <AdminDialog
          title={`Yêu cầu nạp tiền #${detail.id}`}
          busy={working !== null}
          onClose={() => setDetail(null)}
        >
          <div className="admin-dialog-body">
            <dl className="admin-detail-list">
              <div>
                <dt>Người dùng</dt>
                <dd>
                  {detail.userName} (@{detail.username})
                </dd>
              </div>
              <div>
                <dt>Số tiền</dt>
                <dd>{money(detail.amount)}</dd>
              </div>
              <div>
                <dt>Ngân hàng</dt>
                <dd>{detail.bankName}</dd>
              </div>
              <div>
                <dt>Số tài khoản</dt>
                <dd>{detail.bankAccountNumber}</dd>
              </div>
              <div>
                <dt>Chủ tài khoản</dt>
                <dd>{detail.bankAccountHolder}</dd>
              </div>
              <div>
                <dt>Mã giao dịch</dt>
                <dd>{detail.reference || '—'}</dd>
              </div>
              <div>
                <dt>Ghi chú</dt>
                <dd>{detail.note || '—'}</dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd>{dateTime(detail.createdAt)}</dd>
              </div>
            </dl>
            {detail.status === 'PENDING' && (
              <>
                <label>
                  Mã giao dịch thực tế
                  <input
                    maxLength={100}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ví dụ: NAP 001234"
                  />
                </label>
                <label>
                  Ghi chú kiểm duyệt
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Ghi chú cho người dùng (không bắt buộc)"
                  />
                </label>
                <div className="admin-dialog-actions">
                  <button
                    className="admin-primary"
                    disabled={working !== null}
                    onClick={() => void confirm(detail)}
                  >
                    {working === detail.id ? 'Đang xác nhận…' : 'Xác nhận đã nhận tiền'}
                  </button>
                </div>
              </>
            )}
          </div>
        </AdminDialog>
      )}

      {rejecting && (
        <AdminDialog
          title={`Từ chối yêu cầu nạp tiền #${rejecting.id}`}
          busy={working !== null}
          onClose={() => setRejecting(null)}
        >
          <div className="admin-dialog-body">
            <label>
              Lý do từ chối
              <textarea
                rows={3}
                maxLength={500}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Ví dụ: Chưa nhận được tiền trong tài khoản"
              />
            </label>
            <div className="admin-dialog-actions">
              <button
                className="admin-primary"
                disabled={working !== null}
                onClick={() => void reject()}
              >
                {working === rejecting.id ? 'Đang xử lý…' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </AdminDialog>
      )}
    </>
  );
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
  const [detail, setDetail] = useState<WithdrawalRequest | null>(null);
  const [rejecting, setRejecting] = useState<WithdrawalRequest | null>(null);
  const [completing, setCompleting] = useState<WithdrawalRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [reference, setReference] = useState('');

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

  async function approve(request: WithdrawalRequest) {
    if (working !== null) return;
    setWorking(request.id);
    setError('');
    try {
      await approveWithdrawal(request.id, { adminNote: adminNote.trim() || undefined });
      setNotice(`Đã duyệt yêu cầu rút ${money(request.amount)}.`);
      setDetail(null);
      setAdminNote('');
      setRevision((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
    } finally {
      setWorking(null);
    }
  }

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

  async function complete() {
    if (!completing || working !== null) return;
    if (reference.trim().length < 3) {
      setError('Cần nhập mã giao dịch chuyển khoản từ 3 ký tự trở lên.');
      return;
    }
    setWorking(completing.id);
    setError('');
    try {
      await completeWithdrawal(completing.id, {
        reference: reference.trim(),
        adminNote: adminNote.trim() || undefined,
      });
      setNotice(`Đã ghi nhận chuyển khoản ${money(completing.amount)}.`);
      setCompleting(null);
      setReference('');
      setAdminNote('');
      setRevision((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
    } finally {
      setWorking(null);
    }
  }

  async function markFailed() {
    if (!completing || working !== null) return;
    if (adminNote.trim().length < 3) {
      setError('Cần nhập lý do thất bại từ 3 ký tự trở lên.');
      return;
    }
    setWorking(completing.id);
    setError('');
    try {
      await failWithdrawal(completing.id, { adminNote: adminNote.trim() });
      setNotice('Đã đánh dấu thất bại. Số tiền đã được hoàn lại ví.');
      setCompleting(null);
      setAdminNote('');
      setRevision((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
    } finally {
      setWorking(null);
    }
  }

  async function openDetail(request: WithdrawalRequest) {
    try {
      setDetail(await getAdminWithdrawal(request.id));
    } catch (issue) {
      setError(getApiError(issue));
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
      <Panel title="Danh sách yêu cầu rút tiền" note="Tiền đã được giữ lại trong ví khi gửi yêu cầu.">
        {requests.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Số tiền</th>
                  <th>Nguồn</th>
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
                      <span
                        className={`admin-badge ${request.isSandbox ? 'good' : ''}`}
                      >
                        {request.isSandbox ? 'Tiền ảo' : 'Thường'}
                      </span>
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
                      <button onClick={() => void openDetail(request)}>Chi tiết</button>
                      {request.status === 'PENDING' && (
                        <button
                          disabled={working !== null}
                          onClick={() => {
                            setRejecting(request);
                            setAdminNote('');
                          }}
                        >
                          Từ chối
                        </button>
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

      {detail && (
        <AdminDialog
          title={`Yêu cầu rút tiền #${detail.id}`}
          busy={working !== null}
          onClose={() => setDetail(null)}
        >
          <div className="admin-dialog-body">
            <dl className="admin-detail-list">
              <div>
                <dt>Người dùng</dt>
                <dd>
                  {detail.userName} (@{detail.username})
                </dd>
              </div>
              <div>
                <dt>Số tiền</dt>
                <dd>{money(detail.amount)}</dd>
              </div>
              <div>
                <dt>Ngân hàng</dt>
                <dd>{detail.bankName}</dd>
              </div>
              <div>
                <dt>Số tài khoản</dt>
                <dd>{detail.bankAccountNumber}</dd>
              </div>
              <div>
                <dt>Chủ tài khoản</dt>
                <dd>{detail.bankAccountHolder}</dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
                <dd>{detail.statusLabel}</dd>
              </div>
              <div>
                <dt>Ghi chú</dt>
                <dd>{detail.note || '—'}</dd>
              </div>
              <div>
                <dt>Mã giao dịch</dt>
                <dd>{detail.reference || '—'}</dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd>{dateTime(detail.createdAt)}</dd>
              </div>
            </dl>
            {['PENDING', 'APPROVED'].includes(detail.status) && (
              <>
                <label>
                  Ghi chú kiểm duyệt
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Ghi chú cho người dùng (không bắt buộc)"
                  />
                </label>
                <div className="admin-dialog-actions">
                  {detail.status === 'PENDING' && (
                    <button
                      className="admin-primary"
                      disabled={working !== null}
                      onClick={() => void approve(detail)}
                    >
                      {working === detail.id ? 'Đang xử lý…' : 'Duyệt yêu cầu rút tiền'}
                    </button>
                  )}
                  <button
                    disabled={working !== null}
                    onClick={() => {
                      setCompleting(detail);
                      setReference('');
                      setAdminNote('');
                    }}
                  >
                    Ghi nhận chuyển khoản
                  </button>
                  <button
                    disabled={working !== null}
                    onClick={() => {
                      setRejecting(detail);
                      setAdminNote('');
                    }}
                  >
                    Từ chối
                  </button>
                </div>
              </>
            )}
          </div>
        </AdminDialog>
      )}

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
                placeholder="Ví dụ: Tài khoản không khớp chủ tài khoản"
              />
            </label>
            <div className="admin-dialog-actions">
              <button
                className="admin-primary"
                disabled={working !== null}
                onClick={() => void reject()}
              >
                {working === rejecting.id ? 'Đang xử lý…' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </AdminDialog>
      )}

      {completing && (
        <AdminDialog
          title={`Hoàn tất rút tiền #${completing.id}`}
          busy={working !== null}
          onClose={() => setCompleting(null)}
        >
          <div className="admin-dialog-body">
            <p>
              Nhập mã giao dịch chuyển khoản sau khi tiền đã được chuyển tới tài khoản của người
              dùng.
            </p>
            <label>
              Mã giao dịch chuyển khoản
              <input
                maxLength={100}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ví dụ: CK 987654"
              />
            </label>
            <label>
              Ghi chú
              <textarea
                rows={3}
                maxLength={500}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Ghi chú cho người dùng (không bắt buộc)"
              />
            </label>
            <div className="admin-dialog-actions">
              <button
                className="admin-primary"
                disabled={working !== null}
                onClick={() => void complete()}
              >
                {working === completing.id ? 'Đang lưu…' : 'Xác nhận đã chuyển khoản'}
              </button>
              <button disabled={working !== null} onClick={() => void markFailed()}>
                Chuyển khoản thất bại
              </button>
            </div>
          </div>
        </AdminDialog>
      )}
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
      <Panel title="Lịch sử thanh toán bằng ví" note="Chỉ hoàn tiền được một lần cho mỗi đơn hàng.">
        {payments.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Đơn hàng</th>
                  <th>Người mua</th>
                  <th>Chủ vựa</th>
                  <th>Số tiền</th>
                  <th>Hoa hồng</th>
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
                    <td>
                      <small>
                        {payment.commissionAmount === null
                          ? '—'
                          : money(payment.commissionAmount)}
                      </small>
                    </td>
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
