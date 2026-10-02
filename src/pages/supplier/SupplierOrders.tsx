import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../catalog.css';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import OrderList from '../../components/OrderList';
import { getApiError, isUnauthenticated } from '../../services/api';
import { logout } from '../../services/auth.api';
import {
  updateSupplierOrderStatus,
  type SupplierOrder,
} from '../../services/supplier.api';
import type { AuthUser } from '../../types/auth';

const STATUS_ACTIONS: Record<string, { next: string; label: string }> = {
  PENDING: { next: 'APPROVED', label: 'Duyệt đơn' },
  APPROVED: { next: 'PREPARING', label: 'Bắt đầu soạn' },
  PREPARING: { next: 'SHIPPING', label: 'Bàn giao vận chuyển' },
  SHIPPING: { next: 'ISSUE_HANDLING', label: 'Chuyển tiếp nhận xử lý' },
  ISSUE_HANDLING: { next: 'DELIVERED', label: 'Xác nhận đã giao & thu COD' },
};

export default function SupplierOrders({ user, onLogout }: { user?: AuthUser; onLogout: () => void }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [orderRevision, setOrderRevision] = useState(0);
  const [rejectingOrder, setRejectingOrder] = useState<SupplierOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  useEffect(() => {
    document.title = 'SupplyMind AI · Đơn hàng từ cửa hàng';
  }, []);

  async function handleOrderStatus(order: SupplierOrder, forcedStatus?: string, suppliedReason?: string) {
    if (forcedStatus === 'REJECTED' && suppliedReason === undefined) {
      setRejectingOrder(order);
      setRejectReason('');
      setRejectError('');
      return;
    }
    const action = forcedStatus ? { next: forcedStatus, label: 'Từ chối' } : STATUS_ACTIONS[order.status];
    if (!action) return;
    const normalizedReason = action.next === 'REJECTED' ? suppliedReason?.trim() : undefined;
    setBusy(true);
    setNotice('');
    setNoticeError(false);
    try {
      const saved = await updateSupplierOrderStatus(order.id, action.next, normalizedReason);
      setOrderRevision(n => n + 1);
      setNotice(`Đơn #${order.id} đã chuyển sang “${saved.statusLabel}”.`);
    } catch (issue) {
      setNoticeError(true);
      if (isUnauthenticated(issue)) onLogout();
      else setNotice(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

  function submitRejection() {
    if (!rejectingOrder) return;
    if (rejectReason.trim().length < 3) {
      setRejectError('Nhập lý do từ 3 ký tự trở lên.');
      return;
    }
    const order = rejectingOrder;
    const reason = rejectReason;
    setRejectingOrder(null);
    setRejectReason('');
    setRejectError('');
    void handleOrderStatus(order, 'REJECTED', reason);
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      onLogout();
    } catch (issue) {
      setNoticeError(true);
      setNotice(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

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
          <button className="secondary-button" onClick={handleLogout} disabled={busy}>
            <Icon name="logout" /> Đăng xuất
          </button>
        </div>
      </header>
      <section className="supplier-main">
        <nav className="catalog-nav" aria-label="Chủ vựa">
          <Link to="/supplier">Tổng quan</Link>
          <Link to="/supplier/products">Sản phẩm đăng bán</Link>
          <Link to="/supplier/orders" aria-current="page">Đơn hàng</Link>
          <Link to="/supplier/inventory">Kho hàng</Link>
        </nav>
        <div className="supplier-heading">
          <div>
            <p className="form-eyebrow">QUẢN LÝ ĐƠN HÀNG</p>
            <h1>Đơn hàng từ cửa hàng</h1>
            <p className="form-description">
              Theo dõi, duyệt và cập nhật tiến độ giao các đơn đặt hàng từ tiệm tạp hóa.
            </p>
          </div>
          <button
            className="ghost-button"
            onClick={() => setOrderRevision(n => n + 1)}
            disabled={busy}
          >
            ↻ Làm mới
          </button>
        </div>
        {notice && (
          <p
            className={noticeError ? 'error-notice' : 'supplier-success'}
            role={noticeError ? 'alert' : 'status'}
          >
            {notice}
          </p>
        )}
        <OrderList
          kind="supplier"
          onLogout={onLogout}
          revision={orderRevision}
          busy={busy}
          onStatus={handleOrderStatus}
        />
      </section>
      {rejectingOrder && (
        <RejectDialog
          order={rejectingOrder}
          reason={rejectReason}
          error={rejectError}
          busy={busy}
          onChange={(value) => {
            setRejectReason(value);
            setRejectError('');
          }}
          onCancel={() => {
            setRejectingOrder(null);
            setRejectReason('');
            setRejectError('');
          }}
          onSubmit={submitRejection}
        />
      )}
    </main>
  );
}

function RejectDialog({
  order,
  reason,
  error,
  busy,
  onChange,
  onCancel,
  onSubmit,
}: {
  order: SupplierOrder;
  reason: string;
  error: string;
  busy: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="supplier-dialog-backdrop" role="presentation">
      <section className="supplier-dialog" role="dialog" aria-modal="true" aria-labelledby="reject-dialog-title">
        <span className="supplier-panel-label">ĐƠN #{order.id}</span>
        <h2 id="reject-dialog-title">Từ chối đơn hàng</h2>
        <p>Cho cửa hàng biết lý do để họ chủ động điều chỉnh đơn.</p>
        <label className="supplier-dialog-field">
          <span>Lý do từ chối</span>
          <textarea
            value={reason}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Ví dụ: Sản phẩm tạm hết hàng…"
            rows={4}
            maxLength={255}
            disabled={busy}
            autoFocus
          />
        </label>
        {error && <small className="supplier-dialog-error">{error}</small>}
        <div className="supplier-dialog-actions">
          <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>
            Hủy
          </button>
          <button
            type="button"
            className="table-button danger supplier-dialog-submit"
            onClick={onSubmit}
            disabled={busy}
          >
            {busy ? 'Đang xử lý…' : 'Xác nhận từ chối'}
          </button>
        </div>
      </section>
    </div>
  );
}
