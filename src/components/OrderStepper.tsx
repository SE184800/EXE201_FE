import type { SupplierOrder } from '../services/supplier.api';
import './OrderStepper.css';

interface Props {
  order: SupplierOrder;
}

const ORDER_FLOW = [
  { key: 'PENDING', label: 'Đặt đơn', defaultSub: 'Chờ duyệt' },
  { key: 'APPROVED', label: 'Duyệt đơn', defaultSub: 'Đã nhận đơn' },
  { key: 'PREPARING', label: 'Soạn hàng', defaultSub: 'Đang đóng gói' },
  { key: 'SHIPPING', label: 'Đang giao', defaultSub: 'Vận chuyển' },
  { key: 'DELIVERED', label: 'Hàng đã đến', defaultSub: 'Đã nhận hàng' },
];

export default function OrderStepper({ order }: Props) {
  const { status, driverInfo, rejectReason, deliveredAt } = order;

  // Compute active index (0 to 4)
  let activeIndex = 0;
  const isCancelled = status === 'CANCELLED';
  const isRejected = status === 'REJECTED';
  const isIssue = status === 'ISSUE_HANDLING';

  switch (status) {
    case 'PENDING':
      activeIndex = 0;
      break;
    case 'APPROVED':
      activeIndex = 1;
      break;
    case 'PREPARING':
      activeIndex = 2;
      break;
    case 'SHIPPING':
      activeIndex = 3;
      break;
    case 'ISSUE_HANDLING':
      activeIndex = 3;
      break;
    case 'DELIVERED':
    case 'COMPLETED':
      activeIndex = 4;
      break;
    default:
      activeIndex = 0;
  }

  // Calculate connector line fill percentage
  let fillPercentage = 0;
  if (isCancelled || isRejected) {
    fillPercentage = 0;
  } else {
    fillPercentage = Math.min(100, Math.max(0, (activeIndex / 4) * 100));
  }

  // Dynamic subtext for each step
  const getSubtext = (stepKey: string, index: number) => {
    if (stepKey === 'PENDING') {
      if (order.depositStatus === 'PAID') return 'Đã cọc';
      if (order.depositStatus === 'SUBMITTED') return 'Đã báo cọc';
      return 'Chờ duyệt';
    }
    if (stepKey === 'APPROVED') {
      if (index <= activeIndex) return 'Đã duyệt kho';
      return 'Chờ duyệt';
    }
    if (stepKey === 'PREPARING') {
      if (driverInfo?.estimatedDeliveryTime) {
        return `Hẹn: ${driverInfo.estimatedDeliveryTime}`;
      }
      if (index === activeIndex) return 'Đang đóng gói';
      if (index < activeIndex) return 'Đã soạn xong';
      return 'Chờ soạn';
    }
    if (stepKey === 'SHIPPING') {
      if (isIssue) return 'Sự cố vận chuyển';
      if (driverInfo?.driverName) {
        return driverInfo.driverName;
      }
      if (index <= activeIndex) return 'Đang trên đường';
      return 'Chờ tài xế';
    }
    if (stepKey === 'DELIVERED') {
      if (status === 'COMPLETED') return 'Đã hoàn tất';
      if (deliveredAt) {
        try {
          return new Date(deliveredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
            new Date(deliveredAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        } catch {}
      }
      if (index <= activeIndex) return 'Đã giao tới';
      return 'Chờ nhận';
    }
    return '';
  };

  return (
    <div className="order-stepper" aria-label="Tiến trình đơn hàng">
      <div className="order-stepper-steps">
        <div className="order-stepper-line">
          <div className="order-stepper-line-fill" style={{ width: `${fillPercentage}%` }} />
        </div>

        {ORDER_FLOW.map((step, idx) => {
          let stepClass = '';
          if (isCancelled || isRejected) {
            stepClass = idx === 0 ? 'completed' : '';
          } else if (idx < activeIndex) {
            stepClass = 'completed';
          } else if (idx === activeIndex) {
            stepClass = isIssue ? 'special-alert' : 'current';
          }

          return (
            <div key={step.key} className={`order-stepper-step ${stepClass}`}>
              <div className="step-node">
                {idx < activeIndex && !isCancelled && !isRejected ? '✓' : idx + 1}
              </div>
              <span className="step-label">{step.label}</span>
              <span className="step-subtext">{getSubtext(step.key, idx)}</span>
            </div>
          );
        })}
      </div>

      {isRejected && (
        <div className="stepper-alert-bar danger">
          <strong>Đơn hàng đã bị từ chối</strong>
          <span>Lý do: {rejectReason || 'Không có lý do'}</span>
        </div>
      )}

      {isCancelled && (
        <div className="stepper-alert-bar danger">
          <strong>Đơn hàng đã bị hủy</strong>
        </div>
      )}

      {isIssue && (
        <div className="stepper-alert-bar warning">
          <strong>Đang kiểm hàng / xử lý sự cố trên đường giao</strong>
          <span>Cần đối soát hoặc xử lý hàng bù trước khi hoàn tất đơn</span>
        </div>
      )}

      {driverInfo?.estimatedDeliveryTime && status === 'PREPARING' && (
        <div className="stepper-alert-bar info">
          <strong>Lịch hẹn giao hàng:</strong>
          <span>Chủ vựa dự kiến giao hàng lúc {driverInfo.estimatedDeliveryTime}</span>
        </div>
      )}
    </div>
  );
}
