import { useEffect, useState, type SetStateAction } from 'react';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import { Heading, LoadState, Metric } from './admin.shared';
import { useAdminData } from './admin.data';
import type { AdminTabProps } from './admin.types';

type SystemConfig = {
  aiModeration: {
    autoModerationEnabled: boolean;
    strictness: 'STANDARD' | 'STRICT' | 'LENIENT';
    criticalForbiddenKeywords: string[];
    restrictedKeywords: string[];
    minSuspiciousPrice: number;
    warningLowPrice: number;
    maxSuspiciousPrice: number;
    maxMoq: number;
    warningMoq: number;
  };
  escrowDeposit: {
    defaultDepositRate: number;
    minDepositRate: number;
    maxDepositRate: number;
    requireDepositForHighValue: boolean;
    highValueThreshold: number;
    escrowHoldDays: number;
    description: string;
  };
  orderAndDelivery?: {
    orderAutoCancelHours?: number;
    complaintWindowHours?: number;
    deliveryAllowedStartHour?: number;
    deliveryAllowedEndHour?: number;
    autoCompleteDeliveredHours?: number;
    allowWeekendDelivery?: boolean;
  };
  consignment?: {
    maxConsignmentItemsPerStore?: number;
    settlementCycleDays?: number;
    allowConsignmentForUnverified?: boolean;
  };
  walletLimits?: {
    minDepositAmount?: number;
    minWithdrawalAmount?: number;
    maxDailyWithdrawalAmount?: number;
    autoApproveWithdrawalThreshold?: number;
  };
  systemNotice?: {
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
    maintenanceUntil?: string | null;
    announcementEnabled?: boolean;
    announcementTitle?: string;
    announcementContent?: string;
    announcementType?: 'INFO' | 'WARNING' | 'ALERT';
  };
  updatedAt: string;
  updatedBy: string | null;
};

type ConfigTabKey = 'all' | 'order' | 'escrow' | 'wallet' | 'ai' | 'notice';

export default function AdminSystemConfig({ onLogout }: AdminTabProps) {
  const [revision, setRevision] = useState(0);
  const [configTab, setConfigTab] = useState<ConfigTabKey>('all');
  const { data, loading, error } = useAdminData<SystemConfig>(
    '/admin/system-config',
    {},
    onLogout,
    revision
  );

  const [draft, setDraft] = useState<{ source: SystemConfig; value: SystemConfig } | null>(null);
  const rawForm = draft && draft.source === data ? draft.value : (data ?? null);

  function setForm(update: SetStateAction<SystemConfig | null>) {
    setDraft((previous) => {
      const current = previous && previous.source === data ? previous.value : (data ?? null);
      const next = typeof update === 'function' ? update(current) : update;
      return next && data ? { source: data, value: next } : null;
    });
  }

  const [newForbiddenWord, setNewForbiddenWord] = useState('');
  const [forbiddenSearch, setForbiddenSearch] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(''), 4000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  if (loading && !rawForm) {
    return <LoadState loading={true} error="" />;
  }

  if (error && !rawForm) {
    return <LoadState loading={false} error={error} />;
  }

  if (!rawForm) return null;

  // Normalize with safe defaults
  const form: SystemConfig = {
    ...rawForm,
    orderAndDelivery: {
      orderAutoCancelHours: rawForm.orderAndDelivery?.orderAutoCancelHours ?? 4,
      complaintWindowHours: rawForm.orderAndDelivery?.complaintWindowHours ?? 24,
      deliveryAllowedStartHour: rawForm.orderAndDelivery?.deliveryAllowedStartHour ?? 5,
      deliveryAllowedEndHour: rawForm.orderAndDelivery?.deliveryAllowedEndHour ?? 21,
      autoCompleteDeliveredHours: rawForm.orderAndDelivery?.autoCompleteDeliveredHours ?? 48,
      allowWeekendDelivery: rawForm.orderAndDelivery?.allowWeekendDelivery ?? true,
    },
    consignment: {
      maxConsignmentItemsPerStore: rawForm.consignment?.maxConsignmentItemsPerStore ?? 5,
      settlementCycleDays: rawForm.consignment?.settlementCycleDays ?? 7,
      allowConsignmentForUnverified: rawForm.consignment?.allowConsignmentForUnverified ?? false,
    },
    walletLimits: {
      minDepositAmount: rawForm.walletLimits?.minDepositAmount ?? 50000,
      minWithdrawalAmount: rawForm.walletLimits?.minWithdrawalAmount ?? 100000,
      maxDailyWithdrawalAmount: rawForm.walletLimits?.maxDailyWithdrawalAmount ?? 50000000,
      autoApproveWithdrawalThreshold: rawForm.walletLimits?.autoApproveWithdrawalThreshold ?? 2000000,
    },
    systemNotice: {
      maintenanceMode: rawForm.systemNotice?.maintenanceMode ?? false,
      maintenanceMessage:
        rawForm.systemNotice?.maintenanceMessage ??
        'Hệ thống SupplyMind đang bảo trì nâng cấp hệ thống định kỳ. Quý khách vui lòng quay lại sau.',
      maintenanceUntil: rawForm.systemNotice?.maintenanceUntil ?? null,
      announcementEnabled: rawForm.systemNotice?.announcementEnabled ?? false,
      announcementTitle: rawForm.systemNotice?.announcementTitle ?? 'Thông báo từ Ban Quản Trị Sàn SupplyMind',
      announcementContent: rawForm.systemNotice?.announcementContent ?? '',
      announcementType: rawForm.systemNotice?.announcementType ?? 'INFO',
    },
  };

  function handleAddForbidden() {
    const trimmed = newForbiddenWord.trim().toLowerCase();
    if (!trimmed) return;
    if (form.aiModeration.criticalForbiddenKeywords.includes(trimmed)) {
      alert('Từ cấm này đã có trong danh sách.');
      return;
    }
    setForm((curr: SystemConfig | null) => {
      if (!curr) return curr;
      return {
        ...curr,
        aiModeration: {
          ...curr.aiModeration,
          criticalForbiddenKeywords: [...curr.aiModeration.criticalForbiddenKeywords, trimmed],
        },
      };
    });
    setNewForbiddenWord('');
  }

  function handleRemoveForbidden(word: string) {
    setForm((curr: SystemConfig | null) => {
      if (!curr) return curr;
      return {
        ...curr,
        aiModeration: {
          ...curr.aiModeration,
          criticalForbiddenKeywords: curr.aiModeration.criticalForbiddenKeywords.filter((w: string) => w !== word),
        },
      };
    });
  }

  async function handleSaveAll() {
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      await api.put('/admin/system-config', form);
      setSaveSuccess('Đã lưu toàn bộ cấu hình tham số sàn và chính sách vận hành thành công!');
      setRevision((n) => n + 1);
    } catch (e) {
      setSaveError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmReset() {
    setShowResetConfirm(false);
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      await api.post('/admin/system-config/reset');
      setSaveSuccess('Đã khôi phục toàn bộ cấu hình về mặc định ban đầu thành công!');
      setRevision((n) => n + 1);
    } catch (e) {
      setSaveError(getApiError(e));
      if (isUnauthenticated(e)) onLogout();
    } finally {
      setSaving(false);
    }
  }

  const filteredForbidden = form.aiModeration.criticalForbiddenKeywords.filter((w) =>
    !forbiddenSearch ? true : w.toLowerCase().includes(forbiddenSearch.toLowerCase())
  );

  return (
    <>
      <Heading
        eyebrow="SYSTEM CONFIGURATION & POLICIES"
        title="Cấu hình Tham số Sàn & Chính sách Vận hành"
        description="Trung tâm can thiệp và kiểm soát toàn diện: SLA giao nhận, tỷ lệ cọc ký quỹ Escrow, chính sách ký gửi tiếp thị, hạn mức ví nạp/rút, từ cấm kiểm duyệt AI và thông báo bảo trì toàn sàn."
        action={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              disabled={saving}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Khôi phục mặc định
            </button>
            <button
              type="button"
              className="admin-primary"
              onClick={handleSaveAll}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {saving ? 'Đang lưu…' : 'Lưu toàn bộ cấu hình'}
            </button>
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="admin-metrics three" style={{ marginBottom: '18px' }}>
        <Metric
          label="SLA Tự Hủy Đơn Sỉ"
          value={`${form.orderAndDelivery?.orderAutoCancelHours} giờ`}
        />
        <Metric
          label="Ký quỹ Escrow Chuẩn"
          value={`${form.escrowDeposit.defaultDepositRate}%`}
        />
        <Metric
          label="Duyệt Rút Tự Động"
          value={`${((form.walletLimits?.autoApproveWithdrawalThreshold || 0) / 1000000).toLocaleString('vi-VN')} tr ₫`}
        />
      </div>

      {/* Navigation Tabs for Configuration */}
      <div className="admin-config-tabs">
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'all' ? 'active' : ''}`}
          onClick={() => setConfigTab('all')}
        >
          Tất cả cấu hình
        </button>
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'order' ? 'active' : ''}`}
          onClick={() => setConfigTab('order')}
        >
          1. Đơn hàng & SLA giao hàng
        </button>
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'escrow' ? 'active' : ''}`}
          onClick={() => setConfigTab('escrow')}
        >
          2. Ký quỹ & Đặt cọc sỉ
        </button>
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'wallet' ? 'active' : ''}`}
          onClick={() => setConfigTab('wallet')}
        >
          3. Hạn mức Ví & Nạp rút
        </button>
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'ai' ? 'active' : ''}`}
          onClick={() => setConfigTab('ai')}
        >
          4. Kiểm duyệt AI & Từ cấm
        </button>
        <button
          type="button"
          className={`admin-config-tab-btn ${configTab === 'notice' ? 'active' : ''}`}
          onClick={() => setConfigTab('notice')}
        >
          5. Thông báo sàn & Bảo trì
        </button>
      </div>

      {saveSuccess && (
        <p
          role="status"
          style={{
            backgroundColor: '#dcfce7',
            color: '#15803d',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1px solid #bbf7d0',
            fontWeight: 600,
            marginBottom: '20px',
          }}
        >
          {saveSuccess}
        </p>
      )}

      {saveError && (
        <p role="alert" className="error-notice" style={{ marginBottom: '20px' }}>
          {saveError}
        </p>
      )}

      <div className="admin-config-container">
        {/* CARD 1: CẤU HÌNH ĐƠN HÀNG & SLA GIAO HÀNG */}
        {(configTab === 'all' || configTab === 'order') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label" style={{ color: '#0284c7' }}>SLA VẬN HÀNH & ĐƠN HÀNG</span>
              <h2>Chính sách Đặt hàng & SLA Giao hàng</h2>
              <p>
                Thiết lập giới hạn thời gian chủ vựa tiếp nhận đơn sỉ, thời hạn cho phép tiệm khiếu nại và khung giờ giao hàng trong ngày.
              </p>
            </div>

            <div className="admin-config-grid">
              <div className="admin-config-field">
                <label htmlFor="orderAutoCancelHours">Thời hạn vựa tiếp nhận đơn trước khi tự hủy (giờ)</label>
                <input
                  id="orderAutoCancelHours"
                  type="number"
                  min={1}
                  max={72}
                  value={form.orderAndDelivery?.orderAutoCancelHours}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      orderAndDelivery: {
                        ...form.orderAndDelivery,
                        orderAutoCancelHours: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="complaintWindowHours">Thời hạn khiếu nại sau khi nhận hàng (giờ)</label>
                <input
                  id="complaintWindowHours"
                  type="number"
                  min={1}
                  max={168}
                  value={form.orderAndDelivery?.complaintWindowHours}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      orderAndDelivery: {
                        ...form.orderAndDelivery,
                        complaintWindowHours: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="autoCompleteDeliveredHours">Thời hạn tự động hoàn tất đơn sau khi giao (giờ)</label>
                <input
                  id="autoCompleteDeliveredHours"
                  type="number"
                  min={12}
                  max={168}
                  value={form.orderAndDelivery?.autoCompleteDeliveredHours}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      orderAndDelivery: {
                        ...form.orderAndDelivery,
                        autoCompleteDeliveredHours: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label>Khung giờ giao hàng cho phép trong ngày</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    placeholder="Từ (giờ)"
                    style={{ width: '100px' }}
                    value={form.orderAndDelivery?.deliveryAllowedStartHour}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        orderAndDelivery: {
                          ...form.orderAndDelivery,
                          deliveryAllowedStartHour: Number(e.target.value),
                        },
                      })
                    }
                  />
                  <span>đến</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    placeholder="Đến (giờ)"
                    style={{ width: '100px' }}
                    value={form.orderAndDelivery?.deliveryAllowedEndHour}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        orderAndDelivery: {
                          ...form.orderAndDelivery,
                          deliveryAllowedEndHour: Number(e.target.value),
                        },
                      })
                    }
                  />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>giờ hàng ngày</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px' }} className="admin-config-toggle">
              <span>
                <strong>Cho phép chuyến xe giao hàng vào cuối tuần (Thứ Bảy & Chủ Nhật)</strong>
              </span>
              <input
                type="checkbox"
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                checked={form.orderAndDelivery?.allowWeekendDelivery}
                onChange={(e) =>
                  setForm({
                    ...form,
                    orderAndDelivery: {
                      ...form.orderAndDelivery,
                      allowWeekendDelivery: e.target.checked,
                    },
                  })
                }
              />
            </div>
          </section>
        )}

        {/* CARD 2: CẤU HÌNH PHẦN TRĂM KÝ QUỸ ESCROW */}
        {(configTab === 'all' || configTab === 'escrow') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label">CHÍNH SÁCH BẢO ĐẢM TÀI CHÍNH</span>
              <h2>Tỷ lệ phần trăm ký quỹ (Escrow Deposit Rate)</h2>
              <p>
                Điều chỉnh tỷ lệ phần trăm tiền cọc đảm bảo hợp đồng sỉ giữa tiệm tạp hóa và chủ vựa. Tiền cọc được tạm giữ an toàn trong hệ thống ký quỹ cho đến khi đơn hàng hoàn tất.
              </p>
            </div>

            <div className="admin-config-grid">
              <div className="admin-config-field">
                <label htmlFor="defaultDepositRate">Tỷ lệ cọc áp dụng cho báo giá mới (%)</label>
                <input
                  id="defaultDepositRate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.escrowDeposit.defaultDepositRate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      escrowDeposit: {
                        ...form.escrowDeposit,
                        defaultDepositRate: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="maxDepositRate">Tỷ lệ ký quỹ tối đa cho phép (%)</label>
                <input
                  id="maxDepositRate"
                  type="number"
                  min={form.escrowDeposit.minDepositRate}
                  max={100}
                  step={0.5}
                  value={form.escrowDeposit.maxDepositRate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      escrowDeposit: {
                        ...form.escrowDeposit,
                        maxDepositRate: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="highValueThreshold">Ngưỡng đơn giá trị cao (VNĐ)</label>
                <input
                  id="highValueThreshold"
                  type="number"
                  min={0}
                  step={500000}
                  value={form.escrowDeposit.highValueThreshold}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      escrowDeposit: {
                        ...form.escrowDeposit,
                        highValueThreshold: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="escrowHoldDays">Thời gian tạm giữ ký quỹ sau khi giao (ngày)</label>
                <input
                  id="escrowHoldDays"
                  type="number"
                  min={0}
                  max={30}
                  value={form.escrowDeposit.escrowHoldDays}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      escrowDeposit: {
                        ...form.escrowDeposit,
                        escrowHoldDays: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </div>
          </section>
        )}

        {/* CARD 3: CẤU HÌNH HẠN MỨC VÍ & NẠP RÚT */}
        {(configTab === 'all' || configTab === 'wallet') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label" style={{ color: '#7c3aed' }}>KIỂM SOÁT TÀI CHÍNH & VÍ ĐIỆN TỬ</span>
              <h2>Hạn mức Ví & Kiểm soát Nạp / Rút Tiền</h2>
              <p>
                Thiết lập hạn mức nạp rút tối thiểu, tối đa mỗi ngày và ngưỡng duyệt tự động nhằm phòng ngừa rủi ro chiếm đoạt ví và rửa tiền.
              </p>
            </div>

            <div className="admin-config-grid">
              <div className="admin-config-field">
                <label htmlFor="minDepositAmount">Số tiền nạp tối thiểu mỗi giao dịch (VNĐ)</label>
                <input
                  id="minDepositAmount"
                  type="number"
                  min={10000}
                  step={10000}
                  value={form.walletLimits?.minDepositAmount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      walletLimits: {
                        ...form.walletLimits,
                        minDepositAmount: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="minWithdrawalAmount">Số tiền rút tối thiểu mỗi giao dịch (VNĐ)</label>
                <input
                  id="minWithdrawalAmount"
                  type="number"
                  min={10000}
                  step={10000}
                  value={form.walletLimits?.minWithdrawalAmount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      walletLimits: {
                        ...form.walletLimits,
                        minWithdrawalAmount: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="maxDailyWithdrawalAmount">Hạn mức rút tiền tối đa mỗi ngày (VNĐ/tài khoản)</label>
                <input
                  id="maxDailyWithdrawalAmount"
                  type="number"
                  min={500000}
                  step={5000000}
                  value={form.walletLimits?.maxDailyWithdrawalAmount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      walletLimits: {
                        ...form.walletLimits,
                        maxDailyWithdrawalAmount: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="autoApproveWithdrawalThreshold">Ngưỡng tự động duyệt lệnh rút tiền (VNĐ)</label>
                <input
                  id="autoApproveWithdrawalThreshold"
                  type="number"
                  min={0}
                  step={500000}
                  value={form.walletLimits?.autoApproveWithdrawalThreshold}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      walletLimits: {
                        ...form.walletLimits,
                        autoApproveWithdrawalThreshold: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </div>
          </section>
        )}

        {/* CARD 4: CẤU HÌNH THÔNG BÁO SÀN & BẢO TRÌ */}
        {(configTab === 'all' || configTab === 'notice') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label" style={{ color: '#ea580c' }}>TRẠNG THÁI NỀN TẢNG & TRUYỀN THÔNG</span>
              <h2>Thông báo Toàn sàn & Chế độ Bảo trì</h2>
              <p>
                Phát đi thông báo khẩn cấp (thời tiết, bão lũ, kỳ nghỉ lễ Tết) đến toàn bộ tiệm tạp hóa và chủ vựa hoặc bật chế độ bảo trì kỹ thuật.
              </p>
            </div>

            <div className="admin-config-toggle">
              <span>
                <strong>Bật chế độ bảo trì hệ thống toàn sàn (Maintenance Mode)</strong>
              </span>
              <input
                type="checkbox"
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                checked={form.systemNotice?.maintenanceMode}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm({
                    ...form,
                    systemNotice: {
                      ...form.systemNotice,
                      maintenanceMode: checked,
                      maintenanceUntil: checked
                        ? form.systemNotice?.maintenanceUntil || new Date(Date.now() + 60 * 60000).toISOString()
                        : null,
                    },
                  });
                }}
              />
            </div>

            {form.systemNotice?.maintenanceMode && (
              <>
                <div className="admin-config-field" style={{ marginBottom: '16px' }}>
                  <label htmlFor="maintenanceMessage">Lời nhắn thông báo bảo trì hiển thị cho người dùng</label>
                  <textarea
                    id="maintenanceMessage"
                    rows={3}
                    value={form.systemNotice?.maintenanceMessage}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        systemNotice: {
                          ...form.systemNotice,
                          maintenanceMessage: e.target.value,
                        },
                      })
                    }
                  />
                </div>

                <div
                  className="admin-config-field"
                  style={{
                    marginBottom: '20px',
                    padding: '14px 16px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <label htmlFor="maintenanceUntil" style={{ fontWeight: 600, color: '#0f172a' }}>
                    ⏰ Thời gian kết thúc bảo trì dự kiến (Tự động mở lại hệ thống sau mốc này)
                  </label>
                  <p style={{ margin: '4px 0 10px', fontSize: '12.5px', color: '#64748b' }}>
                    Chọn thời điểm trong tương lai. Màn hình bảo trì sẽ hiển thị bộ đếm ngược. Khi hết giờ, hệ thống sẽ tự động chuyển về trạng thái hoạt động bình thường mà không cần Admin phải tắt thủ công.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      id="maintenanceUntil"
                      type="datetime-local"
                      value={
                        form.systemNotice?.maintenanceUntil
                          ? new Date(new Date(form.systemNotice.maintenanceUntil).getTime() - new Date().getTimezoneOffset() * 60000)
                              .toISOString()
                              .slice(0, 16)
                          : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                        setForm({
                          ...form,
                          systemNotice: {
                            ...form.systemNotice,
                            maintenanceUntil: val,
                          },
                        });
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        maxWidth: '240px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[
                        { label: '+30 phút', mins: 30 },
                        { label: '+1 giờ', mins: 60 },
                        { label: '+2 giờ', mins: 120 },
                        { label: '+4 giờ', mins: 240 },
                      ].map((preset) => (
                        <button
                          key={preset.mins}
                          type="button"
                          onClick={() => {
                            const d = new Date(Date.now() + preset.mins * 60000);
                            setForm({
                              ...form,
                              systemNotice: {
                                ...form.systemNotice,
                                maintenanceUntil: d.toISOString(),
                              },
                            });
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            color: '#334155',
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                      {form.systemNotice?.maintenanceUntil && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              ...form,
                              systemNotice: {
                                ...form.systemNotice,
                                maintenanceUntil: null,
                              },
                            });
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: '#fee2e2',
                            border: '1px solid #fca5a5',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            color: '#b91c1c',
                          }}
                        >
                          ✕ Bỏ hẹn giờ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="admin-config-toggle">
              <span>
                <strong>Kích hoạt Banner thông báo khẩn cấp toàn sàn</strong>
              </span>
              <input
                type="checkbox"
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                checked={form.systemNotice?.announcementEnabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    systemNotice: {
                      ...form.systemNotice,
                      announcementEnabled: e.target.checked,
                    },
                  })
                }
              />
            </div>

            {form.systemNotice?.announcementEnabled && (
              <div className="admin-config-grid" style={{ marginTop: '12px' }}>
                <div className="admin-config-field">
                  <label htmlFor="announcementTitle">Tiêu đề thông báo</label>
                  <input
                    id="announcementTitle"
                    type="text"
                    placeholder="VD: Cảnh báo bão số 6 ảnh hưởng các tuyến vận chuyển nông sản miền Trung..."
                    value={form.systemNotice?.announcementTitle}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        systemNotice: {
                          ...form.systemNotice,
                          announcementTitle: e.target.value,
                        },
                      })
                    }
                  />
                </div>

                <div className="admin-config-field">
                  <label htmlFor="announcementType">Mức độ ưu tiên thông báo</label>
                  <select
                    id="announcementType"
                    value={form.systemNotice?.announcementType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        systemNotice: {
                          ...form.systemNotice,
                          announcementType: e.target.value as 'INFO' | 'WARNING' | 'ALERT',
                        },
                      })
                    }
                  >
                    <option value="INFO">Thông tin chung (Màu xanh dương)</option>
                    <option value="WARNING">Cảnh báo lưu ý (Màu vàng cam)</option>
                    <option value="ALERT">Khẩn cấp nghiêm trọng (Màu đỏ)</option>
                  </select>
                </div>

                <div className="admin-config-field" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="announcementContent">Nội dung chi tiết thông báo</label>
                  <textarea
                    id="announcementContent"
                    rows={3}
                    placeholder="Nhập nội dung chi tiết thông báo gửi đến các chủ tiệm và chủ vựa..."
                    value={form.systemNotice?.announcementContent}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        systemNotice: {
                          ...form.systemNotice,
                          announcementContent: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* CARD 5: CÀI ĐẶT THUẬT TOÁN & NGƯỠNG RỦI RO AI */}
        {(configTab === 'all' || configTab === 'ai') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label">QUY TẮC PHÁ GIÁ & SỐ LƯỢNG ẢO</span>
              <h2>Cài đặt Thuật toán AI & Ngưỡng Rủi ro</h2>
              <p>
                Điều chỉnh các ngưỡng giá tối thiểu/tối đa và số lượng MOQ để AI phát hiện kịp thời các hành vi phá giá, tạo đơn ảo hoặc số lượng phi thực tế.
              </p>
            </div>

            <div className="admin-config-toggle">
              <span>
                <strong>Kích hoạt tính năng AI kiểm duyệt tự động</strong>
              </span>
              <input
                type="checkbox"
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                checked={form.aiModeration.autoModerationEnabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    aiModeration: {
                      ...form.aiModeration,
                      autoModerationEnabled: e.target.checked,
                    },
                  })
                }
              />
            </div>

            <div className="admin-config-grid">
              <div className="admin-config-field">
                <label htmlFor="strictness">Độ nghiêm ngặt của AI</label>
                <select
                  id="strictness"
                  value={form.aiModeration.strictness}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      aiModeration: {
                        ...form.aiModeration,
                        strictness: e.target.value as 'STANDARD' | 'STRICT' | 'LENIENT',
                      },
                    })
                  }
                >
                  <option value="STANDARD">Tiêu chuẩn (Khuyên dùng - Cân bằng kiểm duyệt)</option>
                  <option value="STRICT">Nghiêm ngặt (Tăng độ nhạy cảnh báo 25%, kiểm soát chặt)</option>
                  <option value="LENIENT">Linh hoạt (Nới lỏng, chỉ chặn vi phạm nặng)</option>
                </select>
              </div>

              <div className="admin-config-field">
                <label htmlFor="minSuspiciousPrice">Giá sỉ tối thiểu nghi vấn giá ảo / phá giá (VNĐ)</label>
                <input
                  id="minSuspiciousPrice"
                  type="number"
                  min={0}
                  step={100}
                  value={form.aiModeration.minSuspiciousPrice}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      aiModeration: {
                        ...form.aiModeration,
                        minSuspiciousPrice: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="warningLowPrice">Giá sỉ thấp bất thường cần xác minh (VNĐ)</label>
                <input
                  id="warningLowPrice"
                  type="number"
                  min={form.aiModeration.minSuspiciousPrice}
                  step={500}
                  value={form.aiModeration.warningLowPrice}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      aiModeration: {
                        ...form.aiModeration,
                        warningLowPrice: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="maxSuspiciousPrice">Giá sỉ tối đa bất thường (VNĐ)</label>
                <input
                  id="maxSuspiciousPrice"
                  type="number"
                  min={form.aiModeration.warningLowPrice}
                  step={10000000}
                  value={form.aiModeration.maxSuspiciousPrice}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      aiModeration: {
                        ...form.aiModeration,
                        maxSuspiciousPrice: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="maxMoq">Số lượng MOQ tối đa phi thực tế</label>
                <input
                  id="maxMoq"
                  type="number"
                  min={1}
                  step={1000}
                  value={form.aiModeration.maxMoq}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      aiModeration: {
                        ...form.aiModeration,
                        maxMoq: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="admin-config-field">
                <label htmlFor="warningMoq">Ngưỡng MOQ cao cần kiểm tra</label>
                <input
                  id="warningMoq"
                  type="number"
                  min={1}
                  max={form.aiModeration.maxMoq}
                  step={500}
                  value={form.aiModeration.warningMoq}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      aiModeration: {
                        ...form.aiModeration,
                        warningMoq: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </div>
          </section>
        )}

        {/* CARD 6: QUẢN LÝ TỪ CẤM NGHIÊM TRỌNG */}
        {(configTab === 'all' || configTab === 'ai') && (
          <section className="admin-config-card">
            <div className="admin-config-card-header">
              <span className="admin-mini-label" style={{ color: '#b91c1c' }}>TỰ ĐỘNG CẤM ĐĂNG BÁN</span>
              <h2>Quản lý Danh sách Từ cấm Nghiêm trọng</h2>
              <p>
                Khi sản phẩm có chứa bất kỳ từ cấm nào bên dưới (trong tên, danh mục, quy cách hoặc mô tả), AI sẽ ngay lập tức từ chối và cấm đăng bán thẳng để bảo vệ an toàn sàn.
              </p>
            </div>

            <div className="admin-tag-input-row">
              <input
                type="text"
                placeholder="Nhập từ cấm mới (VD: tiền giả, pháo sáng, súng bắn cát...) rồi nhấn Thêm"
                value={newForbiddenWord}
                onChange={(e) => setNewForbiddenWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddForbidden();
                  }
                }}
              />
              <button
                type="button"
                className="admin-primary"
                onClick={handleAddForbidden}
                disabled={!newForbiddenWord.trim()}
                style={{ padding: '9px 18px', whiteSpace: 'nowrap' }}
              >
                + Thêm từ cấm
              </button>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                Tổng cộng {form.aiModeration.criticalForbiddenKeywords.length} từ cấm:
              </span>
              <input
                type="text"
                placeholder="Lọc nhanh từ cấm..."
                value={forbiddenSearch}
                onChange={(e) => setForbiddenSearch(e.target.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  maxWidth: '200px',
                }}
              />
            </div>

            <div className="admin-tag-cloud">
              {filteredForbidden.length > 0 ? (
                filteredForbidden.map((word) => (
                  <span key={word} className="admin-tag-chip critical">
                    <span>{word}</span>
                    <button
                      type="button"
                      className="admin-tag-remove-btn"
                      onClick={() => handleRemoveForbidden(word)}
                      title={`Xóa từ "${word}" khỏi danh sách từ cấm`}
                      aria-label={`Xóa ${word}`}
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px' }}>
                  Không tìm thấy từ cấm nào khớp với tìm kiếm.
                </span>
              )}
            </div>
          </section>
        )}

        {/* BOTTOM ACTION BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '14px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            disabled={saving}
            style={{
              padding: '11px 20px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: 'pointer',
            }}
          >
            Khôi phục mặc định
          </button>
          <button
            type="button"
            className="admin-primary"
            onClick={handleSaveAll}
            disabled={saving}
            style={{
              padding: '11px 24px',
              fontSize: '14px',
              fontWeight: 650,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {saving ? 'Đang lưu…' : 'Lưu toàn bộ cấu hình'}
          </button>
        </div>
      </div>

      {/* MODAL XÁC NHẬN KHÔI PHỤC MẶC ĐỊNH (THAY THẾ WINDOW.CONFIRM BROWSER DIALOG) */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
            backdropFilter: 'blur(3px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setShowResetConfirm(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0',
            }}
          >
            <div
              style={{
                padding: '18px 24px 14px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>
                Xác nhận khôi phục mặc định
              </h3>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={saving}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '22px',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: '0 0 14px 0', fontSize: '14px', color: '#334155', lineHeight: 1.55 }}>
                Bạn có chắc chắn muốn khôi phục toàn bộ tham số sàn và chính sách vận hành về giá trị mặc định ban đầu?
              </p>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  color: '#92400E',
                  lineHeight: 1.5,
                }}
              >
                <strong>Lưu ý:</strong> Toàn bộ các thông số SLA giao hàng, tỷ lệ ký quỹ Escrow, hạn mức ví nạp/rút và cấu hình từ cấm AI sẽ được thiết lập lại về cấu hình gốc của hệ thống.
              </div>
            </div>

            <div
              style={{
                padding: '16px 24px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={saving}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={saving}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                }}
              >
                {saving ? 'Đang khôi phục…' : 'Xác nhận khôi phục'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
