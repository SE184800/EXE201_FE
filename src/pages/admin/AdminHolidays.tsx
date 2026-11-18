import { useRef, useState, type FormEvent } from 'react';
import DatePicker from '../../components/DatePicker';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import { AdminDialog, Badge, Empty, Heading, LoadState, Metric, Panel } from './admin.shared';
import { useAdminData } from './admin.data';
import type { AdminTabProps } from './admin.types';

type Holiday = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  preparationDays: number;
  demandMultiplier: number;
  categoryKeywords: string;
  description: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type HolidayForm = Omit<Holiday, 'id' | 'version' | 'createdAt' | 'updatedAt'>;

const localDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function blankHoliday(): HolidayForm {
  const start = new Date();
  start.setDate(start.getDate() + 14);
  return {
    name: '',
    startDate: localDate(start),
    endDate: localDate(start),
    preparationDays: 14,
    demandMultiplier: 1.2,
    categoryKeywords: '',
    description: '',
    isActive: true,
  };
}

export default function AdminHolidays({ onLogout }: AdminTabProps) {
  const [revision, setRevision] = useState(0);
  const { data, loading, error } = useAdminData<{ holidays: Holiday[] }>(
    '/admin/holidays',
    {},
    onLogout,
    revision,
  );
  const [selected, setSelected] = useState<Holiday | 'new' | null>(null);
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const holidays = data?.holidays || [];
  const active = holidays.filter((item) => item.isActive).length;

  async function remove(item: Holiday) {
    if (!window.confirm(`Xóa cấu hình “${item.name}”?`)) return;
    setDeleting(item.id);
    setActionError('');
    try {
      await api.delete(`/admin/holidays/${item.id}`, { data: { version: item.version } });
      setRevision((value) => value + 1);
    } catch (issue) {
      setActionError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <Heading
        eyebrow="AI BUSINESS RULES"
        title="Ngày lễ & nhu cầu nhập hàng"
        action={
          <button className="admin-primary" onClick={() => setSelected('new')}>
            + Thêm ngày lễ
          </button>
        }
      />
      <div className="admin-metrics three">
        <Metric
          label="Cấu hình đang dùng"
          value={active}
        />
        <Metric
          label="Mức tăng cao nhất"
          value={
            holidays.length
              ? `+${Math.max(...holidays.map((item) => (item.demandMultiplier - 1) * 100)).toLocaleString('vi-VN')}%`
              : '—'
          }
        />
        <Metric
          label="Thời gian chuẩn bị dài nhất"
          value={
            holidays.length
              ? `${Math.max(...holidays.map((item) => item.preparationDays))} ngày`
              : '—'
          }
        />
      </div>
      <LoadState loading={loading} error={error || actionError} />
      {!loading && data && (
        <Panel
          title="Lịch cấu hình của AI"
        >
          {holidays.length ? (
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ngày lễ</th>
                    <th>Thời gian</th>
                    <th>Quy tắc nhu cầu</th>
                    <th>Nhóm hàng áp dụng</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.description || 'Không có ghi chú'}</small>
                      </td>
                      <td>
                        {item.startDate === item.endDate
                          ? new Date(item.endDate + 'T00:00:00').toLocaleDateString('vi-VN')
                          : `${new Date(item.startDate + 'T00:00:00').toLocaleDateString('vi-VN')} – ${new Date(item.endDate + 'T00:00:00').toLocaleDateString('vi-VN')}`}
                        <small>Chuẩn bị trước {item.preparationDays} ngày</small>
                      </td>
                      <td>
                        <strong>x{item.demandMultiplier.toLocaleString('vi-VN')}</strong>
                        <small>
                          Tối đa +{((item.demandMultiplier - 1) * 100).toLocaleString('vi-VN')}%
                        </small>
                      </td>
                      <td>{item.categoryKeywords}</td>
                      <td>
                        <Badge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <button
                            className="admin-btn-edit"
                            disabled={deleting === item.id}
                            onClick={() => setSelected(item)}
                          >
                            Chỉnh sửa
                          </button>
                          <button
                            className="admin-btn-delete"
                            disabled={deleting !== null}
                            onClick={() => void remove(item)}
                          >
                            {deleting === item.id ? 'Đang xóa…' : 'Xóa'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Chưa có ngày lễ. AI hiện chỉ dự báo theo lịch sử bán hàng và tồn kho.</Empty>
          )}
        </Panel>
      )}
      {selected && (
        <HolidayDialog
          holiday={selected === 'new' ? null : selected}
          onLogout={onLogout}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
    </>
  );
}

function HolidayDialog({
  holiday,
  onLogout,
  onClose,
  onSaved,
}: AdminTabProps & { holiday: Holiday | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<HolidayForm>(() =>
    holiday
      ? {
        name: holiday.name,
        startDate: holiday.startDate,
        endDate: holiday.endDate,
        preparationDays: holiday.preparationDays,
        demandMultiplier: holiday.demandMultiplier,
        categoryKeywords: holiday.categoryKeywords,
        description: holiday.description || '',
        isActive: holiday.isActive,
      }
      : blankHoliday(),
  );
  const [isRange, setIsRange] = useState<boolean>(() =>
    holiday ? holiday.startDate !== holiday.endDate : false,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const payload = isRange ? form : { ...form, startDate: form.endDate };
    if (isRange && payload.startDate > payload.endDate) {
      setError('Ngày bắt đầu không được sau ngày kết thúc.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (holiday)
        await api.put(`/admin/holidays/${holiday.id}`, { ...payload, version: holiday.version });
      else await api.post('/admin/holidays', payload);
      onSaved();
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <AdminDialog
      title={holiday ? `Sửa ${holiday.name}` : 'Thêm ngày lễ cho AI'}
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            Tên ngày lễ / dịp bán hàng
            <input
              required
              minLength={2}
              maxLength={150}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ví dụ: Tết Nguyên đán"
            />
          </label>
          <div className="admin-holiday-type-selector">
            <label>
              <input
                type="radio"
                name="holidayType"
                checked={!isRange}
                onChange={() => setIsRange(false)}
              />
              1 ngày duy nhất
            </label>
            <label>
              <input
                type="radio"
                name="holidayType"
                checked={isRange}
                onChange={() => setIsRange(true)}
              />
              Nhiều ngày (khoảng thời gian)
            </label>
          </div>
          {!isRange ? (
            <div className="admin-holiday-dates">
              <label>
                Ngày diễn ra
                <DatePicker
                  required
                  value={form.endDate}
                  onChange={(val) => setForm({ ...form, startDate: val, endDate: val })}
                />
              </label>
            </div>
          ) : (
            <div className="admin-holiday-dates">
              <label>
                Từ ngày
                <DatePicker
                  required
                  value={form.startDate}
                  max={form.endDate}
                  onChange={(val) => setForm({ ...form, startDate: val })}
                />
              </label>
              <label>
                Đến ngày
                <DatePicker
                  required
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(val) => setForm({ ...form, endDate: val })}
                />
              </label>
            </div>
          )}
          <div className="admin-holiday-dates">
            <label>
              Chuẩn bị trước (ngày)
              <input
                required
                type="number"
                min="0"
                max="60"
                step="1"
                value={form.preparationDays}
                onChange={(event) =>
                  setForm({ ...form, preparationDays: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Hệ số nhu cầu
              <input
                required
                type="number"
                min="1"
                max="5"
                step="0.01"
                value={form.demandMultiplier}
                onChange={(event) =>
                  setForm({ ...form, demandMultiplier: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label>
            Nhóm hàng / từ khóa áp dụng
            <textarea
              required
              maxLength={1000}
              rows={3}
              value={form.categoryKeywords}
              onChange={(event) => setForm({ ...form, categoryKeywords: event.target.value })}
              placeholder="bia, nước ngọt, bánh kẹo, hạt dưa"
            />
          </label>
          <label>
            Ghi chú cho quản trị viên
            <textarea
              maxLength={500}
              rows={2}
              value={form.description || ''}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Nguồn quy tắc, kinh nghiệm kinh doanh hoặc lưu ý…"
            />
          </label>
          <label className="admin-holiday-check">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />{' '}
            Cho phép AI sử dụng cấu hình này
          </label>
          {error && (
            <p className="error-notice" role="alert">
              {error}
            </p>
          )}
          <div className="admin-dialog-actions">
            <button type="button" onClick={onClose}>
              Hủy
            </button>
            <button className="admin-primary">{busy ? 'Đang lưu…' : 'Lưu cấu hình'}</button>
          </div>
        </fieldset>
      </form>
    </AdminDialog>
  );
}
