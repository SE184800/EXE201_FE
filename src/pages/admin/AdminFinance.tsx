import { useRef, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import {
  AdminDialog,
  Badge,
  DateFields,
  Empty,
  Heading,
  LoadState,
  Metric,
  Pager,
  Panel,
} from './admin.shared';
import { dateTime, defaultPeriod, money, useAdminData } from './admin.data';
import type { AdminTabProps, List, Settlement } from './admin.types';

type FinanceData = List & {
  orders: Settlement[];
  totals: { subtotal: number; commission: number; unpaid: number };
  suppliers: { id: number; name: string; orders: number; commission: number }[];
};

export default function AdminFinance({ onLogout }: AdminTabProps) {
  const [dates, setDates] = useState(defaultPeriod),
    [supplierId, setSupplierId] = useState(''),
    [status, setStatus] = useState('');
  const [query, setQuery] = useState({ ...defaultPeriod(), supplierId: '', status: '', page: 1 }),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Settlement | null>(null);
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState('');
  const { data, loading, error } = useAdminData<FinanceData>(
    '/admin/settlements',
    query,
    onLogout,
    revision,
  );
  const settings = useAdminData<{ commissionRate: number; version: number }>(
    '/admin/settings',
    {},
    onLogout,
    revision,
  );

  async function download() {
    setExporting(true);
    setExportError('');
    try {
      const response = await api.get('/admin/settlements/export', {
        params: query,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `supplymind-doi-soat-${query.from}-${query.to}.csv`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setExportError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Heading
        eyebrow="COMMISSION & SETTLEMENT"
        title="Hoa hồng & đối soát"
        description="Theo dõi phí phát sinh trên đơn đã giao và xác nhận khoản thu từ từng chủ vựa."
        action={
          <button disabled={loading || !data || exporting} onClick={() => void download()}>
            {exporting ? 'Đang xuất…' : '↓ Xuất báo cáo CSV'}
          </button>
        }
      />
      <LoadState loading={settings.loading} error={settings.error} />
      {settings.data && (
        <CommissionSettings
          key={`${settings.data.version}-${revision}`}
          {...settings.data}
          onLogout={onLogout}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ ...dates, supplierId, status, page: 1 });
          setRevision((n) => n + 1);
        }}
      >
        <DateFields value={dates} onChange={setDates} />
        <label>
          Mã chủ vựa
          <input
            type="number"
            min="1"
            step="1"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            placeholder="Tất cả chủ vựa"
          />
        </label>
        <label>
          Thu phí
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="UNPAID">Chưa thu</option>
            <option value="PAID">Đã thu</option>
            <option value="NO_FEE">Miễn phí</option>
            <option value="UNTRACKED">Chưa có dữ liệu phí</option>
          </select>
        </label>
        <button className="admin-primary">Lọc đối soát</button>
      </form>
      <LoadState loading={loading} error={error || exportError} />
      {data && (
        <>
          <div className="admin-metrics three">
            <Metric label="Tiền hàng trong bộ lọc" value={money(data.totals.subtotal)} />
            <Metric label="Phí hoa hồng phát sinh" value={money(data.totals.commission)} />
            <Metric label="Còn phải thu" value={money(data.totals.unpaid)} />
          </div>
          <Panel title="Đối soát theo đơn">
            {data.orders.length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Đơn / Chủ vựa</th>
                      <th>Ngày giao</th>
                      <th>Tiền hàng</th>
                      <th>Phí hoa hồng</th>
                      <th>Thu phí</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>
                            #{order.id} · {order.businessName}
                          </strong>
                          <small>
                            Mã vựa #{order.supplierId} · {order.buyerName}
                          </small>
                        </td>
                        <td>{dateTime(order.deliveredAt)}</td>
                        <td>{money(order.subtotal)}</td>
                        <td>
                          <strong>
                            {order.commissionAmount === null
                              ? 'Chưa xác định'
                              : money(order.commissionAmount)}
                          </strong>
                          <small>
                            {order.commissionRate === null
                              ? 'Đơn cũ chưa chụp mức phí'
                              : `${order.commissionRate}% tiền hàng`}
                          </small>
                        </td>
                        <td>
                          <Badge status={order.paymentStatus} />
                          {order.paidAt && (
                            <small>
                              {dateTime(order.paidAt)}
                              <br />
                              {order.paymentReference}
                            </small>
                          )}
                        </td>
                        <td>
                          {order.paymentStatus === 'UNPAID' && (
                            <button onClick={() => setSelected(order)}>Xác nhận thu</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )}
            <Pager {...data} onPage={(page) => setQuery({ ...query, page })} />
          </Panel>
          <Panel title="Tổng hợp từng chủ vựa">
            {data.suppliers.length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Chủ vựa</th>
                      <th>Số đơn</th>
                      <th>Phí trong bộ lọc</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.suppliers.map((s) => (
                      <tr key={s.id}>
                        <td>
                          #{s.id} · {s.name}
                        </td>
                        <td>{s.orders}</td>
                        <td>{money(s.commission)}</td>
                        <td>
                          <button
                            onClick={() => {
                              setSupplierId(String(s.id));
                              setQuery({ ...query, supplierId: String(s.id), page: 1 });
                            }}
                          >
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )}
          </Panel>
        </>
      )}
      {selected && (
        <ReceiveDialog
          order={selected}
          onLogout={onLogout}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setRevision((n) => n + 1);
          }}
        />
      )}
    </>
  );
}

function CommissionSettings({
  commissionRate,
  version,
  onLogout,
  onSaved,
}: AdminTabProps & { commissionRate: number; version: number; onSaved: () => void }) {
  const [rate, setRate] = useState(String(commissionRate)),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await api.put('/admin/settings', { commissionRate: Number(rate), version });
      onSaved();
    } catch (e) {
      setError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="admin-rate-card" onSubmit={save}>
      <div>
        <span className="admin-mini-label">CHÍNH SÁCH PHÍ</span>
        <h2>Hoa hồng sàn</h2>
        <p>
          Áp dụng cho đơn tạo mới. Phí = tiền hàng × tỷ lệ; phát sinh khi giao thành công, không
          tính phí vận chuyển.
        </p>
      </div>
      <label>
        Tỷ lệ (%)
        <input
          required
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={rate}
          disabled={busy}
          onChange={(e) => setRate(e.target.value)}
        />
      </label>
      <button className="admin-primary" disabled={busy || Number(rate) === commissionRate}>
        {busy ? 'Đang lưu…' : 'Lưu mức phí'}
      </button>
      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function ReceiveDialog({
  order,
  onLogout,
  onClose,
  onSaved,
}: AdminTabProps & { order: Settlement; onClose: () => void; onSaved: () => void }) {
  const [reference, setReference] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await api.post(`/admin/settlements/${order.id}/receive`, { reference });
      onSaved();
    } catch (e) {
      setError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <AdminDialog title={`Xác nhận thu phí · Đơn #${order.id}`} onClose={onClose} busy={busy}>
      <form onSubmit={save}>
        <p>
          Chủ vựa: <b>{order.businessName}</b>
        </p>
        <p className="admin-payment-amount">{money(order.commissionAmount || 0)}</p>
        <fieldset disabled={busy}>
          <label>
            Mã giao dịch / chứng từ thu
            <input
              required
              minLength={3}
              maxLength={150}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ví dụ: mã chuyển khoản hoặc phiếu thu"
            />
          </label>
          <p className="admin-note">
            Chỉ xác nhận sau khi đã nhận đủ khoản phí này. Nhật ký lưu người xác nhận, thời điểm và
            chứng từ.
          </p>
          {error && (
            <p role="alert" className="error-notice">
              {error}
            </p>
          )}
          <div className="admin-dialog-actions">
            <button type="button" onClick={onClose}>
              Hủy
            </button>
            <button className="admin-primary">{busy ? 'Đang ghi nhận…' : 'Đã nhận đủ phí'}</button>
          </div>
        </fieldset>
      </form>
    </AdminDialog>
  );
}
