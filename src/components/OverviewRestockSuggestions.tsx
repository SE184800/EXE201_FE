import { useEffect, useMemo, useState } from 'react';
import { api, getApiError, isUnauthenticated, withTransientRetry } from '../services/api';
import Icon from './Icon';
import './overview-restock-suggestions.css';

type Holiday = {
  id: number | string;
  name: string;
  multiplier: number;
  description: string | null;
  daysUntil: number;
  isCurrent: boolean;
};

type ForecastItem = {
  itemId: number;
  name: string;
  unit: string;
  quantity: number;
  suggestedQuantity: number | null;
  holidayMultiplier: number | null;
  holidayName: string | null;
};

type ForecastResponse = {
  upcomingHolidays: Holiday[];
  items: ForecastItem[];
};

export default function OverviewRestockSuggestions({
  revision,
  onLogout,
  onOpen,
}: {
  revision: number;
  onLogout: () => void;
  onOpen: () => void;
}) {
  const [forecast, setForecast] = useState<ForecastResponse>({
    upcomingHolidays: [],
    items: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;

    withTransientRetry(() =>
      api.get<ForecastResponse>('/restock/forecast?horizonDays=7&safetyDays=2'),
    )
      .then(({ data }) => {
        if (!active) return;
        setForecast({
          upcomingHolidays: data.upcomingHolidays || [],
          items: data.items || [],
        });
      })
      .catch((issue: unknown) => {
        if (!active) return;
        if (isUnauthenticated(issue)) onLogout();
        else setError(getApiError(issue));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onLogout, reload, revision]);

  const holidayItems = useMemo(
    () =>
      forecast.items
        .filter((item) => item.holidayMultiplier !== null && item.holidayMultiplier > 1)
        .sort((left, right) => {
          const leftNeedsStock = (left.suggestedQuantity || 0) > 0 ? 1 : 0;
          const rightNeedsStock = (right.suggestedQuantity || 0) > 0 ? 1 : 0;
          if (leftNeedsStock !== rightNeedsStock) return rightNeedsStock - leftNeedsStock;
          return (right.suggestedQuantity || 0) - (left.suggestedQuantity || 0);
        }),
    [forecast.items],
  );

  const nearestHoliday = forecast.upcomingHolidays[0];
  const recommendedItems = holidayItems.filter((item) => (item.suggestedQuantity || 0) > 0);
  const visibleItems = recommendedItems.slice(0, 8);
  const actionableCount = recommendedItems.length;

  return (
    <section
      className="dashboard-card overview-restock-card"
      aria-labelledby="overview-restock-title"
    >
      <div className="card-heading overview-restock-heading">
        <div>
          <span className="section-kicker">AI GỢI Ý NHẬP HÀNG</span>
          <h2 id="overview-restock-title">Chuẩn bị hàng cho ngày sắp tới</h2>
        </div>
        <span className="overview-restock-alert-badge">CẢNH BÁO MỚI</span>
      </div>

      {loading ? (
        <div className="overview-restock-loading" role="status">
          <span className="overview-restock-sparkle">
            <Icon name="sparkle" />
          </span>
          <div>
            <strong>AI đang kiểm tra kho…</strong>
            <p>Đối chiếu lịch bán hàng, tồn kho và cấu hình ngày lễ.</p>
          </div>
        </div>
      ) : error ? (
        <div className="overview-restock-empty" role="alert">
          <strong>Chưa tải được gợi ý nhập hàng.</strong>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError('');
              setReload((value) => value + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      ) : nearestHoliday ? (
        <>
          <div className="holiday-overview">
            <span className="overview-restock-sparkle">
              <Icon name="sparkle" />
            </span>
            <div>
              <span>
                {nearestHoliday.isCurrent ? 'ĐANG DIỄN RA' : `CÒN ${nearestHoliday.daysUntil} NGÀY`}
              </span>
              <strong>{nearestHoliday.name}</strong>
              <p>
                {nearestHoliday.description || 'AI đang theo dõi nhu cầu hàng hóa cho dịp này.'}
              </p>
              <p className="holiday-overview-alert">
                {actionableCount > 0
                  ? `AI phát hiện ${actionableCount} mặt hàng nên nhập thêm.`
                  : 'Tồn kho hiện tại vẫn đủ theo dự báo.'}
              </p>
            </div>
            <b>×{nearestHoliday.multiplier}</b>
          </div>

          {actionableCount > 0 && (
            <button
              type="button"
              className="overview-restock-toggle"
              aria-expanded={expanded}
              aria-controls="overview-restock-products"
              onClick={() => setExpanded((current) => !current)}
            >
              <span>
                <Icon name="box" />
                {expanded
                  ? 'Ẩn danh sách hàng cần nhập'
                  : `Xem ${actionableCount} mặt hàng nên nhập`}
              </span>
              <span className={`overview-restock-chevron${expanded ? ' is-open' : ''}`}>⌄</span>
            </button>
          )}

          {expanded && actionableCount > 0 && (
            <div id="overview-restock-products" className="overview-restock-details">
              <div className="overview-restock-list">
                {visibleItems.map((item) => (
                  <button type="button" key={item.itemId} onClick={onOpen}>
                    <span className="overview-restock-product-icon">
                      <Icon name="box" />
                    </span>
                    <span className="overview-restock-product">
                      <strong>{item.name}</strong>
                      <small>
                        Đang có {item.quantity} {item.unit}
                        {item.holidayName ? ` · ${item.holidayName}` : ''}
                      </small>
                    </span>
                    <span className="overview-restock-quantity">
                      Nên nhập {item.suggestedQuantity} {item.unit}
                    </span>
                  </button>
                ))}
              </div>
              <button type="button" className="overview-restock-more" onClick={onOpen}>
                {recommendedItems.length > visibleItems.length
                  ? `Xem thêm ${recommendedItems.length - visibleItems.length} mặt hàng`
                  : 'Mở Kế hoạch nhập hàng'}
                <Icon name="arrow" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="overview-restock-empty">
          <span className="overview-restock-sparkle">
            <Icon name="sparkle" />
          </span>
          <strong>Chưa có dịp bán hàng nào sắp tới.</strong>
          <p>Khi Admin bật lịch ngày lễ, gợi ý sẽ tự động hiện tại đây.</p>
          <button type="button" onClick={onOpen}>
            Xem dự báo thường
          </button>
        </div>
      )}
    </section>
  );
}
