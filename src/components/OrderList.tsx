function isEscrowRef(ref?: string | null): boolean {
  if (!ref) return false;
  const s = ref.toUpperCase();
  return s.includes('VI_HE_THONG') || s.includes('VÍ_HỆ_THỐNG') || s.includes('VI_H') || s.includes('ESCROW') || s.startsWith('VI_');
}

import { useEffect, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';
import {
  rescheduleOrder,
  respondRescheduleOrder,
  confirmOrderArrival,
  submitOrderPayment,
  completeOrder,
  importOrderToInventory,
  previewOrderInventory,
  type InventoryImportOptions,
  type InventoryImportPreview,
  confirmSupplierPayment,
  savePackingChecklist,
  type SupplierOrder,
} from '../services/supplier.api';
import Icon from './Icon';
import DatePicker from './DatePicker';
import ExportDropdown from './ExportDropdown';
import { exportSupplierOrdersToExcel, exportSupplierOrdersToPdf } from '../utils/exportSupplier';
import { depositOrderWithWallet, getWallet } from '../services/wallet.api';
import './complaint-dialog.css';
import OrderStepper from './OrderStepper';
import { orderPaymentSummary, supplierPaymentBank } from '../utils/orderPayment';

const statuses = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PREPARING: 'Đang soạn đơn',
  SHIPPING: 'Đang vận chuyển',
  ISSUE_HANDLING: 'Đang kiểm hàng',
  DELIVERED: 'Đã giao',
  COMPLETED: 'Hoàn tất',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
};

const COMPLAINT_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Mới tạo · Chờ chủ vựa phản hồi', color: '#c2410c', bg: '#fff7ed' },
  IN_REVIEW: { label: 'Đang xử lý · Hai bên đang trao đổi', color: '#1d4ed8', bg: '#eff6ff' },
  RESOLVED: { label: 'Hoàn thành · Đã thống nhất kết quả', color: '#15803d', bg: '#f0fdf4' },
  CLOSED_TIMEOUT: { label: 'Đã đóng (Lịch sử cũ)', color: '#7c2d12', bg: '#ffedd5' },
  CLOSED_UNRESOLVED: { label: 'Đã đóng (Lịch sử cũ)', color: '#475569', bg: '#f1f5f9' },
  REJECTED: { label: 'Chủ vựa từ chối đề xuất', color: '#b91c1c', bg: '#fef2f2' },
  ESCALATED: { label: 'Đang xử lý (Hồ sơ cũ)', color: '#6d28d9', bg: '#f5f3ff' },
  ADMIN_RESOLVED_BUYER: { label: 'Hoàn thành (Hồ sơ cũ)', color: '#15803d', bg: '#f0fdf4' },
  ADMIN_RESOLVED_SUPPLIER: { label: 'Hoàn thành (Hồ sơ cũ)', color: '#475569', bg: '#f1f5f9' },
};

const COMPLAINT_REASONS: { code: string; label: string }[] = [
  { code: 'DAMAGED', label: 'Hàng hư hỏng / bể vỡ' },
  { code: 'SHORTAGE', label: 'Thiếu hàng / thiếu số lượng' },
  { code: 'WRONG_ITEM', label: 'Giao sai sản phẩm / quy cách' },
  { code: 'EXPIRED', label: 'Hàng sắp hết hạn / hết hạn' },
  { code: 'QUALITY', label: 'Lỗi chất lượng sản phẩm' },
  { code: 'LATE', label: 'Giao trễ / sai hẹn' },
  { code: 'OTHER', label: 'Khác' },
];

const REASON_LABELS: Record<string, string> = {
  DAMAGED: 'Hàng hư hỏng / bể vỡ',
  SHORTAGE: 'Thiếu hàng / thiếu số lượng',
  WRONG_ITEM: 'Giao sai sản phẩm / quy cách',
  EXPIRED: 'Hàng sắp hết hạn / hết hạn',
  QUALITY: 'Lỗi chất lượng sản phẩm',
  LATE: 'Giao trễ / sai hẹn',
  OTHER: 'Khác',
};

const money = (n: number) => Math.round(n).toLocaleString('vi-VN') + ' ₫';

const SUPPLIER_RESOLUTIONS: { code: string; label: string }[] = [
  { code: 'AGREE_REPLACE_0VND', label: 'Giao bù hàng mới (Tự động tạo đơn 0đ khi Tiệm đồng ý)' },
  { code: 'DEDUCT_COD', label: 'Giảm trừ tiền hàng hỏng trực tiếp vào COD' },
  { code: 'RETURN_REFUND', label: 'Nhận lại hàng & Hoàn 100% cọc / tiền ví khi Tiệm đồng ý' },
  { code: 'DISCUSS', label: 'Trao đổi thêm phương án khác với cửa hàng' },
  { code: 'REJECT', label: 'Từ chối bồi thường (Hàng giao đúng quy chuẩn)' },
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
  } catch { /* Optional cached state is unavailable; preserve the current values. */ }
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
  initialSearch?: string;
  kind: 'store' | 'supplier';
  onLogout: () => void;
  onInventoryChanged?: () => Promise<void>;
  onViewHistory?: () => void;
  revision?: number;
  busy?: boolean;
  onStatus?: (order: SupplierOrder, forcedStatus?: string) => void;
  onEditDriver?: (order: SupplierOrder) => void;
  onReportIncident?: (order: SupplierOrder) => void;
};


function parseItemPackaging(packagingStr?: string) {
  if (!packagingStr) return { multiplier: 1, unit: 'đơn vị' };
  const m = packagingStr.match(/(?:thùng|két|hộp|lốc|khay|kiện)\s+(\d+)\s*([\p{L}\w]+)/iu);
  if (m) {
    return { multiplier: parseInt(m[1], 10), unit: m[2].trim() };
  }
  return { multiplier: 1, unit: 'đơn vị' };
}

function getIntactItemArrived(order: SupplierOrder, item: SupplierOrder['items'][number]) {
  const packInfo = parseItemPackaging(item.packaging);
  const totalLoose = (packInfo.multiplier || 1) * item.quantity;
  const transitDamaged = order.driverInfo?.incidentReport?.damagedItems || [];

  let transitDamagedLoose = 0;
  for (const d of transitDamaged) {
    if (d.productId === item.productId || d.productName.startsWith(item.productName)) {
      const match = d.productName.match(/Hỏng lẻ\s+(\d+)\/(\d+)/i) || (d.packaging && d.packaging.match(/(\d+)\s+(chai|lon|gói|hộp|lốc)/i));
      if (match) {
        transitDamagedLoose += parseInt(match[1], 10);
      } else {
        transitDamagedLoose += (d.quantity || 1) * (packInfo.multiplier || 1);
      }
    }
  }

  const remainingLoose = Math.max(0, totalLoose - transitDamagedLoose);
  const intactCartons = Math.floor(remainingLoose / (packInfo.multiplier || 1));
  return {
    packInfo,
    totalLoose,
    transitDamagedLoose,
    remainingLoose,
    intactCartons,
  };
}

function computeOrderLossAmount(order: SupplierOrder): number {
  const inc = order.driverInfo?.incidentReport;
  if (!inc || !inc.damagedItems || inc.damagedItems.length === 0) return 0;
  if (typeof inc.lossAmount === 'number' && inc.lossAmount > 0) return inc.lossAmount;

  let totalLoss = 0;
  for (const damaged of inc.damagedItems) {
    const orderItem = order.items.find(
      (it) => it.productId === damaged.productId || it.productName === damaged.productName || damaged.productName.startsWith(it.productName)
    );
    if (!orderItem) continue;

    const looseMatch = damaged.productName.match(/Hỏng lẻ\s+(\d+)\/(\d+)/i) || (damaged.packaging && damaged.packaging.match(/(\d+)\s+(chai|lon|gói|hộp|lốc)/i));
    if (looseMatch) {
      const looseQty = parseInt(looseMatch[1], 10);
      const mult = parseInt(looseMatch[2], 10) || 12;
      const totalUnitsInOrder = mult * orderItem.quantity;
      if (totalUnitsInOrder > 0) {
        totalLoss += (looseQty / totalUnitsInOrder) * orderItem.lineTotal;
      }
    } else {
      totalLoss += (damaged.quantity / orderItem.quantity) * orderItem.lineTotal;
    }
  }
  return Math.round(totalLoss);
}

function getOrderTotalDeduction(order: SupplierOrder): number {
  const incidentDeduct = order.driverInfo?.incidentReport?.action === 'DEDUCT_COD'
    ? computeOrderLossAmount(order)
    : 0;
  const complaintDeduct = Number(order.complaint?.workflow?.agreedDeductAmount || 0);
  return incidentDeduct + (Number.isFinite(complaintDeduct) && complaintDeduct > 0 ? complaintDeduct : 0);
}

function formatComplaintTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

type ComplaintHistoryEntry = {
  at?: string;
  actorRole?: string;
  actorName?: string;
  round?: number;
  action?: string;
  label?: string;
  note?: string | null;
};

type ActionModalState =
  | {
      type: 'buyer-decision';
      complaintId: number;
      decision: 'ACCEPT' | 'WITHDRAW' | 'REJECT_PROPOSAL';
      title: string;
      message: string;
      confirmLabel: string;
      requireInput?: boolean;
      minLength?: number;
      inputLabel?: string;
      inputPlaceholder?: string;
      tone?: 'primary' | 'warning' | 'danger';
    }
  | {
      type: 'cancel-order';
      orderId: number;
      title: string;
      message: string;
      confirmLabel: string;
      requireInput?: false;
      inputLabel: string;
      inputPlaceholder?: string;
      tone?: 'danger';
    }
  | {
      type: 'complete-supplementary';
      orderId: number;
      title: string;
      message: string;
      confirmLabel: string;
      tone?: 'primary';
    };

function normalizeHistoryLabel(label?: string): string {
  const raw = (label || '').trim();
  if (!raw) return 'Cập nhật';
  if (raw.startsWith('Bắt đầu · ')) return raw.slice('Bắt đầu · '.length);
  if (raw.startsWith('Đang xử lý · ')) return raw.slice('Đang xử lý · '.length);
  return raw;
}

function cleanHistoryNote(item: ComplaintHistoryEntry): string {
  const note = (item.note || '').trim();
  if (!note) return '';
  if (item.action === 'CREATE_COMPLAINT') {
    const match = note.match(/^\[Sự cố:[^\]]+\]\s*\n?([\s\S]*)$/);
    const detail = match ? (match[1] || '').trim() : note;
    return detail || 'Đã gửi báo cáo sự cố kèm thông tin chi tiết.';
  }
  return note.replace(/^\[[^\]]+\]:\s*/, '').trim();
}

function dedupeComplaintHistory(rawHistory: ComplaintHistoryEntry[]): ComplaintHistoryEntry[] {
  const seen = new Set<string>();
  const cleaned: ComplaintHistoryEntry[] = [];

  for (const item of rawHistory) {
    const label = normalizeHistoryLabel(item.label);
    const note = cleanHistoryNote(item);
    const key = `${item.actorRole || ''}::${note.toLowerCase()}`;
    if (note && seen.has(key) && label === 'Chủ vựa phản hồi') {
      continue;
    }
    if (note && (item.action === 'PROPOSE' || item.action === 'REJECT' || label.startsWith('Chủ vựa đề xuất'))) {
      // Remove earlier legacy fallback "Chủ vựa phản hồi" entry with identical note
      const dupIdx = cleaned.findIndex(
        (prev) => prev.actorRole === 'SUPPLIER' && prev.label === 'Chủ vựa phản hồi' && prev.note?.toLowerCase() === note.toLowerCase(),
      );
      if (dupIdx !== -1) cleaned.splice(dupIdx, 1);
    }
    if (note) seen.add(key);
    cleaned.push({ ...item, label, note });
  }
  return cleaned;
}

const RESCHEDULE_HOURS = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];
const RESCHEDULE_MINUTES = ['00', '15', '30', '45'];

function getInitialRescheduleData() {
  const now = new Date();
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, '0');
  const localDay = String(now.getDate()).padStart(2, '0');
  const todayStr = `${localYear}-${localMonth}-${localDay}`;

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const minNoticeMinutes = 60;
  const earliestMinutesToday = nowMinutes + minNoticeMinutes;
  const canToday = earliestMinutesToday <= 17 * 60;

  if (canToday) {
    const clamped = Math.max(8 * 60, earliestMinutesToday);
    const rounded = Math.ceil(clamped / 15) * 15;
    const h = Math.min(17, Math.floor(rounded / 60));
    const m = h === 17 ? 0 : rounded % 60;
    return {
      date: todayStr,
      time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      minDate: todayStr,
      canToday: true,
      todayStr,
      tomorrowStr,
      earliestMinutesToday,
    };
  } else {
    return {
      date: tomorrowStr,
      time: '09:00',
      minDate: tomorrowStr,
      canToday: false,
      todayStr,
      tomorrowStr,
      earliestMinutesToday,
    };
  }
}

export default function OrderList({
  kind,
  onLogout,
  initialSearch = '',
  revision = 0,
  busy = false,
  onStatus,
  onEditDriver,
  onReportIncident,
  onInventoryChanged,
  onViewHistory,
}: Props) {
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [query, setQuery] = useState({ page: 1, status: '', q: initialSearch });
  const [data, setData] = useState<{ orders: SupplierOrder[]; total: number; hasMore: boolean }>({
    orders: [],
    total: 0,
    hasMore: false,
  });
  const [error, setError] = useState('');
  const [depositNotice, setDepositNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<number, boolean>>({});
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null);
  const [actionModalInput, setActionModalInput] = useState('');
  const [actionModalError, setActionModalError] = useState('');
  const [actionModalBusy, setActionModalBusy] = useState(false);

  // Packing checklist state (orderId -> itemIds checked)
  const [packingMap, setPackingMap] = useState<Record<number, number[]>>({});

  // Payment dialog state for Store Owner
  const [paymentOrder, setPaymentOrder] = useState<SupplierOrder | null>(null);
  const [importDraft, setImportDraft] = useState<{ order: SupplierOrder; preview: InventoryImportPreview } | null>(null);
  const [importUnits, setImportUnits] = useState<Record<number, { unit: string; count: string }>>({});
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const [complaintOrder, setComplaintOrder] = useState<SupplierOrder | null>(null);
  const [complaintReason, setComplaintReason] = useState(COMPLAINT_REASONS[0].code);
  const [complaintDescription, setComplaintDescription] = useState('');
  const [complaintBusy, setComplaintBusy] = useState(false);
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintResponse, setComplaintResponse] = useState('');
  const [complaintActionBusy, setComplaintActionBusy] = useState(false);
  const [complaintSelectedItems, setComplaintSelectedItems] = useState<Record<number, number>>({});
  const [complaintImages, setComplaintImages] = useState<string[]>([]);
  const [supplierPlan, setSupplierPlan] = useState<string>('AGREE_REPLACE_0VND');
  const [supplierDeductAmount, setSupplierDeductAmount] = useState<string>('');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [depositBusy, setDepositBusy] = useState<number | null>(null);
  const [depositDraft, setDepositDraft] = useState<{ orderId: number; reference: string } | null>(
    null,
  );

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

  async function handleImportInventory(order: SupplierOrder, options?: InventoryImportOptions) {
    if (actionLoadingId !== null || order.inventoryImportedAt || !order.canImportInventory) return;
    setActionLoadingId(order.id);
    setError('');
    try {
      if (!options) {
        const preview = await previewOrderInventory(order.id);
        setImportUnits(Object.fromEntries(preview.lines.map(line => [
          line.id, { unit: line.needsConversion ? line.unit : '', count: '' },
        ])));
        setImportDraft({ order, preview });
        return;
      }
      const result = await importOrderToInventory(order.id, options);
      setImportDraft(null);
      setData(current => ({ ...current, orders: current.orders.map(row => row.id === order.id ? result.order : row) }));
      setDepositNotice(result.message);
      setReload(value => value + 1);
      await onInventoryChanged?.();
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setActionLoadingId(null);
    }
  }

  const importLines = importDraft?.preview.lines.map(line => {
    const choice = importUnits[line.id];
    const count = Number(choice?.count);
    const unit = line.existingUnit ?? (choice?.unit || line.unit);
    const quantity = choice?.unit ? line.packs * count : line.quantity;
    return { ...line, choice, count, unit, quantity,
      valid: !line.incompatible && (!line.needsConversion || Boolean(choice?.unit)) &&
        Number.isInteger(quantity) && quantity > 0 && quantity <= 2147483647 &&
        (!choice?.unit || Number.isInteger(count)) };
  }) ?? [];

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
    } catch { /* Optional cached state is unavailable; preserve the current values. */ }
  }

  async function handleToggleAllPacking(order: SupplierOrder) {
    const current = packingMap[order.id] || [];
    const next = current.length === order.items.length ? [] : order.items.map((it) => it.id);
    setPackingMap((prev) => ({ ...prev, [order.id]: next }));
    try {
      await savePackingChecklist(order.id, next);
    } catch { /* Optional cached state is unavailable; preserve the current values. */ }
  }

  async function handlePaySubmit(method: 'COD' | 'QR' | 'WALLET') {
    if (!paymentOrder || actionLoadingId !== null) return;
    const order = paymentOrder;
    setActionLoadingId(order.id);
    try {
      const res = await submitOrderPayment(order.id, method);
      setDepositNotice(res.message || `Đã báo trả tiền. Chờ chủ vựa xác nhận.`);
      window.dispatchEvent(new Event('supplymind:wallet-changed'));
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
  const [rescheduleDate, setRescheduleDate] = useState(() => getInitialRescheduleData().date);
  const [rescheduleTime, setRescheduleTime] = useState(() => getInitialRescheduleData().time);
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
        `Đơn #${order.id}: đã báo chuyển cọc, chờ chủ vựa xác nhận.`,
      );
      setReload((value) => value + 1);
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDepositBusy(null);
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

    const init = getInitialRescheduleData();
    if (rescheduleDate < init.minDate) {
      setRescheduleMessage(
        init.canToday
          ? 'Ngày hẹn giao không được ở trong quá khứ.'
          : 'Hôm nay đã hết khung giờ nhận giao (kết thúc lúc 17:00). Vui lòng chọn lịch từ ngày mai.'
      );
      return;
    }

    if (!rescheduleTime) {
      setRescheduleMessage('Vui lòng chọn giờ hẹn nhận hàng.');
      return;
    }

    const [h, m] = rescheduleTime.split(':').map(Number);
    if (h < 8 || h > 17 || (h === 17 && m > 0)) {
      setRescheduleMessage('Khung giờ nhận giao phải nằm trong khoảng làm việc chuẩn từ 08:00 đến 17:00.');
      return;
    }

    if (rescheduleDate === init.todayStr) {
      const chosenMinutes = h * 60 + m;
      if (chosenMinutes < init.earliestMinutesToday) {
        setRescheduleMessage('Giờ hẹn giao phải cách thời điểm hiện tại ít nhất 1 tiếng và không ở trong quá khứ.');
        return;
      }
    }

    setRescheduleBusy(true);
    setRescheduleMessage('');
    const formattedDate = rescheduleDate.split('-').reverse().join('/');
    const timeText = `${rescheduleTime} ngày ${formattedDate}`;

    try {
      const { order } = await rescheduleOrder(rescheduleOrderTarget.id, timeText, rescheduleReason.trim() || undefined);
      setData((current) => ({
        ...current,
        orders: current.orders.map((row) => row.id === order.id ? order : row),
      }));
      setRescheduleOrderTarget(null);
      setRescheduleReason('');
      setReload((n) => n + 1);
    } catch (issue) {
      setRescheduleMessage(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setRescheduleBusy(false);
    }
  }

  async function submitSupplierProposal() {
    if (!complaintOrder?.complaint || complaintActionBusy) return;
    const trimmedNote = complaintResponse.trim();
    if (trimmedNote.length < 3) {
      setComplaintMessage('Lỗi: Vui lòng nhập phản hồi chi tiết (tối thiểu 3 ký tự).');
      return;
    }
    let parsedDeduct: number | undefined;
    if (supplierPlan === 'DEDUCT_COD') {
      parsedDeduct = Math.round(Number(supplierDeductAmount));
      if (!Number.isFinite(parsedDeduct) || parsedDeduct <= 0) {
        setComplaintMessage('Lỗi: Vui lòng nhập số tiền đề xuất giảm trừ vào COD lớn hơn 0.');
        return;
      }
    }

    setComplaintActionBusy(true);
    setComplaintMessage('');

    try {
      await api.post(`/complaints/${complaintOrder.complaint.id}/respond`, {
        action: supplierPlan,
        deductAmount: parsedDeduct,
        note: trimmedNote,
      });
      setComplaintOrder(null);
      setComplaintResponse('');
      setSupplierDeductAmount('');
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

    const selectedEntries = Object.entries(complaintSelectedItems).filter(([, qty]) => qty > 0);
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
        return `${it.productName} (x${qty} ${it.packaging || 'thùng'}: ${money(lineCost)})`;
      })
      .filter(Boolean);

    const itemInfo = itemSummaries.join('; ');
    const claimValueText = ` | Thiệt hại ước tính: ${money(totalDamage)}`;
    const structuredHeader = `[Sự cố: ${itemInfo}${claimValueText}]`;
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
      setComplaintMessage('Đã gửi khiếu nại.');
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
    setComplaintImages([]);
    setComplaintMessage('');
  };

  const handleCancelOrder = (order: SupplierOrder) => {
    setActionModalError('');
    setActionModalInput('Tôi muốn điều chỉnh lại mặt hàng');
    setActionModal({
      type: 'cancel-order',
      orderId: order.id,
      title: `Hủy đơn hàng #${order.id}`,
      message: 'Đơn hàng sẽ được hủy và hoàn lại cọc (nếu có) theo quy định.',
      confirmLabel: 'Xác nhận hủy đơn',
      inputLabel: 'Lý do hủy đơn',
      inputPlaceholder: 'Nhập lý do hủy đơn (không bắt buộc)...',
      tone: 'danger',
    });
  };

  const handleBuyerDecision = (
    complaintId: number,
    decision: 'ACCEPT' | 'WITHDRAW' | 'REJECT_PROPOSAL',
  ) => {
    setActionModalError('');
    setActionModalInput('');
    if (decision === 'ACCEPT') {
      setActionModal({
        type: 'buyer-decision',
        complaintId,
        decision,
        title: 'Xác nhận đồng ý phương án',
        message: 'Xác nhận đồng ý với giải pháp Chủ vựa đã đề xuất và ghi nhận trạng thái Hoàn thành cho khiếu nại này?',
        confirmLabel: 'Đồng ý & Hoàn thành',
        tone: 'primary',
      });
      return;
    }
    if (decision === 'REJECT_PROPOSAL') {
      setActionModal({
        type: 'buyer-decision',
        complaintId,
        decision,
        title: 'Từ chối phương án đề xuất',
        message:
          'Bạn không đồng ý với phương án Chủ vựa đề xuất. Hãy nêu rõ lý do để Chủ vựa điều chỉnh. Sau khi từ chối, bạn có thể gọi trực tiếp số điện thoại của Chủ vựa để thương lượng.',
        confirmLabel: 'Từ chối phương án',
        requireInput: true,
        minLength: 3,
        inputLabel: 'Lý do từ chối phương án',
        inputPlaceholder: 'Ví dụ: Mức giảm trừ chưa phù hợp, đề nghị bù thêm hàng...',
        tone: 'danger',
      });
      return;
    }
    setActionModal({
      type: 'buyer-decision',
      complaintId,
      decision: 'WITHDRAW',
      title: 'Rút khiếu nại đơn hàng',
      message: 'Bạn muốn chủ động rút khiếu nại và khép lại yêu cầu này?',
      confirmLabel: 'Xác nhận rút khiếu nại',
      tone: 'danger',
    });
  };

  const submitActionModal = async (event: FormEvent) => {
    event.preventDefault();
    if (!actionModal || actionModalBusy) return;
    setActionModalError('');

    if (actionModal.type === 'buyer-decision' && actionModal.requireInput) {
      const trimmed = actionModalInput.trim();
      if (trimmed.length < (actionModal.minLength || 3)) {
        setActionModalError(`Vui lòng nhập nội dung tối thiểu ${actionModal.minLength || 3} ký tự.`);
        return;
      }
    }

    setActionModalBusy(true);
    try {
      if (actionModal.type === 'cancel-order') {
        const { data } = await api.post<{ message?: string }>(
          `/orders/${actionModal.orderId}/cancel`,
          { reason: actionModalInput.trim() },
        );
        setDepositNotice(data.message || `Đã hủy đơn hàng #${actionModal.orderId}.`);
      } else if (actionModal.type === 'buyer-decision') {
        const note = actionModal.requireInput ? actionModalInput.trim() : undefined;
        const res = await api.post<{ success: boolean; message?: string }>(
          `/complaints/${actionModal.complaintId}/buyer-decision`,
          { decision: actionModal.decision, ...(note ? { note } : {}) },
        );
        setDepositNotice(res.data?.message || 'Đã cập nhật kết quả thương lượng.');
      } else if (actionModal.type === 'complete-supplementary') {
        const payRes = await fetch(`/api/orders/${actionModal.orderId}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'COD', amount: 0 }),
        });
        const payData = await payRes.json().catch(() => ({}));
        if (!payRes.ok) throw new Error(payData.message || 'Không thể xác nhận đơn giao bù.');
        const compRes = await fetch(`/api/orders/${actionModal.orderId}/complete`, { method: 'POST' });
        const compData = await compRes.json().catch(() => ({}));
        if (!compRes.ok) throw new Error(compData.message || 'Không thể hoàn tất đơn giao bù.');
        setDepositNotice(`Đã xác nhận nhận đủ hàng giao bù cho đơn #${actionModal.orderId}.`);
      }
      setActionModal(null);
      setActionModalInput('');
      setReload((n) => n + 1);
    } catch (issue: any) {
      if (isUnauthenticated(issue)) {
        setActionModal(null);
        onLogout();
      } else {
        setActionModalError(getApiError(issue) || issue?.message || 'Không thể thực hiện thao tác này.');
      }
    } finally {
      setActionModalBusy(false);
    }
  };

  const openSupplierComplaint = (order: SupplierOrder) => {
    setComplaintOrder(order);
    setComplaintResponse('');
    const proposed = order.complaint?.workflow?.proposedAction;
    const isValidPlan = SUPPLIER_RESOLUTIONS.some((p) => p.code === proposed);
    setSupplierPlan(isValidPlan && proposed ? proposed : SUPPLIER_RESOLUTIONS[0].code);
    setSupplierDeductAmount(
      order.complaint?.workflow?.proposedDeductAmount
        ? String(Math.round(order.complaint.workflow.proposedDeductAmount))
        : '',
    );
    setComplaintMessage('');
  };

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === query.q) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setQuery((prev) => ({ ...prev, page: 1, q: trimmed }));
    }, 320);
    return () => window.clearTimeout(timer);
  }, [searchInput, query.q]);

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
          <strong>Cập nhật đơn hàng</strong>
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

      <div className="order-toolbar">
        <div className="order-search-field">
          <span>Tìm kiếm đơn hàng</span>
          <div className="order-search-input-wrap">
            <input
              type="search"
              className="order-search-input"
              aria-label="Tìm kiếm đơn hàng"
              placeholder={
                kind === 'store'
                  ? 'Tìm mã đơn (#1206), tên sản phẩm, chủ vựa...'
                  : 'Tìm mã đơn (#1206), sản phẩm, tên cửa hàng...'
              }
              value={searchInput}
              disabled={busy}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const trimmed = searchInput.trim();
                  if (trimmed !== query.q) {
                    setLoading(true);
                    setQuery((prev) => ({ ...prev, page: 1, q: trimmed }));
                  }
                }
              }}
            />
            {searchInput && (
              <button
                type="button"
                className="order-search-clear"
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => {
                  setSearchInput('');
                  if (query.q !== '') {
                    setLoading(true);
                    setQuery((prev) => ({ ...prev, page: 1, q: '' }));
                  }
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        <label className="order-filter">
          Trạng thái đơn
          <select
            aria-label="Lọc trạng thái đơn"
            value={query.status}
            disabled={loading || busy}
            onChange={(e) => {
              setLoading(true);
              setQuery((prev) => ({ ...prev, page: 1, status: e.target.value }));
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="HAS_COMPLAINT">Đang khiếu nại</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span>{data.total} đơn phù hợp</span>
        </label>
      </div>

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
                    ? `Đã hoàn tiền ví · ${money(order.walletPayment.amount)}`
                    : `Đã thanh toán ví · ${money(order.walletPayment.amount)}`}
                </p>
              )}

              {/* Tiến trình 5 bước: Đặt đơn -> Duyệt đơn -> Soạn hàng (Hẹn giờ) -> Đang giao -> Hàng đã đến */}
              <OrderStepper order={order} />

              <div className="order-items">
                {order.items.map((item) => (
                  <div className="order-product" key={item.id}>
                    <div className="order-product-details">
                      <strong>{item.productName}</strong>
                      <span>{item.quantity} × {item.packaging}</span>
                    </div>
                    <strong className="order-product-total">{money(item.lineTotal)}</strong>
                  </div>
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
                      Kiểm hàng ({(packingMap[order.id] || []).length}/{order.items.length} món)
                    </strong>
                    <button
                      type="button"
                      className="ghost-button"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => handleToggleAllPacking(order)}
                    >
                      {(packingMap[order.id] || []).length === order.items.length ? 'Bỏ chọn' : 'Chọn tất cả'}
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
                              textDecoration: 'none',
                              color: isChecked ? '#14532d' : '#0f172a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '13px', color: isChecked ? '#166534' : '#0f172a' }}>{item.productName}</strong>
                              <span
                                style={{
                                  backgroundColor: isChecked ? '#dcfce7' : '#fef3c7',
                                  color: isChecked ? '#166534' : '#92400e',
                                  border: `1px solid ${isChecked ? '#86efac' : '#fde68a'}`,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  fontSize: '11.5px',
                                  letterSpacing: '0.3px',
                                }}
                              >
                                CẦN LẤY: {item.quantity} {item.packaging}
                              </span>
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              {money(item.lineTotal)}
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: isChecked ? '#16a34a' : '#f1f5f9',
                              color: isChecked ? '#ffffff' : '#64748b',
                            }}
                          >
                            {isChecked ? 'Đã lấy đủ' : 'Chưa lấy'}
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
                      ? 'Đã kiểm đủ hàng.'
                      : `Chọn đủ ${order.items.length} mặt hàng trước khi giao.`}
                  </p>
                </div>
              )}

              <p className="order-delivery">
                <strong>{order.recipientName || 'Đơn cũ chưa có người nhận'}</strong>
                {order.recipientPhone && <> · {order.recipientPhone}</>}
                <br />
                {order.deliveryAddress || 'Đơn cũ chưa lưu địa chỉ nhận'}
              </p>

              {order.note && <details className="order-note"><summary>Ghi chú đơn hàng</summary><p>{order.note}</p></details>}

              {/* Reschedule statuses & actions for both Store and Supplier */}
              {(() => {
                if (!['PREPARING', 'SHIPPING'].includes(order.status)) return null;
                const request = order.driverInfo?.rescheduleRequest;
                const isPending = request ? request.status === 'PENDING' : Boolean(
                  order.note?.includes('[YÊU CẦU DỜI LỊCH GIAO') &&
                  !order.note?.includes('[VỰA ĐÃ ĐỒNG Ý DỜI LỊCH') &&
                  !order.note?.includes('[VỰA TỪ CHỐI DỜI LỊCH')
                );
                const isAccepted = request ? request.status === 'ACCEPTED' : Boolean(order.note?.includes('[VỰA ĐÃ ĐỒNG Ý DỜI LỊCH'));
                const isRejected = request ? request.status === 'REJECTED' : Boolean(order.note?.includes('[VỰA TỪ CHỐI DỜI LỊCH'));

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
                          Cửa hàng xin đổi giờ giao
                        </strong>
                        <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 600, backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '10px' }}>
                          Cần xác nhận
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 8px', color: '#78350f' }}>
                        {request ? `Giờ muốn nhận: ${request.requestedTime}${request.reason ? ' · ' + request.reason : ''}` : order.note?.split('[YÊU CẦU DỜI LỊCH GIAO')[1]?.split(']')[0]
                          ? `[YÊU CẦU DỜI LỊCH GIAO${order.note?.split('[YÊU CẦU DỜI LỊCH GIAO')[1]?.split(']')[0]}]`
                          : 'Cửa hàng xin đổi giờ nhận hàng.'}
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
                        {order.recipientPhone && <a
                          href={`tel:${order.recipientPhone}`}
                          className="ghost-button"
                          style={{ fontSize: '11px', padding: '4px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          Gọi cửa hàng
                        </a>}
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
                        <span>Giờ muốn nhận: {request?.requestedTime || 'Đã gửi trong ghi chú'} · Chờ chủ vựa xác nhận</span>
                      </div>
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
                      <strong>Chủ vựa đã xác nhận giờ giao{request ? `: ${request.requestedTime}` : '.'}</strong>
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
                      <strong>Giữ giờ giao cũ.{request?.responseNote ? ` ${request.responseNote}` : ' Gọi chủ vựa nếu cần đổi.'}</strong>
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
                        ? 'Đang soạn hàng'
                        : 'Đang giao hàng'}
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
                      {(() => {
                        const isAcceptedReschedule = !order.driverInfo?.rescheduleRequest && order.note?.includes('[VỰA ĐÃ ĐỒNG Ý DỜI LỊCH GIAO]');
                        if (isAcceptedReschedule) {
                          const matchTime = order.note?.match(/\[YÊU CẦU DỜI LỊCH GIAO[^\]]*\]: Hẹn lúc ([^(—|\]]+)/);
                          if (matchTime && matchTime[1]) {
                            return `Giờ giao mới: ${matchTime[1].trim()}`;
                          }
                        }
                        if (order.driverInfo?.estimatedDeliveryTime) {
                          return `Dự kiến giao: ${order.driverInfo.estimatedDeliveryTime}`;
                        }
                        return order.status === 'PREPARING'
                          ? 'Chưa có giờ giao'
                          : 'Chưa có giờ đến dự kiến';
                      })()}
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
                      <span><strong>Kho:</strong> </span>
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
                      <span><strong>Giao hàng:</strong> </span>
                      <strong>
                        {order.driverInfo?.driverName ||
                          (order.supplier?.businessName
                            ? order.supplier.businessName
                            : 'Chưa có tài xế')}
                      </strong>
                      <br />
                      {(order.driverInfo?.driverPhone || order.supplier?.phone) && <>
                        <span><strong>Liên hệ:</strong> </span>
                        <a
                          href={`tel:${order.driverInfo?.driverPhone || order.supplier?.phone}`}
                          style={{
                            color: '#1d4ed8',
                            fontWeight: 700,
                            textDecoration: 'underline',
                          }}
                        >
                          {order.driverInfo?.driverPhone || order.supplier?.phone}
                        </a>
                      </>}
                      {order.driverInfo?.deliveryNotes && (
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#475569' }}>
                          <span><strong>Ghi chú:</strong> <em>{order.driverInfo.deliveryNotes}</em></span>
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
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {!order.driverInfo?.driverPhone && order.supplier?.phone && (
                        <a
                          href={`tel:${order.supplier.phone}`}
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
                          Gọi chủ vựa
                        </a>
                      )}
                      {kind === 'supplier' && order.status === 'PREPARING' && onEditDriver && (
                        <button
                          type="button"
                          className="table-button primary-small"
                          style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#475569' }}
                          onClick={() => onEditDriver(order)}
                        >
                          {order.driverInfo ? 'Sửa thông tin tài xế' : 'Gán tài xế'}
                        </button>
                      )}
                      {kind === 'store' &&
                        !order.driverInfo?.rescheduleRequest &&
                        !order.note?.includes('[YÊU CẦU DỜI LỊCH GIAO') && (
                        <button
                          type="button"
                          className="table-button primary-small"
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => {
                            const init = getInitialRescheduleData();
                            setRescheduleOrderTarget(order);
                            setRescheduleDate(init.date);
                            setRescheduleTime(init.time);
                            setRescheduleReason('');
                            setRescheduleMessage('');
                          }}
                        >
                          Đề nghị đổi giờ
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
                      Cọc {order.depositRate}% · {money(order.depositAmount)}
                    </strong>
                    <span>
                      {isEscrowRef(order.depositReference) && order.depositStatus === 'PAID'
                        ? 'Đã cọc bằng ví'
                        : isEscrowRef(order.depositReference) && order.depositStatus === 'REFUNDED'
                          ? 'Đã hoàn cọc vào ví'
                          : order.depositStatus === 'PENDING'
                            ? 'Chờ chuyển cọc'
                            : order.depositStatus === 'SUBMITTED'
                              ? 'Đã báo chuyển · Chờ xác nhận'
                              : order.depositStatus === 'PAID'
                                ? 'Đã nhận cọc'
                                : order.depositStatus === 'REFUNDED'
                                  ? 'Đã hoàn cọc'
                                  : order.depositStatus === 'REFUND_PENDING'
                                    ? 'Chờ hoàn cọc'
                                    : order.depositStatus}
                    </span>
                  </div>
                  <details className="order-deposit-details" open={order.depositStatus === 'PENDING'}>
                    <summary>Chi tiết cọc</summary>
                    <div className="order-deposit-detail-content">
                      {isEscrowRef(order.depositReference) ? (
                        <small style={{ color: '#047857' }}>
                          {kind === 'store'
                            ? 'Hệ thống tạm giữ tiền cọc qua ví đến khi nhận hàng thành công.'
                            : 'Tiền cọc qua ví được giải ngân sau khi đơn hoàn tất.'}
                        </small>
                      ) : (
                        <>
                          {order.depositBankAccountNumber && (
                            <div className="order-deposit-bank">
                              <strong>{order.depositBankName}</strong>
                              <b>{order.depositBankAccountNumber}</b>
                              <span>{order.depositBankAccountHolder}</span>
                              {!order.depositReference && <small>Nội dung: COC DH{order.id}</small>}
                            </div>
                          )}
                          {order.depositReference && (
                            <small>Mã/Nội dung chuyển: {order.depositReference}</small>
                          )}
                        </>
                      )}
                      {order.depositSubmittedAt && (
                        <small>
                          Báo chuyển: {' '}
                          {new Date(order.depositSubmittedAt).toLocaleString('vi-VN')}
                        </small>
                      )}
                      {order.depositPaidAt && (
                        <small>
                          Xác nhận: {' '}
                          {new Date(order.depositPaidAt).toLocaleString('vi-VN')}
                        </small>
                      )}
                    </div>
                  </details>
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
                          </div>
                        )}
                      </>
                    )}
                  {kind === 'supplier' &&
                    order.status === 'PENDING' &&
                    ['PENDING', 'SUBMITTED'].includes(order.depositStatus) && (
                      <div className="order-deposit-actions">
                        <button
                          className="table-button primary-small"
                          disabled={depositBusy !== null}
                          onClick={() => void reviewDeposit(order, 'CONFIRM')}
                        >
                          {depositBusy === order.id
                            ? 'Đang xử lý…'
                            : order.depositStatus === 'SUBMITTED'
                              ? 'Xác nhận đã nhận cọc'
                              : 'Xác nhận đã nhận cọc trực tiếp'}
                        </button>
                        {order.depositStatus === 'SUBMITTED' && (
                          <button
                            className="ghost-button"
                            disabled={depositBusy !== null}
                            onClick={() => void reviewDeposit(order, 'REJECT')}
                          >
                            Chưa nhận được
                          </button>
                        )}
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
                      <Icon name="shield" /> Báo sự cố:{' '}
                      {REASON_LABELS[order.complaint.reason] || order.complaint.reason}
                    </strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                            <strong>Nội dung:</strong> {parsed.details}
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

                  {(() => {
                    const wf = order.complaint?.workflow || null;
                    const st = order.complaint?.status || 'OPEN';
                    const isOpenComplaint = ['OPEN', 'IN_REVIEW', 'REJECTED', 'ESCALATED'].includes(st);
                    const pendingParty = wf?.pendingParty || (st === 'OPEN' ? 'SUPPLIER' : isOpenComplaint ? 'STORE_OWNER' : null);
                    const supplierPhone = (order.supplier?.phone || '').trim() || null;
                    const rawHistory = Array.isArray(wf?.history) ? wf.history : [];
                    const cleanHistory = dedupeComplaintHistory(rawHistory);
                    const complaintId = order.complaint!.id;
                    const showHistory = expandedHistoryIds[complaintId] ?? isOpenComplaint;
                    const finalSummary = (wf?.finalSummary || order.complaint?.response || '').trim();
                    const closedReason = (wf?.closedReason || '').trim();
                    const showClosedReason =
                      Boolean(closedReason) &&
                      closedReason.toLowerCase() !== finalSummary.toLowerCase();

                    return (
                      <>
                        {isOpenComplaint && wf && wf.proposedAction && (
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
                              Đề xuất gần nhất của Chủ vựa:
                            </strong>
                            <div>
                              {SUPPLIER_RESOLUTIONS.find((p) => p.code === wf.proposedAction)?.label ||
                                wf.proposedAction}
                              {wf.proposedAction === 'DEDUCT_COD' &&
                                Number(wf.proposedDeductAmount || 0) > 0 && (
                                  <strong style={{ marginLeft: '6px', color: '#dc2626' }}>
                                    (-{money(Number(wf.proposedDeductAmount))})
                                  </strong>
                                )}
                            </div>
                            {wf.proposedNote && (
                              <div style={{ marginTop: '3px', fontSize: '12.5px', color: '#14532d' }}>
                                {wf.proposedNote}
                              </div>
                            )}
                          </div>
                        )}

                        {isOpenComplaint && wf?.storeRejectedProposal && (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '10px 12px',
                              borderRadius: '6px',
                              backgroundColor: '#fef2f2',
                              border: '1px solid #fca5a5',
                              color: '#991b1b',
                            }}
                          >
                            <strong style={{ display: 'block', marginBottom: '3px' }}>
                              {kind === 'store'
                                ? 'Bạn đã từ chối phương án của Chủ vựa'
                                : 'Tiệm tạp hóa đã từ chối phương án của Chủ vựa'}
                            </strong>
                            {wf.rejectedProposalAction && (
                              <div style={{ marginTop: '3px', fontSize: '12.5px', color: '#7f1d1d' }}>
                                Phương án bị từ chối:{' '}
                                {SUPPLIER_RESOLUTIONS.find((p) => p.code === wf.rejectedProposalAction)?.label ||
                                  wf.rejectedProposalAction}
                                {wf.rejectedProposalAction === 'DEDUCT_COD' &&
                                  Number(wf.rejectedProposalDeductAmount || 0) > 0 && (
                                    <strong style={{ marginLeft: '6px' }}>
                                      (-{money(Number(wf.rejectedProposalDeductAmount))})
                                    </strong>
                                  )}
                              </div>
                            )}
                            {wf.rejectedProposalNote && (
                              <div style={{ marginTop: '3px', fontSize: '12.5px', color: '#7f1d1d' }}>
                                Giải trình của Chủ vựa: {wf.rejectedProposalNote}
                              </div>
                            )}
                            {wf.storeRejectionNote && (
                              <div style={{ marginTop: '3px', fontSize: '12.5px', color: '#7f1d1d' }}>
                                {kind === 'store' ? 'Lý do: ' : 'Lý do của Tiệm: '}
                                {wf.storeRejectionNote}
                              </div>
                            )}
                            {kind === 'store' && (
                              <div style={{ marginTop: '3px', fontSize: '12.5px', color: '#7f1d1d' }}>
                                Khiếu nại vẫn đang mở. Bạn có thể gọi trực tiếp Chủ vựa để thương lượng phương án mới.
                              </div>
                            )}
                          </div>
                        )}

                        {isOpenComplaint && !wf?.proposedAction && !wf?.storeRejectedProposal && order.complaint?.response && (
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
                              Chủ vựa phản hồi:
                            </strong>
                            <span>{order.complaint.response}</span>
                          </div>
                        )}

                        {!isOpenComplaint && finalSummary && (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '10px 12px',
                              borderRadius: '6px',
                              backgroundColor: ['CLOSED_TIMEOUT', 'CLOSED_UNRESOLVED'].includes(st)
                                ? '#fff7ed'
                                : '#f0fdf4',
                              border: `1px solid ${['CLOSED_TIMEOUT', 'CLOSED_UNRESOLVED'].includes(st) ? '#fdba74' : '#86efac'}`,
                              fontSize: '13px',
                              color: '#0f172a',
                            }}
                          >
                            <strong>Kết quả thống nhất:</strong> {finalSummary}
                            {showClosedReason && (
                              <div style={{ marginTop: '4px', color: '#475569', fontSize: '12px' }}>
                                Ghi chú: {closedReason}
                              </div>
                            )}
                          </div>
                        )}

                        {cleanHistory.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <button
                              type="button"
                              className="complaint-history-toggle"
                              onClick={() =>
                                setExpandedHistoryIds((prev) => ({
                                  ...prev,
                                  [complaintId]: !showHistory,
                                }))
                              }
                            >
                              {showHistory
                                ? `Ẩn lịch sử trao đổi (${cleanHistory.length} bước)`
                                : `Xem lịch sử trao đổi (${cleanHistory.length} bước)`}
                            </button>
                            {showHistory && (
                              <div
                                style={{
                                  marginTop: '6px',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '12px',
                                }}
                              >
                                <div style={{ display: 'grid', gap: '4px' }}>
                                  {cleanHistory.map((h, i) => (
                                    <div key={`${complaintId}-h-${i}`} style={{ color: '#475569' }}>
                                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{h.label}:</span>{' '}
                                      {h.note}{' '}
                                      {h.at && (
                                        <span style={{ color: '#94a3b8' }}>({formatComplaintTime(h.at)})</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {kind === 'store' && order.complaint && isOpenComplaint && (
                          <div
                            style={{
                              marginTop: '10px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'wrap',
                              paddingTop: '8px',
                              borderTop: '1px dashed #fed7aa',
                            }}
                          >
                            <span style={{ fontSize: '12px', color: '#9a3412' }}>
                              {pendingParty === 'STORE_OWNER'
                                ? 'Chủ vựa đã gửi phương án xử lý. Vui lòng kiểm tra và xác nhận đồng ý hoặc rút khiếu nại.'
                                : 'Đang chờ Chủ vựa kiểm tra và đề xuất phương án xử lý.'}
                            </span>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {pendingParty === 'STORE_OWNER' && (
                                <button
                                  className="table-button"
                                  type="button"
                                  style={{ background: '#16a34a', color: '#fff', borderColor: '#15803d', fontWeight: 600 }}
                                  disabled={busy}
                                  onClick={() => void handleBuyerDecision(order.complaint!.id, 'ACCEPT')}
                                >
                                  {wf?.proposedAction && !['REJECT', 'DISCUSS'].includes(wf.proposedAction)
                                    ? 'Đồng ý phương án & Hoàn thành'
                                    : 'Chấp nhận giải trình & Hoàn thành'}
                                </button>
                              )}
                              {pendingParty === 'STORE_OWNER' && (
                                <button
                                  className="table-button"
                                  type="button"
                                  style={{ background: '#fff', color: '#b91c1c', borderColor: '#fca5a5', fontWeight: 600 }}
                                  disabled={busy}
                                  onClick={() => void handleBuyerDecision(order.complaint!.id, 'REJECT_PROPOSAL')}
                                >
                                  Từ chối phương án
                                </button>
                              )}
                              <button
                                className="table-button"
                                type="button"
                                disabled={busy}
                                onClick={() => void handleBuyerDecision(order.complaint!.id, 'WITHDRAW')}
                              >
                                Rút khiếu nại
                              </button>
                            </div>
                          </div>
                        )}

                        {kind === 'store' && order.complaint && isOpenComplaint && (
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ display: 'block', fontSize: '13px', color: '#1e3a8a' }}>
                                {wf?.storeRejectedProposal
                                  ? 'Bạn đã từ chối phương án · Gọi Chủ vựa để thương lượng trực tiếp'
                                  : 'Cần thương lượng trực tiếp? Gọi Chủ vựa'}
                              </strong>
                              <span style={{ fontSize: '12px', color: '#475569' }}>
                                {order.supplier?.businessName || 'Nhà cung cấp'}
                                {order.supplier?.warehouseAddress
                                  ? ` · ${order.supplier.warehouseAddress}`
                                  : ''}
                              </span>
                              {!supplierPhone && (
                                <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
                                  Chủ vựa chưa cập nhật số điện thoại. Vui lòng trao đổi qua khung tin nhắn.
                                </div>
                              )}
                            </div>
                            {supplierPhone && (
                              <a
                                href={`tel:${supplierPhone}`}
                                className="table-button"
                                style={{
                                  background: '#1d4ed8',
                                  color: '#fff',
                                  borderColor: '#1e40af',
                                  fontWeight: 700,
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  whiteSpace: 'nowrap',
                                }}
                                title={`Gọi cho ${order.supplier?.businessName || 'Chủ vựa'}`}
                              >
                                <Icon name="phone" className="complaint-contact-phone-icon" />
                                <span>Gọi {supplierPhone}</span>
                              </a>
                            )}
                          </div>
                        )}

                        {kind === 'supplier' && (
                          <div
                            style={{
                              marginTop: '10px',
                              display: 'flex',
                              justifyContent: 'flex-end',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'wrap',
                            }}
                          >
                            {isOpenComplaint && pendingParty !== 'STORE_OWNER' ? (
                              <button
                                className="table-button"
                                type="button"
                                disabled={busy}
                                onClick={() => openSupplierComplaint(order)}
                              >
                                Đề xuất phương án xử lý
                              </button>
                            ) : isOpenComplaint && pendingParty === 'STORE_OWNER' ? (
                              <span
                                style={{
                                  fontSize: '12px',
                                  color: '#1d4ed8',
                                  fontWeight: 600,
                                  background: '#eff6ff',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  border: '1px solid #bfdbfe',
                                }}
                              >
                                Đã gửi phương án · Chờ Tiệm tạp hóa xác nhận kết quả.
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '12px',
                                  color: '#15803d',
                                  fontWeight: 600,
                                  background: '#f0fdf4',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  border: '1px solid #bbf7d0',
                                }}
                              >
                                Khiếu nại đã hoàn thành và ghi nhận kết quả.
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Báo cáo sự cố khi đang giao của tài xế */}
              {order.driverInfo?.incidentReport && (() => {
                const inc = order.driverInfo.incidentReport;
                const loss = computeOrderLossAmount(order);
                const isDeductCod = inc.action === 'DEDUCT_COD';
                return (
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
                        Sự cố khi đang giao: {inc.damageTypeLabel || inc.damageType}
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
                      {inc.damagedItems
                        ?.map((d) => `${d.productName} (x${d.quantity})`)
                        .join(', ')}
                    </div>

                    {/* Hiển thị phương án chủ vựa đã chọn */}
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #fca5a5',
                        color: '#991b1b',
                      }}
                    >
                      <strong>Cách xử lý: </strong>
                      {isDeductCod ? (
                        <span>
                          <strong>Trừ thẳng tiền hàng hỏng vào COD khi nhận hàng</strong>
                          <span style={{ display: 'block', color: '#15803d', fontWeight: 600, marginTop: '2px' }}>
                            Đã giảm trừ {money(loss)} vào tiền thu COD. Tiệm chỉ thanh toán phần hàng nguyên vẹn.
                          </span>
                        </span>
                      ) : inc.action === 'RETURN_ALL' ? (
                        <span>
                          <strong>Thu hồi toàn bộ hàng về kho vựa</strong> & Hoàn 100% tiền cọc về ví tiệm.
                        </span>
                      ) : (
                        <span>
                          <strong>Tiếp tục giao hàng lành & Tạo đơn bù 0đ</strong> cho chuyến xe sau.
                        </span>
                      )}
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
                        Chủ vựa đã tạo đơn giao bổ sung 0đ #{inc.supplementaryOrderId} để bù hàng hỏng chuyến sau cho tiệm.
                      </div>
                    )}
                  </div>
                );
              })()}

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
                        Đã báo trả {money(order.driverInfo.paymentInfo.amount)} · {order.driverInfo.paymentInfo.method === 'COD' ? 'Tiền mặt' : 'Chuyển khoản'}
                      </strong>
                      <span style={{ fontSize: '12px', color: '#713f12' }}>
                        {kind === 'store'
                          ? 'Chờ chủ vựa xác nhận đã nhận tiền.'
                          : 'Kiểm tra tiền trước khi xác nhận.'}
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
                        Chờ xác nhận nhận tiền
                      </button>
                    )}
                  </div>
                </div>
              )}

              {orderPaymentSummary(order).paid && order.status === 'DELIVERED' && (
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
                        Đã trả đủ tiền
                      </strong>
                      <span style={{ fontSize: '12px', color: '#14532d' }}>
                        {order.complaint && ['OPEN', 'IN_REVIEW'].includes(order.complaint.status)
                          ? 'Cần xử lý xong sự cố trước khi hoàn tất.' : kind === 'store'
                            ? 'Bạn có thể hoàn tất đơn.'
                            : 'Chờ cửa hàng hoàn tất đơn.'}
                      </span>
                    </div>

                    {kind === 'store' && !(order.complaint && ['OPEN', 'IN_REVIEW', 'ESCALATED'].includes(order.complaint.status)) && (
                      <button
                        type="button"
                        className="table-button primary-small"
                        style={{ backgroundColor: '#15803d', fontWeight: 700 }}
                        disabled={actionLoadingId === order.id}
                        onClick={() => void handleCompleteOrder(order)}
                      >
                        {actionLoadingId === order.id ? 'Đang hoàn tất…' : 'Hoàn tất đơn'}
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
                  Đơn đã hoàn tất · Đã thanh toán đủ
                </div>
              )}

              {kind === 'store' && order.status === 'COMPLETED' && (
                <div className="order-inventory-import">
                  <button
                    type="button"
                    className="primary-button"
                    aria-label={order.inventoryImportedAt ? `Đơn #${order.id} đã thêm vào kho` : `Thêm đơn #${order.id} vào kho`}
                    disabled={busy || actionLoadingId !== null || Boolean(order.inventoryImportedAt) || !order.canImportInventory}
                    onClick={() => void handleImportInventory(order)}
                  >
                    {order.inventoryImportedAt ? 'Đã nhập kho' : actionLoadingId === order.id ? 'Đang nhập kho…' : 'Nhập kho'}
                  </button>
                  <p className="catalog-hint">
                    {order.inventoryImportedAt
                      ? `Nhập kho lúc ${new Date(order.inventoryImportedAt).toLocaleString('vi-VN')}`
                      : order.inventoryImportBlockedReason || (order.canImportInventory
                        ? 'Chỉ nhập khi đã kiểm đủ hàng. Mỗi đơn nhập một lần.'
                        : 'Chưa thể nhập kho. Vui lòng tải lại đơn.')}
                  </p>
                  {order.inventoryImportedAt && onViewHistory && (
                    <button type="button" className="secondary-button" onClick={onViewHistory}>
                      Xem lịch sử nhập kho
                    </button>
                  )}
                </div>
              )}

              {(() => {
                const loss = getOrderTotalDeduction(order);
                const adjustedSubtotal = Math.max(0, order.subtotal - loss);
                const depositPaid = order.depositStatus === 'PAID' ? order.depositAmount : 0;

                return loss > 0 ? (
                  <div style={{ margin: '8px 0', fontSize: '12.5px', color: '#475569' }}>
                    <div>
                      Tiền hàng gốc: <strong>{money(order.subtotal)}</strong>
                      <span style={{ color: '#dc2626', fontWeight: 600 }}> - Trừ hàng hỏng ({money(loss)})</span>
                      {' = '}
                      <strong style={{ color: '#166534' }}>{money(adjustedSubtotal)}</strong>
                      {order.deliveryFee > 0 && ` + Giao hàng ${money(order.deliveryFee)}`}
                    </div>
                    {depositPaid > 0 && (
                      <div style={{ color: '#15803d', marginTop: '2px' }}>
                        Đã cọc {order.depositRate}%: <strong>- {money(depositPaid)}</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="catalog-hint">
                    Hàng {money(order.subtotal)} · Phí giao {money(order.deliveryFee)}
                  </p>
                );
              })()}

              <div className="order-card-bottom">
                <strong>
                  {order.status === 'REJECTED' ? 'Giá trị đơn đã hủy' : orderPaymentSummary(order).paid || order.status === 'COMPLETED'
                    ? 'Tổng tiền đơn' : 'Còn phải trả'}
                  :{' '}
                  {money(
                    orderPaymentSummary(order).paid || ['COMPLETED', 'REJECTED'].includes(order.status)
                      ? orderPaymentSummary(order, getOrderTotalDeduction(order)).total
                      : orderPaymentSummary(order, getOrderTotalDeduction(order)).remaining,
                  )}
                </strong>
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
                            ? `Cần kiểm đủ ${order.items.length} mặt hàng`
                            : undefined
                        }
                      >
                        {(packingMap[order.id] || []).length < order.items.length
                          ? `Soạn đủ hàng để giao (${(packingMap[order.id] || []).length}/${order.items.length})`
                          : 'Giao hàng'}
                      </button>
                    )}

                    {order.status === 'SHIPPING' && (
                      <button
                        type="button"
                        className="table-button danger"
                        style={{ backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 650 }}
                        onClick={() => onReportIncident?.(order)}
                      >
                        Báo sự cố
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
                          Nhận đơn
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

                    {order.status === 'SHIPPING' && (
                      <button
                        type="button"
                        className="table-button primary-small"
                        style={{ backgroundColor: '#15803d', fontWeight: 700 }}
                        disabled={busy || actionLoadingId === order.id}
                        onClick={() => void handleConfirmArrival(order)}
                      >
                        {actionLoadingId === order.id ? 'Đang xử lý…' : 'Đã nhận hàng'}
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
                        {!orderPaymentSummary(order).paid && !(order.complaint && ['OPEN', 'IN_REVIEW'].includes(order.complaint.status)) && (!order.driverInfo?.paymentInfo ||
                          order.driverInfo?.paymentInfo?.status === 'PENDING_PAYMENT') && (
                            <button
                              type="button"
                              className="table-button primary-small"
                              style={{ backgroundColor: '#0284c7', fontWeight: 700 }}
                              onClick={() => {
                                if (Number(order.total) === 0) {
                                  setActionModalError('');
                                  setActionModalInput('');
                                  setActionModal({
                                    type: 'complete-supplementary',
                                    orderId: order.id,
                                    title: `Hoàn tất đơn giao bù #${order.id}`,
                                    message: 'Xác nhận đã nhận đủ hàng giao bù và hoàn tất đơn hàng này?',
                                    confirmLabel: 'Xác nhận hoàn tất',
                                    tone: 'primary',
                                  });
                                  return;
                                }
                                setPaymentOrder(order);
                              }}
                            >
                              {Number(order.total) === 0 ? 'Nhận đủ hàng bù & Hoàn tất' : 'Trả tiền'}
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
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="table-button danger"
                    style={{ padding: '4px 10px', fontSize: '13px' }}
                    onClick={() => handleCancelOrder(order)}
                  >
                    Hủy đơn hàng
                  </button>
                  <p className="catalog-hint" style={{ margin: 0 }}>
                    {order.depositStatus === 'PENDING'
                      ? 'Chưa chuyển cọc. Bạn có thể hủy đơn nếu đổi ý.'
                      : 'Đơn đang chờ chủ vựa duyệt. Hủy đơn sẽ tự động hoàn lại tiền cọc về Ví.'}
                  </p>
                </div>
              )}
              {false && kind === 'store' && order.status === 'PENDING' && order.depositStatus !== 'SUBMITTED' && (
                <p className="catalog-hint">
                  {order.depositStatus === 'PENDING'
                    ? 'Chuyển cọc rồi bấm báo đã chuyển.'
                    : 'Chờ chủ vựa duyệt đơn.'}
                </p>
              )}


              {/* Nút báo cáo đơn hàng khi đã giao (DELIVERED) */}
              {kind === 'store' && order.status === 'DELIVERED' && !order.complaint && (() => {
                const isExpired = order.deliveredAt && (Date.now() - new Date(order.deliveredAt).getTime() > 24 * 60 * 60 * 1000);
                return (
                  <div
                    className="order-card-bottom"
                    style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e8eee7' }}
                  >
                    {isExpired ? (
                      <p className="catalog-hint" style={{ margin: 0, color: '#dc2626', fontWeight: 600 }}>
                        Đã hết thời hạn khiếu nại (24 giờ kể từ khi nhận hàng lúc {new Date(order.deliveredAt!).toLocaleString('vi-VN')}).
                      </p>
                    ) : (
                      <>
                        <p className="catalog-hint" style={{ margin: 0 }}>
                          Kiểm tra hàng thực nhận rồi cập nhật kho. Khiếu nại có hiệu lực trong vòng 24 giờ kể từ khi nhận hàng.
                        </p>
                        <button
                          className="table-button complaint-card-report-btn"
                          type="button"
                          onClick={() => openStoreComplaint(order)}
                        >
                          Báo cáo sự cố
                        </button>
                      </>
                    )}
                  </div>
                );
              })()}
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
                    void submitSupplierProposal();
                  }
              }
            >
              <div className="complaint-dialog-body">
                {kind === 'store' ? (
                  <div className="complaint-section-group">
                    {/* 1. Chọn mặt hàng gặp sự cố */}
                    <div className="complaint-field">
                      <label className="complaint-label">
                        <span>Mặt hàng gặp sự cố</span>
                        <span className="complaint-label-hint">Chọn sản phẩm và số thùng/kiện bị lỗi hoặc thiếu</span>
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
                                    const intact = getIntactItemArrived(complaintOrder, it);
                                    if (intact.remainingLoose > 0) {
                                      nextMap[it.id] = Math.max(1, intact.intactCartons || it.quantity);
                                    }
                                  });
                                }
                                setComplaintSelectedItems(nextMap);
                              }}
                            />
                            <span>Chọn tất cả ({complaintOrder.items.length})</span>
                          </label>
                          <span className="complaint-label-hint">
                            Đã chọn{' '}
                            {
                              Object.values(complaintSelectedItems).filter((q) => q > 0)
                                .length
                            }
                            /{complaintOrder.items.length}
                          </span>
                        </div>

                        <div className="complaint-checklist-body">
                          {complaintOrder.items.map((item) => {
                            const intact = getIntactItemArrived(complaintOrder, item);
                            const isAllDamagedInTransit = intact.remainingLoose <= 0;
                            const isChecked = (complaintSelectedItems[item.id] || 0) > 0;
                            const currentQty = complaintSelectedItems[item.id] || 1;
                            const itemDamageValue = isChecked ? currentQty * item.unitPrice : 0;

                            return (
                              <div
                                key={item.id}
                                className={`complaint-checklist-row ${isChecked ? 'checked' : ''}`}
                                style={isAllDamagedInTransit ? { opacity: 0.65, backgroundColor: '#f1f5f9' } : {}}
                              >
                                <div className="complaint-row-left">
                                  <input
                                    type="checkbox"
                                    className="complaint-item-check"
                                    disabled={isAllDamagedInTransit}
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (isAllDamagedInTransit) return;
                                      setComplaintSelectedItems((prev) => {
                                        const next = { ...prev };
                                        if (e.target.checked) {
                                          next[item.id] = Math.max(1, intact.intactCartons || 1);
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
                                      Đặt mua: {item.quantity} {item.packaging || 'thùng'} · Đơn giá: {money(item.unitPrice)}
                                    </span>
                                    {isAllDamagedInTransit ? (
                                      <div style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 600, marginTop: '2px' }}>
                                        Đã báo hỏng toàn bộ khi vận chuyển.
                                      </div>
                                    ) : intact.transitDamagedLoose > 0 ? (
                                      <div style={{ fontSize: '11.5px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                                        Tài xế đã báo hỏng khi giao: còn {intact.intactCartons}/{item.quantity} {item.packaging || 'thùng'}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="complaint-row-right">
                                  {isChecked ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                      <div className="complaint-qty-control">
                                        <span style={{ fontSize: '11.5px', color: '#55725e' }}>
                                          SL lỗi:
                                        </span>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            className="complaint-qty-input"
                                            value={complaintSelectedItems[item.id] || ''}
                                            onChange={(e) => {
                                              let digits = e.target.value.replace(/\D/g, '');
                                              if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
                                              let val = 1;
                                              if (digits !== '') {
                                                val = Math.max(1, Math.min(intact.intactCartons || item.quantity, parseInt(digits, 10)));
                                              }
                                              setComplaintSelectedItems((prev) => ({
                                                ...prev,
                                                [item.id]: val,
                                              }));
                                            }}
                                            style={{ width: '54px', textAlign: 'center' }}
                                          />
                                          <span style={{ fontSize: '11px', color: '#728477' }}>
                                            /{intact.intactCartons || item.quantity}
                                          </span>
                                        </div>
                                      </div>

                                      <span className="complaint-row-subtotal">
                                        {money(Math.round(itemDamageValue))}
                                      </span>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                      {isAllDamagedInTransit ? 'Đã xử lý' : 'Chưa chọn'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="complaint-checklist-footer">
                          <span>Giá trị hàng lỗi ước tính:</span>
                          <span className="complaint-total-badge">
                            {money(
                              Math.round(
                                Object.entries(complaintSelectedItems).reduce((sum, [idStr, qty]) => {
                                  const item = complaintOrder.items.find((i) => i.id === Number(idStr));
                                  if (!item) return sum;
                                  return sum + qty * item.unitPrice;
                                }, 0)
                              )
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Lý do khiếu nại */}
                    <div className="complaint-field">
                      <label className="complaint-label">
                        <span>Lý do khiếu nại</span>
                        <span className="complaint-label-hint">Chủ vựa sẽ kiểm tra và đề xuất phương án xử lý</span>
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
                        <span>Phương án đề xuất gửi Tiệm tạp hóa</span>
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

                    {supplierPlan === 'DEDUCT_COD' && (
                      <div className="complaint-field">
                        <label className="complaint-label">
                          <span>Số tiền đề xuất giảm trừ vào COD (VNĐ)</span>
                        </label>
                        <input
                          type="number"
                          min={1000}
                          step={1000}
                          className="complaint-select"
                          value={supplierDeductAmount}
                          onChange={(e) => setSupplierDeductAmount(e.target.value)}
                          placeholder="Ví dụ: 150000"
                        />
                      </div>
                    )}

                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        fontSize: '12.5px',
                        color: '#1e3a8a',
                      }}
                    >
                      Phương án bạn gửi sẽ chuyển tới Tiệm tạp hóa để xác nhận đồng ý trước khi hoàn thành và ghi nhận kết quả.
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
                        placeholder="Ghi rõ phương án giải quyết, số lượng bù, số tiền giảm hoặc thời gian xử lý..."
                      />
                    </div>
                  </div>
                )}

                {complaintMessage && (
                  <p
                    className={
                      complaintMessage.includes('Lỗi') || complaintMessage.includes('không') || complaintMessage.includes('Vui lòng')
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
                  Đóng
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
                    {['OPEN', 'IN_REVIEW', 'REJECTED', 'ESCALATED'].includes(
                      complaintOrder?.complaint?.status || '',
                    ) && complaintOrder?.complaint?.workflow?.pendingParty !== 'STORE_OWNER' ? (
                      <button
                        type="submit"
                        className="complaint-btn-primary"
                        disabled={complaintActionBusy}
                      >
                        {complaintActionBusy
                          ? 'Đang gửi…'
                          : 'Gửi phương án cho Tiệm xác nhận'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', padding: '6px 12px' }}>
                        {complaintOrder?.complaint?.workflow?.pendingParty === 'STORE_OWNER'
                          ? 'Đang chờ Tiệm tạp hóa xác nhận hoặc đề xuất lại.'
                          : `Khiếu nại đang ở trạng thái ${COMPLAINT_STATUS_MAP[complaintOrder?.complaint?.status || '']?.label || complaintOrder?.complaint?.status}, không thể cập nhật thêm.`}
                      </span>
                    )}
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {actionModal && (
        <div
          className="complaint-dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-action-modal-title"
          onClick={() => {
            if (!actionModalBusy) setActionModal(null);
          }}
        >
          <div className="complaint-dialog-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="complaint-dialog-header">
              <div>
                {actionModal.type !== 'cancel-order' && (
                  <div className="complaint-dialog-eyebrow">Xác nhận thao tác</div>
                )}
                <h2 id="order-action-modal-title" className="complaint-dialog-title">
                  {actionModal.title}
                </h2>
              </div>
              <button
                type="button"
                className="complaint-dialog-close"
                aria-label="Đóng hộp thoại"
                disabled={actionModalBusy}
                onClick={() => setActionModal(null)}
              >
                ×
              </button>
            </div>
            <form onSubmit={submitActionModal}>
              <div className="complaint-dialog-body">
                <p style={{ margin: '0 0 12px', color: '#334155', fontSize: '14px', lineHeight: 1.55 }}>
                  {actionModal.message}
                </p>

                {'inputLabel' in actionModal && actionModal.inputLabel && (
                  <div className="complaint-field">
                    <label className="complaint-label" htmlFor="order-action-modal-input">
                      {actionModal.inputLabel}
                      {actionModal.type === 'buyer-decision' && actionModal.requireInput && (
                        <span style={{ color: '#dc2626', marginLeft: '4px' }}>*</span>
                      )}
                    </label>
                    <textarea
                      id="order-action-modal-input"
                      className="complaint-textarea"
                      rows={3}
                      value={actionModalInput}
                      placeholder={actionModal.inputPlaceholder || ''}
                      disabled={actionModalBusy}
                      onChange={(e) => {
                        setActionModalInput(e.target.value);
                        if (actionModalError) setActionModalError('');
                      }}
                    />
                  </div>
                )}

                {actionModalError && (
                  <p className="error-notice" role="alert" style={{ marginTop: '10px', marginBottom: 0 }}>
                    {actionModalError}
                  </p>
                )}
              </div>

              <div className="complaint-dialog-footer">
                <button
                  type="button"
                  className="complaint-btn-ghost"
                  disabled={actionModalBusy}
                  onClick={() => setActionModal(null)}
                >
                  {actionModal.type === 'cancel-order' ? 'Quay lại' : 'Hủy'}
                </button>
                <button
                  type="submit"
                  className="complaint-btn-primary"
                  disabled={actionModalBusy}
                  style={
                    actionModal.tone === 'danger'
                      ? { backgroundColor: '#dc2626' }
                      : actionModal.tone === 'warning'
                        ? { backgroundColor: '#d97706' }
                        : undefined
                  }
                >
                  {actionModalBusy ? 'Đang xử lý…' : actionModal.confirmLabel}
                </button>
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-reschedule-title"
          >
            <h2 id="order-reschedule-title">Đề nghị đổi giờ nhận · Đơn #{rescheduleOrderTarget.id}</h2>
            <p className="catalog-hint" style={{ marginTop: 0 }}>
              Chọn giờ bạn muốn nhận. Lịch giao chỉ thay đổi khi chủ vựa đồng ý.
            </p>

            {(() => {
              const init = getInitialRescheduleData();
              const [rescheduleHour = '08', rescheduleMinute = '00'] = rescheduleTime ? rescheduleTime.split(':') : ['08', '00'];

              const availableHours = (() => {
                if (rescheduleDate !== init.todayStr) return RESCHEDULE_HOURS;
                return RESCHEDULE_HOURS.filter((hStr) => {
                  const h = parseInt(hStr, 10);
                  if (h === 17) return h * 60 >= init.earliestMinutesToday;
                  return (h + 1) * 60 > init.earliestMinutesToday;
                });
              })();

              const availableMinutes = (() => {
                const h = parseInt(rescheduleHour, 10);
                if (h === 17) return ['00'];
                if (rescheduleDate !== init.todayStr) return RESCHEDULE_MINUTES;
                const valid = RESCHEDULE_MINUTES.filter((mStr) => {
                  return h * 60 + parseInt(mStr, 10) >= init.earliestMinutesToday;
                });
                return valid;
              })();

              const dateParts = rescheduleDate.split('-');
              const dateFormatted = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : rescheduleDate;

              return (
                <div style={{ margin: '14px 0', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontWeight: 750, fontSize: '13px', color: '#1e293b' }}>
                      Thời gian nhận hàng thuận tiện
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '12px' }}>
                      Giờ chuẩn: 08:00 - 17:00
                    </span>
                  </div>

                  {!init.canToday ? (
                    <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#92400e', lineHeight: 1.45 }}>
                      <strong>Lưu ý:</strong> Hiện tại đã hết khung giờ nhận giao hôm nay (kết thúc lúc 17:00). Lịch hẹn giao sớm nhất bắt đầu từ <strong>08:00 sáng mai</strong>.
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#166534', lineHeight: 1.45 }}>
                      Giờ nhận hàng trong ngày: từ <strong>{init.time}</strong> đến <strong>17:00</strong>.
                    </div>
                  )}

                  <div className="order-reschedule-fields">
                    <label style={{ display: 'block' }}>
                      <span style={{ fontSize: '12px', fontWeight: 650, color: '#334155', display: 'block', marginBottom: '5px' }}>
                        Chọn ngày nhận hàng:
                      </span>
                      <DatePicker
                        required
                        min={init.minDate}
                        value={rescheduleDate}
                        onChange={(newDate) => {
                          setRescheduleDate(newDate);
                          let nextH = rescheduleHour;
                          const nextAvailH = newDate !== init.todayStr
                            ? RESCHEDULE_HOURS
                            : RESCHEDULE_HOURS.filter((hStr) => {
                              const h = parseInt(hStr, 10);
                              if (h === 17) return h * 60 >= init.earliestMinutesToday;
                              return (h + 1) * 60 > init.earliestMinutesToday;
                            });
                          if (!nextAvailH.includes(nextH)) nextH = nextAvailH[0] || '08';
                          const h = parseInt(nextH, 10);
                          let nextM = rescheduleMinute;
                          const nextAvailM = h === 17
                            ? ['00']
                            : (newDate !== init.todayStr
                              ? RESCHEDULE_MINUTES
                              : RESCHEDULE_MINUTES.filter((mStr) => h * 60 + parseInt(mStr, 10) >= init.earliestMinutesToday));
                          if (!nextAvailM.includes(nextM)) nextM = nextAvailM[0] || '00';
                          setRescheduleTime(`${nextH}:${nextM}`);
                        }}
                      />
                    </label>

                    <div style={{ display: 'block' }}>
                      <span style={{ fontSize: '12px', fontWeight: 650, color: '#334155', display: 'block', marginBottom: '5px' }}>
                        Chọn giờ nhận hàng:
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <select
                          aria-label="Giờ nhận hàng" value={rescheduleHour}
                          onChange={(e) => {
                            const newH = e.target.value;
                            const h = parseInt(newH, 10);
                            let nextM = rescheduleMinute;
                            const nextAvailM = h === 17
                              ? ['00']
                              : (rescheduleDate !== init.todayStr
                                ? RESCHEDULE_MINUTES
                                : RESCHEDULE_MINUTES.filter((mStr) => h * 60 + parseInt(mStr, 10) >= init.earliestMinutesToday));
                            if (!nextAvailM.includes(nextM)) nextM = nextAvailM[0] || '00';
                            setRescheduleTime(`${newH}:${nextM}`);
                          }}
                        >
                          {!availableHours.includes(rescheduleHour) && <option aria-label="Giờ nhận hàng" value={rescheduleHour} disabled>{rescheduleHour} giờ · Chọn lại giờ</option>}
                          {availableHours.map((h) => (
                            <option key={h} value={h}>{h} giờ</option>
                          ))}
                        </select>
                        <select
                          aria-label="Phút nhận hàng" value={rescheduleMinute}
                          onChange={(e) => setRescheduleTime(`${rescheduleHour}:${e.target.value}`)}
                        >
                          {!availableMinutes.includes(rescheduleMinute) && <option aria-label="Phút nhận hàng" value={rescheduleMinute} disabled>{rescheduleMinute} phút · Chọn lại phút</option>}
                          {availableMinutes.map((m) => (
                            <option key={m} value={m}>{m} phút</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '12.5px', color: '#0f172a' }}>
                    Giờ đề nghị: <strong style={{ color: '#15803d' }}>Ngày {dateFormatted} lúc {rescheduleTime}</strong>
                    {(!availableHours.includes(rescheduleHour) || !availableMinutes.includes(rescheduleMinute) || rescheduleDate < init.minDate) && (
                      <p role="alert" className="error-notice">Giờ đã chọn không còn phù hợp. Chọn lại ngày hoặc giờ.</p>
                    )}
                  </div>
                </div>
              );
            })()}

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
                {rescheduleBusy ? 'Đang gửi…' : 'Gửi đề nghị'}
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

      {importDraft && (
        <div className="supplier-dialog-backdrop">
          <form className="supplier-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-preview-title"
            onSubmit={event => {
              event.preventDefault();
              if (!importLines.length || importLines.some(line => !line.valid)) return;
              void handleImportInventory(importDraft.order, {
                conversions: importLines.flatMap(line => line.choice?.unit
                  ? [{ id: line.id, unit: line.choice.unit, unitsPerPack: line.count }] : []),
                preview: importLines.map(({ id, unit, quantity }) => ({ id, unit, quantity })),
              });
            }}>
            <h2 id="inventory-preview-title">Nhập kho đơn #{importDraft.order.id}</h2>
            {importLines.map(line => (
              <fieldset key={line.id} className="supplier-field" disabled={actionLoadingId !== null}>
                <legend>{line.name}</legend>
                <span>Đã mua {line.packs} × {line.packaging}</span>
                {line.canConvert && !line.existingUnit && (
                  <label className="supplier-field">
                    Đơn vị nhập kho
                    <select value={line.choice?.unit ?? ''} onChange={event => {
                      const unit = event.target.value;
                      setImportUnits(current => ({ ...current, [line.id]: { unit, count: '' } }));
                    }}>
                      <option value="">Chọn đơn vị bán lẻ</option>
                      {importDraft.preview.units.filter(unit => unit !== line.packaging).map(unit => <option key={unit}>{unit}</option>)}
                    </select>
                  </label>
                )}
                {line.choice?.unit && (
                  <label className="supplier-field">
                    Số {line.choice.unit} trong mỗi {line.packaging}
                    <input required type="number" min={1} step={1} value={line.choice.count} onChange={event => {
                      const count = event.target.value;
                      setImportUnits(current => ({ ...current, [line.id]: { ...current[line.id], count } }));
                    }} />
                  </label>
                )}
                {line.incompatible && <span>Kiểm tra đơn vị trong kho ({line.unit}) trước khi nhập mặt hàng này.</span>}
                {line.valid && <strong>{line.multiplier > 1 || line.choice?.unit
                  ? `${line.packs} × ${line.choice?.unit ? line.count : line.multiplier} = ` : 'Nhập '}{line.quantity} {line.unit}</strong>}
              </fieldset>
            ))}
            {error && <p className="error-notice" role="alert">{error}</p>}
            <div className="supplier-dialog-actions">
              <button type="button" className="ghost-button" disabled={actionLoadingId !== null} onClick={() => setImportDraft(null)}>Hủy</button>
              <button type="submit" className="primary-button" disabled={actionLoadingId !== null || !importLines.length || importLines.some(line => !line.valid)}>Xác nhận nhập kho</button>
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
  onSubmit: (method: 'COD' | 'QR' | 'WALLET') => void;
}) {
  const [method, setMethod] = useState<'COD' | 'QR' | 'WALLET'>('WALLET');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);

  const lossAmount = getOrderTotalDeduction(order);
  const depositPaid = order.depositStatus === 'PAID' ? order.depositAmount : 0;
  const remainingAmount = orderPaymentSummary(order, lossAmount).remaining;

  useEffect(() => {
    let active = true;
    getWallet()
      .then((data) => {
        if (active) setWalletBalance(data.wallet.balance);
      })
      .catch(() => {
        if (active) setWalletBalance(null);
      })
      .finally(() => {
        if (active) setLoadingWallet(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const bank = supplierPaymentBank(order.supplier);
  const hasSupplierBank = Boolean(bank);
  const bankName = bank?.name || '';
  const bankAcc = bank?.account || '';
  const bankHolder = bank?.holder || '';
  const qrUrl = `https://img.vietqr.io/image/${encodeURIComponent(bankName)}-${encodeURIComponent(bankAcc)}-compact2.png?amount=${remainingAmount}&addInfo=THANH%20TOAN%20DH${order.id}&accountName=${encodeURIComponent(bankHolder)}`;

  const isWalletSufficient = walletBalance !== null && walletBalance >= remainingAmount;

  return (
    <div className="supplier-dialog-backdrop" role="presentation">
      <section
        className="supplier-dialog order-payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <span className="supplier-panel-label">THANH TOÁN ĐƠN #{order.id}</span>
        <h2 id="payment-dialog-title">Thanh toán tiền hàng</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', marginBottom: '14px' }}>
          Chọn cách trả tiền.
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
            <span>Tổng tiền:</span>
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
              <span>Đã cọc ({order.depositRate}%):</span>
              <strong>- {money(depositPaid)}</strong>
            </div>
          )}
          {lossAmount > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '4px',
                fontSize: '13px',
                color: '#dc2626',
              }}
            >
              <span>Trừ hàng hỏng:</span>
              <strong>- {money(lossAmount)}</strong>
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
            <strong style={{ color: '#0f172a' }}>Cần trả:</strong>
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
            Trả bằng:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            {/* Lựa chọn 1: Ví hệ thống (SupplyMind Wallet) */}
            <button
              type="button"
              onClick={() => setMethod('WALLET')}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: `2px solid ${method === 'WALLET' ? '#0284c7' : '#e2e8f0'}`,
                backgroundColor: method === 'WALLET' ? '#f0f9ff' : '#ffffff',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong
                  style={{
                    display: 'block',
                    color: method === 'WALLET' ? '#0369a1' : '#1e293b',
                    fontSize: '13.5px',
                  }}
                >
                  Ví hệ thống (SupplyMind Wallet)
                </strong>
                <small style={{ color: '#64748b' }}>
                  {loadingWallet
                    ? 'Đang kiểm tra số dư ví…'
                    : walletBalance === null ? 'Chưa tải được số dư. Đóng và mở lại để thử.'
                    : `Số dư khả dụng: ${money(walletBalance)} · Trừ ví, rồi hoàn tất đơn`}
                </small>
              </div>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  backgroundColor: method === 'WALLET' ? '#0284c7' : '#f1f5f9',
                  color: method === 'WALLET' ? '#ffffff' : '#64748b',
                }}
              >
                Khuyên dùng
              </span>
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {/* Lựa chọn 2: COD */}
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

              {/* Lựa chọn 3: Quét mã VietQR */}
              <button
                type="button"
                onClick={() => setMethod('QR')}
              disabled={busy || !hasSupplierBank}
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
                <small style={{ color: '#64748b' }}>{hasSupplierBank ? 'Vào tài khoản chủ vựa' : 'Chủ vựa chưa có tài khoản nhận tiền'}</small>
              </button>
            </div>
          </div>
        </div>

        {/* Nội dung chi tiết từng phương thức */}
        {method === 'WALLET' ? (
          <div
            style={{
              marginBottom: '14px',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: isWalletSufficient ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${isWalletSufficient ? '#86efac' : '#fde68a'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', color: '#1e293b' }}>Số dư ví khả dụng hiện tại:</span>
              <strong style={{ fontSize: '14px', color: isWalletSufficient ? '#15803d' : '#b45309' }}>
                {loadingWallet ? '…' : money(walletBalance ?? 0)}
              </strong>
            </div>

            {isWalletSufficient ? (
              <div>
                <p style={{ margin: '4px 0', fontSize: '12.5px', color: '#166534' }}>
                  Số dư ví đủ để thanh toán. Số dư còn lại sau thanh toán: <strong>{money((walletBalance ?? 0) - remainingAmount)}</strong>.
                </p>
                <div style={{ fontSize: '12px', color: '#15803d', marginTop: '6px' }}>
                  Đơn hàng sẽ được ghi nhận đã thanh toán. Sau khi hoàn tất đơn, bạn có thể bấm Nhập kho.
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin: '4px 0', fontSize: '12.5px', color: '#b45309', fontWeight: 600 }}>
                  Số dư ví khả dụng không đủ (còn thiếu {money(remainingAmount - (walletBalance ?? 0))}).
                </p>
                <p style={{ margin: '4px 0 8px', fontSize: '12px', color: '#92400e' }}>
                  Bạn có thể nạp thêm tiền vào ví tại mục Ví & Giao dịch, hoặc chọn nhanh hình thức thanh toán khác dưới đây:
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setMethod('COD')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #d97706',
                      backgroundColor: '#ffffff',
                      color: '#b45309',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Chuyển sang Tiền mặt (COD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('QR')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #d97706',
                      backgroundColor: '#ffffff',
                      color: '#b45309',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Chuyển sang Quét mã VietQR
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : method === 'QR' ? (
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
              Quét mã để chuyển khoản
            </span>
            <p>Chủ vựa sẽ kiểm tra tiền nhận được. Ứng dụng không tự xác nhận giao dịch ngân hàng.</p>
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
            <strong>Trả tiền mặt</strong>
            <p style={{ margin: '4px 0 0' }}>
              Đưa <strong>{money(remainingAmount)}</strong> cho người giao hàng.
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
            style={{
              backgroundColor: method === 'WALLET' && !isWalletSufficient ? '#94a3b8' : '#0284c7',
              fontWeight: 700,
              cursor: method === 'WALLET' && !isWalletSufficient ? 'not-allowed' : 'pointer',
            }}
            onClick={() => onSubmit(method)}
            disabled={busy || (method === 'WALLET' && !isWalletSufficient) || (method === 'QR' && !hasSupplierBank)}
          >
            {busy
              ? 'Đang xử lý…'
              : method === 'WALLET'
                ? `Xác nhận trừ ${money(remainingAmount)} từ Ví`
                : 'Xác nhận đã trả tiền'}
          </button>
        </div>
      </section>
    </div>
  );
}
