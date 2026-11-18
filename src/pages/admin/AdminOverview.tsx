import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Badge, DateFields, Heading, LoadState, Metric, Panel } from './admin.shared';
import { dateTime, defaultPeriod, money, useAdminData } from './admin.data';
import type { AdminTabProps } from './admin.types';
import DailyAnalyticsChart from './components/DailyAnalyticsChart';

type OverviewTransaction = {
  id: number;
  orderCode: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  deliveredAt: string | null;
  region: string;
  buyerName: string;
  buyerPhone: string | null;
  supplierName: string;
  itemCount: number;
};

type OverviewData = {
  from: string;
  to: string;
  gmv: number;
  completedOrders: number;
  commissionAccrued: number;
  commissionReceived: number;
  commissionUnpaid: number;
  pendingVerifications: number;
  legacyOrders: number;
  users: Record<string, number>;
  daily: { day: string; gmv: number; orders: number }[];
  topProducts?: {
    productId: number;
    productName: string;
    packaging: string;
    region: string | null;
    quantity: number;
    revenue: number;
  }[];
  transactions?: OverviewTransaction[];
};

export default function AdminOverview({ onLogout }: AdminTabProps) {
  const [dates, setDates] = useState(defaultPeriod);
  const [region, setRegion] = useState('');
  const [query, setQuery] = useState<Record<string, string>>(defaultPeriod);
  const [revision, setRevision] = useState(0);

  const { data, error, loading } = useAdminData<OverviewData>(
    '/admin/analytics',
    query,
    onLogout,
    revision,
  );

  const totalDailyGmv = data?.daily.reduce((sum, d) => sum + d.gmv, 0) || 0;
  const totalDailyOrders = data?.daily.reduce((sum, d) => sum + d.orders, 0) || 0;

  return (
    <div className="admin-overview-view">
      <Heading
        eyebrow="PLATFORM OVERVIEW"
        title="Toàn cảnh vận hành sàn B2B"
        description="Theo dõi dữ liệu giao dịch sỉ thời gian thực giữa chủ tiệm tạp hóa và nhà cung cấp chủ vựa."
        action={
          <button className="admin-refresh-btn" onClick={() => setRevision((n) => n + 1)}>
            ↻ Làm mới
          </button>
        }
      />

      <div className="admin-overview-toolbar">
        <form
          className="admin-filters admin-filters-inline"
          onSubmit={(e) => {
            e.preventDefault();
            const fallback = defaultPeriod();
            const from = dates.from || fallback.from;
            const to = dates.to || fallback.to;
            setQuery({ from, to, region });
            setRevision((n) => n + 1);
          }}
        >
          <DateFields value={dates} onChange={setDates} />
          <label>
            Khu vực chủ vựa
            <input
              maxLength={100}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Tất cả khu vực"
            />
          </label>
          <button className="admin-primary">Xem báo cáo</button>
        </form>
      </div>

      <LoadState loading={loading} error={error} />

      {data && (
        <>
          <div className="admin-metrics">
            <Metric
              label="Tổng giá trị giao dịch (GMV)"
              value={money(data.gmv)}
              note="Doanh số đơn sỉ đã giao & hoàn tất"
            />
            <Metric
              label="Đơn hàng hoàn tất"
              value={`${data.completedOrders.toLocaleString('vi-VN')} đơn`}
              note="Giao dịch sỉ hoàn tất thành công"
            />
            <article className="admin-metric">
              <span>Mạng lưới đối tác sàn</span>
              <div className="admin-metric-dual">
                <div>
                  <strong>{data.users.STORE_OWNER || 0}</strong>
                  <small>Tiệm tạp hóa</small>
                </div>
                <div className="admin-metric-divider" />
                <div>
                  <strong>{data.users.SUPPLIER || 0}</strong>
                  <small>Chủ vựa</small>
                </div>
              </div>
              <small>Tài khoản đối tác đang hoạt động</small>
            </article>
            <article className="admin-metric">
              <span>Hồ sơ vựa chờ thẩm định</span>
              <strong className={data.pendingVerifications > 0 ? 'text-amber' : ''}>
                {data.pendingVerifications} hồ sơ
              </strong>
              <small>
                <NavLink to="/admin/verification" className="admin-link-accent">
                  Xem hồ sơ chờ duyệt →
                </NavLink>
              </small>
            </article>
          </div>

          <div className="admin-overview-split">
            <Panel
              title="Giá trị giao dịch theo ngày"
              note={
                data.daily.length > 0
                  ? `Dữ liệu giao dịch sỉ thời gian thực giữa Tạp Hóa & Chủ Vựa`
                  : undefined
              }
            >
              <DailyAnalyticsChart
                daily={data.daily}
                from={data.from}
                to={data.to}
                totalGmv={totalDailyGmv}
                totalOrders={totalDailyOrders}
              />
            </Panel>

            <Panel title="Tổng quan kết nối">
              <div className="admin-network">
                <div>
                  <Icon name="store" />
                  <span>
                    Chủ tiệm tạp hóa<strong>{data.users.STORE_OWNER || 0}</strong>
                  </span>
                </div>
                <div>
                  <Icon name="box" />
                  <span>
                    Chủ vựa cung ứng<strong>{data.users.SUPPLIER || 0}</strong>
                  </span>
                </div>
                <NavLink to="/admin/verification" className="admin-network-action">
                  <span>Hồ sơ vựa chờ thẩm định (KYC)</span>
                  <strong>{data.pendingVerifications} →</strong>
                </NavLink>
              </div>
              <div className="admin-network-footer">
                <small>Dữ liệu vận hành tự động đồng bộ theo múi giờ Việt Nam (UTC+7)</small>
              </div>
            </Panel>
          </div>

          {data.legacyOrders > 0 && (
            <p className="admin-note">
              Có {data.legacyOrders} đơn cũ chưa ghi nhận ngày giao. Các đơn này chưa được đưa vào
              báo cáo theo kỳ.
            </p>
          )}

          <Panel
            title="Giao dịch thực tế giữa Tạp hóa & Chủ vựa"
            note="Danh sách đơn đặt hàng sỉ trực tiếp giữa chủ tiệm tạp hóa và nhà cung cấp chủ vựa trong kỳ"
          >
            {data.transactions && data.transactions.length > 0 ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Tiệm tạp hóa (Người mua)</th>
                      <th>Chủ vựa (Nhà bán sỉ)</th>
                      <th>Quy mô</th>
                      <th>Giá trị giao dịch</th>
                      <th>Trạng thái</th>
                      <th>Thời gian giao dịch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <span className="admin-order-code">{tx.orderCode}</span>
                        </td>
                        <td>
                          <div className="admin-party-info">
                            <strong>{tx.buyerName}</strong>
                            {tx.buyerPhone && <small>{tx.buyerPhone}</small>}
                          </div>
                        </td>
                        <td>
                          <div className="admin-party-info">
                            <strong>{tx.supplierName}</strong>
                            {tx.region && tx.region !== '—' && (
                              <span className="admin-region-pill">{tx.region}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span>{tx.itemCount} sản phẩm</span>
                        </td>
                        <td className="admin-money">
                          <strong>{money(tx.subtotal || tx.total)}</strong>
                        </td>
                        <td>
                          <Badge status={tx.status} />
                        </td>
                        <td>
                          <span className="admin-tx-time">
                            {dateTime(tx.deliveredAt || tx.createdAt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-tx-empty">
                <Icon name="box" />
                <p>Chưa có giao dịch sỉ nào phát sinh giữa tạp hóa và chủ vựa trong khoảng thời gian này.</p>
                <small>Khi chủ tiệm tạp hóa đặt hàng từ chủ vựa, chi tiết giao dịch sẽ hiển thị tự động tại đây.</small>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
