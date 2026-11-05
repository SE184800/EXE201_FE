import { Link } from 'react-router-dom';
import type { SupplierOrder } from '../services/supplier.api';
import { isOrderScheduledToday, extractTimeFromEta } from '../utils/deliverySchedule';
import './TodayDeliveryAlert.css';

interface TodayDeliveryAlertProps {
  orders: SupplierOrder[];
  role: 'SUPPLIER' | 'STORE_OWNER';
  onViewOrders?: () => void;
}

export default function TodayDeliveryAlert({
  orders,
  role,
  onViewOrders,
}: TodayDeliveryAlertProps) {
  const todayOrders = (orders || []).filter(isOrderScheduledToday);

  if (todayOrders.length === 0) {
    return null;
  }

  const title =
    role === 'SUPPLIER'
      ? `Lịch giao hàng hôm nay (${todayOrders.length} đơn cần xuất kho / giao)`
      : `Lịch nhận hàng hôm nay (${todayOrders.length} đơn dự kiến giao đến tiệm)`;

  const subtitle =
    role === 'SUPPLIER'
      ? 'Các đơn hàng có lịch hẹn giao trong ngày hoặc đang trên đường vận chuyển.'
      : 'Vui lòng chuẩn bị nhân sự và mặt bằng kho để kiểm nhận hàng khi tài xế đến.';

  return (
    <div className="today-delivery-alert" role="region" aria-label="Lịch giao hàng hôm nay">
      <div className="today-delivery-header">
        <div className="today-delivery-title-box">
          <div className="today-delivery-icon-box" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
        </div>

        {role === 'SUPPLIER' ? (
          <Link to="/supplier/orders" className="today-delivery-view-all">
            Xem toàn bộ đơn hàng
          </Link>
        ) : (
          onViewOrders && (
            <button
              type="button"
              className="today-delivery-view-all"
              onClick={onViewOrders}
            >
              Xem đơn mua hàng
            </button>
          )
        )}
      </div>

      <div className="today-delivery-grid">
        {todayOrders.map((order) => {
          const isShipping = order.status === 'SHIPPING';
          const etaTime = extractTimeFromEta(order.driverInfo?.estimatedDeliveryTime);
          const driver = order.driverInfo;

          return (
            <div key={order.id} className="today-delivery-item-card">
              <div className="today-delivery-card-top">
                <span className="today-delivery-order-id">Đơn #{order.id}</span>
                <span
                  className={`today-delivery-status-pill ${
                    isShipping ? 'shipping' : 'preparing'
                  }`}
                >
                  {isShipping ? 'Đang giao hàng' : 'Đang chuẩn bị giao'}
                </span>
              </div>

              <div className="today-delivery-details">
                <div className="today-delivery-time-badge">
                  <span>Giờ hẹn: {etaTime}</span>
                </div>

                {role === 'SUPPLIER' ? (
                  <>
                    <div>
                      <strong>Khách nhận:</strong> {order.recipientName || 'Tiệm tạp hóa'}
                      {order.recipientPhone && ` (${order.recipientPhone})`}
                    </div>
                    {order.deliveryAddress && (
                      <div style={{ color: '#64748b', fontSize: '11.5px' }}>
                        {order.deliveryAddress}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <strong>Nhà cung cấp:</strong>{' '}
                      {order.supplier?.businessName || 'Nhà cung cấp sỉ'}
                    </div>
                    {order.recipientName && (
                      <div style={{ color: '#64748b', fontSize: '11.5px' }}>
                        Người nhận: {order.recipientName}
                      </div>
                    )}
                  </>
                )}

                {driver?.driverName && (
                  <div style={{ marginTop: '2px' }}>
                    <strong>Tài xế:</strong> {driver.driverName}
                    {driver.driverPhone && ` - ${driver.driverPhone}`}
                    {driver.vehicleType && ` (${driver.vehicleType})`}
                  </div>
                )}
              </div>

              <div className="today-delivery-bottom-action">
                {role === 'SUPPLIER' ? (
                  <Link
                    to="/supplier/orders"
                    className="today-delivery-action-btn"
                  >
                    Xem chi tiết đơn →
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="today-delivery-action-btn"
                    onClick={onViewOrders}
                  >
                    Xem chi tiết đơn →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
