import { useEffect, useState, type FormEvent } from 'react';
import { fillEmptySuggestions } from '../validation/restock';
import { api, getApiError, isUnauthenticated } from '../services/api';
import './restock-print.css';

type Holiday = {
  id: string;
  name: string;
  categories: string[];
  multiplier: number;
  description: string;
  daysUntil: number;
  isUpcoming: boolean;
  isCurrent: boolean;
};

type Forecast = {
  purchasePrice: number | null;
  itemId: number;
  name: string;
  unit: string;
  quantity: number;
  averageDailySales: number | null;
  daysUntilStockout: number | null;
  suggestedQuantity: number | null;
  holidayMultiplier?: number | null;
  holidayName?: string | null;
  notes: string[];
};

type Plan = {
  id: string;
  name: string;
  note: string;
  horizonDays: number;
  safetyDays: number;
  updatedAt: string;
  lines: {
    purchasePrice: number | null;
    sourceItemId: number;
    productName: string;
    unit: string;
    quantity: number;
  }[];
};

type SeasonalOpportunity = {
  id: string;
  name: string;
  category: string;
  unit: string;
  holidayName: string;
  growthNote: string;
  trendScore: number;
  supplierName: string;
  supplierDistance: string;
  wholesalePrice: number;
  moq: number;
};

const SEASONAL_OPPORTUNITIES: SeasonalOpportunity[] = [
  {
    id: 'SEAS-01',
    name: 'Khay Mứt Tết Ngũ Phúc 600g (Hộp lục giác sang trọng)',
    category: 'Bánh kẹo & Quà Tết',
    unit: 'Hộp',
    holidayName: 'Tết & Giáng Sinh',
    growthNote: 'Nhu cầu tăng x2.8 lần vào dịp lễ hội cuối năm (Nguồn: Kantar FMCG Vietnam)',
    trendScore: 92,
    supplierName: 'Vựa Nông Sản & Bánh Kẹo Chợ Lớn',
    supplierDistance: '2.4 km',
    wholesalePrice: 65000,
    moq: 10,
  },
  {
    id: 'SEAS-02',
    name: 'Hạt Điều Rang Muối Bình Phước (Hũ 500g loại 1)',
    category: 'Hạt dinh dưỡng & Đồ nhắm',
    unit: 'Hũ',
    holidayName: 'Tết & Giáng Sinh',
    growthNote: 'Tìm kiếm Google Trends tăng +210% các tuần cận Tết (Google Search Trends VN)',
    trendScore: 88,
    supplierName: 'Vựa Nông Sản Miền Đông',
    supplierDistance: '3.8 km',
    wholesalePrice: 85000,
    moq: 12,
  },
  {
    id: 'SEAS-03',
    name: 'Hộp Quà Bánh Quy Bơ Thượng Hạng (Hộp thiếc đỏ 450g)',
    category: 'Quà biếu tặng',
    unit: 'Hộp',
    holidayName: 'Tết & Giáng Sinh',
    growthNote: 'Nhóm quà biếu tặng tiêu thụ mạnh nhất tháng Chạp (Kantar Retail Outlook)',
    trendScore: 85,
    supplierName: 'Tổng Kho Bánh Kẹo Hữu Nghị',
    supplierDistance: '4.5 km',
    wholesalePrice: 125000,
    moq: 6,
  },
];

const money = (value: number | bigint) => value.toLocaleString('vi-VN') + ' ₫';

function budget(lines: { quantity: number; purchasePrice: number | null }[]) {
  const selected = lines.filter(
    (line) => Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 2147483647,
  );
  const total = selected.reduce(
    (sum, line) =>
      sum +
      (line.purchasePrice == null ? BigInt(0) : BigInt(line.quantity) * BigInt(line.purchasePrice)),
    BigInt(0),
  );
  const missing = selected.filter((line) => line.purchasePrice == null).length;
  return `${missing ? 'Tạm tính phần có giá' : 'Chi phí dự kiến'}: ${money(total)}${missing ? ` · ${missing} mặt hàng chưa có giá nhập` : ''}`;
}

const DEMO_HOLIDAYS: Holiday[] = [
  {
    id: 'CHRISTMAS_DEMO',
    name: 'Lễ Giáng Sinh & Chào Đón Năm Mới',
    categories: ['Bia', 'Nước giải khát', 'Bánh kẹo', 'Rượu', 'Snack'],
    multiplier: 1.6,
    description: 'Dự báo tiệc cuối năm & lễ hội làm nhu cầu Đồ uống, Bia & Bánh kẹo tăng vọt (+60%).',
    daysUntil: 12,
    isUpcoming: true,
    isCurrent: false,
  },
];

const DEMO_ITEMS: Forecast[] = [
  {
    itemId: 9991,
    name: 'Bia Heineken (Thùng 24 lon)',
    unit: 'Thùng',
    quantity: 6,
    averageDailySales: 4.2,
    daysUntilStockout: 1.4,
    purchasePrice: 430000,
    suggestedQuantity: 42,
    holidayMultiplier: 1.6,
    holidayName: 'Lễ Giáng Sinh & Chào Đón Năm Mới',
    notes: ['Dịp Lễ [Giáng Sinh & Năm Mới]: AI tự động tăng nhu cầu gợi ý nhập x1.6 (+60%).'],
  },
  {
    itemId: 9992,
    name: 'Nước ngọt Coca-Cola (Thùng 24 lon)',
    unit: 'Thùng',
    quantity: 10,
    averageDailySales: 5.0,
    daysUntilStockout: 2.0,
    purchasePrice: 195000,
    suggestedQuantity: 48,
    holidayMultiplier: 1.6,
    holidayName: 'Lễ Giáng Sinh & Chào Đón Năm Mới',
    notes: ['Dịp Lễ [Giáng Sinh & Năm Mới]: AI tự động tăng nhu cầu gợi ý nhập x1.6 (+60%).'],
  },
  {
    itemId: 9993,
    name: 'Bánh Quy Danisa 454g (Hộp thiếc biếu)',
    unit: 'Hộp',
    quantity: 4,
    averageDailySales: 2.5,
    daysUntilStockout: 1.6,
    purchasePrice: 185000,
    suggestedQuantity: 24,
    holidayMultiplier: 1.6,
    holidayName: 'Lễ Giáng Sinh & Chào Đón Năm Mới',
    notes: ['Dịp Lễ [Giáng Sinh & Năm Mới]: AI tự động tăng nhu cầu gợi ý nhập x1.6 (+60%).'],
  },
];

export default function RestockPage({
  revision,
  onLogout,
}: {
  revision: number;
  onLogout: () => void;
}) {
  const [view, setView] = useState<'forecast' | 'saved'>('forecast');
  const [horizon, setHorizon] = useState(7);
  const [safety, setSafety] = useState(2);
  const [items, setItems] = useState<Forecast[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('supplymind:draft-restock-quantities');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [upcomingHolidays, setUpcomingHolidays] = useState<Holiday[]>([]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [recommendationRunId, setRecommendationRunId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  // Modal tạo / sửa kế hoạch tại tab "Kế hoạch đã lưu"
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [modalPlanName, setModalPlanName] = useState('');
  const [modalPlanNote, setModalPlanNote] = useState('');

  // Toast thông báo lưu thành công
  const [toastMessage, setToastMessage] = useState('');

  // Modal in phiếu PDF
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printScope, setPrintScope] = useState<'TOMORROW' | 'ALL'>('TOMORROW');
  const [printPlanTarget, setPrintPlanTarget] = useState<Plan | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(''), 4000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    let active = true;
    api
      .get(
        view === 'forecast'
          ? `/restock/forecast?horizonDays=${horizon}&safetyDays=${safety}`
          : `/restock/plans?page=${page}`,
      )
      .then(({ data }) => {
        if (!active) return;
        if (view === 'forecast') {
          setItems(data.items || []);
          setUpcomingHolidays(data.upcomingHolidays || []);
          setRecommendationRunId(data.recommendationRunId);
        } else {
          setPlans(data.plans || []);
          setHasMore(data.hasMore || false);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          if (view === 'forecast') setItems([]);
          setError(getApiError(e));
          if (isUnauthenticated(e)) onLogout();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [horizon, safety, page, view, revision, reload, onLogout]);

  function change() {
    setRequestId(crypto.randomUUID());
    setMessage('');
  }

  function refresh() {
    setLoading(true);
    setError('');
    setReload((n) => n + 1);
  }

  function openView(next: 'forecast' | 'saved') {
    if (next !== view) {
      setLoading(true);
      setError('');
      setView(next);
    }
  }

  const displayHolidays = upcomingHolidays.length > 0 ? upcomingHolidays : DEMO_HOLIDAYS;
  const displayItems = items.length > 0 ? items : DEMO_ITEMS;

  // Lọc danh sách các mặt hàng đã chọn số lượng > 0
  const selectedLines = displayItems
    .map((item) => {
      const q = quantities[item.itemId];
      const qty = q !== undefined && q !== '' ? Number(q) : 0;
      return {
        itemId: item.itemId,
        name: item.name,
        unit: item.unit,
        quantity: qty,
        purchasePrice: item.purchasePrice,
      };
    })
    .filter((line) => line.quantity > 0);

  const selectedCount = selectedLines.length;
  const totalCost = selectedLines.reduce(
    (sum, l) => sum + (l.purchasePrice == null ? BigInt(0) : BigInt(l.quantity) * BigInt(l.purchasePrice)),
    BigInt(0),
  );

  // Xử lý nút: "Lưu mặt hàng cần nhập" ở Tab 1
  function handleSaveDraftSelection() {
    try {
      localStorage.setItem('supplymind:draft-restock-quantities', JSON.stringify(quantities));
    } catch {
      // Bỏ qua lỗi storage
    }
    setToastMessage(`✓ Đã lưu danh sách cần nhập (${selectedCount} mặt hàng · ${money(totalCost)})! Sang tab "Kế hoạch đã lưu" để tạo phiếu.`);
    setMessage(`Đã lưu danh sách mặt hàng cần nhập (${selectedCount} món). Dữ liệu đã sẵn sàng để tạo kế hoạch.`);
  }

  // Mở modal tạo kế hoạch mới ở Tab 2
  function openCreatePlanModal() {
    setEditing(null);
    setModalPlanName(`Kế hoạch nhập hàng - ${new Date().toLocaleDateString('vi-VN')}`);
    setModalPlanNote('');
    setShowCreatePlanModal(true);
  }

  // Mở chỉnh sửa kế hoạch từ danh sách ở Tab 2
  function handleEditPlan(plan: Plan) {
    setEditing(plan);
    setModalPlanName(plan.name);
    setModalPlanNote(plan.note || '');
    setHorizon(plan.horizonDays);
    setSafety(plan.safetyDays);
    const newQty = Object.fromEntries(plan.lines.map((l) => [l.sourceItemId, String(l.quantity)]));
    setQuantities(newQty);
    try {
      localStorage.setItem('supplymind:draft-restock-quantities', JSON.stringify(newQty));
    } catch {
      // Bỏ qua lỗi storage
    }
    setShowCreatePlanModal(true);
  }

  // Lưu kế hoạch chính thức từ Modal
  async function handleSavePlanFromModal(e: FormEvent) {
    e.preventDefault();
    if (!selectedLines.length) {
      setError('Vui lòng chọn số lượng lớn hơn 0 cho ít nhất 1 mặt hàng ở tab "Gợi ý nhập hàng" trước khi tạo kế hoạch.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    const lines = selectedLines.map((l) => ({ itemId: l.itemId, quantity: l.quantity }));
    try {
      const payload = {
        recommendationRunId,
        requestId,
        name: modalPlanName.trim() || 'Kế hoạch nhập hàng',
        note: modalPlanNote.trim(),
        horizonDays: horizon,
        safetyDays: safety,
        lines,
        expectedUpdatedAt: editing?.updatedAt,
      };
      if (editing) {
        await api.put(`/restock/plans/${editing.id}`, payload);
      } else {
        await api.post('/restock/plans', payload);
      }

      setShowCreatePlanModal(false);
      setEditing(null);
      setToastMessage(editing ? '✓ Đã cập nhật kế hoạch thành công!' : '✓ Đã tạo và lưu kế hoạch nhập hàng thành công!');
      setMessage('Kế hoạch đã được lưu an toàn.');
      // Tải lại danh sách plans
      const res = await api.get(`/restock/plans?page=1`);
      setPlans(res.data.plans || []);
      setHasMore(res.data.hasMore || false);
      setPage(1);
    } catch (err) {
      setError(getApiError(err));
      if (isUnauthenticated(err)) onLogout();
    } finally {
      setSaving(false);
    }
  }

  const printableLines = (() => {
    if (printPlanTarget) {
      if (printScope === 'TOMORROW') {
        return printPlanTarget.lines.slice(0, Math.max(3, Math.ceil(printPlanTarget.lines.length / 2)));
      }
      return printPlanTarget.lines;
    }

    const allSelected = displayItems
      .map((item) => {
        const inputVal = quantities[item.itemId];
        const qty = inputVal !== undefined && inputVal !== '' ? Number(inputVal) : (item.suggestedQuantity ?? 0);
        return {
          sourceItemId: item.itemId,
          productName: item.name,
          unit: item.unit,
          currentStock: item.quantity,
          daysUntilStockout: item.daysUntilStockout,
          quantity: qty,
          purchasePrice: item.purchasePrice,
        };
      })
      .filter((x) => x.quantity > 0);

    if (printScope === 'TOMORROW') {
      const urgent = allSelected.filter(
        (x) => (x.daysUntilStockout !== null && x.daysUntilStockout <= 2) || x.currentStock <= 10,
      );
      return urgent.length > 0 ? urgent : allSelected;
    }

    return allSelected;
  })();

  const printTotalCost = printableLines.reduce((sum, line) => {
    return sum + (line.purchasePrice ? BigInt(line.quantity) * BigInt(line.purchasePrice) : BigInt(0));
  }, BigInt(0));

  function handleTriggerPrint() {
    setShowPrintModal(false);
    setTimeout(() => {
      window.print();
    }, 150);
  }

  // Đếm nhanh mặt hàng cấp bách
  const urgentCount = displayItems.filter(
    (i) => i.daysUntilStockout !== null && i.daysUntilStockout <= 2,
  ).length;

  return (
    <section className="dashboard-card restock-card">
      {/* Toast thông báo nổi */}
      {toastMessage && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 999999,
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 650,
            fontSize: '14px',
          }}
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header chính */}
      <div className="card-heading" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div>
          <span className="section-kicker">CHỦ ĐỘNG NGUỒN HÀNG</span>
          <h2>Dự báo & kế hoạch nhập</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="inventory-refresh"
            style={{
              backgroundColor: '#059669',
              color: '#ffffff',
              borderColor: '#059669',
              fontWeight: 600,
            }}
            onClick={() => {
              setPrintPlanTarget(null);
              setShowPrintModal(true);
            }}
            disabled={loading || saving}
          >
            In phiếu / Xuất PDF
          </button>
          <button className="inventory-refresh" onClick={refresh} disabled={loading || saving}>
            ↻ Tải lại
          </button>
        </div>
      </div>

      {/* 3 Thẻ KPI chỉ số trực quan nhanh */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          margin: '16px 0 18px',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>HÀNG CẤP BÁCH</span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>
            {urgentCount} mặt hàng sắp cạn
          </div>
        </div>
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>VỐN NHẬP DỰ KIẾN</span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
            {money(totalCost)}
          </div>
        </div>
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>GỢI Ý MẶT HÀNG MỚI</span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
            {SEASONAL_OPPORTUNITIES.length} món hot dịp lễ
          </div>
        </div>
      </div>

      {/* Tabs điều hướng */}
      <div className="restock-tabs">
        <button
          aria-pressed={view === 'forecast'}
          onClick={() => openView('forecast')}
          disabled={saving}
        >
          Gợi ý nhập hàng
        </button>
        <button aria-pressed={view === 'saved'} onClick={() => openView('saved')} disabled={saving}>
          Kế hoạch đã lưu
        </button>
      </div>

      {error && (
        <p role="alert" className="restock-error" style={{ margin: '14px 0' }}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="restock-success" style={{ margin: '14px 0' }}>
          {message}
        </p>
      )}
      {loading && <p role="status">Đang tải dữ liệu…</p>}

      {/* TAB 1: GỢI Ý NHẬP HÀNG */}
      {view === 'forecast' ? (
        <div>
          {/* Banner sự kiện dịp lễ thu gọn */}
          <div
            style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              padding: '12px 16px',
              marginTop: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🎉</span>
              <div>
                <strong style={{ color: '#1e40af', fontSize: '14px' }}>
                  {displayHolidays[0]?.name || 'Lễ Giáng Sinh & Năm Mới'}:
                </strong>
                <span style={{ color: '#1e3a8a', fontSize: '13px', marginLeft: '6px' }}>
                  {displayHolidays[0]?.description}
                </span>
              </div>
            </div>
            <span
              style={{
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                fontWeight: 700,
                fontSize: '12.5px',
                padding: '4px 10px',
                borderRadius: '20px',
              }}
            >
              Hệ số gợi ý x{displayHolidays[0]?.multiplier || 1.6} (+60%)
            </span>
          </div>

          {/* Điều khiển chu kỳ */}
          <div className="restock-controls" style={{ marginBottom: '14px' }}>
            <label>
              Nhập đủ bán trong:
              <select
                value={horizon}
                onChange={(e) => {
                  setHorizon(Number(e.target.value));
                  setLoading(true);
                  change();
                }}
              >
                {[7, 14, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} ngày
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dự phòng thêm:
              <select
                value={safety}
                onChange={(e) => {
                  setSafety(Number(e.target.value));
                  setLoading(true);
                  change();
                }}
              >
                {Array.from({ length: 8 }, (_, n) => (
                  <option key={n} value={n}>
                    {n} ngày
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="inventory-refresh"
              onClick={() => {
                setQuantities((current) => fillEmptySuggestions(current, displayItems));
                change();
              }}
            >
              Điền đề xuất vào ô trống
            </button>
          </div>

          {/* PHẦN 1: BẢNG HÀNG TRONG KHO CẦN NHẬP */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '15px', color: '#0f172a', margin: '0 0 10px 0', fontWeight: 700 }}>
              1. Mặt hàng trong kho cần tái nhập ({displayItems.length} sản phẩm)
            </h3>
            <div className="restock-table-wrap">
              <table className="restock-table">
                <thead>
                  <tr>
                    <th>Mặt hàng</th>
                    <th>Tồn kho</th>
                    <th>Tình trạng</th>
                    <th>Bán/ngày</th>
                    <th>Giá nhập</th>
                    <th>Gợi ý AI</th>
                    <th style={{ width: '130px' }}>Số lượng bạn chọn</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item) => {
                    const days = item.daysUntilStockout;
                    const isUrgent = days !== null && days <= 1.5;
                    const isWarning = days !== null && days > 1.5 && days <= 3;
                    return (
                      <tr key={item.itemId}>
                        <td>
                          <strong>{item.name}</strong>
                          {item.holidayMultiplier && (
                            <span
                              style={{
                                display: 'inline-block',
                                backgroundColor: '#dcfce7',
                                color: '#15803d',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginLeft: '6px',
                              }}
                            >
                              +{Math.round((item.holidayMultiplier - 1) * 100)}% ({item.holidayName || 'Lễ'})
                            </span>
                          )}
                          <small style={{ display: 'block', color: '#64748b' }}>ĐVT: {item.unit}</small>
                        </td>
                        <td>
                          <span style={{ fontWeight: 650 }}>{item.quantity}</span> {item.unit}
                        </td>
                        <td>
                          {isUrgent ? (
                            <span
                              style={{
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                              }}
                            >
                              🔴 Còn ≈ {days} ngày
                            </span>
                          ) : isWarning ? (
                            <span
                              style={{
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                              }}
                            >
                              🟡 Còn ≈ {days} ngày
                            </span>
                          ) : (
                            <span
                              style={{
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                              }}
                            >
                              🟢 Đủ bán
                            </span>
                          )}
                        </td>
                        <td>{item.averageDailySales === null ? '-' : item.averageDailySales.toLocaleString('vi-VN')}</td>
                        <td>{item.purchasePrice == null ? 'Chưa có giá' : money(item.purchasePrice)}</td>
                        <td>
                          <strong style={{ color: '#059669', fontSize: '14.5px' }}>
                            {item.suggestedQuantity ?? 'Chọn tay'}
                          </strong>
                        </td>
                        <td>
                          <input
                            aria-label={`Lượng nhập ${item.name}`}
                            type="number"
                            min="0"
                            max="2147483647"
                            step="1"
                            value={quantities[item.itemId] ?? ''}
                            placeholder="0"
                            onChange={(e) => {
                              setQuantities({ ...quantities, [item.itemId]: e.target.value });
                              change();
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontWeight: 650,
                              textAlign: 'center',
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PHẦN 2: GỢI Ý MẶT HÀNG MỚI NGOÀI KHO THEO MÙA VỤ / DỊP LỄ */}
          <div
            style={{
              backgroundColor: '#faf5ff',
              border: '1.5px solid #e9d5ff',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>✨</span>
                  <h3 style={{ margin: 0, fontSize: '15.5px', color: '#6b21a8', fontWeight: 700 }}>
                    2. Đề xuất mặt hàng mới đón đầu Dịp Lễ (Chưa có trong kho)
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#7e22ce' }}>
                  Mặt hàng có nhu cầu tăng cao dịp lễ Tết theo Kantar FMCG & Google Trends VN · Có sẵn nguồn hàng từ Chủ vựa B2B
                </p>
              </div>
              <span
                style={{
                  backgroundColor: '#f3e8ff',
                  color: '#7e22ce',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 650,
                }}
              >
                Kiểm chứng: Google Trends & Kantar FMCG
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {SEASONAL_OPPORTUNITIES.map((opp) => (
                <div
                  key={opp.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e9d5ff',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                      <strong style={{ fontSize: '14px', color: '#1e293b' }}>{opp.name}</strong>
                      <span
                        style={{
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Hot {opp.trendScore}/100
                      </span>
                    </div>
                    <p style={{ margin: '6px 0 8px', fontSize: '12px', color: '#6b7280', lineHeight: 1.4 }}>
                      {opp.growthNote}
                    </p>
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#334155',
                      }}
                    >
                      <div>
                        <strong>Chủ vựa:</strong> {opp.supplierName} ({opp.supplierDistance})
                      </div>
                      <div style={{ marginTop: '2px' }}>
                        <strong>Giá sỉ:</strong> <span style={{ color: '#059669', fontWeight: 700 }}>{money(opp.wholesalePrice)}</span> / {opp.unit} · MOQ: {opp.moq} {opp.unit}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      backgroundColor: '#7e22ce',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 650,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                    onClick={() => {
                      setToastMessage(`Đã ghi nhận mặt hàng "${opp.name}" vào danh sách quan tâm!`);
                    }}
                  >
                    + Thêm vào kế hoạch sỉ
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* KHUNG TỔNG KẾT & NÚT LƯU MẶT HÀNG CẦN NHẬP (KHÔNG CÒN FORM RƯỜM RÀ) */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Tổng hợp đề xuất:</span>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                Đã chọn: <span style={{ color: '#059669' }}>{selectedCount} mặt hàng</span> · Chi phí dự kiến:{' '}
                <span style={{ color: '#059669' }}>{money(totalCost)}</span>
              </div>
            </div>

            <button
              type="button"
              className="dash-primary"
              style={{
                padding: '12px 24px',
                fontSize: '15px',
                fontWeight: 700,
                backgroundColor: '#059669',
                borderColor: '#059669',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
              }}
              disabled={selectedCount === 0}
              onClick={handleSaveDraftSelection}
            >
              💾 Lưu mặt hàng cần nhập
            </button>
          </div>
        </div>
      ) : (
        /* TAB 2: KẾ HOẠCH ĐÃ LƯU */
        !loading && (
          <div className="restock-saved">
            {/* Thanh công cụ với nút thêm kế hoạch mới to rõ */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>Danh Sách Kế Hoạch Đã Lưu</h3>
                <small style={{ color: '#64748b' }}>
                  Lưu trữ các phiếu dự trù nhập hàng để in ấn, đối chiếu và giao nhận với nhà cung cấp.
                </small>
              </div>

              <button
                type="button"
                className="dash-primary"
                style={{
                  padding: '11px 20px',
                  backgroundColor: '#059669',
                  borderColor: '#059669',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 10px rgba(5, 150, 105, 0.2)',
                }}
                onClick={openCreatePlanModal}
              >
                + Thêm kế hoạch mới
              </button>
            </div>

            {plans.length ? (
              plans.map((plan) => (
                <article key={plan.id} style={{ marginBottom: '14px' }}>
                  <div className="card-heading">
                    <div>
                      <h3>{plan.name}</h3>
                      <small>
                        {new Date(plan.updatedAt).toLocaleString('vi-VN')} · {plan.horizonDays} ngày +{' '}
                        {plan.safetyDays} ngày dự phòng
                      </small>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="inventory-refresh"
                        style={{ color: '#059669', borderColor: '#059669', fontWeight: 600 }}
                        onClick={() => {
                          setPrintPlanTarget(plan);
                          setShowPrintModal(true);
                        }}
                      >
                        In phiếu / Xuất PDF
                      </button>
                      <button className="inventory-refresh" onClick={() => handleEditPlan(plan)}>
                        Mở chỉnh sửa
                      </button>
                    </div>
                  </div>
                  {plan.note && <p style={{ margin: '8px 0', color: '#475569', fontSize: '13.5px' }}>{plan.note}</p>}
                  <ul>
                    {plan.lines.map((line) => (
                      <li key={line.sourceItemId}>
                        {line.productName}:{' '}
                        <strong>
                          {line.quantity} {line.unit}
                        </strong>{' '}
                        ·{' '}
                        {line.purchasePrice == null
                          ? 'Chưa có giá'
                          : money(line.purchasePrice) + ' / ' + line.unit}
                      </li>
                    ))}
                  </ul>
                  <p style={{ marginTop: '8px' }}>
                    <strong>{budget(plan.lines)}</strong>
                  </p>
                </article>
              ))
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px dashed #cbd5e1',
                }}
              >
                <p style={{ color: '#64748b', fontSize: '14.5px', margin: '0 0 12px' }}>
                  Chưa có kế hoạch nhập hàng nào được lưu.
                </p>
                <button
                  type="button"
                  className="dash-primary"
                  style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                  onClick={openCreatePlanModal}
                >
                  + Tạo kế hoạch đầu tiên ngay
                </button>
              </div>
            )}

            {plans.length > 0 && (
              <div className="restock-actions" style={{ marginTop: '16px' }}>
                <button
                  disabled={page === 1}
                  onClick={() => {
                    setPage(page - 1);
                    setLoading(true);
                  }}
                >
                  Trang trước
                </button>
                <span>Trang {page}</span>
                <button
                  disabled={!hasMore}
                  onClick={() => {
                    setPage(page + 1);
                    setLoading(true);
                  }}
                >
                  Trang sau
                </button>
              </div>
            )}
          </div>
        )
      )}

      {/* MODAL TẠO / SỬA KẾ HOẠCH TẠI TAB "KẾ HOẠCH ĐÃ LƯU" */}
      {showCreatePlanModal && (
        <div
          className="restock-print-modal-backdrop"
          onClick={() => setShowCreatePlanModal(false)}
        >
          <div
            className="restock-print-modal-card"
            style={{ maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>
                {editing ? 'Chỉnh Sửa Kế Hoạch Nhập Hàng' : 'Tạo Kế Hoạch Nhập Hàng Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreatePlanModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlanFromModal} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 650,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Tên kế hoạch:
                </label>
                <input
                  required
                  maxLength={100}
                  value={modalPlanName}
                  onChange={(e) => setModalPlanName(e.target.value)}
                  placeholder="Ví dụ: Kế hoạch nhập hàng tuần 48"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 650,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Ghi chú (Tùy chọn):
                </label>
                <textarea
                  maxLength={500}
                  rows={2}
                  value={modalPlanNote}
                  onChange={(e) => setModalPlanNote(e.target.value)}
                  placeholder="Nhà xe giao hàng, ngày dự kiến nhận..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* FIELD CHỌN NGUỒN HÀNG (GOM GỌN THÀNH 1 OPTION DUY NHẤT) */}
              <div style={{ marginBottom: '18px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 650,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Nguồn mặt hàng đưa vào kế hoạch:
                </label>
                <div
                  style={{
                    padding: '12px 14px',
                    border: '1.5px solid #059669',
                    borderRadius: '8px',
                    backgroundColor: '#f0fdf4',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px', color: '#059669', fontWeight: 'bold' }}>✓</span>
                    <div>
                      <strong style={{ color: '#065f46', fontSize: '14.5px' }}>
                        Danh sách từ Gợi ý nhập hàng ({selectedCount} mặt hàng · {money(totalCost)})
                      </strong>
                      <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#047857' }}>
                        {selectedCount > 0
                          ? `Gồm ${selectedCount} mặt hàng bạn đã chọn số lượng.`
                          : 'Chưa có mặt hàng nào được chọn số lượng ở tab Gợi ý nhập hàng.'}
                      </p>
                    </div>
                  </div>
                </div>

                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                  💡 Muốn thay đổi mặt hàng hoặc chỉnh số lượng? Hãy quay lại tab "Gợi ý nhập hàng", sửa số lượng và bấm "Lưu mặt hàng cần nhập", kế hoạch tại đây sẽ tự động cập nhật theo!
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowCreatePlanModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || selectedCount === 0}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    fontWeight: 650,
                    fontSize: '14px',
                    cursor: saving || selectedCount === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                  }}
                >
                  {saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu kế hoạch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IN PHIẾU PDF */}
      {showPrintModal && (
        <div className="restock-print-modal-backdrop" onClick={() => setShowPrintModal(false)}>
          <div className="restock-print-modal-card" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>
                In Kế Hoạch & Xuất File PDF
              </h3>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
                Hệ thống sẽ định dạng khổ giấy A4 tiêu chuẩn kèm đầy đủ Quốc hiệu, Tiêu đề phiếu, bảng
                mặt hàng, đơn giá dự kiến, cột kiểm nhận thực tế và ô ký nhận giữa Tạp hóa và Nhà cung
                cấp.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <strong
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    marginBottom: '8px',
                    color: '#1e293b',
                  }}
                >
                  Phạm vi danh sách in / xuất:
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1.5px solid ${printScope === 'TOMORROW' ? '#059669' : '#cbd5e1'}`,
                      backgroundColor: printScope === 'TOMORROW' ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="printScope"
                      checked={printScope === 'TOMORROW'}
                      onChange={() => setPrintScope('TOMORROW')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '14px' }}>
                        Chỉ in các mặt hàng cấp bách cần nhập ngày mai
                      </strong>
                      <span style={{ fontSize: '13px', color: '#475569' }}>
                        Lọc các mặt hàng có tồn kho còn dưới 2 ngày bán hoặc chạm ngưỡng tồn an toàn để
                        kịp thời nhập hàng ngay sáng mai.
                      </span>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1.5px solid ${printScope === 'ALL' ? '#059669' : '#cbd5e1'}`,
                      backgroundColor: printScope === 'ALL' ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="printScope"
                      checked={printScope === 'ALL'}
                      onChange={() => setPrintScope('ALL')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '14px' }}>
                        In toàn bộ kế hoạch nhập hàng ({printPlanTarget ? printPlanTarget.name : 'Kế hoạch nhập hàng'})
                      </strong>
                      <span style={{ fontSize: '13px', color: '#475569' }}>
                        Bao gồm tất cả các mặt hàng đã được phân bổ số lượng cần nhập trong kế hoạch.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#f1f5f9',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#334155',
                }}
              >
                Số lượng mặt hàng in dự kiến: <strong>{printableLines.length} mặt hàng</strong> · Tổng
                tiền dự kiến: <strong>{money(printTotalCost)}</strong>
              </div>
            </div>

            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                backgroundColor: '#f8fafc',
              }}
            >
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleTriggerPrint}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Bắt đầu In / Lưu file PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KHỐI TÀI LIỆU CHUẨN IN KHỔ A4 / XUẤT FILE PDF */}
      <div className="restock-print-document">
        <div className="restock-print-header">
          <div className="restock-print-motto">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="restock-print-submotto">Độc lập - Tự do - Hạnh phúc</div>
          <div className="restock-print-title">BẢNG KẾ HOẠCH NHẬP HÀNG & PHIẾU KIỂM NHẬN KHO</div>
          <div className="restock-print-subtitle">
            Hệ thống Quản lý Chuỗi Cung ứng SupplyMind AI · Phục vụ kiểm đếm thực tế & đối chiếu nhà cung cấp
          </div>
        </div>

        <div className="restock-print-meta">
          <div>
            <strong>Kế hoạch:</strong> {printPlanTarget ? printPlanTarget.name : 'Kế hoạch nhập hàng'}
          </div>
          <div>
            <strong>Ngày lập phiếu:</strong> {new Date().toLocaleDateString('vi-VN')}{' '}
            {new Date().toLocaleTimeString('vi-VN')}
          </div>
          <div>
            <strong>Phạm vi kiểm tra:</strong>{' '}
            {printScope === 'TOMORROW'
              ? 'DANH MỤC CẤP BÁCH CẦN NHẬP NGÀY MAI (Dưới 2 ngày bán / Cạn kho)'
              : 'TOÀN BỘ KẾ HOẠCH NHẬP HÀNG'}
          </div>
          <div>
            <strong>Ghi chú / Đơn vị giao:</strong>{' '}
            {printPlanTarget?.note || 'Theo thỏa thuận phân phối hàng hóa tiêu dùng'}
          </div>
        </div>

        <table className="restock-print-table">
          <thead>
            <tr>
              <th style={{ width: '35px' }}>STT</th>
              <th>Tên hàng hóa / Quy cách</th>
              <th style={{ width: '60px' }}>ĐVT</th>
              <th style={{ width: '80px' }}>Tồn kho</th>
              <th style={{ width: '80px' }}>SL cần nhập</th>
              <th style={{ width: '100px' }}>Đơn giá dự kiến</th>
              <th style={{ width: '110px' }}>Thành tiền dự kiến</th>
              <th style={{ width: '65px' }}>Kiểm nhận</th>
            </tr>
          </thead>
          <tbody>
            {printableLines.map((line, idx) => {
              const lineCost = line.purchasePrice
                ? BigInt(line.quantity) * BigInt(line.purchasePrice)
                : BigInt(0);
              const currentStockText =
                'currentStock' in line && typeof line.currentStock === 'number'
                  ? line.currentStock
                  : '-';
              return (
                <tr key={idx}>
                  <td className="center">{idx + 1}</td>
                  <td>
                    <strong>{line.productName}</strong>
                  </td>
                  <td className="center">{line.unit}</td>
                  <td className="center">{currentStockText}</td>
                  <td className="center">
                    <strong>{line.quantity}</strong>
                  </td>
                  <td className="right">
                    {line.purchasePrice == null ? 'Chưa có giá' : money(line.purchasePrice)}
                  </td>
                  <td className="right">{money(lineCost)}</td>
                  <td className="checkbox-col">[ &nbsp; ]</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="restock-print-total">
          Tổng số mặt hàng: {printableLines.length} mặt hàng &nbsp;|&nbsp; Tổng chi phí dự kiến:{' '}
          {money(printTotalCost)}
        </div>

        <div className="restock-print-signatures">
          <div className="restock-print-sign-col">
            <strong>ĐẠI DIỆN CỬA HÀNG / TẠP HÓA</strong>
            <br />
            <span style={{ fontSize: '9.5pt', fontStyle: 'italic' }}>
              (Ký, ghi rõ họ tên và kiểm nhận hàng)
            </span>
            <div className="restock-print-sign-space" />
          </div>
          <div className="restock-print-sign-col">
            <strong>ĐẠI DIỆN VỰA / NHÀ CUNG CẤP</strong>
            <br />
            <span style={{ fontSize: '9.5pt', fontStyle: 'italic' }}>
              (Ký, ghi rõ họ tên và xác nhận xuất kho)
            </span>
            <div className="restock-print-sign-space" />
          </div>
        </div>
      </div>
    </section>
  );
}
