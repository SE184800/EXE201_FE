import { useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import { money } from '../admin.data';

export type DailyPoint = {
  day: string;
  dayLabel: string;
  weekdayLabel: string;
  fullDate: string;
  gmv: number;
  orders: number;
};

function formatWeekday(dateStr: string): string {
  try {
    const dt = new Date(dateStr + 'T00:00:00');
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[dt.getDay()] || '';
  } catch {
    return '';
  }
}

function getNiceMaxScale(maxValue: number): number {
  if (maxValue <= 100000) return 100000;
  if (maxValue <= 500000) return Math.ceil(maxValue / 100000) * 100000;
  if (maxValue <= 2000000) return Math.ceil(maxValue / 250000) * 250000;
  if (maxValue <= 10000000) return Math.ceil(maxValue / 1000000) * 1000000;
  return Math.ceil(maxValue / 5000000) * 5000000;
}

export default function DailyAnalyticsChart({
  daily,
  totalGmv,
  totalOrders,
}: {
  daily: { day: string; gmv: number; orders: number }[];
  from?: string;
  to?: string;
  totalGmv: number;
  totalOrders: number;
}) {
  const [chartMode, setChartMode] = useState<'bar' | 'area'>('bar');
  const [hoveredPoint, setHoveredPoint] = useState<DailyPoint | null>(null);

  const points: DailyPoint[] = useMemo(() => {
    if (!daily || daily.length === 0) return [];
    return [...daily]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => {
        const dayMonth = `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}`;
        const weekday = formatWeekday(d.day);
        return {
          day: d.day,
          dayLabel: dayMonth,
          weekdayLabel: weekday,
          fullDate: `${weekday}, ngày ${dayMonth}/${d.day.slice(0, 4)}`,
          gmv: d.gmv,
          orders: d.orders,
        };
      });
  }, [daily]);

  const maxGmvRaw = Math.max(1, ...points.map((p) => p.gmv));
  const maxScale = useMemo(() => getNiceMaxScale(maxGmvRaw), [maxGmvRaw]);

  const peakDay = useMemo(() => {
    return points.reduce(
      (max, d) => (d.gmv > max.gmv ? d : max),
      { day: '', dayLabel: '', weekdayLabel: '', fullDate: '', gmv: 0, orders: 0 },
    );
  }, [points]);

  const yTicks = [
    maxScale,
    Math.round(maxScale * 0.75),
    Math.round(maxScale * 0.5),
    Math.round(maxScale * 0.25),
    0,
  ];

  const svgWidth = 720;
  const svgHeight = 240;
  const paddingLeft = 70;
  const paddingRight = 35;
  const paddingTop = 42;
  const paddingBottom = 46;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const N = points.length;
  const slotWidth = N > 0 ? plotWidth / N : plotWidth;
  const barWidth = Math.min(54, Math.max(22, slotWidth * 0.55));

  const getX = (index: number) => {
    if (N <= 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (index + 0.5) * slotWidth;
  };

  const getY = (value: number) => {
    const ratio = Math.min(1, Math.max(0, value / maxScale));
    return paddingTop + plotHeight - ratio * plotHeight;
  };

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.gmv).toFixed(1)}`)
      .join(' ');
  }, [points, maxScale, slotWidth]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = getX(0).toFixed(1);
    const lastX = getX(points.length - 1).toFixed(1);
    const bottomY = (paddingTop + plotHeight).toFixed(1);
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePath, points, slotWidth]);

  if (daily.length === 0) {
    return (
      <div className="admin-empty-chart">
        <Icon name="chart" />
        <p>Chưa có giao dịch sỉ nào phát sinh trong khoảng thời gian này.</p>
        <small>Các giao dịch giữa chủ tiệm tạp hóa và chủ vựa sẽ tự động tổng hợp vào biểu đồ.</small>
      </div>
    );
  }

  return (
    <div className="admin-smart-chart-container">
      <div className="admin-chart-topbar">
        <div className="admin-chart-kpis">
          <div className="admin-chart-kpi-item">
            <span>Tổng giao dịch</span>
            <strong>{money(totalGmv)}</strong>
          </div>
          <div className="admin-chart-kpi-divider" />
          <div className="admin-chart-kpi-item">
            <span>Số đơn hoàn tất</span>
            <strong>{totalOrders} đơn</strong>
          </div>
          {peakDay.gmv > 0 && (
            <>
              <div className="admin-chart-kpi-divider" />
              <div className="admin-chart-kpi-item">
                <span>Đỉnh doanh số / ngày</span>
                <strong className="text-emerald">{money(peakDay.gmv)}</strong>
              </div>
              <div className="admin-chart-kpi-divider" />
              <div className="admin-chart-kpi-item">
                <span>Số ngày giao dịch</span>
                <strong>{points.length} ngày</strong>
              </div>
            </>
          )}
        </div>

        <div className="admin-chart-switcher">
          <button
            type="button"
            className={`admin-chart-mode-btn ${chartMode === 'bar' ? 'active' : ''}`}
            onClick={() => setChartMode('bar')}
          >
            Cột số liệu
          </button>
          <button
            type="button"
            className={`admin-chart-mode-btn ${chartMode === 'area' ? 'active' : ''}`}
            onClick={() => setChartMode('area')}
          >
            Đường xu hướng
          </button>
        </div>
      </div>

      <div className="admin-chart-svg-wrapper">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="admin-smart-svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity="0.32" />
              <stop offset="65%" stopColor="#22c55e" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
            <linearGradient id="barGradientActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>

          {yTicks.map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke={val === 0 ? '#cbd5e1' : '#e2e8f0'}
                  strokeDasharray={val === 0 ? 'none' : '4 4'}
                  strokeWidth={val === 0 ? '1.5' : '1'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontWeight="500"
                >
                  {val >= 1000000 ? `${(val / 1000000).toFixed(1)}Tr ₫` : val > 0 ? `${Math.round(val / 1000)}k ₫` : '0 ₫'}
                </text>
              </g>
            );
          })}

          {chartMode === 'area' && (
            <>
              {points.length > 1 && (
                <>
                  <path d={areaPath} fill="url(#areaGradient)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
              {points.map((p, i) => {
                const cx = getX(i);
                const cy = getY(p.gmv);
                const isHovered = hoveredPoint?.day === p.day;

                return (
                  <g
                    key={p.day}
                    className="admin-chart-point-group"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {isHovered && (
                      <line
                        x1={cx}
                        y1={paddingTop}
                        x2={cx}
                        y2={paddingTop + plotHeight}
                        stroke="#16a34a"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : 4.5}
                      fill="#16a34a"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={cx}
                      y={cy - 10}
                      textAnchor="middle"
                      fill="#15803d"
                      fontSize="10.5"
                      fontWeight="650"
                    >
                      {money(p.gmv)}
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {chartMode === 'bar' && (
            <>
              {points.map((p, i) => {
                const cx = getX(i);
                const cy = getY(p.gmv);
                const barHeight = Math.max(4, paddingTop + plotHeight - cy);
                const isHovered = hoveredPoint?.day === p.day;

                return (
                  <g
                    key={p.day}
                    className="admin-chart-bar-group"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={cx - barWidth}
                      y={paddingTop}
                      width={barWidth * 2}
                      height={plotHeight}
                      fill="transparent"
                    />

                    <rect
                      x={cx - barWidth / 2}
                      y={cy}
                      width={barWidth}
                      height={barHeight}
                      rx="6"
                      ry="6"
                      fill={isHovered ? 'url(#barGradientActive)' : 'url(#barGradient)'}
                      filter="drop-shadow(0px 2px 4px rgba(22, 163, 74, 0.2))"
                    />

                    <text
                      x={cx}
                      y={cy - 19}
                      textAnchor="middle"
                      fill="#059669"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {p.orders} đơn
                    </text>
                    <text
                      x={cx}
                      y={cy - 6}
                      textAnchor="middle"
                      fill="#166534"
                      fontSize="11"
                      fontWeight="700"
                    >
                      {money(p.gmv)}
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {points.map((p, i) => {
            const cx = getX(i);
            const isHovered = hoveredPoint?.day === p.day;

            return (
              <g key={`axis-label-${p.day}`}>
                <text
                  x={cx}
                  y={paddingTop + plotHeight + 17}
                  textAnchor="middle"
                  fill={isHovered ? '#16a34a' : '#1e293b'}
                  fontSize="11"
                  fontWeight="650"
                >
                  {p.dayLabel}
                </text>
                <text
                  x={cx}
                  y={paddingTop + plotHeight + 31}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="9.5"
                  fontWeight="500"
                >
                  {p.weekdayLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredPoint && (
          <div
            className="admin-chart-tooltip"
            style={{
              left: `${(getX(points.findIndex((p) => p.day === hoveredPoint.day)) / svgWidth) * 100}%`,
              top: '10px',
            }}
          >
            <span className="tooltip-date">{hoveredPoint.fullDate}</span>
            <strong className="tooltip-amount">{money(hoveredPoint.gmv)}</strong>
            <span className="tooltip-orders">
              {hoveredPoint.orders} giao dịch hoàn tất
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
