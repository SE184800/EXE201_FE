import { useEffect, useState } from 'react';
import { api, getApiError, isUnauthenticated } from '../../services/api';

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
  order: {
    id: number;
    subtotal: number;
    total: number;
    depositAmount: number;
    depositStatus: string;
    status: string;
    recipientName: string;
    recipientPhone: string;
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

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  ESCALATED: { label: 'Chờ Admin phân xử', color: '#7c3aed', bg: '#f5f3ff' },
  OPEN: { label: 'Chờ vựa xem', color: '#c2410c', bg: '#fff7ed' },
  IN_REVIEW: { label: 'Đang kiểm hàng', color: '#1d4ed8', bg: '#eff6ff' },
  REJECTED: { label: 'Vựa từ chối', color: '#b91c1c', bg: '#fef2f2' },
  RESOLVED: { label: 'Đã giải quyết', color: '#15803d', bg: '#f0fdf4' },
  ADMIN_RESOLVED_BUYER: { label: 'Admin xử Tiệm thắng (Đã hoàn tiền)', color: '#15803d', bg: '#f0fdf4' },
  ADMIN_RESOLVED_SUPPLIER: { label: 'Admin xử Vựa thắng', color: '#475569', bg: '#f1f5f9' },
};

export default function AdminDisputes({ onLogout }: { onLogout: () => void }) {
  const [complaints, setComplaints] = useState<DisputeComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ESCALATED' | 'RESOLVED'>('ESCALATED');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

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

  const handleResolve = async (complaintId: number, decision: 'FAVOR_BUYER' | 'FAVOR_SUPPLIER') => {
    const isBuyer = decision === 'FAVOR_BUYER';
    const note = window.prompt(
      `Xác nhận phân xử: ${isBuyer ? 'XỬ CỬA HÀNG THẮNG (Hoàn 100% tiền cọc và tiền hàng)' : 'XỬ CHỦ VỰA THẮNG (Giải ngân cọc cho Vựa)'}?\nNhập ghi chú căn cứ phân xử:`,
      isBuyer
        ? 'Quản trị viên đã kiểm tra biên bản và hình ảnh thiệt hại. Chấp thuận khiếu nại của tiệm và hoàn tiền.'
        : 'Cửa hàng không cung cấp đủ căn cứ chứng minh sự cố hoặc từ chối nhận hàng vô cớ. Giải ngân cọc cho vựa.'
    );
    if (note === null) return;

    setBusyId(complaintId);
    try {
      const res = await api.post<{ message: string }>(`/admin/complaints/${complaintId}/resolve`, {
        decision,
        note: note.trim(),
      });
      window.alert(res.data.message || 'Đã phân xử thành công.');
      await loadData();
    } catch (e) {
      window.alert(getApiError(e) || 'Lỗi khi xử lý phân xử.');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = complaints.filter((c) => {
    if (filter === 'ESCALATED') return c.status === 'ESCALATED';
    if (filter === 'RESOLVED') return ['ADMIN_RESOLVED_BUYER', 'ADMIN_RESOLVED_SUPPLIER', 'RESOLVED'].includes(c.status);
    return true;
  });

  const escalatedCount = complaints.filter((c) => c.status === 'ESCALATED').length;

  return (
    <div className="admin-content-inner">
      <header className="admin-header">
        <div>
          <h1>Phân xử khiếu nại & Tranh chấp đơn hàng</h1>
          <p className="admin-subtitle">
            Giải quyết các trường hợp Cửa hàng kháng cáo do Chủ vựa bác bỏ sự cố giao nhận
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadData()}
            disabled={loading}
          >
            Làm mới
          </button>
        </div>
      </header>

      {/* Metrics */}
      <div className="admin-metrics-grid" style={{ marginBottom: '20px' }}>
        <article className="admin-metric">
          <span>CẦN PHÂN XỬ GẤP</span>
          <strong style={{ color: escalatedCount > 0 ? '#b91c1c' : '#15803d' }}>
            {escalatedCount} vụ
          </strong>
          <small>Cửa hàng kháng cáo lên Admin</small>
        </article>
        <article className="admin-metric">
          <span>TỔNG SỐ KHIẾU NẠI</span>
          <strong>{complaints.length}</strong>
          <small>Ghi nhận trên toàn hệ thống</small>
        </article>
        <article className="admin-metric">
          <span>ĐÃ XỬ XONG</span>
          <strong style={{ color: '#15803d' }}>
            {complaints.filter((c) => ['ADMIN_RESOLVED_BUYER', 'ADMIN_RESOLVED_SUPPLIER'].includes(c.status)).length}
          </strong>
          <small>Đã có quyết định phân xử</small>
        </article>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          className={`table-button ${filter === 'ESCALATED' ? 'primary-small' : ''}`}
          style={filter === 'ESCALATED' ? { background: '#7c3aed', color: '#fff' } : {}}
          onClick={() => setFilter('ESCALATED')}
        >
          Chờ Admin phân xử ({escalatedCount})
        </button>
        <button
          type="button"
          className={`table-button ${filter === 'RESOLVED' ? 'primary-small' : ''}`}
          onClick={() => setFilter('RESOLVED')}
        >
          Đã phân xử xong
        </button>
        <button
          type="button"
          className={`table-button ${filter === 'ALL' ? 'primary-small' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          Tất cả ({complaints.length})
        </button>
      </div>

      {error && <div className="admin-error-banner" style={{ marginBottom: '16px' }}>{error}</div>}

      {loading ? (
        <p style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Đang tải danh sách khiếu nại...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
            {filter === 'ESCALATED' ? 'Hiện không có vụ việc nào đang chờ Admin phân xử.' : 'Không có khiếu nại nào.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.map((c) => {
            const statusConfig = STATUS_MAP[c.status] || { label: c.status, color: '#64748b', bg: '#f1f5f9' };
            const isEscalated = c.status === 'ESCALATED';

            return (
              <div
                key={c.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: isEscalated ? '2px solid #c084fc' : '1px solid #e2e8f0',
                  padding: '18px 20px',
                  boxShadow: isEscalated ? '0 4px 12px rgba(124, 58, 237, 0.08)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>
                      Khiếu nại #{c.id} · Đơn sỉ #{c.orderId}
                    </span>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: statusConfig.color,
                        background: statusConfig.bg,
                        border: `1px solid ${statusConfig.color}40`,
                      }}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Cập nhật: {new Date(c.updatedAt).toLocaleString('vi-VN')}
                  </span>
                </div>

                {/* Buyer and Supplier Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
                  <div>
                    <strong style={{ color: '#0f172a' }}>Bên mua (Cửa hàng):</strong>
                    <div style={{ color: '#334155', marginTop: '2px' }}>{c.buyer.name} ({c.buyer.phone || c.buyer.email || 'N/A'})</div>
                  </div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>Bên bán (Chủ vựa):</strong>
                    <div style={{ color: '#334155', marginTop: '2px' }}>{c.supplier.businessName} ({c.supplier.user?.phone || c.supplier.user?.email || 'N/A'})</div>
                  </div>
                  <div>
                    <strong style={{ color: '#0f172a' }}>Giá trị đơn:</strong>
                    <div style={{ color: '#0284c7', fontWeight: 600, marginTop: '2px' }}>
                      Tổng: {Number(c.order.total).toLocaleString('vi-VN')} ₫ · Cọc: {Number(c.order.depositAmount).toLocaleString('vi-VN')} ₫ ({c.order.depositStatus})
                    </div>
                  </div>
                </div>

                {/* Complaint Details */}
                <div style={{ marginBottom: '14px', fontSize: '14px', lineHeight: 1.6 }}>
                  <div style={{ marginBottom: '6px' }}>
                    <strong style={{ color: '#b91c1c' }}>Lý do khiếu nại:</strong> {c.reason}
                  </div>
                  <div style={{ color: '#334155', whiteSpace: 'pre-wrap' }}>
                    <strong>Nội dung & Kháng cáo:</strong> {c.description}
                  </div>
                  {c.response && (
                    <div style={{ marginTop: '8px', padding: '10px 12px', background: '#fffbeb', border: '1px solid #fef08a', borderRadius: '6px', color: '#854d0e' }}>
                      <strong>Phản hồi / Bác bỏ của Chủ vựa:</strong> {c.response}
                    </div>
                  )}
                </div>

                {/* Images */}
                {c.imageUrl && (
                  <div style={{ marginBottom: '14px' }}>
                    <strong style={{ fontSize: '13px', color: '#475569', display: 'block', marginBottom: '6px' }}>Hình ảnh bằng chứng:</strong>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {c.imageUrl.split(',').map((url, idx) => (
                        <img
                          key={idx}
                          src={url.trim()}
                          alt="Bằng chứng"
                          style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                          onClick={() => setViewingImage(url.trim())}
                          title="Bấm để xem ảnh phóng to"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons for Escalated Disputes */}
                {isEscalated && (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="table-button danger"
                      style={{ background: '#16a34a', borderColor: '#15803d', color: '#ffffff', fontWeight: 600, padding: '8px 16px' }}
                      disabled={busyId === c.id}
                      onClick={() => handleResolve(c.id, 'FAVOR_BUYER')}
                    >
                      Xử Cửa Hàng Thắng (Hoàn 100% Tiền)
                    </button>
                    <button
                      type="button"
                      className="table-button"
                      style={{ background: '#475569', color: '#ffffff', borderColor: '#334155', fontWeight: 600, padding: '8px 16px' }}
                      disabled={busyId === c.id}
                      onClick={() => handleResolve(c.id, 'FAVOR_SUPPLIER')}
                    >
                      Xử Chủ Vựa Thắng (Giải Ngân Cọc)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Image Preview */}
      {viewingImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setViewingImage(null)}
        >
          <img
            src={viewingImage}
            alt="Bằng chứng phóng to"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', background: '#fff' }}
          />
        </div>
      )}
    </div>
  );
}
