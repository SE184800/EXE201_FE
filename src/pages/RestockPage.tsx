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
    name: 'Lễ Giáng Sinh & Chào Đón Năm Mới (Mô Phỏng Demo AI)',
    categories: ['Bia', 'Nước giải khát', 'Bánh kẹo', 'Rượu', 'Snack'],
    multiplier: 1.6,
    description:
      'Dự báo tiệc cuối năm & lễ hội làm nhu cầu Đồ uống, Bia & Bánh kẹo tăng vọt (+60%).',
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
  const [horizon, setHorizon] = useState(7),
    [safety, setSafety] = useState(2);
  const [items, setItems] = useState<Forecast[]>([]),
    [quantities, setQuantities] = useState<Record<number, string>>({});
  const [upcomingHolidays, setUpcomingHolidays] = useState<Holiday[]>([]);
  const [name, setName] = useState('Kế hoạch nhập hàng'),
    [note, setNote] = useState('');
  const [editing, setEditing] = useState<Plan | null>(null);
  const [recommendationRunId, setRecommendationRunId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [plans, setPlans] = useState<Plan[]>([]),
    [page, setPage] = useState(1),
    [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [reload, setReload] = useState(0);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printScope, setPrintScope] = useState<'TOMORROW' | 'ALL'>('TOMORROW');
  const [printPlanTarget, setPrintPlanTarget] = useState<Plan | null>(null);

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
          setPlans(data.plans);
          setHasMore(data.hasMore);
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

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const lines = Object.entries(quantities)
      .filter(([, q]) => q !== '' && Number(q) !== 0)
      .map(([itemId, quantity]) => ({ itemId: Number(itemId), quantity: Number(quantity) }));
    try {
      const payload = {
        recommendationRunId,
        requestId,
        name,
        note,
        horizonDays: horizon,
        safetyDays: safety,
        lines,
        expectedUpdatedAt: editing?.updatedAt,
      };
      const { data } = editing
        ? await api.put(`/restock/plans/${editing.id}`, payload)
        : await api.post('/restock/plans', payload);
      setEditing(data.plan);
      setMessage('Đã lưu kế hoạch. Tồn kho không thay đổi.');
    } catch (e) {
      setError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      setSaving(false);
    }
  }

  function edit(plan: Plan) {
    setEditing(plan);
    setName(plan.name);
    setNote(plan.note);
    setHorizon(plan.horizonDays);
    setSafety(plan.safetyDays);
    setQuantities(
      Object.fromEntries(plan.lines.map((line) => [line.sourceItemId, String(line.quantity)])),
    );
    change();
    openView('forecast');
  }

  const displayHolidays = upcomingHolidays.length > 0 ? upcomingHolidays : DEMO_HOLIDAYS;
  const displayItems = items.length > 0 ? items : DEMO_ITEMS;

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
        const qty =
          inputVal !== undefined && inputVal !== ''
            ? Number(inputVal)
            : (item.suggestedQuantity ?? 0);
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
        (x) =>
          (x.daysUntilStockout !== null && x.daysUntilStockout <= 2) ||
          x.currentStock <= 10,
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

  return (
    <section className="dashboard-card restock-card">
      <div className="card-heading">
        <div>
          <span className="section-kicker">CHỦ ĐỘNG NGUỒN HÀNG</span>
          <h2>Dự báo & kế hoạch nhập</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
        <p role="alert" className="restock-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="restock-success">
          {message}
        </p>
      )}
      {loading && <p role="status">Đang tải dữ liệu…</p>}

      {view === 'forecast' ? (
        <form onSubmit={(e) => void save(e)}>
          <fieldset disabled={saving || loading}>
            {/* BANNER NGÀY LỄ DEMO - CHỈ HIỂN THỊ TẠI TAB GỢI Ý NHẬP HÀNG */}
            <div
              style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                borderLeft: '5px solid #2563eb',
                padding: '14px 18px',
                borderRadius: '8px',
                marginTop: '10px',
                marginBottom: '16px',
                color: '#1e3a8a',
                boxShadow: '0 2px 6px rgba(37,99,235,0.1)',
              }}
            >
              <strong style={{ fontSize: '15.5px', color: '#1d4ed8' }}>
                AI CẢNH BÁO LỊCH NGÀY LỄ (DEMO CHẾ ĐỘ GIÁNG SINH & NĂM MỚI):
              </strong>
              {displayHolidays.map((h) => (
                <p
                  key={h.id}
                  style={{ margin: '6px 0 0 0', fontSize: '13.5px', lineHeight: '1.5' }}
                >
                  • <strong>{h.name}</strong> (
                  {h.isCurrent ? 'Đang diễn ra' : `còn ${h.daysUntil} ngày nữa`}): {h.description}
                  <span style={{ color: '#059669', fontWeight: 'bold', marginLeft: '6px' }}>
                    (Hệ số gợi ý nhập x{h.multiplier})
                  </span>
                </p>
              ))}
            </div>

            <p className="restock-explanation">
              Ước tính thống kê từ tối đa 30 ngày trọn vẹn gần nhất, kết hợp mô hình{' '}
              <strong>Lịch Ngày Lễ tại Việt Nam</strong> để tự động điều chỉnh tăng số lượng gợi ý
              nhập hàng.
            </p>

            <div className="restock-controls">
              <label>
                Nhập đủ bán trong
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
                Dự phòng thêm
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

            <div className="restock-table-wrap">
              <table className="restock-table">
                <thead>
                  <tr>
                    <th>Mặt hàng</th>
                    <th>Tồn kho</th>
                    <th>Bán/ngày</th>
                    <th>Còn đủ bán</th>
                    <th>Giá nhập</th>
                    <th>Gợi ý nhập</th>
                    <th>Số lượng bạn chọn</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item) => (
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
                            +{Math.round((item.holidayMultiplier - 1) * 100)}% (
                            {item.holidayName || 'Dịp Lễ'})
                          </span>
                        )}
                        <small style={{ display: 'block', color: '#6b7280' }}>{item.unit}</small>
                        <details>
                          <summary>Cơ sở ước tính</summary>
                          {item.notes.map((text) => (
                            <p key={text}>{text}</p>
                          ))}
                        </details>
                      </td>
                      <td>{item.quantity}</td>
                      <td>
                        {item.averageDailySales === null
                          ? 'Chưa đủ dữ liệu'
                          : item.averageDailySales.toLocaleString('vi-VN')}
                      </td>
                      <td>
                        {item.daysUntilStockout === null
                          ? 'Chưa xác định'
                          : `≈ ${item.daysUntilStockout.toLocaleString('vi-VN')} ngày`}
                      </td>
                      <td>
                        {item.purchasePrice == null ? 'Chưa có giá' : money(item.purchasePrice)}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: item.holidayMultiplier ? 'bold' : 'normal',
                            color: item.holidayMultiplier ? '#059669' : 'inherit',
                          }}
                        >
                          {item.suggestedQuantity ?? 'Chọn thủ công'}
                        </span>
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
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="restock-success">
              {budget(
                displayItems.map((item) => ({
                  quantity: Number(quantities[item.itemId] ?? 0),
                  purchasePrice: item.purchasePrice,
                })),
              )}
            </p>

            <div className="restock-draft">
              <h3>{editing ? 'Chỉnh kế hoạch đã lưu' : 'Kế hoạch mới'}</h3>
              <label>
                Tên kế hoạch
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    change();
                  }}
                />
              </label>
              <label>
                Ghi chú
                <textarea
                  maxLength={500}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    change();
                  }}
                  placeholder="Nhà cung cấp, ngày dự kiến nhập…"
                />
              </label>
              <p>
                Chọn số lượng lớn hơn 0 để đưa vào kế hoạch. Chi phí chưa gồm vận chuyển, chiết
                khấu. Giá nhập được chụp lại lúc lưu; mở sửa và lưu lại sẽ dùng giá hiện tại. Lưu kế
                hoạch không đặt mua hàng hay cộng hàng vào kho.
              </p>
              <div className="restock-actions">
                <button className="dash-primary" disabled={!displayItems.length}>
                  {saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu kế hoạch'}
                </button>
                <button
                  type="button"
                  className="inventory-refresh"
                  onClick={() => {
                    setEditing(null);
                    setName('Kế hoạch nhập hàng');
                    setNote('');
                    setQuantities({});
                    change();
                  }}
                >
                  Tạo kế hoạch mới
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      ) : (
        !loading && (
          <div className="restock-saved">
            {plans.length ? (
              plans.map((plan) => (
                <article key={plan.id}>
                  <div className="card-heading">
                    <div>
                      <h3>{plan.name}</h3>
                      <small>
                        {new Date(plan.updatedAt).toLocaleString('vi-VN')} · {plan.horizonDays} ngày
                        + {plan.safetyDays} ngày dự phòng
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
                      <button className="inventory-refresh" onClick={() => edit(plan)}>
                        Mở chỉnh sửa
                      </button>
                    </div>
                  </div>
                  {plan.note && <p>{plan.note}</p>}
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
                  <p>
                    <strong>{budget(plan.lines)}</strong>
                  </p>
                </article>
              ))
            ) : (
              <p>Chưa có kế hoạch đã lưu.</p>
            )}
            <div className="restock-actions">
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
          </div>
        )
      )}

      {/* Modal Lựa chọn In Phiếu / Xuất File PDF */}
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
                        In toàn bộ kế hoạch nhập hàng ({printPlanTarget ? printPlanTarget.name : name})
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
            <strong>Kế hoạch:</strong> {printPlanTarget ? printPlanTarget.name : name}
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
            {printPlanTarget?.note || note || 'Theo thỏa thuận phân phối hàng hóa tiêu dùng'}
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
