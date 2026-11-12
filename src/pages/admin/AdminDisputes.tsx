import { useEffect, useState } from 'react';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import type { ComplaintWorkflow } from '../../services/supplier.api';
import { AdminDialog, Empty, LoadState, Metric } from './admin.shared';

type DisputeComplaint = {
  id: number;
  orderId: number;
  buyerId: number;
  supplierId: number;
  reason: string;
  description: string;
  imageUrl: string | null;
  status: string;
  response: string | null;
  createdAt: string;
  updatedAt: string;
  workflow?: ComplaintWorkflow | null;
  driverPaymentInfo?: {
    method?: string;
    amount?: number;
    status?: string;
    storePaidAt?: string | null;
    confirmedAt?: string | null;
  } | null;
  order: {
    id: number;
    subtotal: number;
    deliveryFee?: number;
    total: number;
    depositAmount: number;
    depositStatus: string;
    status: string;
    inventoryImportedAt?: string | null;
    recipientName: string;
    recipientPhone: string;
    orderPayment?: {
      id: number;
      status: string;
      amount: number;
      paidAt: string | null;
      refund?: { id: number } | null;
    } | null;
    items: Array<{
      id: number;
      productName: string;
      quantity: number;
      packaging: string;
      unitPrice: number;
      lineTotal: number;
    }>;
  };
  buyer: {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
  };
  supplier: {
    id: number;
    businessName: string;
    userId: number;
    user?: {
      name: string;
      phone: string | null;
      email: string | null;
    };
  };
};

const REASON_LABELS: Record<string, string> = {
  DAMAGED: 'Hàng bể vỡ / hư hỏng',
  SHORTAGE: 'Giao thiếu số lượng',
  WRONG_ITEM: 'Giao sai sản phẩm',
  EXPIRED: 'Cận hạn / hết hạn sử dụng',
  QUALITY: 'Lỗi chất lượng sản phẩm',
  LATE: 'Giao trễ / sai hẹn',
  OTHER: 'Lý do khác',
};

const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  NONE: 'Không có cọc',
  PENDING: 'Chờ nộp cọc',
  SUBMITTED: 'Chờ xác nhận cọc',
  PAID: 'Đang tạm giữ Escrow',
  RELEASED: 'Đã giải ngân cho Vựa',
  REFUNDED: 'Đã hoàn về Ví Tiệm',
  REJECTED: 'Cọc bị từ chối',
};

const STATUS_STAGE_MAP: Record<string, { label: string; tone: '' | 'good' | 'bad' }> = {
  OPEN: { label: 'Mới tạo', tone: '' },
  IN_REVIEW: { label: 'Đang xử lý', tone: '' },
  REJECTED: { label: 'Đang xử lý', tone: 'bad' },
  ESCALATED: { label: 'Đang xử lý', tone: '' },
  RESOLVED: { label: 'Hoàn thành', tone: 'good' },
  CLOSED_TIMEOUT: { label: 'Đã đóng', tone: '' },
  CLOSED_UNRESOLVED: { label: 'Đã đóng', tone: '' },
  ADMIN_RESOLVED_BUYER: { label: 'Hoàn thành', tone: 'good' },
  ADMIN_RESOLVED_SUPPLIER: { label: 'Hoàn thành', tone: 'good' },
};

const money = (v: number) => `${Math.round(Number(v || 0)).toLocaleString('vi-VN')} đ`;

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '---';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '---';
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

function parseEvidenceImages(imageUrl?: string | null): string[] {
  if (!imageUrl) return [];
  const parts = imageUrl.includes('|||') ? imageUrl.split('|||') : imageUrl.split(',');
  return parts.map((s) => s.trim()).filter(Boolean);
}

function parseDescriptionSummary(raw: string): { metaLine: string; details: string } {
  const match = String(raw || '').match(/^\[([^\]]+)\]\s*\n?([\s\S]*)$/);
  if (match) {
    return {
      metaLine: match[1].trim(),
      details: (match[2] || '').trim(),
    };
  }
  return { metaLine: '', details: String(raw || '').trim() };
}

function getPaidSummary(c: DisputeComplaint): { amount: number; label: string } {
  if (c.order.orderPayment && c.order.orderPayment.status === 'PAID') {
    const refunded = Boolean(c.order.orderPayment.refund);
    return {
      amount: Number(c.order.orderPayment.amount || 0),
      label: refunded ? 'Ví hệ thống (Đã hoàn)' : 'Ví hệ thống',
    };
  }
  if (c.driverPaymentInfo?.status === 'CONFIRMED') {
    return {
      amount: Number(c.driverPaymentInfo.amount || 0),
      label: `Đã nhận (${c.driverPaymentInfo.method || 'COD/QR'})`,
    };
  }
  if (c.driverPaymentInfo?.storePaidAt) {
    return {
      amount: Number(c.driverPaymentInfo.amount || 0),
      label: `Tiệm báo đã trả (${c.driverPaymentInfo.method || 'COD/QR'})`,
    };
  }
  return { amount: 0, label: 'Chưa thanh toán phần còn lại' };
}

function getOutcomeText(c: DisputeComplaint): string {
  const wf = c.workflow;
  if (wf?.finalSummary) return wf.finalSummary;
  if (c.status === 'RESOLVED') return c.response || 'Hai bên đã thống nhất kết quả';
  if (c.status === 'OPEN') return 'Chờ Chủ vựa kiểm tra và đề xuất phương án';
  if (['IN_REVIEW', 'REJECTED', 'ESCALATED'].includes(c.status)) {
    if (wf?.pendingParty === 'STORE_OWNER') return 'Chủ vựa đã gửi phương án · Chờ Tiệm xác nhận';
    if (wf?.pendingParty === 'SUPPLIER') return 'Tiệm đã phản hồi · Chờ Chủ vựa đề xuất lại';
    return 'Hai bên đang trao đổi phương án';
  }
  return c.response || 'Đã ghi nhận kết thúc';
}

export default function AdminDisputes({ onLogout }: { onLogout: () => void }) {
  const [complaints, setComplaints] = useState<DisputeComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DisputeComplaint | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ complaints: DisputeComplaint[] }>('/admin/complaints');
      setComplaints(res.data.complaints || []);
    } catch (e) {
      if (isUnauthenticated(e)) onLogout();
      else setError(getApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const inProgressStatuses = ['OPEN', 'IN_REVIEW', 'REJECTED', 'ESCALATED'];
  const completedStatuses = [
    'RESOLVED',
    'ADMIN_RESOLVED_BUYER',
    'ADMIN_RESOLVED_SUPPLIER',
    'CLOSED_TIMEOUT',
    'CLOSED_UNRESOLVED',
  ];

  const activeCount = complaints.filter((c) => inProgressStatuses.includes(c.status)).length;
  const completedCount = complaints.filter((c) => completedStatuses.includes(c.status)).length;

  const q = search.trim().toLowerCase();
  const filtered = complaints.filter((c) => {
    if (filter === 'OPEN' && c.status !== 'OPEN') return false;
    if (filter === 'IN_PROGRESS' && !['IN_REVIEW', 'REJECTED', 'ESCALATED'].includes(c.status)) {
      return false;
    }
    if (filter === 'RESOLVED' && !completedStatuses.includes(c.status)) return false;
    if (!q) return true;
    const reasonText = (REASON_LABELS[c.reason] || c.reason || '').toLowerCase();
    return (
      String(c.id).includes(q) ||
      String(c.orderId).includes(q) ||
      (c.buyer.name || '').toLowerCase().includes(q) ||
      (c.supplier.businessName || '').toLowerCase().includes(q) ||
      reasonText.includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  });

  const selectedPaid = selected ? getPaidSummary(selected) : null;
  const selectedImages = selected ? parseEvidenceImages(selected.imageUrl) : [];
  const selectedDesc = selected ? parseDescriptionSummary(selected.description) : { metaLine: '', details: '' };

  return (
    <>
      <header className="admin-heading">
        <div>
          <p>GHI NHẬN KHIẾU NẠI</p>
          <h1>Lịch sử khiếu nại đơn hàng</h1>
          <span>
            Ghi nhận thông tin khiếu nại, bên gửi/bên nhận, số tiền giao dịch (đã trả + tiền cọc) và
            kết quả thống nhất cuối cùng giữa Tiệm tạp hóa và Chủ vựa.
          </span>
        </div>
        <button type="button" onClick={() => void loadData()} disabled={loading}>
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </header>

      <div className="admin-metrics three">
        <Metric
          label="Đang xử lý"
          value={`${activeCount} vụ`}
          note="Mới tạo và hai bên đang trao đổi"
        />
        <Metric
          label="Hoàn thành"
          value={`${completedCount} vụ`}
          note="Đã thống nhất phương án cuối cùng"
        />
        <Metric
          label="Tổng số khiếu nại"
          value={complaints.length}
          note="Lịch sử ghi nhận toàn hệ thống"
        />
      </div>

      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label style={{ flex: 2, minWidth: '240px' }}>
          Tìm kiếm hồ sơ
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mã khiếu nại, mã đơn, tiệm tạp hóa, chủ vựa, nguyên nhân..."
          />
        </label>
        <label style={{ maxWidth: '240px' }}>
          Trạng thái
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED')
            }
          >
            <option value="ALL">Tất cả ({complaints.length})</option>
            <option value="OPEN">Mới tạo (Bắt đầu)</option>
            <option value="IN_PROGRESS">Đang xử lý</option>
            <option value="RESOLVED">Hoàn thành ({completedCount})</option>
          </select>
        </label>
      </form>

      <LoadState loading={loading && complaints.length === 0} error={error} />

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Danh sách ghi nhận khiếu nại</h2>
          <p>
            Hiển thị {filtered.length} / {complaints.length} hồ sơ · Bấm "Xem chi tiết" để xem ảnh
            bằng chứng và nhật ký trao đổi đầy đủ.
          </p>
        </div>

        {filtered.length === 0 ? (
          <Empty>Chưa có hồ sơ khiếu nại nào phù hợp với bộ lọc hiện tại.</Empty>
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hồ sơ / Đơn</th>
                  <th>Người khiếu nại → Bị khiếu nại</th>
                  <th>Nguyên nhân</th>
                  <th>Số tiền (Đã trả + Cọc)</th>
                  <th>Trạng thái</th>
                  <th>Kết quả thống nhất</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const stage = STATUS_STAGE_MAP[c.status] || { label: c.status, tone: '' as const };
                  const paid = getPaidSummary(c);
                  const depositAmt = Number(c.order.depositAmount || 0);
                  const deducted = Number(c.workflow?.agreedDeductAmount || 0);
                  const parsed = parseDescriptionSummary(c.description);
                  const shortText = parsed.details || parsed.metaLine || '---';

                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>
                          #KN-{c.id} · Đơn #{c.orderId}
                        </strong>
                        <small>{formatDateTime(c.createdAt)}</small>
                      </td>
                      <td>
                        <strong>{c.buyer.name}</strong>
                        <small>Vựa: {c.supplier.businessName}</small>
                      </td>
                      <td style={{ maxWidth: '240px' }}>
                        <strong>{REASON_LABELS[c.reason] || c.reason}</strong>
                        <small
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '220px',
                          }}
                          title={shortText}
                        >
                          {shortText}
                        </small>
                      </td>
                      <td className="admin-money">
                        <strong>
                          Trả: {money(paid.amount)} · Cọc: {money(depositAmt)}
                        </strong>
                        <small>
                          Tổng đơn: {money(c.order.total)}
                          {deducted > 0 ? ` · Giảm COD: -${money(deducted)}` : ''}
                        </small>
                      </td>
                      <td>
                        <span className={`admin-badge ${stage.tone}`}>{stage.label}</span>
                        <small>{formatDateTime(c.updatedAt)}</small>
                      </td>
                      <td style={{ maxWidth: '260px' }}>
                        <strong style={{ fontWeight: 500 }}>{getOutcomeText(c)}</strong>
                        <small>
                          {c.order.inventoryImportedAt ? 'Đã nhập kho' : 'Chưa nhập kho'} ·{' '}
                          {DEPOSIT_STATUS_LABELS[c.order.depositStatus] || c.order.depositStatus}
                        </small>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setZoomImage(null);
                            setSelected(c);
                          }}
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <AdminDialog
          title={`Hồ sơ khiếu nại #${selected.id} · Đơn #${selected.orderId}`}
          busy={false}
          onClose={() => {
            setZoomImage(null);
            setSelected(null);
          }}
        >
          {zoomImage ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <img
                src={zoomImage}
                alt="Bằng chứng phóng to"
                style={{
                  width: '100%',
                  maxHeight: '62vh',
                  objectFit: 'contain',
                  borderRadius: '10px',
                  border: '1px solid #dce3d5',
                  background: '#f8fafc',
                }}
              />
              <div className="admin-dialog-actions">
                <button type="button" onClick={() => setZoomImage(null)}>
                  ← Quay lại thông tin khiếu nại
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '9px',
                  background: '#f7f9f3',
                  border: '1px solid #e2e8da',
                }}
              >
                <span
                  className={`admin-badge ${(STATUS_STAGE_MAP[selected.status]?.tone || '') as string}`}
                >
                  Trạng thái: {STATUS_STAGE_MAP[selected.status]?.label || selected.status}
                </span>
                <span style={{ fontSize: '12px', color: '#53644f' }}>
                  Tạo: {formatDateTime(selected.createdAt)} · Cập nhật:{' '}
                  {formatDateTime(selected.updatedAt)}
                </span>
              </div>

              <dl className="admin-detail-list" style={{ marginBottom: 0 }}>
                <div>
                  <dt>Người khiếu nại</dt>
                  <dd>
                    <strong>{selected.buyer.name}</strong> (Tiệm tạp hóa)
                    <br />
                    <small style={{ color: '#64748b' }}>
                      SĐT: {selected.buyer.phone || 'Chưa có'} · Email:{' '}
                      {selected.buyer.email || 'Chưa có'}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Bên bị khiếu nại</dt>
                  <dd>
                    <strong>{selected.supplier.businessName}</strong> (Chủ vựa)
                    <br />
                    <small style={{ color: '#64748b' }}>
                      Đại diện: {selected.supplier.user?.name || '---'} · SĐT:{' '}
                      {selected.supplier.user?.phone || 'Chưa có'}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Số tiền giao dịch</dt>
                  <dd>
                    <div>
                      Tổng giá trị đơn: <strong>{money(selected.order.total)}</strong>
                      {Number(selected.workflow?.agreedDeductAmount || 0) > 0 && (
                        <span style={{ color: '#15803d', fontWeight: 600 }}>
                          {' '}
                          (Giảm trừ COD: -{money(Number(selected.workflow?.agreedDeductAmount || 0))})
                        </span>
                      )}
                    </div>
                    <div>
                      Tiền đã trả: <strong>{money(selectedPaid?.amount || 0)}</strong>{' '}
                      <span style={{ color: '#64748b' }}>({selectedPaid?.label})</span>
                    </div>
                    <div>
                      Tiền cọc ký quỹ: <strong>{money(selected.order.depositAmount)}</strong>{' '}
                      <span style={{ color: '#64748b' }}>
                        (
                        {DEPOSIT_STATUS_LABELS[selected.order.depositStatus] ||
                          selected.order.depositStatus}
                        )
                      </span>
                    </div>
                  </dd>
                </div>
                <div>
                  <dt>Nguyên nhân</dt>
                  <dd>
                    <strong>{REASON_LABELS[selected.reason] || selected.reason}</strong>
                    {selectedDesc.metaLine && (
                      <div style={{ color: '#475569', marginTop: '2px' }}>
                        {selectedDesc.metaLine}
                      </div>
                    )}
                    {selectedDesc.details && (
                      <div style={{ marginTop: '4px', whiteSpace: 'pre-line' }}>
                        {selectedDesc.details}
                      </div>
                    )}
                  </dd>
                </div>
                {selected.order.items?.length > 0 && (
                  <div>
                    <dt>Mặt hàng đơn</dt>
                    <dd>
                      {selected.order.items
                        .map((item) => `${item.productName} (${item.quantity} ${item.packaging})`)
                        .join(' · ')}
                    </dd>
                  </div>
                )}
                {selectedImages.length > 0 && (
                  <div>
                    <dt>Ảnh bằng chứng</dt>
                    <dd>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {selectedImages.map((src, idx) => (
                          <button
                            key={`${selected.id}-img-${idx}`}
                            type="button"
                            onClick={() => setZoomImage(src)}
                            style={{ padding: 0, overflow: 'hidden', borderRadius: '6px' }}
                            title="Bấm để phóng to"
                          >
                            <img
                              src={src}
                              alt={`Bằng chứng ${idx + 1}`}
                              style={{
                                width: '64px',
                                height: '64px',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    </dd>
                  </div>
                )}
              </dl>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8da',
                  borderRadius: '10px',
                  padding: '12px 14px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#37583f', marginBottom: '6px' }}>
                  Diễn biến trao đổi giữa hai bên
                </div>
                {selected.workflow?.history?.length ? (
                  <div style={{ display: 'grid', gap: '6px', fontSize: '12.5px' }}>
                    {selected.workflow.history.map((h, i) => (
                      <div
                        key={`${selected.id}-hist-${i}`}
                        style={{
                          padding: '6px 9px',
                          background: '#ffffff',
                          borderRadius: '6px',
                          borderLeft: `3px solid ${
                            h.actorRole === 'SUPPLIER'
                              ? '#0284c7'
                              : h.actorRole === 'STORE_OWNER'
                                ? '#16a34a'
                                : '#64748b'
                          }`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                          <strong>
                            {h.label} ({h.actorName})
                          </strong>
                          <span style={{ color: '#64748b', fontSize: '11px' }}>
                            {formatDateTime(h.at)}
                          </span>
                        </div>
                        {h.note && <div style={{ color: '#334155', marginTop: '2px' }}>{h.note}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                    {selected.response || 'Chưa có phản hồi từ Chủ vựa.'}
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: completedStatuses.includes(selected.status) ? '#eaf3e2' : '#f4f6f2',
                  border: `1px solid ${completedStatuses.includes(selected.status) ? '#b9d391' : '#dce3d5'}`,
                  fontSize: '13px',
                }}
              >
                <div style={{ fontWeight: 700, color: '#223c33' }}>
                  Kết quả ghi nhận: {getOutcomeText(selected)}
                </div>
                {selected.workflow?.closedReason && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#475569' }}>
                    Ghi chú: {selected.workflow.closedReason}
                  </div>
                )}
                {selected.workflow?.resolvedAt && (
                  <div style={{ marginTop: '2px', fontSize: '11.5px', color: '#64748b' }}>
                    Thời điểm hoàn thành: {formatDateTime(selected.workflow.resolvedAt)}
                  </div>
                )}
              </div>

              <div className="admin-dialog-actions">
                <button
                  type="button"
                  className="admin-primary"
                  onClick={() => {
                    setZoomImage(null);
                    setSelected(null);
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </AdminDialog>
      )}
    </>
  );
}
