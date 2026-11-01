import SupplierLayout from '../components/SupplierLayout';
import type { AuthUser } from '../types/auth';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { getApiError, isUnauthenticated } from '../services/api';
import {
  getSubscription,
  renewSubscription,
  insufficientWalletBalance,
  pendingRenewal,
  savePendingRenewal,
  type Subscription,
} from '../services/subscription.api';
import './subscription.css';

const money = (value: number) => value.toLocaleString('vi-VN') + ' ₫';
const date = (value: string | null) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—');
const benefits = {
  STORE_OWNER: [
    ['Kho hàng', 'Quản lý tồn kho, nhập hàng, lô hàng và hạn sử dụng.'],
    ['Bán nhanh bằng giọng nói', 'Nhận diện sản phẩm đã có trong kho và ghi nhận bán hàng.'],
    ['AI hỗ trợ nhập hàng', 'Xem dự báo và đề xuất kế hoạch nhập hàng.'],
    ['Nguồn sỉ và đơn hàng', 'Tìm hàng, nhận báo giá, đặt hàng và theo dõi giao nhận.'],
    ['Ví và lịch sử giao dịch', 'Theo dõi số dư, nạp tiền và thanh toán trong hệ thống.'],
  ],
  SUPPLIER: [
    ['Sản phẩm và kho hàng', 'Quản lý danh mục, giá bán và lượng hàng của chủ vựa.'],
    ['Báo giá', 'Gửi báo giá và tiếp thị sản phẩm đến cửa hàng.'],
    ['Xử lý đơn hàng', 'Duyệt đơn, soạn hàng và cập nhật tiến độ giao hàng.'],
    ['Khách hàng và khiếu nại', 'Theo dõi giao dịch với cửa hàng và xử lý phản hồi.'],
    ['Ví và lịch sử giao dịch', 'Theo dõi số dư, thanh toán và tiền nhận từ đơn hàng.'],
  ],
};

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
  const [requestId, setRequestId] = useState<string | null>(null);
  const locked = useRef(false);
  const workspace = role === 'SUPPLIER' ? '/supplier' : '/store';

  useEffect(() => {
    document.title = 'SupplyMind AI · Gói sử dụng';
    let active = true;
    getSubscription()
      .then((subscription) => {
        if (!active) return;
        setData(subscription);
        setRequestId(subscription.id ? pendingRenewal(subscription.id) : null);
        setError('');
      })
      .catch((issue) => {
        if (!active) return;
        setError(getApiError(issue));
        if (isUnauthenticated(issue)) onLogout();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onLogout]);

  async function renew() {
    if (locked.current || !data?.id || data.paymentSource !== 'WALLET') return;
    if (!requestId && (data.walletBalance ?? 0) < data.monthlyPrice) return;
    if (
      !requestId &&
      !window.confirm(
        `Trừ ${money(data.monthlyPrice)} từ ví để mua thêm 1 tháng Basic? Thời gian còn lại được giữ nguyên.`,
      )
    )
      return;
    locked.current = true;
    const id = requestId || crypto.randomUUID();
    savePendingRenewal(data.id, id);
    setRequestId(id);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await renewSubscription(id);
      setData(saved);
      setNotice(
        `Đã thanh toán ${money(data.monthlyPrice)} từ ví. Gói Basic có hiệu lực đến ${date(saved.accessEndsAt)}.`,
      );
      savePendingRenewal(data.id, null);
      setRequestId(null);
    } catch (issue) {
      const balance = insufficientWalletBalance(issue);
      if (balance !== null) {
        setData((current) => (current ? { ...current, walletBalance: balance } : current));
        savePendingRenewal(data.id, null);
        setRequestId(null);
      }
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }


  const balance = data?.walletBalance ?? 0;
  const shortage = Math.max(0, (data?.monthlyPrice ?? 19000) - balance);
  const walletReady = data?.paymentSource === 'WALLET';
  const content = (
    <section className="subscription-page">
      <div className="subscription-hero">
        <div>
          <p>GÓI SỬ DỤNG</p>
          <h1>
            SupplyMind Basic
            <br />
            19.000đ / tháng
          </h1>
          <span>Một gói cho công việc mỗi ngày. Thanh toán bằng số dư ví SupplyMind.</span>
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
                <span>GÓI HIỆN TẠI</span>
                <h2>
                  {data.status === 'TRIAL'
                    ? 'Dùng thử miễn phí'
                    : data.status === 'ACTIVE'
                      ? 'SupplyMind Basic'
                      : 'Gói đã hết hạn'}
                </h2>
              </div>
              <b className={`subscription-status ${data.hasAccess ? 'active' : 'expired'}`}>
                {data.hasAccess ? 'Đang sử dụng' : 'Cần gia hạn'}
              </b>
            </div>
            <dl>
              <div>
                <dt>Tài khoản</dt>
                <dd>{role === 'SUPPLIER' ? 'Chủ vựa' : 'Chủ tạp hóa'}</dd>
              </div>
              <div>
                <dt>Sử dụng đến</dt>
                <dd>{date(data.accessEndsAt)}</dd>
              </div>
              <div>
                <dt>Thời gian còn lại</dt>
                <dd>{data.daysRemaining ?? 0} ngày</dd>
              </div>
              <div>
                <dt>Gói mua thêm</dt>
                <dd>Basic · {money(data.monthlyPrice)} / 1 tháng</dd>
              </div>
            </dl>
            <div className="subscription-wallet">
              <span>SỐ DƯ VÍ KHẢ DỤNG</span>
              <strong>{walletReady ? money(balance) : 'Chưa có thông tin'}</strong>
              {walletReady &&
                (shortage > 0 ? (
                  <p>
                    Cần nạp thêm <b>{money(shortage)}</b> để mua gói.
                  </p>
                ) : (
                  <p>
                    Số dư sau khi mua thêm 1 tháng: <b>{money(balance - data.monthlyPrice)}</b>
                  </p>
                ))}
              <Link to={`${workspace}/wallet?tab=deposit&from=subscription`}>
                Nạp tiền vào ví →
              </Link>
            </div>
            {requestId && (
              <p role="status">
                Có giao dịch chưa nhận được kết quả. Bấm kiểm tra để tiếp tục cùng giao dịch, không
                trừ tiền lần nữa.
              </p>
            )}
            <button
              className="subscription-renew"
              disabled={busy || !walletReady || (!requestId && shortage > 0)}
              onClick={() => void renew()}
            >
              {busy
                ? 'Đang xử lý…'
                : requestId
                  ? 'Kiểm tra giao dịch'
                  : data.status === 'ACTIVE'
                    ? 'Gia hạn 1 tháng · 19.000đ'
                    : 'Mua gói Basic · 19.000đ'}
            </button>
            {!walletReady && (
              <p role="status">
                Máy chủ chưa bật thanh toán gói bằng ví. Vui lòng thử lại sau khi cập nhật hệ thống.
              </p>
            )}
            <p>
              Chỉ trừ tiền khi bạn xác nhận mua. Không tự động gia hạn. Mua sớm được cộng thêm 1
              tháng vào hạn hiện tại, kể cả thời gian dùng thử còn lại.
            </p>
          </article>
          <article className="subscription-card">
            <span className="subscription-kicker">QUYỀN HẠN CỦA BẠN</span>
            <h2>
              {data.hasAccess ? 'Các tiện ích đang được sử dụng' : 'Gia hạn để mở lại các tiện ích'}
            </h2>
            <p>
              {data.status === 'TRIAL'
                ? 'Trong thời gian dùng thử, bạn được sử dụng các tiện ích Basic theo vai trò tài khoản.'
                : 'Basic bao gồm các tiện ích theo vai trò tài khoản của bạn.'}
            </p>
            <ul className="subscription-benefits">
              {benefits[role].map(([title, description]) => (
                <li key={title}>
                  <Icon name={data.hasAccess ? 'check' : 'lock'} />
                  <div>
                    <strong>{title}</strong>
                    <span>{description}</span>
                  </div>
                </li>
              ))}
            </ul>
            {!data.hasAccess && (
              <p>
                Dữ liệu đã nhập được giữ lại khi hết hạn. Nạp ví và mua gói để tiếp tục làm việc.
              </p>
            )}
            <Link className="ghost-button subscription-back" to={workspace}>
              ← Trở về không gian làm việc
            </Link>
          </article>
        </div>
      )}
      {data && (
        <article className="subscription-card subscription-history">
          <span className="subscription-kicker">LỊCH SỬ GÓI SỬ DỤNG</span>
          <h2>Các lần mua và gia hạn</h2>
          {data.payments.length ? (
            <div
              className="subscription-table"
              tabIndex={0}
              aria-label="Lịch sử thanh toán, cuộn ngang để xem đầy đủ"
            >
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Số tiền</th>
                    <th>Thanh toán</th>
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
                        {payment.method === 'WALLET'
                          ? 'Số dư ví'
                          : payment.method === 'SIMULATED'
                            ? 'Mô phỏng cũ · không trừ ví'
                            : payment.method}
                      </td>
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
            <p>Chưa có giao dịch mua gói.</p>
          )}
        </article>
      )}
    </section>
  );

  if (role === 'SUPPLIER' && user) {
    return (
      <SupplierLayout user={user} activeNav="subscription" onLogout={onLogout} pageTitle="Gói sử dụng">
        {loading ? (
          <section className="subscription-page">
            <p role="status">Đang kiểm tra gói sử dụng…</p>
          </section>
        ) : (
          content
        )}
      </SupplierLayout>
    );
  }

  if (loading)
    return (
      <section className="subscription-page">
        <p role="status">Đang kiểm tra gói sử dụng…</p>
      </section>
    );

  return content;
}
