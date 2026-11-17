import DatePicker from '../../components/DatePicker';
import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import SupplierLayout from '../../components/SupplierLayout';
import ExportSalesDialog from '../../components/ExportSalesDialog';
import ExportDropdown from '../../components/ExportDropdown';
import { exportSalesToExcel, exportSalesToPdf } from '../../utils/exportSales';
import { getApiError, isUnauthenticated } from '../../services/api';
import {
  getSupplierRevenue,
  vietnamDay,
  vnd,
  type StoreRevenueReport,
} from '../../services/storeRevenue.api';
import type { AuthUser } from '../../types/auth';
import '../store-revenue.css';

const shortDay = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;
const fullDay = (value: string) => `${shortDay(value)}/${value.slice(0, 4)}`;

function addDays(iso: string, days: number): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function getDaysDiff(fromIso: string, toIso: string): number {
  if (!fromIso || !toIso) return 0;
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

function vietnameseDayText(iso: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(d)} tháng ${Number(m)}, ${y}`;
}

function formatShortMoney(value: bigint) {
  const num = Number(value);
  if (num === 0) return '0 ₫';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace('.0', '')} tỷ`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace('.0', '')} tr`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)} k`;
  return `${num} ₫`;
}

export default function SupplierRevenue({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const today = vietnamDay();
  const [range, setRange] = useState(() => ({
    from: today.slice(0, 8) + '01',
    to: today,
  }));
  const [draft, setDraft] = useState(range);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<StoreRevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  // Trạng thái hover trên cột biểu đồ
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  // Ẩn / hiện bảng số liệu từng ngày
  const [showDailyTable, setShowDailyTable] = useState(false);

  // Mở rộng chi tiết bán hàng theo ngày
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Phân trang danh sách ngày bán
  const DAYS_PER_PAGE = 7;
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageInput, setSalesPageInput] = useState('1');

  async function loadFullReport(from: string, to: string): Promise<StoreRevenueReport | null> {
    try {
      return await getSupplierRevenue(from, to, 1);
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    getSupplierRevenue(range.from, range.to, 1, controller.signal)
      .then((report) => {
        if (active) {
          setData(report);
          setError('');
          if (report?.sales?.length) {
            const firstDay = vietnamDay(new Date(report.sales[0].createdAt));
            setExpandedDays(new Set([firstDay]));
          }
        }
      })
      .catch((issue: unknown) => {
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
      controller.abort();
    };
  }, [range, reload, onLogout]);

  function handleFromChange(val: string) {
    const clampedFrom = val > today ? today : val;
    setDraft((prev) => {
      const maxToForFrom = addDays(clampedFrom, 31);
      const capTo = maxToForFrom > today ? today : maxToForFrom;
      let nextTo = prev.to;
      if (!nextTo || nextTo < clampedFrom || nextTo > capTo) {
        nextTo = capTo;
      }
      return { from: clampedFrom, to: nextTo };
    });
    setFilterError('');
  }

  function handleToChange(val: string) {
    const clampedTo = val > today ? today : val;
    setDraft((prev) => {
      const minFromForTo = addDays(clampedTo, -31);
      let nextFrom = prev.from;
      if (!nextFrom || nextFrom > clampedTo || nextFrom < minFromForTo) {
        nextFrom = minFromForTo;
      }
      return { from: nextFrom, to: clampedTo };
    });
    setFilterError('');
  }

  function apply(next: typeof range) {
    const from = next.from > today ? today : next.from;
    const to = next.to > today ? today : next.to;
    if (!from || !to || from > to) {
      setFilterError('Ngày bắt đầu không được sau ngày kết thúc.');
      return;
    }
    const diff = getDaysDiff(from, to);
    if (diff > 31) {
      setFilterError('Khoảng thời gian xem báo cáo tối đa là 31 ngày (1 tháng) để biểu đồ hiển thị rõ ràng nhất.');
      return;
    }
    setFilterError('');
    setDraft({ from, to });
    setLoading(true);
    setSalesPage(1);
    setSalesPageInput('1');
    setRange({ from, to });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    apply(draft);
  }

  function refresh() {
    setLoading(true);
    setReload((value) => value + 1);
  }

  // Nhóm các giao dịch bán hàng theo ngày
  const salesByDay = useMemo(() => {
    if (!data?.sales) return [];
    const map = new Map<
      string,
      {
        day: string;
        dayFormatted: string;
        totalRevenue: bigint;
        items: typeof data.sales;
      }
    >();

    for (const sale of data.sales) {
      const d = new Date(sale.createdAt);
      const dayStr = vietnamDay(d);
      if (!map.has(dayStr)) {
        map.set(dayStr, {
          day: dayStr,
          dayFormatted: fullDay(dayStr),
          totalRevenue: 0n,
          items: [],
        });
      }
      const group = map.get(dayStr)!;
      if (sale.revenue) {
        group.totalRevenue += BigInt(sale.revenue);
      }
      group.items.push(sale);
    }

    return Array.from(map.values()).sort((a, b) => b.day.localeCompare(a.day));
  }, [data?.sales]);

  // Phân trang cho các ngày bán
  const totalSalesPages = Math.max(1, Math.ceil(salesByDay.length / DAYS_PER_PAGE));
  const paginatedDays = useMemo(() => {
    return salesByDay.slice((salesPage - 1) * DAYS_PER_PAGE, salesPage * DAYS_PER_PAGE);
  }, [salesByDay, salesPage, DAYS_PER_PAGE]);

  function toggleDay(day: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function toggleAllDays() {
    if (expandedDays.size === salesByDay.length) {
      setExpandedDays(new Set());
    } else {
      setExpandedDays(new Set(salesByDay.map((g) => g.day)));
    }
  }

  // Đỉnh trục Y cho biểu đồ
  const maxChartValue = useMemo(() => {
    if (!data?.daily?.length) return 1_000_000n;
    let max = 1_000_000n;
    for (const d of data.daily) {
      const rev = BigInt(d.revenue || '0');
      const cost = BigInt(d.purchaseCost || '0');
      if (rev > max) max = rev;
      if (cost > max) max = cost;
    }
    const buffer = (max * 110n) / 100n;
    return buffer > 0n ? buffer : 1_000_000n;
  }, [data?.daily]);

  // 4 mốc nhãn cho trục Y (100%, 66%, 33%, 0%)
  const yTicks = useMemo(() => {
    const top = maxChartValue;
    return [top, (top * 2n) / 3n, top / 3n, 0n];
  }, [maxChartValue]);

  return (
    <SupplierLayout user={user} onLogout={onLogout} activeNav="revenue" pageTitle="Doanh thu bán sỉ">
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '20px 24px' }}>
        <section className="store-revenue" aria-label="Doanh thu gian hàng sỉ">
          {/* Tiêu đề & tác vụ */}
          <header className="dashboard-title">
            <div>
              <p className="dashboard-eyebrow">HIỆU QUẢ KINH DOANH</p>
              <h1>Doanh thu bán sỉ</h1>
              <p>Theo dõi doanh số các đơn hàng bán sỉ của riêng chủ vựa bạn.</p>
            </div>
            <div
              className="dashboard-title-actions"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
            >
              <ExportDropdown
                label="Xuất báo cáo"
                onOpenModal={() => setExportOpen(true)}
                onExportExcel={async () => {
                  const full = await loadFullReport(range.from, range.to);
                  if (full) {
                    exportSalesToExcel({
                      from: range.from,
                      to: range.to,
                      storeName: 'Gian hàng sỉ của bạn',
                      summary: full.summary,
                      topProducts: full.topProducts,
                      sales: full.sales,
                    });
                  }
                }}
                onExportPdf={async () => {
                  const full = await loadFullReport(range.from, range.to);
                  if (full) {
                    await exportSalesToPdf({
                      from: range.from,
                      to: range.to,
                      storeName: 'Gian hàng sỉ của bạn',
                      summary: full.summary,
                      topProducts: full.topProducts,
                      sales: full.sales,
                    });
                  }
                }}
              />
              <Link className="dash-primary" to="/supplier/orders">
                <Icon name="box" /> Quản lý đơn hàng
              </Link>
            </div>
          </header>

          {/* Bộ chọn ngày gọn gàng (Đồng bộ với tab tạp hóa) */}
          <div className="dashboard-card revenue-filters">
            <form onSubmit={submit}>
              <label>
                Từ ngày
                <DatePicker
                  required
                  min={draft.to ? addDays(draft.to, -31) : undefined}
                  max={draft.to && draft.to < today ? draft.to : today}
                  value={draft.from}
                  onChange={handleFromChange}
                />
                {draft.from && (
                  <span style={{ fontSize: '11.5px', color: '#166534', fontWeight: 600 }}>
                    {vietnameseDayText(draft.from)}
                  </span>
                )}
              </label>
              <label>
                Đến ngày
                <DatePicker
                  required
                  min={draft.from || undefined}
                  max={
                    draft.from
                      ? addDays(draft.from, 31) < today
                        ? addDays(draft.from, 31)
                        : today
                      : today
                  }
                  value={draft.to}
                  onChange={handleToChange}
                />
                {draft.to && (
                  <span style={{ fontSize: '11.5px', color: '#166534', fontWeight: 600 }}>
                    {vietnameseDayText(draft.to)}
                  </span>
                )}
              </label>
              <button className="dash-primary" type="submit" style={{ alignSelf: 'center', marginTop: '14px' }}>
                Xem báo cáo
              </button>
            </form>
            {filterError && (
              <p className="error-notice" role="alert" style={{ margin: 0 }}>
                {filterError}
              </p>
            )}
          </div>

          {loading ? (
            <div className="dashboard-card revenue-loading" role="status">
              Đang tải dữ liệu kinh doanh…
            </div>
          ) : error ? (
            <div className="error-notice" role="alert">
              {error}{' '}
              <button className="text-button" onClick={refresh}>
                Thử lại
              </button>
            </div>
          ) : (
            data && (
              <>
                {/* Bộ 4 Thẻ KPI Tổng Hợp (Đồng bộ giao diện) */}
                <div className="revenue-metrics">
                  {/* Thẻ Doanh thu */}
                  <article className="dashboard-card revenue-total">
                    <span>Doanh thu bán sỉ</span>
                    <strong>{vnd(data.summary.revenue)}</strong>
                  </article>

                  {/* Thẻ Tiền nhập hàng */}
                  <article
                    className="dashboard-card"
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fef08a',
                    }}
                  >
                    <span style={{ color: '#854d0e' }}>Tiền nhập hàng</span>
                    <strong style={{ color: '#b45309' }}>
                      {vnd(data.summary.purchaseCost || 0)}
                    </strong>
                  </article>

                  {/* Thẻ Lượt bán sỉ */}
                  <article className="dashboard-card">
                    <span>Đơn sỉ đã bán</span>
                    <strong>{data.summary.salesCount.toLocaleString('vi-VN')}</strong>
                  </article>

                  {/* Thẻ Mặt hàng đã bán */}
                  <article className="dashboard-card">
                    <span>Mặt hàng đã bán</span>
                    <strong>{data.summary.productCount.toLocaleString('vi-VN')}</strong>
                  </article>
                </div>

                {/* Biểu đồ Nhịp bán hàng theo ngày (Fit 100% khung hình, có trục tung trục hoành) */}
                <section className="dashboard-card chart-card">
                  <div className="chart-header">
                    <div>
                      <span className="section-kicker">THEO NGÀY</span>
                      <h2>Nhịp bán hàng & Nhập hàng</h2>
                    </div>
                    <div className="chart-legend">
                      <div className="legend-item">
                        <span className="legend-dot" style={{ background: '#15803d' }} />
                        <span>Doanh thu bán</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot" style={{ background: '#ea580c' }} />
                        <span>Tiền nhập hàng</span>
                      </div>
                    </div>
                  </div>

                  {/* Khung biểu đồ có trục tung trục hoành */}
                  <div className="chart-container-with-axes">
                    {/* Trục tung Y bên trái */}
                    <div className="chart-y-axis">
                      {yTicks.map((tick, idx) => (
                        <span key={idx} className="chart-y-label">
                          {formatShortMoney(tick)}
                        </span>
                      ))}
                    </div>

                    {/* Vùng vẽ các cột tự động co giãn vừa vặn 100% khung hình */}
                    <div className="chart-plot-area-wrapper">
                      {/* Đường kẻ ngang gióng trục Y */}
                      <div className="chart-grid-lines">
                        <div className="chart-grid-line" />
                        <div className="chart-grid-line" />
                        <div className="chart-grid-line" />
                        <div className="chart-grid-line" />
                      </div>

                      {/* Các cột ngày co giãn 100% */}
                      <div className="chart-bars-scroll">
                        {data.daily.map((day, idx) => {
                          const totalDays = data.daily.length;
                          const revBig = BigInt(day.revenue || '0');
                          const costBig = BigInt(day.purchaseCost || '0');
                          const revHeight =
                            Number((revBig * 100n) / (maxChartValue > 0n ? maxChartValue : 1n));
                          const costHeight =
                            Number((costBig * 100n) / (maxChartValue > 0n ? maxChartValue : 1n));
                          const isHovered = hoveredDay === day.day;
                          const profit = revBig - costBig;

                          // Nhãn ngày thông minh
                          const step = totalDays <= 12 ? 1 : totalDays <= 22 ? 2 : totalDays <= 32 ? 3 : 5;
                          const isMajorLabel = idx === 0 || idx === totalDays - 1 || idx % step === 0;

                          // Tránh tooltip bị cắt mép
                          const isNearLeft = idx <= 2;
                          const isNearRight = totalDays - idx <= 3;

                          return (
                            <div
                              className="chart-day-column"
                              key={day.day}
                              onMouseEnter={() => setHoveredDay(day.day)}
                              onMouseLeave={() => setHoveredDay(null)}
                            >
                              {/* Tooltip Popup hiện đại khi hover vào cột */}
                              {isHovered && (
                                <div
                                  className="chart-tooltip-popup"
                                  style={{
                                    left: isNearLeft ? '0' : isNearRight ? 'auto' : '50%',
                                    right: isNearRight ? '0' : 'auto',
                                    transform: isNearLeft || isNearRight ? 'none' : 'translateX(-50%)',
                                  }}
                                >
                                  <div className="tooltip-title">📅 Ngày {fullDay(day.day)}</div>
                                  <div className="tooltip-row">
                                    <span style={{ color: '#4ade80' }}>🟢 Doanh thu:</span>
                                    <strong>+{vnd(revBig)}</strong>
                                  </div>
                                  <div className="tooltip-row">
                                    <span style={{ color: '#fb923c' }}>🟠 Tiền nhập:</span>
                                    <strong>-{vnd(costBig)}</strong>
                                  </div>
                                  <div
                                    className="tooltip-row"
                                    style={{
                                      borderTop: '1px solid #334155',
                                      paddingTop: '4px',
                                      marginTop: '4px',
                                      color: profit >= 0n ? '#86efac' : '#f87171',
                                    }}
                                  >
                                    <span>⚖️ Chênh lệch:</span>
                                    <strong>
                                      {profit >= 0n ? '+' : ''}
                                      {vnd(profit)}
                                    </strong>
                                  </div>
                                  <div className="tooltip-row" style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    <span>Lượt bán:</span>
                                    <span>{day.salesCount} lượt</span>
                                  </div>
                                </div>
                              )}

                              {/* 2 Cột: Bán (Xanh lá) & Nhập (Cam) */}
                              <div className="chart-bars-group">
                                <div
                                  className="bar-revenue"
                                  style={{
                                    height: `${Math.max(revBig > 0n ? 4 : 0, Math.min(100, revHeight))}%`,
                                  }}
                                />
                                <div
                                  className="bar-purchase"
                                  style={{
                                    height: `${Math.max(costBig > 0n ? 4 : 0, Math.min(100, costHeight))}%`,
                                  }}
                                />
                              </div>

                              {/* Nhãn ngày trục hoành X */}
                              <span
                                className="chart-day-label"
                                style={{
                                  opacity: isMajorLabel || isHovered ? 1 : 0,
                                  fontWeight: isHovered ? 700 : 600,
                                  color: isHovered ? '#166534' : '#475569',
                                }}
                              >
                                {shortDay(day.day)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Nút Xem số liệu từng ngày to, nổi bật */}
                  <div style={{ marginTop: '18px' }}>
                    <button
                      type="button"
                      onClick={() => setShowDailyTable((v) => !v)}
                      className="ghost-button"
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 650,
                        padding: '9px 18px',
                        borderRadius: '9px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        color: '#166534',
                        border: '1px solid #bbf7d0',
                        background: showDailyTable ? '#dcfce7' : '#f0fdf4',
                      }}
                    >
                      <span style={{ fontSize: '15px' }}>📊</span>
                      <span>
                        {showDailyTable ? 'Thu gọn số liệu từng ngày' : 'Xem số liệu từng ngày'}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          transition: 'transform 0.2s',
                          transform: showDailyTable ? 'rotate(180deg)' : 'none',
                        }}
                      >
                        ▼
                      </span>
                    </button>
                  </div>

                  {/* Bảng số liệu từng ngày gọn gàng (4 cột chuẩn, không có cột Lợi nhuận) */}
                  {showDailyTable && (
                    <div
                      className="inventory-table-wrap"
                      style={{
                        marginTop: '16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        maxHeight: '340px',
                        overflowY: 'auto',
                      }}
                    >
                      <table className="inventory-table" style={{ margin: 0 }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f8fafc' }}>
                          <tr>
                            <th style={{ width: '130px' }}>Ngày</th>
                            <th>Doanh thu bán</th>
                            <th>Tiền nhập hàng</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>Lượt bán</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.daily.map((day) => {
                            const rev = BigInt(day.revenue || '0');
                            const cost = BigInt(day.purchaseCost || '0');
                            return (
                              <tr key={day.day}>
                                <td style={{ fontWeight: 600, color: '#1e293b' }}>
                                  {fullDay(day.day)}
                                </td>
                                <td className="revenue-money">+{vnd(rev)}</td>
                                <td style={{ color: '#c2410c', fontWeight: 600 }}>
                                  {cost > 0n ? `-${vnd(cost)}` : '0 ₫'}
                                </td>
                                <td style={{ textAlign: 'center', color: '#475569' }}>
                                  {day.salesCount}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Bảng Top 10 mặt hàng bán nhiều tiền nhất */}
                <section className="dashboard-card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">10 MẶT HÀNG NỔI BẬT</span>
                      <h2>Bán sỉ nhiều tiền nhất</h2>
                    </div>
                  </div>
                  {!data.topProducts.length ? (
                    <p className="revenue-note">Chưa có dữ liệu bán hàng.</p>
                  ) : (
                    <div className="inventory-table-wrap">
                      <table className="inventory-table">
                        <thead>
                          <tr>
                            <th>Sản phẩm / quy cách</th>
                            <th>Số lượng bán</th>
                            <th>Doanh thu đã ghi nhận</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.topProducts.map((product) => (
                            <tr key={`${product.itemId}-${product.productName}-${product.unit}`}>
                              <td>
                                <strong>{product.productName}</strong>
                                <small>{product.unit}</small>
                              </td>
                              <td>
                                {BigInt(product.quantity).toLocaleString('vi-VN')} {product.unit}
                              </td>
                              <td className="revenue-money">{vnd(product.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Bảng Chi tiết bán hàng theo ngày (Gom nhóm theo ngày & Trổ xuống chi tiết) */}
                <section className="dashboard-card">
                  <div
                    className="card-heading"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '10px',
                    }}
                  >
                    <div>
                      <span className="section-kicker">NHẬT KÝ BÁN SỈ</span>
                      <h2 style={{ margin: 0 }}>Chi tiết bán hàng theo ngày</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      {salesByDay.length > 0 && (
                        <button
                          type="button"
                          className="ghost-button"
                          style={{ fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }}
                          onClick={toggleAllDays}
                        >
                          {expandedDays.size === salesByDay.length
                            ? 'Thu gọn tất cả'
                            : 'Mở rộng tất cả'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary-button"
                        style={{
                          fontSize: '12px',
                          padding: '6px 12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                        }}
                        onClick={() => setExportOpen(true)}
                      >
                        Xuất Excel / PDF
                      </button>
                    </div>
                  </div>

                  {!salesByDay.length ? (
                    <p className="revenue-note">Không có lượt bán nào trong khoảng thời gian đã chọn.</p>
                  ) : (
                    <>
                      {/* Danh sách các ngày theo dạng Accordion trổ xuống */}
                      <div className="daily-sales-accordion">
                        {paginatedDays.map((group) => {
                          const isOpen = expandedDays.has(group.day);
                          return (
                            <div
                              key={group.day}
                              className={`daily-sales-card ${isOpen ? 'is-open' : ''}`}
                            >
                              {/* Header của từng ngày */}
                              <div
                                className="daily-sales-header"
                                onClick={() => toggleDay(group.day)}
                              >
                                <div className="daily-sales-title">
                                  <span style={{ fontSize: '16px' }}>📅</span>
                                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                                    Ngày {group.dayFormatted}
                                  </strong>
                                  <span className="daily-sales-badge">
                                    {group.items.length} mặt hàng sỉ ({group.items.reduce((s, i) => s + i.quantity, 0)} số lượng)
                                  </span>
                                </div>
                                <div className="daily-sales-right">
                                  <span className="daily-sales-revenue">
                                    +{vnd(group.totalRevenue)}
                                  </span>
                                  <button
                                    type="button"
                                    className="daily-sales-toggle-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDay(group.day);
                                    }}
                                  >
                                    <span>{isOpen ? 'Thu gọn' : 'Chi tiết'}</span>
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        transition: 'transform 0.2s',
                                        transform: isOpen ? 'rotate(180deg)' : 'none',
                                      }}
                                    >
                                      ▼
                                    </span>
                                  </button>
                                </div>
                              </div>

                              {/* Bảng con danh sách sản phẩm bán trong ngày trổ xuống */}
                              {isOpen && (
                                <div className="inventory-table-wrap" style={{ borderTop: 'none' }}>
                                  <table className="inventory-table" style={{ margin: 0 }}>
                                    <thead style={{ background: '#f8fafc' }}>
                                      <tr>
                                        <th style={{ width: '110px' }}>Giờ bán</th>
                                        <th>Sản phẩm</th>
                                        <th style={{ width: '130px' }}>Số lượng</th>
                                        <th style={{ width: '130px' }}>Đơn giá</th>
                                        <th style={{ width: '140px' }}>Thành tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.items.map((sale) => (
                                        <tr key={sale.id}>
                                          <td style={{ color: '#64748b', fontSize: '12.5px' }}>
                                            {new Date(sale.createdAt).toLocaleTimeString('vi-VN', {
                                              timeZone: 'Asia/Ho_Chi_Minh',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              second: '2-digit',
                                            })}
                                          </td>
                                          <td>
                                            <strong style={{ color: '#0f172a' }}>
                                              {sale.productName}
                                            </strong>
                                            {sale.note && (
                                              <small style={{ display: 'block', color: '#64748b' }}>
                                                {sale.note}
                                              </small>
                                            )}
                                          </td>
                                          <td style={{ fontWeight: 600 }}>
                                            {sale.quantity.toLocaleString('vi-VN')} {sale.unit}
                                          </td>
                                          <td>
                                            {sale.unitSalePrice == null ? (
                                              <span className="revenue-unknown">Chưa có giá</span>
                                            ) : (
                                              vnd(sale.unitSalePrice)
                                            )}
                                          </td>
                                          <td className="revenue-money">
                                            {sale.revenue == null ? 'Chưa tính được' : vnd(sale.revenue)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Phân trang danh sách ngày bán */}
                      {salesByDay.length > DAYS_PER_PAGE && (
                        <div
                          className="catalog-pagination"
                          style={{
                            marginTop: '16px',
                            padding: '12px 18px',
                            background: '#fff',
                            borderRadius: '12px',
                            border: '1px solid #e5ebe2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px',
                          }}
                        >
                          <div className="pagination-info" style={{ color: '#475569', fontSize: '13px' }}>
                            Hiển thị {(salesPage - 1) * DAYS_PER_PAGE + 1} -{' '}
                            {Math.min(salesPage * DAYS_PER_PAGE, salesByDay.length)} trong{' '}
                            <strong>{salesByDay.length}</strong> ngày có lượt bán
                          </div>
                          <div
                            className="pagination-controls"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                          >
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={salesPage <= 1}
                              onClick={() => {
                                const next = Math.max(1, salesPage - 1);
                                setSalesPage(next);
                                setSalesPageInput(String(next));
                              }}
                              style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                cursor: salesPage <= 1 ? 'not-allowed' : 'pointer',
                                opacity: salesPage <= 1 ? 0.5 : 1,
                              }}
                            >
                              ← Trang trước
                            </button>

                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '13px',
                                color: '#1e293b',
                              }}
                            >
                              <span>Trang</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={salesPageInput}
                                onChange={(e) => setSalesPageInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const parsed = parseInt(salesPageInput, 10);
                                    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalSalesPages) {
                                      setSalesPage(parsed);
                                    } else {
                                      setSalesPageInput(String(salesPage));
                                    }
                                  }
                                }}
                                onBlur={() => {
                                  const parsed = parseInt(salesPageInput, 10);
                                  if (!isNaN(parsed) && parsed >= 1 && parsed <= totalSalesPages) {
                                    setSalesPage(parsed);
                                  } else {
                                    setSalesPageInput(String(salesPage));
                                  }
                                }}
                                style={{
                                  width: '38px',
                                  height: '28px',
                                  padding: '0 4px',
                                  textAlign: 'center',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  background: '#fff',
                                }}
                              />
                              <span>/ {totalSalesPages}</span>
                            </div>

                            <button
                              type="button"
                              className="ghost-button"
                              disabled={salesPage >= totalSalesPages}
                              onClick={() => {
                                const next = Math.min(totalSalesPages, salesPage + 1);
                                setSalesPage(next);
                                setSalesPageInput(String(next));
                              }}
                              style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                cursor: salesPage >= totalSalesPages ? 'not-allowed' : 'pointer',
                                opacity: salesPage >= totalSalesPages ? 0.5 : 1,
                              }}
                            >
                              Trang sau →
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )
          )}
        </section>

        {/* Modal xem trước & xuất báo cáo */}
        {exportOpen && (
          <ExportSalesDialog
            isOpen={exportOpen}
            onClose={() => setExportOpen(false)}
            defaultDate={range.from === range.to ? range.from : undefined}
            storeName="Gian hàng sỉ của bạn"
            fetchReport={getSupplierRevenue}
          />
        )}
      </div>
    </SupplierLayout>
  );
}
