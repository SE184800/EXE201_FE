import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { getApiError, isUnauthenticated } from '../services/api';
import {
  getSubscription,
  renewSubscription,
  type Subscription,
} from '../services/subscription.api';
import './subscription.css';
import SupplierHeader from '../components/SupplierHeader';
import type { AuthUser } from '../types/auth';

const money = (value: number) => value.toLocaleString('vi-VN') + ' ₫';
const date = (value: string | null) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—');

export default function SubscriptionPage({
  role,
  user,
  onLogout,
}: {
  role: 'STORE_OWNER' | 'SUPPLIER';
  user?: AuthUser;
  onLogout: () => void;
}) {
  const [data, setData] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<string | null>(null);

  useEffect(() => {
    document.title = 'SupplyMind AI · Gói sử dụng';
    let active = true;
    getSubscription()
      .then((subscription) => {
        if (active) {
          setData(subscription);
          setError('');
        }
      })
      .catch((issue) => {
        if (active) {
          setError(getApiError(issue));
          if (isUnauthenticated(issue)) onLogout();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onLogout]);

  async function renew() {
    if (
      busy ||
      !window.confirm(
        'Xác nhận thanh toán mô phỏng 19.000đ để gia hạn thêm 1 tháng? Không có tiền thật được trừ.',
      )
    )
      return;
    if (!request.current) request.current = crypto.randomUUID();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await renewSubscription(request.current);
      setData(saved);
      setNotice(`Đã gia hạn mô phỏng đến ${date(saved.accessEndsAt)}.`);
      request.current = null;
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setBusy(false);
    }
  }

  const workspace = role === 'SUPPLIER' ? '/supplier' : '/store';
  if (loading)
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        {role === 'SUPPLIER' && user && (
          <SupplierHeader user={user} activeNav="subscription" onLogout={onLogout} />
        )}
        <section className="subscription-page">
          <p role="status">Đang kiểm tra gói sử dụng…</p>
        </section>
      </div>
    );
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {role === 'SUPPLIER' && user && (
        <SupplierHeader user={user} activeNav="subscription" onLogout={onLogout} />
      )}
      <section className="subscription-page">
      <div className="subscription-hero">
        <div>
          <p>SUPPLYMIND BASIC</p>
          <h1>
            Dùng thử 1 tháng.
            <br />
            Sau đó 19.000đ/tháng.
          </h1>
          <span>
            Quản lý kho, AI gợi ý nhập hàng, nguồn sỉ, báo giá và đơn hàng trong cùng một tài khoản.
          </span>
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
      {data && (
        <div className="subscription-layout">
          <article className="subscription-card main">
            <div className="subscription-card-head">
              <div>
                <span>TRẠNG THÁI GÓI</span>
                <h2>
                  {data.status === 'TRIAL'
                    ? 'Đang dùng thử miễn phí'
                    : data.status === 'ACTIVE'
                      ? 'Gói đang hoạt động'
                      : 'Gói đã hết hạn'}
                </h2>
              </div>
              <b className={`subscription-status ${data.hasAccess ? 'active' : 'expired'}`}>
                {data.hasAccess ? 'Có quyền sử dụng' : 'Cần gia hạn'}
              </b>
            </div>
            <div className="subscription-price">
              <strong>{money(data.monthlyPrice)}</strong>
              <span>/ tháng</span>
            </div>
            <dl>
              <div>
                <dt>Ngày kết thúc quyền sử dụng</dt>
                <dd>{date(data.accessEndsAt)}</dd>
              </div>
              <div>
                <dt>Thời gian còn lại</dt>
                <dd>{data.daysRemaining ?? 0} ngày</dd>
              </div>
              <div>
                <dt>Hình thức hiện tại</dt>
                <dd>
                  {data.status === 'TRIAL'
                    ? 'Dùng thử 1 tháng'
                    : data.status === 'ACTIVE'
                      ? 'Gia hạn theo tháng'
                      : 'Đã hết hạn'}
                </dd>
              </div>
            </dl>
            <button className="subscription-renew" disabled={busy} onClick={() => void renew()}>
              {busy ? 'Đang gia hạn…' : 'Gia hạn mô phỏng 19.000đ / tháng'}
            </button>
            <p>
              Thanh toán hiện tại chỉ là mô phỏng phục vụ demo. Hệ thống không kết nối ngân hàng,
              MoMo hoặc VNPay và không trừ tiền thật.
            </p>
          </article>
          <article className="subscription-card">
            <span className="subscription-kicker">QUYỀN LỢI</span>
            <h2>Bao gồm toàn bộ tính năng hiện tại</h2>
            <ul>
              <li>Quản lý kho, lô hàng và hạn sử dụng</li>
              <li>AI dự báo và kế hoạch nhập hàng</li>
              <li>Bán nhanh bằng giọng nói</li>
              <li>Tìm nguồn sỉ, deal giá và theo dõi chuyển cọc</li>
              <li>Báo giá tiếp thị giữa chủ vựa và tạp hóa</li>
            </ul>
            <Link className="ghost-button subscription-back" to={workspace}>
              ← Trở về không gian làm việc
            </Link>
          </article>
        </div>
      )}
      {data && (
        <article className="subscription-card subscription-history">
          <span className="subscription-kicker">LỊCH SỬ GIA HẠN</span>
          <h2>Các lần thanh toán mô phỏng</h2>
          {data.payments.length ? (
            <div className="subscription-table">
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Số tiền</th>
                    <th>Chu kỳ</th>
                    <th>Tham chiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{new Date(payment.paidAt).toLocaleString('vi-VN')}</td>
                      <td>{money(payment.amount)}</td>
                      <td>
                        {date(payment.periodStart)} – {date(payment.periodEnd)}
                      </td>
                      <td>{payment.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Chưa có lần gia hạn nào. Tài khoản đang sử dụng thời gian dùng thử miễn phí.</p>
          )}
        </article>
      )}
    </section>
    </div>
  );
}
