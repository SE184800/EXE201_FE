import { useEffect, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';
import {
  rescheduleOrder,
  respondRescheduleOrder,
  approveOrder,
  confirmOrderArrival,
  submitOrderPayment,
  completeOrder,
  confirmSupplierPayment,
  savePackingChecklist,
  type SupplierOrder,
} from '../services/supplier.api';
import Icon from './Icon';
import ExportDropdown from './ExportDropdown';
import { exportSupplierOrdersToExcel, exportSupplierOrdersToPdf } from '../utils/exportSupplier';
import { payOrderWithWallet, depositOrderWithWallet } from '../services/wallet.api';
import './complaint-dialog.css';

const statuses = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PREPARING: 'Đang soạn đơn',
  SHIPPING: 'Đang vận chuyển',
  ISSUE_HANDLING: 'Tiếp nhận xử lý',
  DELIVERED: 'Đã giao',
  COMPLETED: 'Hoàn tất',
  REJECTED: 'Đã từ chối',
};

const COMPLAINT_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Chờ supplier tiếp nhận', color: '#c2410c', bg: '#fff7ed' },
  IN_REVIEW: { label: 'Supplier đang xử lý', color: '#1d4ed8', bg: '#eff6ff' },
  RESOLVED: { label: 'Đã giải quyết', color: '#15803d', bg: '#f0fdf4' },
  REJECTED: { label: 'Supplier từ chối', color: '#b91c1c', bg: '#fef2f2' },
};

const COMPLAINT_REASONS: { code: string; label: string }[] = [
  { code: 'DAMAGED', label: 'Hàng hư hỏng / bể vỡ' },
  { code: 'SHORTAGE', label: 'Thiếu hàng / thiếu số lượng' },
  { code: 'WRONG_ITEM', label: 'Giao sai sản phẩm / quy cách' },
  { code: 'EXPIRED', label: 'Hàng cận date / hết hạn' },
  { code: 'QUALITY', label: 'Lỗi chất lượng sản phẩm' },
  { code: 'LATE', label: 'Giao trễ / sai hẹn' },
  { code: 'OTHER', label: 'Khác' },
];

const REASON_LABELS: Record<string, string> = {
  DAMAGED: 'Hàng hư hỏng / bể vỡ',
  SHORTAGE: 'Thiếu hàng / thiếu số lượng',
  WRONG_ITEM: 'Giao sai sản phẩm / quy cách',
  EXPIRED: 'Hàng cận date / hết hạn',
  QUALITY: 'Lỗi chất lượng sản phẩm',
  LATE: 'Giao trễ / sai hẹn',
  OTHER: 'Khác',
};

const money = (n: number) => Math.round(n).toLocaleString('vi-VN') + ' ₫';

const DESIRED_RESOLUTIONS: { code: string; label: string }[] = [
  { code: 'REFUND', label: 'Hoàn tiền / Trừ cọc tương ứng' },
  { code: 'REPLACE', label: 'Giao bù hàng mới chuyến sau' },
  { code: 'RETURN', label: 'Đổi trả toàn bộ hàng lỗi' },
  { code: 'DISCOUNT', label: 'Giảm giá / Cấn trừ công nợ' },
];

const SUPPLIER_RESOLUTIONS: { code: string; label: string }[] = [
  { code: 'AGREE_REPLACE_0VND', label: 'Đồng ý giao bù hàng mới (Tự động tạo đơn 0đ)' },
  { code: 'AGREE_REFUND', label: 'Đồng ý hoàn tiền / Trừ cọc' },
  { code: 'AGREE_REPLACE', label: 'Đồng ý giao bù hàng mới chuyến sau' },
  { code: 'AGREE_RETURN', label: 'Đồng ý thu hồi đổi trả hàng' },
  { code: 'DISCUSS', label: 'Đang liên hệ trao đổi phương án với cửa hàng' },
  { code: 'REJECT', label: 'Từ chối (Hàng giao đúng và đảm bảo tiêu chuẩn)' },
];

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        const key =
          'https://local.supplymind.vn/img_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        try {
          localStorage.setItem(key, base64);
          resolve(key);
        } catch {
          resolve(base64);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function resolveComplaintImage(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('https://local.supplymind.vn/img_')) return localStorage.getItem(url) || url;
  return url;
}

function resolveComplaintImages(url: string | null | undefined): string[] {
  if (!url) return [];
  try {
    if (url.startsWith('[') && url.endsWith(']')) {
      const parsed = JSON.parse(url);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => resolveComplaintImage(u)).filter(Boolean) as string[];
      }
    }
  } catch { }
  if (url.includes('|||')) {
    return url
      .split('|||')
      .map((u) => resolveComplaintImage(u.trim()))
      .filter(Boolean) as string[];
  }
  const single = resolveComplaintImage(url);
  return single ? [single] : [];
}

function parseComplaintDescription(desc: string) {
  const match = desc.match(
    /^\[Sự cố:\s*([^|\]]+)(?:\s*\|\s*Bồi hoàn ước tính:\s*([^|\]]+))?(?:\s*\|\s*Đề xuất:\s*([^|\]]+))?\]\s*\n?([\s\S]*)$/,
  );
  if (match) {
    return {
      itemInfo: match[1]?.trim(),
      claimValue: match[2]?.trim(),
      resolution: match[3]?.trim(),
      details: match[4]?.trim(),
    };
  }
  return {
    itemInfo: null,
    claimValue: null,
    resolution: null,
    details: desc,
  };
}

type Props = {
  kind: 'store' | 'supplier';
  onLogout: () => void;
  revision?: number;
  busy?: boolean;
  onStatus?: (order: SupplierOrder, forcedStatus?: string) => void;
  onEditDriver?: (order: SupplierOrder) => void;
  onReportIncident?: (order: SupplierOrder) => void;
};

export default function OrderList({
  kind,
  onLogout,
  revision = 0,
  busy = false,
  onStatus,
  onEditDriver,
  onReportIncident,
}: Props) {
  const [query, setQuery] = useState({ page: 1, status: '' });
  const [data, setData] = useState<{ orders: SupplierOrder[]; total: number; hasMore: boolean }>({
    orders: [],
    total: 0,
    hasMore: false,
  });
  const [error, setError] = useState('');
  const [depositNotice, setDepositNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  // Packing checklist state (orderId -> itemIds checked)
  const [packingMap, setPackingMap] = useState<Record<number, number[]>>({});

  // Payment dialog state for Store Owner
  const [paymentOrder, setPaymentOrder] = useState<SupplierOrder | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const [complaintOrder, setComplaintOrder] = useState<SupplierOrder | null>(null);
  const [complaintReason, setComplaintReason] = useState(COMPLAINT_REASONS[0].code);
  const [complaintDescription, setComplaintDescription] = useState('');
  const [complaintBusy, setComplaintBusy] = useState(false);
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintResponse, setComplaintResponse] = useState('');
  const [complaintActionBusy, setComplaintActionBusy] = useState(false);
  const [complaintSelectedItems, setComplaintSelectedItems] = useState<Record<number, number>>({});
  const [complaintResolution, setComplaintResolution] = useState<string>('REFUND');
  const [complaintImages, setComplaintImages] = useState<string[]>([]);
  const [supplierPlan, setSupplierPlan] = useState<string>('AGREE_REFUND');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [depositBusy, setDepositBusy] = useState<number | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [depositDraft, setDepositDraft] = useState<{ orderId: number; reference: string } | null>(
    null,
  );

  async function handleStoreApprove(order: SupplierOrder) {
    if (actionLoadingId !== null) return;
    setActionLoadingId(order.id);
    setError('');
    try {
      const res = await approveOrder(order.id);
      setDepositNotice(res.message || `Đơn #${order.id} đã được duyệt và chuyển sang đang soạn đơn.`);
      setReload((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleConfirmArrival(order: SupplierOrder) {
    if (actionLoadingId !== null) return;
    setActionLoadingId(order.id);
    setError('');
    try {
      const res = await confirmOrderArrival(order.id);
      setDepositNotice(res.message || `Đã xác nhận hàng đến cửa hàng cho đơn #${order.id}.`);
      setReload((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCompleteOrder(order: SupplierOrder) {
    if (actionLoadingId !== null) return;
    setActionLoadingId(order.id);
    setError('');
    try {
      const res = await completeOrder(order.id);
      setDepositNotice(res.message || `Đơn #${order.id} đã hoàn tất thành công.`);
      setReload((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleSupplierConfirmPayment(order: SupplierOrder) {
    if (actionLoadingId !== null) return;
    setActionLoadingId(order.id);
    setError('');
    try {
      const res = await confirmSupplierPayment(order.id);
      setDepositNotice(res.message || `Đã xác nhận nhận đủ tiền thanh toán cho đơn #${order.id}.`);
      setReload((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleTogglePackingItem(orderId: number, itemId: number) {
    const current = packingMap[orderId] || [];
    const next = current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId];
    setPackingMap((prev) => ({ ...prev, [orderId]: next }));
    try {
      await savePackingChecklist(orderId, next);
    } catch { }
  }

  async function handleToggleAllPacking(order: SupplierOrder) {
    const current = packingMap[order.id] || [];
    const next = current.length === order.items.length ? [] : order.items.map((it) => it.id);
    setPackingMap((prev) => ({ ...prev, [order.id]: next }));
    try {
      await savePackingChecklist(order.id, next);
    } catch { }
  }

  async function handlePaySubmit(method: 'COD' | 'QR') {
    if (!paymentOrder) return;
    const order = paymentOrder;
    setActionLoadingId(order.id);
    try {
      const res = await submitOrderPayment(order.id, method);
      setDepositNotice(res.message || `Đã gửi xác nhận trả tiền qua ${method}. Đang chờ Chủ vựa xác nhận.`);
      setPaymentOrder(null);
      setReload((n) => n + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setActionLoadingId(null);
    }
  }
  function handleExportExcel() {
    exportSupplierOrdersToExcel(
      data.orders,
      kind === 'store' ? 'Đơn Mua Hàng Cửa Hàng' : 'Đơn Bán Sỉ Chủ Vựa',
    );
  }

  async function handleExportPdf() {
    await exportSupplierOrdersToPdf(
      data.orders,
      kind === 'store' ? 'Đơn Mua Hàng Cửa Hàng' : 'Đơn Bán Sỉ Chủ Vựa',
    );
  }

  const [refundDraft, setRefundDraft] = useState<{ orderId: number; reference: string } | null>(
    null,
  );
  const [rescheduleOrderTarget, setRescheduleOrderTarget] = useState<SupplierOrder | null>(null);
  const [rescheduleTimeChoice, setRescheduleTimeChoice] = useState<'1_HOUR' | 'THIS_AFTERNOON' | 'TOMORROW_MORNING' | 'CUSTOM'>('1_HOUR');
  const [customRescheduleTime, setCustomRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleMessage, setRescheduleMessage] = useState('');
  const [supplierRescheduleBusy, setSupplierRescheduleBusy] = useState<number | null>(null);
  const [rejectRescheduleOrder, setRejectRescheduleOrder] = useState<SupplierOrder | null>(null);
  const [rejectRescheduleReason, setRejectRescheduleReason] = useState('');

  async function handleDepositWithWallet(order: SupplierOrder) {
    if (depositBusy !== null) return;
    setDepositBusy(order.id);
    setError('');
    setDepositNotice('');
    try {
      await depositOrderWithWallet(order.id);
      setDepositNotice(
        `Đã ký quỹ thành công ${money(order.depositAmount)} từ Ví hệ thống cho đơn #${order.id}.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDepositBusy(null);
    }
  }

  async function submitDeposit(event: FormEvent, order: SupplierOrder) {
    event.preventDefault();
    const reference = depositDraft?.orderId === order.id ? depositDraft.reference.trim() : '';
    if (depositBusy !== null || reference.length < 3) {
      setError('Nhập mã giao dịch hoặc nội dung chuyển khoản từ 3 ký tự trở lên.');
      return;
    }
    setDepositBusy(order.id);
    setError('');
    setDepositNotice('');
    try {
      await api.post(`/orders/${order.id}/deposit`, { reference });
      setDepositDraft(null);
      setDepositNotice(
        `Đã báo chuyển cọc cho đơn #${order.id}. Chủ vựa sẽ kiểm tra tài khoản và xác nhận; hiện tại đơn chưa được tính là đã thanh toán.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDepositBusy(null);
    }
  }

  /** Pays an order with the store wallet. The amount comes from the backend. */
  async function payWithWallet(order: SupplierOrder) {
    if (payingOrderId !== null) return;
    setPayingOrderId(order.id);
    setError('');
    setDepositNotice('');
    try {
      const payment = await payOrderWithWallet(order.id);
      setDepositNotice(
        `Đã thanh toán ${money(payment.amount)} cho đơn #${order.id} bằng ví. Chủ vựa sẽ nhận tiền khi đơn được giao.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setPayingOrderId(null);
    }
  }

  async function reviewDeposit(order: SupplierOrder, action: 'CONFIRM' | 'REJECT') {
    if (depositBusy !== null) return;
    setDepositBusy(order.id);
    setError('');
    setDepositNotice('');
    try {
      await api.patch(`/supplier/orders/${order.id}/deposit`, {
        action,
        ...(action === 'REJECT' ? { reason: 'Chủ vựa chưa ghi nhận tiền cọc vào tài khoản' } : {}),
      });
      setDepositNotice(
        action === 'CONFIRM'
          ? `Đã xác nhận nhận cọc cho đơn #${order.id}. Tạp hóa sẽ thấy trạng thái “Đã nhận cọc”.`
          : `Đã báo chưa nhận được cọc của đơn #${order.id}. Tạp hóa có thể kiểm tra và gửi lại thông tin chuyển khoản.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDepositBusy(null);
    }
  }

  async function submitSandboxDeposit(order: SupplierOrder) {
    if (depositBusy !== null) return;
    setDepositBusy(order.id);
    setError('');
    setDepositNotice('');
    try {
      await api.post(`/orders/${order.id}/deposit/sandbox`);
      setDepositDraft(null);
      setDepositNotice(
        `Thanh toán sandbox cho đơn #${order.id} đã được ghi nhận. Không có tiền thật được chuyển; chủ vựa vẫn cần bấm xác nhận để hoàn tất bước cọc.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDepositBusy(null);
    }
  }

  async function submitRefund(event: FormEvent, order: SupplierOrder) {
    event.preventDefault();
    const reference = refundDraft?.orderId === order.id ? refundDraft.reference.trim() : '';
    if (depositBusy !== null || reference.length < 3) {
      setError('Nhập mã giao dịch hoàn cọc từ 3 ký tự trở lên.');
      return;
    }
    setDepositBusy(order.id);
    setError('');
    setDepositNotice('');
    try {
      await api.patch(`/supplier/orders/${order.id}/deposit`, {
        action: 'REFUND',
        reference,
      });
      setRefundDraft(null);
      setDepositNotice(
        `Đã ghi nhận hoàn cọc cho đơn #${order.id}. Tạp hóa sẽ thấy mã hoàn tiền trong đơn hàng.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDepositBusy(null);
    }
  }

  async function handleSupplierReschedule(order: SupplierOrder, action: 'ACCEPT' | 'REJECT', note?: string) {
    if (supplierRescheduleBusy !== null) return;
    setSupplierRescheduleBusy(order.id);
    setError('');
    try {
      await respondRescheduleOrder(order.id, action, note);
      setReload((n) => n + 1);
      if (action === 'REJECT') {
        setRejectRescheduleOrder(null);
        setRejectRescheduleReason('');
      }
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setSupplierRescheduleBusy(null);
    }
  }

  async function handleReschedule(event: FormEvent) {
    event.preventDefault();
    if (!rescheduleOrderTarget || rescheduleBusy) return;
    setRescheduleBusy(true);
    setRescheduleMessage('');
    const timeText = rescheduleTimeChoice === '1_HOUR'
      ? 'Sau 1 tiếng nữa'
      : rescheduleTimeChoice === 'THIS_AFTERNOON'
        ? 'Buổi chiều nay (14h00 – 16h30)'
        : rescheduleTimeChoice === 'TOMORROW_MORNING'
          ? 'Buổi sáng mai (8h00 – 11h00)'
          : customRescheduleTime.trim() || 'Thời gian đã thỏa thuận';
    try {
      await rescheduleOrder(rescheduleOrderTarget.id, timeText, rescheduleReason.trim() || undefined);
      setRescheduleMessage('Đã gửi yêu cầu dời giờ giao hàng cho chủ vựa thành công.');
      setTimeout(() => {
        setRescheduleOrderTarget(null);
        setRescheduleReason('');
        setCustomRescheduleTime('');
        setReload((n) => n + 1);
      }, 1000);
    } catch (issue) {
      setRescheduleMessage(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setRescheduleBusy(false);
    }
  }

  async function updateComplaint(status: string) {
    if (!complaintOrder?.complaint || complaintActionBusy) return;
    setComplaintActionBusy(true);

    const planLabel =
      SUPPLIER_RESOLUTIONS.find((p) => p.code === supplierPlan)?.label || supplierPlan;
    const finalResponse = complaintResponse.trim()
      ? `[Phương án: ${planLabel}] ${complaintResponse.trim()}`
      : `[Phương án: ${planLabel}]`;

    try {
      await api.patch(`/complaints/${complaintOrder.complaint.id}`, {
        status,
        response: finalResponse,
      });
      setComplaintOrder(null);
      setComplaintResponse('');
      setReload((n) => n + 1);
    } catch (issue) {
      setComplaintMessage(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setComplaintActionBusy(false);
    }
  }

  async function submitComplaint(event: FormEvent) {
    event.preventDefault();
    if (!complaintOrder || complaintBusy) return;

    const selectedEntries = Object.entries(complaintSelectedItems).filter(([_, qty]) => qty > 0);
    if (selectedEntries.length === 0) {
      setComplaintMessage('Vui lòng tích chọn ít nhất 1 mặt hàng gặp sự cố.');
      return;
    }

    setComplaintBusy(true);
    setComplaintMessage('');

    let totalDamage = 0;
    const itemSummaries = selectedEntries
      .map(([idStr, qty]) => {
        const it = complaintOrder.items.find((item) => item.id === Number(idStr));
        if (!it) return '';
        const lineCost = qty * it.unitPrice;
        totalDamage += lineCost;
        return `${it.productName} (x${qty} ${it.packaging || 'phần'}: ${money(lineCost)})`;
      })
      .filter(Boolean);

    const itemInfo = itemSummaries.join('; ');
    const claimValueText = ` | Bồi hoàn ước tính: ${money(totalDamage)}`;
    const resolutionLabel =
      DESIRED_RESOLUTIONS.find((r) => r.code === complaintResolution)?.label || complaintResolution;

    const structuredHeader = `[Sự cố: ${itemInfo}${claimValueText} | Đề xuất: ${resolutionLabel}]`;
    const finalDescription = complaintDescription.trim()
      ? `${structuredHeader}\n${complaintDescription.trim()}`
      : structuredHeader;

    const serializedImages = complaintImages.length > 0 ? complaintImages.join('|||') : undefined;

    try {
      await api.post('/complaints', {
        orderId: complaintOrder.id,
        reason: complaintReason,
        description: finalDescription,
        ...(serializedImages ? { imageUrl: serializedImages } : {}),
      });
      setComplaintMessage('Đã gửi khiếu nại thành công đến nhà cung cấp.');
      setTimeout(() => {
        setComplaintOrder(null);
        setComplaintImages([]);
        setComplaintSelectedItems({});
        setReload((n) => n + 1);
      }, 1000);
    } catch (issue) {
      setComplaintMessage(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setComplaintBusy(false);
    }
  }

  const openStoreComplaint = (order: SupplierOrder) => {
    setComplaintOrder(order);
    setComplaintReason(COMPLAINT_REASONS[0].code);
    setComplaintDescription('');
    const initialMap: Record<number, number> = {};
    order.items.forEach((it) => {
      initialMap[it.id] = it.quantity;
    });
    setComplaintSelectedItems(initialMap);
    setComplaintResolution(DESIRED_RESOLUTIONS[0].code);
    setComplaintImages([]);
    setComplaintMessage('');
  };

  const openSupplierComplaint = (order: SupplierOrder) => {
    setComplaintOrder(order);
    setComplaintResponse(order.complaint?.response || '');
    setSupplierPlan(SUPPLIER_RESOLUTIONS[0].code);
    setComplaintMessage('');
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden && !busy) setReload((n) => n + 1);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    const abort = new AbortController();
    api
      .get(kind === 'store' ? '/orders' : '/supplier/orders', {
        params: query,
        signal: abort.signal,
      })
      .then(({ data }) => {
        if (!abort.signal.aborted) {
          setData(data);
          setError('');
          setPackingMap((prev) => {
            const next = { ...prev };
            data.orders?.forEach((o: SupplierOrder) => {
              if (o.driverInfo?.packingChecklist) {
                next[o.id] = o.driverInfo.packingChecklist;
              }
            });
            return next;
          });
        }
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setError(getApiError(error));
          if (isUnauthenticated(error)) onLogout();
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [kind, query, revision, reload, onLogout]);

  const submittedDepositCount = data.orders.filter(
    (order) => order.status === 'PENDING' && order.depositStatus === 'SUBMITTED',
  ).length;

  return (
    <section className="supplier-panel order-panel" aria-label="Danh sách đơn hàng">
      <div className="supplier-panel-title">
        <div>
          <span className="supplier-panel-label">ĐƠN HÀNG</span>
          <h2>{kind === 'store' ? 'Đơn mua của cửa hàng' : 'Đơn hàng từ cửa hàng'}</h2>
          <p className="catalog-hint">Tự cập nhật mỗi 30 giây khi bạn đang xem.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <ExportDropdown
            label="Xuất đơn"
            disabled={!data.orders.length}
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
          />
          <button
            className="ghost-button"
            disabled={loading || busy}
            onClick={() => {
              setLoading(true);
              setReload((n) => n + 1);
            }}
          >
            Tải lại đơn
          </button>
        </div>
      </div>

      {depositNotice && (
        <div className="deposit-flow-notice" role="status" aria-live="polite">
          <strong>Cập nhật thanh toán thành công</strong>
          <span>{depositNotice}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setDepositNotice('')}>
            ×
          </button>
        </div>
      )}

      {kind === 'supplier' && submittedDepositCount > 0 && (
        <div className="order-deposit-alert" role="status">
          <strong>Có {submittedDepositCount} khoản cọc đang chờ bạn xác nhận</strong>
          <span>
            Kiểm tra tiền đã vào tài khoản ngân hàng, sau đó bấm “Xác nhận đã nhận cọc” trong đơn
            tương ứng.
          </span>
        </div>
      )}

      <label className="order-filter">
        Trạng thái đơn
        <select
          aria-label="Lọc trạng thái đơn"
          value={query.status}
          disabled={loading || busy}
          onChange={(e) => {
            setLoading(true);
            setQuery({ page: 1, status: e.target.value });
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(statuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span>{data.total} đơn phù hợp</span>
      </label>

      {error ? (
        <p className="error-notice" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p role="status">Đang tải đơn hàng…</p>
      ) : !data.orders.length ? (
        <p className="inventory-empty">Chưa có đơn phù hợp với bộ lọc này.</p>
      ) : (
        <div className="order-list">
          {data.orders.map((order) => (
            <article className="order-card" key={order.id} aria-label={`Đơn ${order.id}`}>
              <div className="order-card-top">
                <div>
                  <strong>Đơn #{order.id}</strong>
                  <span>
                    {new Date(order.createdAt).toLocaleString('vi-VN')} ·{' '}
                    {kind === 'store' ? order.supplier?.businessName : order.buyer.name}
                  </span>
                </div>
                <span className={`order-status order-${order.status.toLowerCase()}`}>
                  {order.statusLabel}
                </span>
              </div>

              {order.walletPayment && (
                <p className="catalog-hint" style={{ marginTop: 8 }}>
                  {order.walletPayment.refunded
                    ? `Đã thanh toán bằng ví ${money(order.walletPayment.amount)} · đã hoàn tiền`
                    : order.walletPayment.status === 'SETTLED'
                      ? `Đã thanh toán bằng ví ${money(order.walletPayment.amount)} · chủ vựa đã nhận tiền`
                      : `Đã thanh toán bằng ví ${money(order.walletPayment.amount)} · chờ giao hàng`}
                </p>
              )}

              <div className="order-items">
                {order.items.map((item) => (
                  <span key={item.id}>
                    {item.productName} · {item.quantity} × {item.packaging} ·{' '}
                    {money(item.lineTotal)}
                  </span>
                ))}
              </div>

              {/* Checklist soạn hàng cho Chủ vựa khi đơn ở trạng thái PREPARING */}
              {kind === 'supplier' && order.status === 'PREPARING' && (
                <div
                  style={{
                    margin: '10px 0',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                      Checklist soạn hàng đóng gói ({(packingMap[order.id] || []).length}/{order.items.length} món)
                    </strong>
                    <button
                      type="button"
                      className="ghost-button"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => handleToggleAllPacking(order)}
                    >
                      {(packingMap[order.id] || []).length === order.items.length ? 'Bỏ chọn tất cả' : 'Tích chọn tất cả'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {order.items.map((item) => {
                      const isChecked = (packingMap[order.id] || []).includes(item.id);
                      return (
                        <label
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: isChecked ? '#f0fdf4' : '#ffffff',
                            border: `1px solid ${isChecked ? '#86efac' : '#e2e8f0'}`,
                            cursor: 'pointer',
                            fontSize: '12.5px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePackingItem(order.id, item.id)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <span
                            style={{
                              flex: 1,
                              textDecoration: isChecked ? 'line-through' : 'none',
                              color: isChecked ? '#166534' : '#1e293b',
                            }}
                          >
                            <strong>{item.productName}</strong> · SL: <strong>{item.quantity}</strong> × {item.packaging} ({money(item.lineTotal)})
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 650, color: isChecked ? '#15803d' : '#94a3b8' }}>
                            {isChecked ? 'Đã chuẩn bị' : 'Chưa lấy'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p
                    style={{
                      margin: '8px 0 0',
                      fontSize: '11.5px',
                      color: (packingMap[order.id] || []).length === order.items.length ? '#15803d' : '#b45309',
                      fontWeight: 500,
                    }}
                  >
                    {(packingMap[order.id] || []).length === order.items.length
                      ? 'Đã kiểm tra đủ toàn bộ hàng hóa. Nút "Chuẩn bị giao hàng" bên dưới đã sẵn sàng!'
                      : `Vui lòng tick kiểm tra đủ ${order.items.length} món hàng để kích hoạt nút chuẩn bị giao hàng.`}
                  </p>
                </div>
              )}

              <p className="order-delivery">
                <strong>{order.recipientName || 'Đơn cũ chưa có người nhận'}</strong>
                {order.recipientPhone && <> · {order.recipientPhone}</>}
                <br />
                {order.deliveryAddress || 'Đơn cũ chưa lưu địa chỉ nhận'}
              </p>

              {order.note && <p className="catalog-hint">Ghi chú: {order.note}</p>}

              {/* Reschedule statuses & actions for both Store and Supplier */}
              {(() => {
                const isPending = Boolean(
                  order.note?.includes('[YÊU CẦU DỜI LỊCH GIAO') &&
                  !order.note?.includes('[VỰA ĐÃ ĐỒNG Ý DỜI LỊCH') &&
                  !order.note?.includes('[VỰA TỪ CHỐI DỜI LỊCH')
                );
                const isAccepted = Boolean(order.note?.includes('[VỰA ĐÃ ĐỒNG Ý DỜI LỊCH'));
                const isRejected = Boolean(order.note?.includes('[VỰA TỪ CHỐI DỜI LỊCH'));

                if (isPending) {
                  return kind === 'supplier' ? (
                    <div
                      style={{
                        margin: '10px 0',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Yêu cầu dời giờ giao từ tiệm tạp hóa
                        </strong>
                        <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 600, backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '10px' }}>
                          Cần xác nhận
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 8px', color: '#78350f' }}>
                        {order.note?.split('[YÊU CẦU DỜI LỊCH GIAO')[1]?.split(']')[0]
                          ? `[YÊU CẦU DỜI LỊCH GIAO${order.note?.split('[YÊU CẦU DỜI LỊCH GIAO')[1]?.split(']')[0]}]`
                          : 'Tiệm có việc bận đi vắng, xin dời giờ giao hàng (cam kết nhận, không bùng đơn).'}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="table-button primary-small"
                          disabled={supplierRescheduleBusy === order.id}
                          onClick={() => void handleSupplierReschedule(order, 'ACCEPT')}
                        >
                          {supplierRescheduleBusy === order.id ? 'Đang lưu…' : 'Đồng ý dời lịch'}
                        </button>
                        <a
                          href={`tel:${order.recipientPhone || '0908123456'}`}
                          className="ghost-button"
                          style={{ fontSize: '11px', padding: '4px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          Gọi cho Tiệm (${order.recipientPhone || '0908 123 456'})
                        </a>
                        <button
                          type="button"
                          className="ghost-button"
                          style={{ color: '#b91c1c' }}
                          disabled={supplierRescheduleBusy === order.id}
                          onClick={() => {
                            setRejectRescheduleOrder(order);
                            setRejectRescheduleReason('');
                          }}
                        >
                          Không thể dời
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        margin: '8px 0',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        fontSize: '12px',
                        color: '#92400e',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <span>ĐÃ GỬI YÊU CẦU DỜI LỊCH GIAO: Đang chờ chủ vựa xác nhận.</span>
                      </div>
                      <small style={{ display: 'block', marginTop: '2px', color: '#b45309' }}>
                        Tiệm đã báo trước để tài xế chủ động tuyến đường, hoàn toàn không tính là bùng đơn.
                      </small>
                    </div>
                  );
                }

                if (isAccepted) {
                  return (
                    <div
                      style={{
                        margin: '8px 0',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        fontSize: '12px',
                        color: '#166534',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <strong>ĐÃ THỐNG NHẤT DỜI LỊCH GIAO: Chủ vựa đã xác nhận đổi tuyến giao theo giờ hẹn của tiệm.</strong>
                    </div>
                  );
                }

                if (isRejected) {
                  return (
                    <div
                      style={{
                        margin: '8px 0',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        fontSize: '12px',
                        color: '#b91c1c',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <strong>CHỦ VỰA KHÔNG THỂ DỜI LỊCH: Vui lòng sắp xếp người nhận hàng hoặc gọi trực tiếp cho vựa.</strong>
                    </div>
                  );
                }

                return null;
              })()}

              {(order.status === 'PREPARING' || order.status === 'SHIPPING') && (
                <div
                  style={{
                    margin: '10px 0',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: order.status === 'PREPARING' ? '#f0fdf4' : '#eff6ff',
                    border: `1px solid ${order.status === 'PREPARING' ? '#bbf7d0' : '#bfdbfe'}`,
                    fontSize: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <strong
                      style={{
                        color: order.status === 'PREPARING' ? '#15803d' : '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                      }}
                    >
                      {order.status === 'PREPARING'
                        ? 'Đã chuẩn bị hàng xong · Sẵn sàng vận chuyển'
                        : 'Đang trên đường vận chuyển'}
                    </strong>
                    <span
                      style={{
                        color: order.status === 'PREPARING' ? '#166534' : '#1e40af',
                        fontWeight: 600,
                        backgroundColor: order.status === 'PREPARING' ? '#dcfce7' : '#dbeafe',
                        padding: '3px 8px',
                        borderRadius: '12px',
                      }}
                    >
                      {order.driverInfo?.estimatedDeliveryTime
                        ? `Dự kiến giao: ${order.driverInfo.estimatedDeliveryTime}`
                        : order.status === 'PREPARING'
                          ? 'Dự kiến: Sắp xếp chuyến xe sớm nhất'
                          : 'Dự kiến giao: trong 30 – 45 phút tới'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '10px',
                      color: order.status === 'PREPARING' ? '#14532d' : '#1e3a8a',
                      marginTop: '6px',
                    }}
                  >
                    <div>
                      <span><strong>Kho xuất phát:</strong> </span>
                      <span>{order.supplier?.warehouseAddress || 'Kho vựa phân phối'}</span>
                      <div style={{ marginTop: '4px' }}>
                        <span><strong>Phương tiện:</strong> </span>
                        <span
                          style={{
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '11px',
                          }}
                        >
                          {order.driverInfo?.vehicleType || 'Xe giao hàng'}
                        </span>
                        {order.driverInfo?.licensePlate && (
                          <span
                            style={{
                              marginLeft: '6px',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            Biển số: {order.driverInfo.licensePlate}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span><strong>Tài xế giao hàng:</strong> </span>
                      <strong>
                        {order.driverInfo?.driverName ||
                          (order.supplier?.businessName
                            ? `Đội giao vận ${order.supplier.businessName}`
                            : 'Đội giao vận chủ vựa')}
                      </strong>
                      <br />
                      <span><strong>Số điện thoại tài xế:</strong> </span>
                      <a
                        href={`tel:${order.driverInfo?.driverPhone || order.supplier?.phone || '0908123789'}`}
                        style={{
                          color: '#1d4ed8',
                          fontWeight: 700,
                          textDecoration: 'underline',
                        }}
                      >
                        {order.driverInfo?.driverPhone || order.supplier?.phone || '0908 123 789'}
                      </a>
                      {order.driverInfo?.deliveryNotes && (
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#475569' }}>
                          <span><strong>Ghi chú chuyến xe:</strong> <em>{order.driverInfo.deliveryNotes}</em></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '10px',
                      paddingTop: '8px',
                      borderTop: `1px dashed ${order.status === 'PREPARING' ? '#86efac' : '#93c5fd'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <span style={{ color: '#475569', fontSize: '11px' }}>
                      {order.status === 'PREPARING'
                        ? 'Hàng đã chuẩn bị xong. Tiệm có thể hẹn dời giờ nhận ngay trước khi xe lăn bánh để vựa chủ động sắp chuyến.'
                        : 'Nếu bạn có việc bận đi vắng, hãy gọi tài xế hoặc bấm Hẹn dời giờ nhận để tài xế chủ động tuyến đường.'}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <a
                        href={`tel:${order.driverInfo?.driverPhone || order.supplier?.phone || '0908123789'}`}
                        className="ghost-button"
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        Gọi tài xế / vựa
                      </a>
                      {kind === 'supplier' && onEditDriver && (
                        <button
                          type="button"
                          className="table-button primary-small"
                          style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#475569' }}
                          onClick={() => onEditDriver(order)}
                        >
                          {order.driverInfo ? 'Sửa thông tin tài xế' : 'Gán tài xế'}
                        </button>
                      )}
                      {kind === 'store' && (
                        <button
                          type="button"
                          className="table-button primary-small"
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => {
                            setRescheduleOrderTarget(order);
                            setRescheduleTimeChoice('1_HOUR');
                            setCustomRescheduleTime('');
                            setRescheduleReason('');
                            setRescheduleMessage('');
                          }}
                        >
                          Hẹn dời giờ nhận hàng
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {order.depositAmount > 0 && (
                <div className={`order-deposit order-deposit-${order.depositStatus.toLowerCase()}`}>
                  <div className="order-deposit-heading">
                    <strong>
                      Đặt cọc {order.depositRate}% · {money(order.depositAmount)}
                    </strong>
                    <span>
                      {order.depositReference === 'VÍ_HỆ_THỐNG' && order.depositStatus === 'PAID'
                        ? 'Đã ký quỹ qua Ví hệ thống (An toàn)'
                        : order.depositReference === 'VÍ_HỆ_THỐNG' && order.depositStatus === 'REFUNDED'
                          ? 'Đã hoàn cọc vào Ví hệ thống'
                          : order.depositStatus === 'PENDING'
                            ? 'Chờ cửa hàng chuyển cọc'
                            : order.depositStatus === 'SUBMITTED'
                              ? 'Cửa hàng đã báo chuyển · chờ chủ vựa xác nhận'
                              : order.depositStatus === 'PAID'
                                ? 'Chủ vựa đã xác nhận nhận cọc'
                                : order.depositStatus === 'REFUNDED'
                                  ? 'Đã hoàn cọc'
                                  : order.depositStatus === 'REFUND_PENDING'
                                    ? 'Chủ vựa cần hoàn lại tiền cọc'
                                    : order.depositStatus}
                    </span>
                  </div>
                  {order.depositReference === 'VÍ_HỆ_THỐNG' ? (
                    <div
                      style={{
                        margin: '6px 0',
                        fontSize: '12px',
                        color: '#047857',
                        backgroundColor: '#f0fdf4',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Ký quỹ đảm bảo qua Ví hệ thống (Escrow)
                      </strong>
                      <span>
                        {kind === 'store'
                          ? `Tiền cọc ${money(order.depositAmount)} đang được hệ thống giữ an toàn. Chỉ giải ngân cho chủ vựa sau khi bạn nhận hàng thành công.`
                          : `Sàn đã khóa cọc ${money(order.depositAmount)} từ Ví của cửa hàng. Tiền cọc sẽ tự động giải ngân vào Ví của bạn khi giao hàng thành công.`}
                      </span>
                      <strong style={{ color: '#1f2937', marginTop: '2px' }}>
                        Thanh toán COD khi giao: ${money(order.total - order.depositAmount)}
                      </strong>
                    </div>
                  ) : (
                    <>
                      {order.depositBankAccountNumber && (
                        <div className="order-deposit-bank">
                          <span>Chuyển trực tiếp đến</span>
                          <strong>{order.depositBankName}</strong>
                          <b>{order.depositBankAccountNumber}</b>
                          <span>{order.depositBankAccountHolder}</span>
                          <small>Nội dung gợi ý: COC DH{order.id}</small>
                        </div>
                      )}
                      {order.depositReference && (
                        <small>Mã/nội dung cửa hàng cung cấp: {order.depositReference}</small>
                      )}
                    </>
                  )}
                  {order.depositSubmittedAt && (
                    <small>
                      Tạp hóa báo đã chuyển lúc{' '}
                      {new Date(order.depositSubmittedAt).toLocaleString('vi-VN')}
                    </small>
                  )}
                  {order.depositPaidAt && (
                    <small>
                      Chủ vựa xác nhận đã nhận lúc{' '}
                      {new Date(order.depositPaidAt).toLocaleString('vi-VN')}
                    </small>
                  )}
                  {order.depositRejectionReason && order.depositStatus === 'PENDING' && (
                    <small className="order-deposit-warning">
                      Chủ vựa chưa xác nhận: {order.depositRejectionReason}
                    </small>
                  )}
                  {order.depositRefundReference && (
                    <small>Mã giao dịch hoàn cọc: {order.depositRefundReference}</small>
                  )}
                  {kind === 'store' &&
                    order.status === 'PENDING' &&
                    order.depositStatus === 'PENDING' && (
                      <>
                        {depositDraft?.orderId === order.id ? (
                          <form
                            className="order-deposit-form"
                            onSubmit={(event) => void submitDeposit(event, order)}
                          >
                            <label>
                              Mã giao dịch hoặc nội dung chuyển khoản
                              <input
                                required
                                minLength={3}
                                maxLength={100}
                                value={depositDraft.reference}
                                onChange={(event) =>
                                  setDepositDraft({
                                    orderId: order.id,
                                    reference: event.target.value,
                                  })
                                }
                                placeholder={`Ví dụ: COC DH${order.id}`}
                                autoFocus
                              />
                            </label>
                            <div className="order-deposit-actions">
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => setDepositDraft(null)}
                                disabled={depositBusy !== null}
                              >
                                Hủy
                              </button>
                              <button
                                className="table-button primary-small"
                                disabled={depositBusy !== null}
                              >
                                {depositBusy === order.id ? 'Đang gửi…' : 'Gửi xác nhận đã chuyển'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="order-deposit-actions">
                            <button
                              className="table-button primary-small"
                              disabled={depositBusy !== null}
                              onClick={() => void handleDepositWithWallet(order)}
                            >
                              {depositBusy === order.id
                                ? 'Đang ký quỹ…'
                                : `Ký quỹ từ Ví (${money(order.depositAmount)})`}
                            </button>
                            <button
                              className="ghost-button"
                              disabled={depositBusy !== null}
                              onClick={() =>
                                setDepositDraft({
                                  orderId: order.id,
                                  reference: `COC DH${order.id}`,
                                })
                              }
                            >
                              Tôi đã chuyển khoản ngoài
                            </button>
                            <button
                              className="ghost-button"
                              disabled={depositBusy !== null}
                              onClick={() => void submitSandboxDeposit(order)}
                            >
                              {depositBusy === order.id
                                ? 'Đang chạy sandbox…'
                                : 'Thanh toán thử sandbox'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  {kind === 'supplier' &&
                    order.status === 'PENDING' &&
                    order.depositStatus === 'SUBMITTED' && (
                      <div className="order-deposit-actions">
                        <button
                          className="table-button primary-small"
                          disabled={depositBusy !== null}
                          onClick={() => void reviewDeposit(order, 'CONFIRM')}
                        >
                          {depositBusy === order.id ? 'Đang xử lý…' : 'Xác nhận đã nhận cọc'}
                        </button>
                        <button
                          className="ghost-button"
                          disabled={depositBusy !== null}
                          onClick={() => void reviewDeposit(order, 'REJECT')}
                        >
                          Chưa nhận được
                        </button>
                      </div>
                    )}
                  {kind === 'supplier' && order.depositStatus === 'REFUND_PENDING' && (
                    <>
                      {refundDraft?.orderId === order.id ? (
                        <form
                          className="order-deposit-form"
                          onSubmit={(event) => void submitRefund(event, order)}
                        >
                          <label>
                            Mã giao dịch hoàn cọc
                            <input
                              required
                              minLength={3}
                              maxLength={100}
                              value={refundDraft.reference}
                              onChange={(event) =>
                                setRefundDraft({
                                  orderId: order.id,
                                  reference: event.target.value,
                                })
                              }
                              placeholder="Ví dụ: HOAN COC DH1"
                              autoFocus
                            />
                          </label>
                          <div className="order-deposit-actions">
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => setRefundDraft(null)}
                              disabled={depositBusy !== null}
                            >
                              Hủy
                            </button>
                            <button
                              className="table-button primary-small"
                              disabled={depositBusy !== null}
                            >
                              {depositBusy === order.id ? 'Đang lưu…' : 'Xác nhận đã hoàn cọc'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          className="table-button primary-small"
                          disabled={depositBusy !== null}
                          onClick={() =>
                            setRefundDraft({
                              orderId: order.id,
                              reference: `HOAN COC DH${order.id}`,
                            })
                          }
                        >
                          Ghi nhận đã hoàn cọc
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {order.complaint && (
                <div
                  style={{
                    margin: '12px 0',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#fffaf5',
                    border: '1px solid #fed7aa',
                    fontSize: '13px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <strong
                      style={{
                        color: '#c2410c',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13.5px',
                      }}
                    >
                      <Icon name="shield" /> Khiếu nại sự cố:{' '}
                      {REASON_LABELS[order.complaint.reason] || order.complaint.reason}
                    </strong>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        color: COMPLAINT_STATUS_MAP[order.complaint.status]?.color || '#c2410c',
                        backgroundColor:
                          COMPLAINT_STATUS_MAP[order.complaint.status]?.bg || '#fff7ed',
                        border: `1px solid ${COMPLAINT_STATUS_MAP[order.complaint.status]?.color || '#c2410c'}40`,
                      }}
                    >
                      {COMPLAINT_STATUS_MAP[order.complaint.status]?.label ||
                        order.complaint.status}
                    </span>
                  </div>

                  {(() => {
                    const parsed = parseComplaintDescription(order.complaint.description);
                    return (
                      <div>
                        {parsed.itemInfo && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                              margin: '8px 0',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#ffedd5',
                                color: '#9a3412',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              Mặt hàng: {parsed.itemInfo}
                            </span>
                            {parsed.claimValue && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#dcfce7',
                                  color: '#166534',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 650,
                                }}
                              >
                                Thiệt hại: {parsed.claimValue}
                              </span>
                            )}
                            {parsed.resolution && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                Đề xuất: {parsed.resolution}
                              </span>
                            )}
                          </div>
                        )}
                        {parsed.details && (
                          <p style={{ margin: '6px 0', color: '#431407', lineHeight: 1.5 }}>
                            <strong>Mô tả chi tiết:</strong> {parsed.details}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {order.complaint.imageUrl && (() => {
                    const images = resolveComplaintImages(order.complaint.imageUrl);
                    if (!images.length) return null;
                    return (
                      <div style={{ marginTop: '10px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#9a3412',
                            display: 'block',
                            marginBottom: '6px',
                          }}
                        >
                          Ảnh chụp bằng chứng ({images.length} ảnh):
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {images.map((imgSrc, idx) => (
                            <img
                              key={idx}
                              src={imgSrc}
                              alt={`Ảnh bằng chứng ${idx + 1}`}
                              style={{
                                width: '80px',
                                height: '65px',
                                objectFit: 'cover',
                                borderRadius: '6px',
                                border: '1px solid #fed7aa',
                                cursor: 'pointer',
                              }}
                              onClick={() => setViewingImage(imgSrc)}
                              title="Bấm vào để xem ảnh phóng to"
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {order.complaint.response ? (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        color: '#166534',
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: '3px' }}>
                        Phản hồi từ Nhà cung cấp:
                      </strong>
                      <span>{order.complaint.response}</span>
                    </div>
                  ) : (
                    <small
                      style={{
                        color: '#9a3412',
                        fontStyle: 'italic',
                        display: 'block',
                        marginTop: '6px',
                      }}
                    >
                      {kind === 'store'
                        ? 'Đang chờ nhà cung cấp tiếp nhận và phản hồi.'
                        : 'Chưa có phản hồi cho cửa hàng.'}
                    </small>
                  )}

                  {kind === 'supplier' && (
                    <div
                      style={{
                        marginTop: '10px',
                        display: 'flex',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <button
                        className="table-button"
                        type="button"
                        disabled={busy}
                        onClick={() => openSupplierComplaint(order)}
                      >
                        Xử lý khiếu nại
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Báo cáo sự cố khi đang giao của tài xế */}
              {order.driverInfo?.incidentReport && (
                <div
                  style={{
                    margin: '10px 0',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    fontSize: '12.5px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <strong style={{ color: '#991b1b', fontSize: '13px' }}>
                      Sự cố khi đang giao: {order.driverInfo.incidentReport.damageTypeLabel || order.driverInfo.incidentReport.damageType}
                    </strong>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#b91c1c',
                        fontWeight: 650,
                        backgroundColor: '#fee2e2',
                        padding: '2px 8px',
                        borderRadius: '10px',
                      }}
                    >
                      Báo cáo sự cố tài xế
                    </span>
                  </div>
                  <div style={{ color: '#7f1d1d' }}>
                    <strong>Mặt hàng bị hỏng:</strong>{' '}
                    {order.driverInfo.incidentReport.damagedItems
                      ?.map((d) => `${d.productName} (x${d.quantity})`)
                      .join(', ')}
                  </div>
                  {order.driverInfo.incidentReport.notes && (
                    <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#991b1b' }}>
                      Ghi chú: "{order.driverInfo.incidentReport.notes}"
                    </div>
                  )}
                  {order.driverInfo.incidentReport.evidenceImageUrl && (() => {
                    const imgs = resolveComplaintImages(order.driverInfo.incidentReport.evidenceImageUrl);
                    if (!imgs.length) return null;
                    return (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {imgs.map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt={`Bằng chứng ${i + 1}`}
                            style={{
                              width: '55px',
                              height: '55px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #fca5a5',
                              cursor: 'pointer',
                            }}
                            onClick={() => setViewingImage(src)}
                            title="Bấm để xem ảnh lớn"
                          />
                        ))}
                      </div>
                    );
                  })()}
                  {order.driverInfo.incidentReport.supplementaryOrderId && (
                    <div
                      style={{
                        marginTop: '8px',
                        fontWeight: 650,
                        color: '#166534',
                        backgroundColor: '#f0fdf4',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      Chủ vựa đã tạo đơn giao bổ sung 0đ #{order.driverInfo.incidentReport.supplementaryOrderId} để bù hàng hỏng chuyến sau cho tiệm.
                    </div>
                  )}
                </div>
              )}

              {/* Tiến trình thanh toán & Xác nhận 2 bước */}
              {order.driverInfo?.paymentInfo?.status === 'PENDING_SUPPLIER_CONFIRM' && (
                <div
                  style={{
                    margin: '10px 0',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#fefce8',
                    border: '1px solid #fef08a',
                    fontSize: '12.5px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#854d0e', display: 'block', fontSize: '13px' }}>
                        {kind === 'store'
                          ? `Đã gửi xác nhận trả tiền qua ${order.driverInfo.paymentInfo.method} (${money(order.driverInfo.paymentInfo.amount)})`
                          : `Tiệm tạp hóa đã báo trả tiền qua ${order.driverInfo.paymentInfo.method} (${money(order.driverInfo.paymentInfo.amount)})`}
                      </strong>
                      <span style={{ fontSize: '12px', color: '#713f12' }}>
                        {kind === 'store'
                          ? 'Đang chờ Chủ vựa / Tài xế bấm "Xác nhận đã nhận đủ tiền" để kích hoạt hoàn tất đơn.'
                          : 'Vui lòng kiểm tra tiền mặt từ tài xế hoặc tài khoản ngân hàng, sau đó bấm xác nhận bên dưới.'}
                      </span>
                    </div>

                    {kind === 'supplier' ? (
                      <button
                        type="button"
                        className="table-button primary-small"
                        style={{ backgroundColor: '#15803d', fontWeight: 700 }}
                        disabled={actionLoadingId === order.id}
                        onClick={() => void handleSupplierConfirmPayment(order)}
                      >
                        {actionLoadingId === order.id ? 'Đang lưu…' : 'Xác nhận đã nhận đủ tiền'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="table-button primary-small"
                        disabled={true}
                        style={{ opacity: 0.6, cursor: 'not-allowed', backgroundColor: '#94a3b8' }}
                        title="Nút sẽ được kích hoạt ngay khi Chủ vựa bấm xác nhận đã nhận đủ tiền"
                      >
                        Thanh toán thành công (Chờ vựa xác nhận...)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {order.driverInfo?.paymentInfo?.status === 'CONFIRMED' && order.status !== 'COMPLETED' && (
                <div
                  style={{
                    margin: '10px 0',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    fontSize: '12.5px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#166534', display: 'block', fontSize: '13px' }}>
                        Chủ vựa đã xác nhận nhận đủ tiền thanh toán qua {order.driverInfo.paymentInfo.method}
                      </strong>
                      <span style={{ fontSize: '12px', color: '#14532d' }}>
                        {kind === 'store'
                          ? 'Tiền hàng đã được thanh toán an toàn. Bấm nút bên phải để hoàn tất đơn hàng và giải ngân ký quỹ.'
                          : 'Đã xác nhận thu tiền thành công. Cửa hàng đang thực hiện hoàn tất đơn.'}
                      </span>
                    </div>

                    {kind === 'store' && (
                      <button
                        type="button"
                        className="table-button primary-small"
                        style={{ backgroundColor: '#15803d', fontWeight: 700 }}
                        disabled={actionLoadingId === order.id}
                        onClick={() => void handleCompleteOrder(order)}
                      >
                        {actionLoadingId === order.id ? 'Đang hoàn tất…' : 'Thanh toán thành công & Hoàn tất đơn'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {order.status === 'COMPLETED' && (
                <div
                  style={{
                    margin: '10px 0',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #86efac',
                    color: '#15803d',
                    fontWeight: 650,
                    fontSize: '12.5px',
                  }}
                >
                  Đơn hàng đã hoàn tất thành công. Tiền hàng và cọc đã được quyết toán đầy đủ.
                </div>
              )}

              <p className="catalog-hint">
                Tiền hàng {money(order.subtotal)} + giao hàng {money(order.deliveryFee)}
              </p>

              <div className="order-card-bottom">
                <strong>
                  {order.status === 'DELIVERED' || order.status === 'COMPLETED'
                    ? 'Tổng đã giao'
                    : order.depositStatus === 'PAID'
                      ? 'Còn lại khi giao'
                      : 'Tổng đơn'}
                  :{' '}
                  {money(
                    order.depositStatus === 'PAID'
                      ? order.total - order.depositAmount
                      : order.total,
                  )}
                </strong>
                {kind === 'store' && !['REJECTED', 'DELIVERED'].includes(order.status) && (
                  <div className="order-actions">
                    <button
                      className="table-button primary-small"
                      disabled={busy || payingOrderId === order.id || Boolean(order.walletPayment)}
                      onClick={() => void payWithWallet(order)}
                    >
                      {payingOrderId === order.id
                        ? 'Đang thanh toán…'
                        : order.walletPayment
                          ? 'Đã thanh toán bằng ví'
                          : 'Thanh toán bằng ví'}
                    </button>
                  </div>
                )}
                {kind === 'supplier' && (
                  <div className="order-actions">
                    {order.status === 'PREPARING' && (
                      <button
                        className="table-button primary-small"
                        disabled={
                          busy ||
                          (packingMap[order.id] || []).length < order.items.length
                        }
                        onClick={() => onStatus?.(order)}
                        title={
                          (packingMap[order.id] || []).length < order.items.length
                            ? `Cần tích đủ ${order.items.length} món trong checklist soạn hàng`
                            : undefined
                        }
                      >
                        {(packingMap[order.id] || []).length < order.items.length
                          ? `Soạn đủ hàng để giao (${(packingMap[order.id] || []).length}/${order.items.length})`
                          : 'Chuẩn bị giao hàng & Gán tài xế'}
                      </button>
                    )}

                    {order.status === 'SHIPPING' && (
                      <button
                        type="button"
                        className="table-button danger"
                        style={{ backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 650 }}
                        onClick={() => onReportIncident?.(order)}
                      >
                        Lập báo cáo sự cố (Khi giao)
                      </button>
                    )}

                    {order.status === 'PENDING' && (
                      <>
                        <button
                          className="table-button primary-small"
                          disabled={
                            busy ||
                            (order.status === 'PENDING' &&
                              order.depositAmount > 0 &&
                              order.depositStatus !== 'PAID')
                          }
                          onClick={() => onStatus?.(order)}
                        >
                          Bắt đầu soạn đơn
                        </button>
                        <button
                          className="table-button danger"
                          disabled={busy || order.depositStatus === 'SUBMITTED'}
                          title={
                            order.depositStatus === 'SUBMITTED'
                              ? 'Xử lý xác nhận cọc trước khi từ chối đơn'
                              : undefined
                          }
                          onClick={() => onStatus?.(order, 'REJECTED')}
                        >
                          Từ chối
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Phía Chủ tạp hóa: Các nút duyệt đơn, nhận hàng, trả tiền */}
                {kind === 'store' && (
                  <div className="order-actions">
                    {(order.status === 'PENDING' || order.status === 'APPROVED') && (
                      <button
                        type="button"
                        className="table-button primary-small"
                        disabled={
                          busy ||
                          actionLoadingId === order.id ||
                          (order.depositAmount > 0 && order.depositStatus !== 'PAID')
                        }
                        onClick={() => void handleStoreApprove(order)}
                        title={
                          order.depositAmount > 0 && order.depositStatus !== 'PAID'
                            ? 'Cần đặt cọc trước khi duyệt đơn'
                            : undefined
                        }
                      >
                        {actionLoadingId === order.id ? 'Đang duyệt…' : 'Duyệt đơn (Chuyển sang soạn đơn)'}
                      </button>
                    )}

                    {order.status === 'SHIPPING' && (
                      <button
                        type="button"
                        className="table-button primary-small"
                        style={{ backgroundColor: '#15803d', fontWeight: 700 }}
                        disabled={busy || actionLoadingId === order.id}
                        onClick={() => void handleConfirmArrival(order)}
                      >
                        {actionLoadingId === order.id ? 'Đang xử lý…' : 'Hàng đã đến cửa hàng (Xác nhận nhận xe)'}
                      </button>
                    )}

                    {order.status === 'ISSUE_HANDLING' && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {!order.complaint && (
                          <button
                            type="button"
                            className="table-button complaint-card-report-btn"
                            onClick={() => openStoreComplaint(order)}
                          >
                            Báo cáo sự cố
                          </button>
                        )}
                        {(!order.driverInfo?.paymentInfo ||
                          order.driverInfo?.paymentInfo?.status === 'PENDING_PAYMENT') && (
                            <button
                              type="button"
                              className="table-button primary-small"
                              style={{ backgroundColor: '#0284c7', fontWeight: 700 }}
                              onClick={() => setPaymentOrder(order)}
                            >
                              Hàng hóa đầy đủ & Trả tiền
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {order.status === 'REJECTED' && (
                <p className="order-rejection">Lý do từ chối: {order.rejectReason}</p>
              )}

              {kind === 'store' && order.status === 'PENDING' && (
                <p className="catalog-hint">
                  {order.depositStatus === 'PENDING'
                    ? 'Chuyển đúng số tiền cọc đến tài khoản hiển thị phía trên rồi gửi mã giao dịch.'
                    : order.depositStatus === 'SUBMITTED'
                      ? 'Đã gửi xác nhận chuyển cọc. Đang chờ chủ vựa kiểm tra tài khoản.'
                      : 'Bấm nút Duyệt đơn để báo chủ vựa bắt đầu soạn hàng.'}
                </p>
              )}

              {/* Nút báo cáo đơn hàng khi đang ở bước tiếp nhận xử lý (ISSUE_HANDLING) */}
              {kind === 'store' && order.status === 'ISSUE_HANDLING' && !order.complaint && (
                <div
                  className="order-card-bottom"
                  style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e8eee7' }}
                >
                  <p className="catalog-hint" style={{ margin: 0 }}>
                    Đơn hàng đang ở bước <strong>tiếp nhận xử lý</strong>. Nếu phát hiện sự cố hoặc
                    lỗi hàng, bạn có thể gửi báo cáo khiếu nại.
                  </p>
                  <button
                    className="table-button complaint-card-report-btn"
                    type="button"
                    onClick={() => openStoreComplaint(order)}
                  >
                    Báo cáo sự cố
                  </button>
                </div>
              )}

              {/* Nút báo cáo đơn hàng khi đã giao (DELIVERED) */}
              {kind === 'store' && order.status === 'DELIVERED' && !order.complaint && (
                <div
                  className="order-card-bottom"
                  style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e8eee7' }}
                >
                  <p className="catalog-hint" style={{ margin: 0 }}>
                    Kiểm tra hàng thực nhận rồi cập nhật kho. Nếu có sự cố, bạn có thể gửi báo cáo
                    khiếu nại.
                  </p>
                  <button
                    className="table-button complaint-card-report-btn"
                    type="button"
                    onClick={() => openStoreComplaint(order)}
                  >
                    Báo cáo sự cố
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="catalog-pagination">
        <button
          className="ghost-button"
          disabled={loading || busy || query.page === 1}
          onClick={() => {
            setLoading(true);
            setQuery({ ...query, page: query.page - 1 });
          }}
        >
          Trang trước
        </button>
        <span>Trang {query.page}</span>
        <button
          className="ghost-button"
          disabled={loading || busy || !data.hasMore || Boolean(error)}
          onClick={() => {
            setLoading(true);
            setQuery({ ...query, page: query.page + 1 });
          }}
        >
          Trang sau
        </button>
      </div>

      {complaintOrder && (
        <div
          className="complaint-dialog-backdrop"
          onClick={() => setComplaintOrder(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="complaint-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="complaint-dialog-header">
              <div>
                <div className="complaint-dialog-eyebrow">
                  {kind === 'store' ? 'HỖ TRỢ & KHIẾU NẠI ĐƠN HÀNG' : 'TIẾP NHẬN XỬ LÝ SỰ CỐ'}
                </div>
                <h2 className="complaint-dialog-title">
                  {kind === 'store'
                    ? `Báo cáo sự cố đơn hàng #${complaintOrder.id}`
                    : `Xử lý khiếu nại đơn #${complaintOrder.id}`}
                </h2>
                <p className="complaint-dialog-subtitle">
                  {kind === 'store'
                    ? `Gửi trực tiếp đến nhà cung cấp: ${complaintOrder.supplier?.businessName || 'Nhà cung cấp'}`
                    : `Cửa hàng gửi khiếu nại: ${complaintOrder.recipientName || 'Cửa hàng tạp hóa'}`}
                </p>
              </div>
              <button
                type="button"
                className="complaint-dialog-close"
                onClick={() => setComplaintOrder(null)}
                aria-label="Đóng"
              >
                <Icon name="close" />
              </button>
            </div>

            <form
              onSubmit={
                kind === 'store'
                  ? submitComplaint
                  : (e) => {
                    e.preventDefault();
                    void updateComplaint('RESOLVED');
                  }
              }
            >
              <div className="complaint-dialog-body">
                {kind === 'store' ? (
                  <div className="complaint-section-group">
                    {/* 1. Danh sách mặt hàng gặp sự cố (Chọn nhiều món) */}
                    <div className="complaint-field">
                      <label className="complaint-label">
                        <span>Danh sách mặt hàng gặp sự cố</span>
                        <span className="complaint-label-hint">Tích chọn các món bị hỏng, lỗi, thiếu</span>
                      </label>

                      <div className="complaint-checklist-box">
                        <div className="complaint-checklist-header">
                          <label className="complaint-select-all-label">
                            <input
                              type="checkbox"
                              className="complaint-item-check"
                              checked={
                                complaintOrder.items.length > 0 &&
                                complaintOrder.items.every(
                                  (it) => (complaintSelectedItems[it.id] || 0) > 0,
                                )
                              }
                              onChange={(e) => {
                                const isAll = e.target.checked;
                                const nextMap: Record<number, number> = {};
                                if (isAll) {
                                  complaintOrder.items.forEach((it) => {
                                    nextMap[it.id] = it.quantity;
                                  });
                                }
                                setComplaintSelectedItems(nextMap);
                              }}
                            />
                            <span>Chọn tất cả ({complaintOrder.items.length} mặt hàng)</span>
                          </label>
                          <span className="complaint-label-hint">
                            Đã chọn{' '}
                            {
                              Object.values(complaintSelectedItems).filter((q) => q > 0)
                                .length
                            }{' '}
                            / {complaintOrder.items.length} món
                          </span>
                        </div>

                        <div className="complaint-checklist-body">
                          {complaintOrder.items.map((item) => {
                            const isChecked = (complaintSelectedItems[item.id] || 0) > 0;
                            const currentQty = complaintSelectedItems[item.id] || 0;
                            const itemSubtotal = currentQty * item.unitPrice;

                            return (
                              <div
                                key={item.id}
                                className={`complaint-checklist-row ${isChecked ? 'checked' : ''}`}
                              >
                                <div className="complaint-row-left">
                                  <input
                                    type="checkbox"
                                    className="complaint-item-check"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      setComplaintSelectedItems((prev) => {
                                        const next = { ...prev };
                                        if (e.target.checked) {
                                          next[item.id] = item.quantity;
                                        } else {
                                          delete next[item.id];
                                        }
                                        return next;
                                      });
                                    }}
                                  />
                                  <div className="complaint-item-info">
                                    <span className="complaint-item-name">
                                      {item.productName}
                                    </span>
                                    <span className="complaint-item-meta">
                                      Đơn giá: {money(item.unitPrice)} / {item.packaging || 'phần'} (Tổng mua: {item.quantity})
                                    </span>
                                  </div>
                                </div>

                                <div className="complaint-row-right">
                                  {isChecked ? (
                                    <>
                                      <div className="complaint-qty-control">
                                        <span style={{ fontSize: '11.5px', color: '#55725e' }}>
                                          SL lỗi:
                                        </span>
                                        <input
                                          type="number"
                                          className="complaint-qty-input"
                                          min={1}
                                          max={item.quantity}
                                          value={currentQty}
                                          onChange={(e) => {
                                            const val = Math.max(
                                              1,
                                              Math.min(item.quantity, Number(e.target.value) || 1),
                                            );
                                            setComplaintSelectedItems((prev) => ({
                                              ...prev,
                                              [item.id]: val,
                                            }));
                                          }}
                                        />
                                        <span style={{ fontSize: '11px', color: '#728477' }}>
                                          /{item.quantity}
                                        </span>
                                      </div>
                                      <span className="complaint-row-subtotal">
                                        {money(itemSubtotal)}
                                      </span>
                                    </>
                                  ) : (
                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                      Chưa chọn
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="complaint-checklist-footer">
                          <span>Tổng thiệt hại ước tính:</span>
                          <span className="complaint-total-badge">
                            {money(
                              Object.entries(complaintSelectedItems).reduce(
                                (sum, [id, qty]) => {
                                  const it = complaintOrder.items.find(
                                    (i) => i.id === Number(id),
                                  );
                                  return sum + (it ? it.unitPrice * qty : 0);
                                },
                                0,
                              ),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Lý do & Phương án mong muốn */}
                    <div className="complaint-grid-2">
                      <div className="complaint-field">
                        <label className="complaint-label">
                          <span>Lý do khiếu nại</span>
                        </label>
                        <select
                          className="complaint-select"
                          value={complaintReason}
                          onChange={(e) => setComplaintReason(e.target.value)}
                        >
                          {COMPLAINT_REASONS.map((r) => (
                            <option key={r.code} value={r.code}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="complaint-field">
                        <label className="complaint-label">
                          <span>Phương án mong muốn</span>
                        </label>
                        <select
                          className="complaint-select"
                          value={complaintResolution}
                          onChange={(e) => setComplaintResolution(e.target.value)}
                        >
                          {DESIRED_RESOLUTIONS.map((res) => (
                            <option key={res.code} value={res.code}>
                              {res.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 3. Đính kèm ảnh bằng chứng (Cho phép nhiều ảnh) */}
                    <div className="complaint-field">
                      <label className="complaint-label">
                        <span>Ảnh chụp bằng chứng hiện trạng</span>
                        <span className="complaint-label-hint">Tối đa 5 ảnh (Thùng vỡ, tem date, các món lỗi...)</span>
                      </label>

                      <input
                        id="complaint-file-input"
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          const remainingSlots = 5 - complaintImages.length;
                          if (remainingSlots <= 0) return;
                          const filesToProcess = files.slice(0, remainingSlots);
                          const newCompressedList: string[] = [];
                          for (const file of filesToProcess) {
                            const compressed = await compressImageFile(file);
                            newCompressedList.push(compressed);
                          }
                          setComplaintImages((prev) => [...prev, ...newCompressedList]);
                          e.target.value = '';
                        }}
                      />

                      {complaintImages.length > 0 && (
                        <div className="complaint-gallery-grid">
                          {complaintImages.map((imgSrc, idx) => (
                            <div key={idx} className="complaint-gallery-thumb">
                              <img
                                src={resolveComplaintImage(imgSrc)}
                                alt={`Ảnh bằng chứng ${idx + 1}`}
                                onClick={() => setViewingImage(resolveComplaintImage(imgSrc) || null)}
                                title="Bấm để xem ảnh to"
                              />
                              <button
                                type="button"
                                className="complaint-thumb-remove"
                                onClick={() => setComplaintImages((prev) => prev.filter((_, i) => i !== idx))}
                                title="Gỡ ảnh này"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {complaintImages.length < 5 && (
                        <div
                          className="complaint-upload-zone"
                          style={{ marginTop: complaintImages.length > 0 ? '8px' : 0 }}
                          onClick={() => document.getElementById('complaint-file-input')?.click()}
                        >
                          <div className="complaint-upload-icon">
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                          </div>
                          <div className="complaint-upload-info">
                            <span className="complaint-upload-title">
                              {complaintImages.length === 0
                                ? 'Tải lên hoặc chụp ảnh kiện hàng / các món lỗi'
                                : `Thêm ảnh bằng chứng khác (${complaintImages.length}/5 ảnh)`}
                            </span>
                            <span className="complaint-upload-sub">
                              Định dạng JPG, PNG • Chọn nhiều ảnh cùng lúc • Hệ thống tự nén dung lượng
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. Mô tả chi tiết */}
                    <div className="complaint-field">
                      <label className="complaint-label">
                        <span>Mô tả chi tiết sự cố</span>
                      </label>
                      <textarea
                        className="complaint-textarea"
                        required
                        minLength={3}
                        maxLength={1000}
                        rows={3}
                        placeholder="Mô tả cụ thể sự cố để nhà cung cấp xác minh và hỗ trợ xử lý nhanh chóng..."
                        value={complaintDescription}
                        onChange={(e) => setComplaintDescription(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  /* Supplier review */
                  <div className="complaint-section-group">
                    <div className="complaint-review-panel">
                      <div className="complaint-review-row">
                        <span
                          className="complaint-review-tag"
                          style={{ background: '#ffedd5', color: '#9a3412' }}
                        >
                          Lý do: {REASON_LABELS[complaintOrder.complaint?.reason || ''] ||
                            complaintOrder.complaint?.reason}
                        </span>
                        <span
                          className="complaint-review-tag"
                          style={{
                            color:
                              COMPLAINT_STATUS_MAP[complaintOrder.complaint?.status || 'OPEN']
                                ?.color || '#c2410c',
                            background:
                              COMPLAINT_STATUS_MAP[complaintOrder.complaint?.status || 'OPEN']
                                ?.bg || '#fff7ed',
                          }}
                        >
                          {COMPLAINT_STATUS_MAP[complaintOrder.complaint?.status || 'OPEN']?.label}
                        </span>
                      </div>

                      {(() => {
                        const parsed = parseComplaintDescription(
                          complaintOrder.complaint?.description || '',
                        );
                        return (
                          <>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {parsed.itemInfo && (
                                <span
                                  className="complaint-review-tag"
                                  style={{ background: '#f1f5f9', color: '#334155' }}
                                >
                                  Sản phẩm: {parsed.itemInfo}
                                </span>
                              )}
                              {parsed.claimValue && (
                                <span
                                  className="complaint-review-tag"
                                  style={{ background: '#dcfce7', color: '#166534' }}
                                >
                                  Ước tính: {parsed.claimValue}
                                </span>
                              )}
                              {parsed.resolution && (
                                <span
                                  className="complaint-review-tag"
                                  style={{ background: '#e0f2fe', color: '#0369a1' }}
                                >
                                  Đề xuất: {parsed.resolution}
                                </span>
                              )}
                            </div>
                            {parsed.details && (
                              <div className="complaint-review-desc">
                                <strong style={{ color: '#1a2b20' }}>Ghi chú của cửa hàng:</strong>{' '}
                                {parsed.details}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {complaintOrder.complaint?.imageUrl && (() => {
                        const images = resolveComplaintImages(complaintOrder.complaint?.imageUrl);
                        if (!images.length) return null;
                        return (
                          <div style={{ marginTop: '8px' }}>
                            <strong style={{ fontSize: '12px', display: 'block', marginBottom: '6px', color: '#2b4536' }}>
                              Ảnh bằng chứng từ cửa hàng ({images.length} ảnh):
                            </strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {images.map((imgSrc, idx) => (
                                <img
                                  key={idx}
                                  src={imgSrc}
                                  alt={`Bằng chứng ${idx + 1}`}
                                  className="complaint-preview-thumb"
                                  onClick={() => setViewingImage(imgSrc)}
                                  title="Bấm để xem ảnh phóng to"
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="complaint-field">
                      <label className="complaint-label">
                        <span>Phương án giải quyết (Chủ vựa xác nhận)</span>
                      </label>
                      <select
                        className="complaint-select"
                        value={supplierPlan}
                        onChange={(e) => setSupplierPlan(e.target.value)}
                      >
                        {SUPPLIER_RESOLUTIONS.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="complaint-field">
                      <label className="complaint-label">
                        <span>Phản hồi chi tiết gửi đến cửa hàng</span>
                      </label>
                      <textarea
                        className="complaint-textarea"
                        required
                        minLength={3}
                        maxLength={1000}
                        rows={3}
                        value={complaintResponse}
                        onChange={(e) => setComplaintResponse(e.target.value)}
                        placeholder="Ghi rõ phương án giải quyết, thời gian hoàn cọc hoặc lịch giao bù..."
                      />
                    </div>
                  </div>
                )}

                {complaintMessage && (
                  <p
                    className={
                      complaintMessage.includes('Lỗi') || complaintMessage.includes('không')
                        ? 'error-notice'
                        : 'supplier-success'
                    }
                  >
                    {complaintMessage}
                  </p>
                )}
              </div>

              <div className="complaint-dialog-footer">
                <button
                  type="button"
                  className="complaint-btn-ghost"
                  onClick={() => setComplaintOrder(null)}
                >
                  Hủy bỏ
                </button>
                {kind === 'store' ? (
                  <button
                    type="submit"
                    className="complaint-btn-primary"
                    disabled={complaintBusy}
                  >
                    {complaintBusy ? 'Đang gửi…' : 'Gửi khiếu nại'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="complaint-btn-danger"
                      disabled={complaintActionBusy}
                      onClick={() => void updateComplaint('REJECTED')}
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      className="complaint-btn-ghost"
                      disabled={complaintActionBusy}
                      onClick={() => void updateComplaint('IN_REVIEW')}
                    >
                      Tiếp nhận xử lý
                    </button>
                    <button
                      type="button"
                      className="complaint-btn-primary"
                      disabled={complaintActionBusy}
                      onClick={() => void updateComplaint('RESOLVED')}
                    >
                      Xác nhận giải quyết
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox phóng to ảnh bằng chứng */}
      {viewingImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'pointer',
          }}
          onClick={() => setViewingImage(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={viewingImage}
              alt="Bằng chứng khiếu nại phóng to"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                borderRadius: '8px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              }}
            />
            <div
              style={{
                textAlign: 'center',
                color: '#fff',
                marginTop: '10px',
                fontSize: '13px',
              }}
            >
              (Bấm vào bất kỳ đâu để đóng)
            </div>
          </div>
        </div>
      )}
      {/* Reschedule Delivery Modal */}
      {rescheduleOrderTarget && (
        <div className="supplier-dialog-backdrop">
          <form
            className="supplier-dialog"
            style={{ maxWidth: '520px' }}
            onSubmit={handleReschedule}
          >
            <h2>Hẹn dời giờ nhận hàng (Đơn #{rescheduleOrderTarget.id})</h2>
            <p className="catalog-hint" style={{ marginTop: 0 }}>
              Thông báo trước cho tài xế và chủ vựa (
              <strong>{rescheduleOrderTarget.supplier?.businessName || 'Chủ vựa'}</strong>) nếu bạn có việc bận đột xuất để dời lịch giao, hoàn toàn không tính là bùng đơn.
            </p>

            <div style={{ margin: '14px 0' }}>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '8px', fontSize: '13px' }}>
                Chọn thời gian mong muốn dời lại:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { code: '1_HOUR', label: 'Dời lại 1 tiếng nữa (Tôi đang ra ngoài có việc gấp)' },
                  { code: 'THIS_AFTERNOON', label: 'Giao vào buổi chiều nay (14h00 – 16h30)' },
                  { code: 'TOMORROW_MORNING', label: 'Giao vào sáng mai (8h00 – 11h00)' },
                  { code: 'CUSTOM', label: 'Tự nhập thời gian khác...' },
                ].map((item) => (
                  <label
                    key={item.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: rescheduleTimeChoice === item.code ? '2px solid #2563eb' : '1px solid #d1d5db',
                      backgroundColor: rescheduleTimeChoice === item.code ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                      fontWeight: rescheduleTimeChoice === item.code ? 600 : 400,
                      fontSize: '13px',
                    }}
                  >
                    <input
                      type="radio"
                      name="rescheduleTime"
                      value={item.code}
                      checked={rescheduleTimeChoice === item.code}
                      onChange={() => setRescheduleTimeChoice(item.code as any)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {rescheduleTimeChoice === 'CUSTOM' && (
              <label className="supplier-dialog-field">
                <span>Thời gian bạn có thể nhận hàng:</span>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Khoảng 17h30 chiều nay..."
                  value={customRescheduleTime}
                  onChange={(e) => setCustomRescheduleTime(e.target.value)}
                />
              </label>
            )}

            <label className="supplier-dialog-field">
              <span>Lý do dời giờ (Không bắt buộc):</span>
              <input
                type="text"
                placeholder="Ví dụ: Đang đi đón con / Đi lấy hàng / Đang có việc gia đình..."
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
              />
            </label>

            {rescheduleMessage && (
              <p
                className={
                  rescheduleMessage.includes('Lỗi') || rescheduleMessage.includes('không')
                    ? 'error-notice'
                    : 'supplier-success'
                }
              >
                {rescheduleMessage}
              </p>
            )}

            <div className="supplier-dialog-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setRescheduleOrderTarget(null)}
              >
                Đóng
              </button>
              <button className="table-button primary-small" disabled={rescheduleBusy}>
                {rescheduleBusy ? 'Đang gửi…' : 'Gửi yêu cầu dời giờ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Reschedule Modal for Supplier */}
      {rejectRescheduleOrder && (
        <div className="supplier-dialog-backdrop">
          <form
            className="supplier-dialog"
            style={{ maxWidth: '480px' }}
            onSubmit={(e) => {
              e.preventDefault();
              void handleSupplierReschedule(rejectRescheduleOrder, 'REJECT', rejectRescheduleReason);
            }}
          >
            <h2>Không thể dời lịch giao (Đơn #{rejectRescheduleOrder.id})</h2>
            <p className="catalog-hint" style={{ marginTop: 0 }}>
              Nhập lý do không thể dời giờ giao (ví dụ: xe đã kín tuyến, hàng đông lạnh cần giao ngay, hoặc vựa hết chuyến giao trong ngày) để thông báo cho tiệm tạp hóa.
            </p>

            <label className="supplier-dialog-field">
              <span>Lý do không thể dời:</span>
              <input
                type="text"
                required
                minLength={3}
                placeholder="Ví dụ: Xe đã kín tuyến / Hàng cần bảo quản lạnh gấp..."
                value={rejectRescheduleReason}
                onChange={(e) => setRejectRescheduleReason(e.target.value)}
              />
            </label>

            <div className="supplier-dialog-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setRejectRescheduleOrder(null)}
              >
                Hủy
              </button>
              <button
                className="table-button danger"
                disabled={supplierRescheduleBusy !== null || rejectRescheduleReason.trim().length < 3}
              >
                {supplierRescheduleBusy !== null ? 'Đang gửi…' : 'Xác nhận không thể dời'}
              </button>
            </div>
          </form>
        </div>
      )}

      {paymentOrder && (
        <PaymentDialog
          order={paymentOrder}
          busy={actionLoadingId === paymentOrder.id}
          onCancel={() => setPaymentOrder(null)}
          onSubmit={handlePaySubmit}
        />
      )}
    </section>
  );
}

function PaymentDialog({
  order,
  busy,
  onCancel,
  onSubmit,
}: {
  order: SupplierOrder;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (method: 'COD' | 'QR') => void;
}) {
  const [method, setMethod] = useState<'COD' | 'QR'>('COD');
  const depositPaid = order.depositStatus === 'PAID' ? order.depositAmount : 0;
  const remainingAmount = Math.max(0, order.total - depositPaid);

  const bankName = order.supplier?.bankName || order.depositBankName || 'Vietcombank';
  const bankAcc = order.supplier?.bankAccountNumber || order.depositBankAccountNumber || '123456789';
  const bankHolder =
    order.supplier?.bankAccountHolder ||
    order.depositBankAccountHolder ||
    order.supplier?.businessName ||
    'CHỦ VỰA';
  const qrUrl = `https://img.vietqr.io/image/${bankName}-${bankAcc}-compact2.png?amount=${remainingAmount}&addInfo=THANH%20TOAN%20DH${order.id}&accountName=${encodeURIComponent(bankHolder)}`;

  return (
    <div className="supplier-dialog-backdrop" role="presentation">
      <section
        className="supplier-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <span className="supplier-panel-label">THANH TOÁN ĐƠN #{order.id}</span>
        <h2 id="payment-dialog-title">Thanh toán tiền hàng</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', marginBottom: '14px' }}>
          Chọn phương thức thanh toán tiền hàng còn lại khi nhận xe giao đến tiệm.
        </p>

        <div
          style={{
            marginBottom: '14px',
            padding: '12px 14px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '4px',
              fontSize: '13px',
            }}
          >
            <span>Tổng giá trị đơn hàng:</span>
            <strong>{money(order.total)}</strong>
          </div>
          {depositPaid > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '4px',
                fontSize: '13px',
                color: '#15803d',
              }}
            >
              <span>Đã thanh toán / cọc trước:</span>
              <strong>- {money(depositPaid)}</strong>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px dashed #cbd5e1',
              paddingTop: '6px',
              fontSize: '15px',
            }}
          >
            <strong style={{ color: '#0f172a' }}>Số tiền còn lại cần trả:</strong>
            <strong style={{ color: '#0284c7', fontSize: '16px' }}>{money(remainingAmount)}</strong>
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 650,
              color: '#1e293b',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Chọn hình thức thanh toán:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setMethod('COD')}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: `2px solid ${method === 'COD' ? '#0284c7' : '#e2e8f0'}`,
                backgroundColor: method === 'COD' ? '#f0f9ff' : '#ffffff',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <strong
                style={{
                  display: 'block',
                  color: method === 'COD' ? '#0369a1' : '#1e293b',
                  fontSize: '13px',
                }}
              >
                Tiền mặt khi giao (COD)
              </strong>
              <small style={{ color: '#64748b' }}>Trả tiền trực tiếp cho tài xế</small>
            </button>

            <button
              type="button"
              onClick={() => setMethod('QR')}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: `2px solid ${method === 'QR' ? '#0284c7' : '#e2e8f0'}`,
                backgroundColor: method === 'QR' ? '#f0f9ff' : '#ffffff',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <strong
                style={{
                  display: 'block',
                  color: method === 'QR' ? '#0369a1' : '#1e293b',
                  fontSize: '13px',
                }}
              >
                Quét mã VietQR
              </strong>
              <small style={{ color: '#64748b' }}>Chuyển khoản trực tiếp vựa</small>
            </button>
          </div>
        </div>

        {method === 'QR' ? (
          <div
            style={{
              marginBottom: '14px',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#166534',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              Quét mã QR bằng ứng dụng ngân hàng:
            </span>
            <img
              src={qrUrl}
              alt="Mã QR thanh toán VietQR"
              style={{
                width: '180px',
                height: '180px',
                margin: '0 auto',
                display: 'block',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
              }}
            />
            <div
              style={{
                marginTop: '10px',
                fontSize: '12.5px',
                color: '#1e293b',
                textAlign: 'left',
                padding: '8px 12px',
                backgroundColor: '#ffffff',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <strong>Ngân hàng:</strong> {bankName}
              </div>
              <div>
                <strong>Số tài khoản:</strong> {bankAcc}
              </div>
              <div>
                <strong>Chủ tài khoản:</strong> {bankHolder}
              </div>
              <div>
                <strong>Nội dung CK:</strong> THANH TOAN DH{order.id}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              marginBottom: '14px',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              fontSize: '13px',
              color: '#92400e',
            }}
          >
            <strong>Hướng dẫn thanh toán tiền mặt (COD):</strong>
            <p style={{ margin: '4px 0 0' }}>
              Chuẩn bị đúng số tiền <strong>{money(remainingAmount)}</strong> để đưa cho tài xế giao hàng khi xe đến cửa hàng.
            </p>
          </div>
        )}

        <div className="supplier-dialog-actions">
          <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>
            Đóng
          </button>
          <button
            type="button"
            className="table-button primary-small"
            style={{ backgroundColor: '#0284c7', fontWeight: 700 }}
            onClick={() => onSubmit(method)}
            disabled={busy}
          >
            {busy ? 'Đang xử lý…' : 'Xác nhận đã trả tiền'}
          </button>
        </div>
      </section>
    </div>
  );
}
