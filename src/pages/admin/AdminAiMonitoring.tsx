import { useState } from 'react';
import { Badge, DateFields, Empty, Heading, LoadState, Metric, Panel } from './admin.shared';
import { defaultPeriod, useAdminData } from './admin.data';
import type { AdminTabProps } from './admin.types';

type AiData = {
  configuredProvider: string | null;
  weatherIntegrated: boolean;
  recommendationRuns: number;
  acceptedRuns: number;
  acceptanceRate: number | null;
  groups: {
    provider: string;
    status: string;
    count: number;
    averageMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
  }[];
  daily: { day: string; provider: string; calls: number }[];
};

export default function AdminAiMonitoring({ onLogout }: AdminTabProps) {
  const [dates, setDates] = useState(defaultPeriod),
    [query, setQuery] = useState(defaultPeriod),
    [revision, setRevision] = useState(0);
  const { data, error, loading } = useAdminData<AiData>('/admin/ai', query, onLogout, revision);
  const external = data?.groups.filter((g) => g.provider !== 'RULES') || [];

  return (
    <>
      <Heading
        eyebrow="AI PERFORMANCE"
        title="Hoạt động AI"
        description="Quan sát số lượt gọi dịch vụ, lỗi và mức độ sử dụng đề xuất nhập hàng."
        action={<button onClick={() => setRevision((n) => n + 1)}>↻ Làm mới</button>}
      />
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(dates);
          setRevision((n) => n + 1);
        }}
      >
        <DateFields value={dates} onChange={setDates} />
        <button className="admin-primary">Xem thống kê</button>
      </form>
      <LoadState loading={loading} error={error} />
      {data && (
        <>
          <div className="admin-metrics">
            <Metric
              label="Lượt gọi AI bên ngoài"
              value={external.reduce((sum, g) => sum + g.count, 0)}
            />
            <Metric
              label="Lượt lỗi / dùng dự phòng"
              value={external
                .filter((g) => g.status === 'ERROR')
                .reduce((sum, g) => sum + g.count, 0)}
            />
            <Metric
              label="Lượt dự báo có đề xuất"
              value={data.recommendationRuns}
            />
            <Metric
              label="Tỷ lệ sử dụng đề xuất"
              value={data.acceptanceRate === null ? '—' : `${data.acceptanceRate}%`}
            />
          </div>
          <p className="admin-note">
            Tỷ lệ sử dụng = số lượt dự báo có ít nhất một số lượng đề xuất được lưu đúng vào kế
            hoạch trong 24 giờ / tổng lượt dự báo có đề xuất. Đây là mức độ chấp nhận, chưa phải độ
            chính xác dự báo. Số liệu được ghi nhận từ khi bật chức năng theo dõi.
          </p>
          <div className="admin-service-strip">
            <span>
              <i className={data.configuredProvider ? 'online' : ''} /> Gemini / OpenAI:{' '}
              {data.configuredProvider || 'Chưa cấu hình khóa và model'}
            </span>
            <span>
              <i /> API thời tiết: chưa tích hợp · chưa có lượt gọi để thống kê
            </span>
          </div>
          <Panel title="Lưu lượng theo dịch vụ">
            {data.groups.length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dịch vụ</th>
                      <th>Kết quả</th>
                      <th>Lượt gọi</th>
                      <th>Độ trễ trung bình</th>
                      <th>Token vào / ra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.groups.map((g) => (
                      <tr key={`${g.provider}-${g.status}`}>
                        <td>
                          <strong>{g.provider}</strong>
                        </td>
                        <td>
                          <Badge status={g.status} />
                        </td>
                        <td>{g.count}</td>
                        <td>
                          {g.status === 'STARTED'
                            ? 'Chưa kết thúc'
                            : `${g.averageMs.toLocaleString('vi-VN')} ms`}
                        </td>
                        <td>
                          {g.inputTokens ?? '—'} / {g.outputTokens ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Chưa có hoạt động trợ lý trong kỳ đã chọn.</Empty>
            )}
          </Panel>
          <Panel title="Tần suất theo ngày">
            {data.daily.length ? (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Dịch vụ</th>
                      <th>Lượt gọi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((d) => (
                      <tr key={`${d.day}-${d.provider}`}>
                        <td>{d.day}</td>
                        <td>{d.provider}</td>
                        <td>{d.calls}</td>
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
    </>
  );
}
