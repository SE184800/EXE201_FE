import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { getApiError, isUnauthenticated } from '../services/api';
import { getStoreRevenue, vietnamDay, vnd, type StoreRevenueReport } from '../services/storeRevenue.api';
import './store-revenue.css';

const shortDay = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;
const fullDay = (value: string) => `${shortDay(value)}/${value.slice(0, 4)}`;
function presetRange(preset: 'today' | 'week' | 'month') {
  const to = vietnamDay();
  const from = preset === 'today' ? to : preset === 'month' ? to.slice(0, 8) + '01' : new Date(Date.parse(to + 'T00:00:00Z') - 6 * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

export default function StoreRevenue({ onLogout }: { onLogout: () => void }) {
  const [range, setRange] = useState(() => presetRange('month'));
  const [draft, setDraft] = useState(range);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<StoreRevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    getStoreRevenue(range.from, range.to, page, controller.signal)
      .then(report => { if (active) { setData(report); setError(''); } })
      .catch((issue: unknown) => { if (active) { setError(getApiError(issue)); if (isUnauthenticated(issue)) onLogout(); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [range, page, reload, onLogout]);

  function apply(next: typeof range) {
    if (!next.from || !next.to || next.from > next.to) { setFilterError('Chọn ngày bắt đầu không sau ngày kết thúc.'); return; }
    if (Date.parse(next.to) - Date.parse(next.from) >= 366 * 86400000) { setFilterError('Chọn tối đa 366 ngày cho mỗi báo cáo.'); return; }
    setFilterError(''); setDraft(next); setLoading(true); setPage(1); setRange({ ...next });
  }
  function submit(event: FormEvent) { event.preventDefault(); apply(draft); }
  function refresh() { setLoading(true); setReload(value => value + 1); }
  const maxRevenue = data?.daily.reduce((max, day) => BigInt(day.revenue) > max ? BigInt(day.revenue) : max, 0n) || 1n;

  return <section className="store-revenue" aria-label="Doanh thu cửa hàng">
    <header className="dashboard-title"><div><p className="dashboard-eyebrow">HIỆU QUẢ KINH DOANH</p><h1>Doanh thu cửa hàng</h1><p>Theo dõi số tiền bán hàng đã ghi nhận của riêng cửa hàng bạn.</p></div><Link className="dash-primary" to="/store/activity"><Icon name="arrow" /> Ghi nhận bán hàng</Link></header>
    <div className="dashboard-card revenue-filters">
      <div className="revenue-presets" aria-label="Khoảng thời gian nhanh">{([['today', 'Hôm nay'], ['week', '7 ngày qua'], ['month', 'Tháng này']] as const).map(([key, label]) => { const next = presetRange(key); return <button key={key} type="button" aria-pressed={range.from === next.from && range.to === next.to} onClick={() => apply(next)}>{label}</button>; })}</div>
      <form onSubmit={submit}><label>Từ ngày<input aria-label="Từ ngày" type="date" required min="1900-01-01" max="9999-12-30" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label><label>Đến ngày<input aria-label="Đến ngày" type="date" required min="1900-01-01" max="9999-12-30" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label><button className="dash-primary" type="submit">Xem báo cáo</button><button className="inventory-refresh" type="button" disabled={loading} onClick={refresh}>↻ Tải lại</button></form>
      {filterError && <p className="error-notice" role="alert">{filterError}</p>}
      <p className="revenue-note">Theo ngày Việt Nam (UTC+7). Chỉ tính thao tác Bán hàng; nhập hàng và chỉnh tồn không tạo doanh thu.</p>
    </div>
    {loading ? <div className="dashboard-card revenue-loading" role="status">Đang tải doanh thu…</div> : error ? <div className="error-notice" role="alert">{error} <button className="text-button" onClick={refresh}>Thử lại</button></div> : data && <>
      <p className="revenue-period">Báo cáo từ <strong>{fullDay(data.from)}</strong> đến <strong>{fullDay(data.to)}</strong></p>
      {data.summary.unpricedSalesCount > 0 && <p className="revenue-warning" role="status"><strong>{data.summary.unpricedSalesCount.toLocaleString('vi-VN')} lượt bán chưa có giá.</strong> Doanh thu bên dưới chỉ cộng các lượt đã lưu giá bán. Lịch sử cũ không được tính lại bằng giá hiện tại.</p>}
      <div className="revenue-metrics">
        <article className="dashboard-card revenue-total"><span>Doanh thu đã ghi giá</span><strong>{vnd(data.summary.revenue)}</strong><small>Từ {data.summary.pricedSalesCount.toLocaleString('vi-VN')} lượt bán có giá</small></article>
        <article className="dashboard-card"><span>Lượt ghi bán</span><strong>{data.summary.salesCount.toLocaleString('vi-VN')}</strong><small>Mỗi lần ghi bán một mặt hàng là một lượt</small></article>
        <article className="dashboard-card"><span>Mặt hàng đã bán</span><strong>{data.summary.productCount.toLocaleString('vi-VN')}</strong><small>Trong khoảng thời gian đã chọn</small></article>
      </div>
      {!data.summary.salesCount && <div className="dashboard-card revenue-empty"><Icon name="store" /><h2>Chưa có lượt bán trong khoảng này</h2><p>Ghi nhận bán hàng kèm giá bán để doanh thu tự cập nhật tại đây.</p><Link className="dash-link" to="/store/activity">Ghi lượt bán đầu tiên →</Link></div>}
      <section className="dashboard-card revenue-chart"><div className="card-heading"><div><span className="section-kicker">THEO NGÀY</span><h2>Nhịp bán hàng</h2></div><span className="revenue-note">Đơn vị: VNĐ</span></div>
        <div className="revenue-chart-scroll"><div className="revenue-bars" style={{ minWidth: Math.max(480, data.daily.length * 24) }}>{data.daily.map(day => <div className="revenue-day" key={day.day} role="img" tabIndex={0} aria-label={`${fullDay(day.day)}: ${vnd(day.revenue)}, ${day.salesCount} lượt bán, ${day.unpricedSalesCount} lượt thiếu giá`} title={`${fullDay(day.day)}: ${vnd(day.revenue)} · ${day.salesCount} lượt bán`}><div className="revenue-bar-track"><div className="revenue-bar" style={{ height: `${Number(BigInt(day.revenue)) / Number(maxRevenue) * 100}%`, minHeight: BigInt(day.revenue) > 0n ? 3 : 0 }} /></div><small>{shortDay(day.day)}</small></div>)}</div></div>
        <details className="revenue-daily-data"><summary>Xem số liệu từng ngày</summary><div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Ngày</th><th>Lượt bán</th><th>Thiếu giá</th><th>Doanh thu đã ghi giá</th></tr></thead><tbody>{data.daily.map(day => <tr key={day.day}><td>{fullDay(day.day)}</td><td>{day.salesCount}</td><td>{day.unpricedSalesCount}</td><td>{vnd(day.revenue)}</td></tr>)}</tbody></table></div></details>
      </section>
      <section className="dashboard-card"><div className="card-heading"><div><span className="section-kicker">10 MẶT HÀNG NỔI BẬT</span><h2>Bán nhiều tiền nhất</h2></div></div>{!data.topProducts.length ? <p className="revenue-note">Chưa có dữ liệu bán hàng.</p> : <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Sản phẩm / quy cách</th><th>Số lượng bán</th><th>Doanh thu đã ghi giá</th></tr></thead><tbody>{data.topProducts.map(product => <tr key={`${product.itemId}-${product.productName}-${product.unit}`}><td><strong>{product.productName}</strong><small>{product.unit}{product.unpricedSalesCount > 0 && ` · ${product.unpricedSalesCount} lượt thiếu giá`}</small></td><td>{BigInt(product.quantity).toLocaleString('vi-VN')} {product.unit}</td><td className="revenue-money">{vnd(product.revenue)}</td></tr>)}</tbody></table></div>}</section>
      <section className="dashboard-card"><div className="card-heading"><div><span className="section-kicker">GIÁ TẠI THỜI ĐIỂM BÁN</span><h2>Chi tiết bán hàng</h2></div><span className="revenue-note">Mới nhất trước</span></div>{!data.sales.length ? <p className="revenue-note">Không có lượt bán ở trang này.</p> : <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Thời gian</th><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{data.sales.map(sale => <tr key={sale.id}><td>{new Date(sale.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td><td><strong>{sale.productName}</strong><small>{sale.note}</small></td><td>{sale.quantity.toLocaleString('vi-VN')} {sale.unit}</td><td>{sale.unitSalePrice == null ? <span className="revenue-unknown">Chưa có giá</span> : vnd(sale.unitSalePrice)}</td><td className="revenue-money">{sale.revenue == null ? 'Chưa tính được' : vnd(sale.revenue)}</td></tr>)}</tbody></table></div>}
        <div className="stock-pagination"><button className="secondary-button" disabled={page === 1} onClick={() => { setLoading(true); setPage(page - 1); }}>Trước</button><span>Trang {data.page}</span><button className="secondary-button" disabled={!data.hasMore} onClick={() => { setLoading(true); setPage(page + 1); }}>Sau</button></div>
      </section>
      <p className="revenue-note">Doanh thu là số lượng bán × giá bán đã lưu, chưa trừ chi phí. Mục này chưa theo dõi công nợ, thanh toán hay hoàn trả hàng.</p>
    </>}
  </section>;
}
