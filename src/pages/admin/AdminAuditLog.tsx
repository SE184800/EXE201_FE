import { useState, type ReactNode } from 'react';
import { DateFields, Empty, Heading, LoadState, Pager, Panel } from './admin.shared';
import { dateTime, defaultPeriod, money, useAdminData } from './admin.data';
import type { AdminTabProps, List } from './admin.types';

type Log = {
  id: number;
  actorId: number | null;
  actor: { name: string; username: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  details: Record<string, unknown>;
};

const actionLabels: Record<string, string> = {
  ACCOUNT_STATUS_CHANGED: 'Đổi trạng thái tài khoản',
  SUBSCRIPTION_UNLOCKED_BY_ADMIN: 'Admin mở khóa gói sử dụng',
  SUPPLIER_VERIFICATION_REVIEWED: 'Duyệt hồ sơ chủ vựa',
  SUPPLIER_VERIFICATION_SUBMITTED: 'Gửi hồ sơ xác minh',
  SUPPLIER_PROFILE_UPDATED: 'Cập nhật hồ sơ gian hàng',
  COMMISSION_RATE_CHANGED: 'Đổi tỷ lệ hoa hồng',
  COMMISSION_RECEIVED: 'Xác nhận thu hoa hồng',
  PRODUCT_CREATED: 'Thêm sản phẩm',
  PRODUCT_UPDATED: 'Cập nhật giá / sản phẩm',
  PRODUCT_HIDDEN: 'Ẩn sản phẩm',
  HOLIDAY_CREATED: 'Thêm cấu hình ngày lễ',
  HOLIDAY_UPDATED: 'Sửa cấu hình ngày lễ',
  HOLIDAY_DELETED: 'Xóa cấu hình ngày lễ',
  QUOTE_SENT: 'Gửi báo giá tiếp thị',
  QUOTE_ACCEPTED: 'Chấp nhận báo giá',
  QUOTE_REJECTED: 'Từ chối báo giá',
  QUOTE_CANCELLED: 'Hủy báo giá',
  DEPOSIT_SIMULATED: 'Xác nhận cọc mô phỏng (dữ liệu cũ)',
  DEPOSIT_SUBMITTED: 'Cửa hàng báo đã chuyển cọc',
  DEPOSIT_SANDBOX_SUBMITTED: 'Cửa hàng chạy thanh toán cọc sandbox',
  DEPOSIT_CONFIRMED: 'Chủ vựa xác nhận nhận cọc',
  DEPOSIT_REJECTED: 'Chủ vựa từ chối cọc',
  DEPOSIT_REFUNDED: 'Chủ vựa xác nhận hoàn cọc',
  ORDER_CREATED_FROM_QUOTE: 'Tạo đơn từ báo giá',
  ORDER_CREATED: 'Tạo đơn hàng',
  ORDER_STATUS_CHANGED: 'Cập nhật tiến độ đơn',
  SUBSCRIPTION_RENEWED: 'Gia hạn gói sử dụng',
  PERSONAL_PROFILE_UPDATED: 'Đổi thông tin cá nhân',
  PASSWORD_CHANGED: 'Đổi mật khẩu',
  PASSWORD_RESET: 'Khôi phục mật khẩu',
  ORDER_SETTLED_TO_SUPPLIER: 'Quyết toán tiền đơn hàng cho chủ vựa',
  ORDER_REFUNDED: 'Hoàn tiền đơn hàng',
  ORDER_PAID_WITH_WALLET: 'Thanh toán đơn hàng bằng ví',
  DEPOSIT_REQUESTED: 'Tạo yêu cầu nạp tiền',
  QR_DEPOSIT_REQUESTED: 'Tạo mã QR nạp tiền',
  QR_DEPOSIT_CONFIRMED: 'Xác nhận nạp tiền qua QR',
  SEPAY_WEBHOOK_DEPOSIT_CONFIRMED: 'Hệ thống SePay tự động nạp tiền',
  DEPOSIT_APPROVED: 'Duyệt yêu cầu nạp tiền',
  SANDBOX_DEPOSIT_CREATED: 'Nạp tiền thử nghiệm (Sandbox)',
  WITHDRAWAL_REQUESTED: 'Tạo yêu cầu rút tiền',
  WITHDRAWAL_APPROVED: 'Duyệt yêu cầu rút tiền',
  WITHDRAWAL_REJECTED: 'Từ chối yêu cầu rút tiền',
  WITHDRAWAL_COMPLETED: 'Hoàn tất chuyển khoản rút tiền',
  WITHDRAWAL_FAILED: 'Thất bại khi chuyển tiền rút',
  SANDBOX_WITHDRAWAL_CREATED: 'Rút tiền thử nghiệm (Sandbox)',
  SYSTEM_CONFIG_UPDATED: 'Cập nhật tham số sàn',
  SYSTEM_CONFIG_RESET: 'Khôi phục tham số mặc định',
  FORBIDDEN_KEYWORD_ADDED: 'Thêm từ khóa cấm',
  FORBIDDEN_KEYWORD_REMOVED: 'Xóa từ khóa cấm',
  RESTRICTED_KEYWORD_ADDED: 'Thêm từ khóa cảnh báo',
  RESTRICTED_KEYWORD_REMOVED: 'Xóa từ khóa cảnh báo',
  STOCK_MOVEMENT: 'Biến động tồn kho',
  INVENTORY_UPDATED: 'Cập nhật kho tiệm',
  INVENTORY_CREATED: 'Thêm hàng vào kho',
  INVENTORY_RECEIVED: 'Nhập hàng vào kho',
  INVENTORY_IMPORTED: 'Nhập hàng vào kho',
  COMPLAINT_RESOLVED_CONSENSUS: 'Thống nhất xử lý khiếu nại',
  COMPLAINT_WITHDRAWN: 'Rút khiếu nại',
  COMPLAINT_AUTO_TIMEOUT_CLOSED: 'Tự động đóng khiếu nại (quá hạn)',
  DELIVERY_TIME_REQUESTED: 'Đề xuất giờ giao hàng',
  DELIVERY_TIME_RESPONDED: 'Phản hồi giờ giao hàng',
  ORDER_CANCELLED_BY_STORE: 'Tạp hóa hủy đơn',
  ORDER_COMPLETED: 'Đơn hàng hoàn tất',
  ORDER_IMPORTED_TO_INVENTORY: 'Nhập đơn hàng vào kho',
  SUPPLIER_VERIFICATION_RESUBMITTED: 'Nộp lại hồ sơ xác minh',
  SUPPLIER_QUICK_VERIFIED: 'Kích hoạt xác minh nhanh',
  PRODUCT_AI_MODERATION_APPROVED: 'Duyệt sản phẩm qua AI',
  PRODUCT_AI_MODERATION_REJECTED: 'Từ chối sản phẩm qua AI',
  WITHDRAWAL_COMPLETED_VIA_SEPAY: 'Chuyển khoản rút tiền qua SePay',
};

const entityLabels: Record<string, string> = {
  ORDER: 'Đơn hàng',
  SUBSCRIPTION: 'Gói sử dụng',
  USER: 'Tài khoản',
  SUPPLIER: 'Chủ vựa',
  PRODUCT: 'Sản phẩm',
  DEPOSIT_REQUEST: 'Yêu cầu nạp',
  WITHDRAWAL_REQUEST: 'Yêu cầu rút',
  SETTING: 'Tham số sàn',
  HOLIDAY: 'Lịch sự kiện',
  QUOTE: 'Báo giá',
  SYSTEM: 'Hệ thống',
  INVENTORY: 'Kho tiệm',
  COMPLAINT: 'Khiếu nại',
};

const fieldTranslations: Record<string, string> = {
  strictness: 'Mức kiểm duyệt',
  autoModerationEnabled: 'Tự động kiểm duyệt',
  forbiddenWordsCount: 'Số từ cấm',
  restrictedWordsCount: 'Số từ cảnh báo',
  defaultDepositRate: 'Tỷ lệ cọc mặc định',
  maxDepositRate: 'Tỷ lệ cọc tối đa',
  orderAutoCancelHours: 'Thời hạn tự hủy đơn',
  complaintWindowHours: 'Thời hạn khiếu nại',
  maxConsignmentItems: 'Sản phẩm ký gửi tối đa',
  minDepositAmount: 'Mức nạp tối thiểu',
  name: 'Tên',
  action: 'Hành động',
  status: 'Trạng thái',
  price: 'Giá',
  stock: 'Tồn kho',
  active: 'Hoạt động',
  packaging: 'Quy cách',
};

const valueTranslations: Record<string, string> = {
  true: 'Bật',
  false: 'Tắt',
  STANDARD: 'Tiêu chuẩn',
  STRICT: 'Nghiêm ngặt',
  LENIENT: 'Nới lỏng',
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngưng hoạt động',
  SUSPENDED: 'Tạm khóa',
  BANNED: 'Bị cấm',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

function formatLogSummary(details: Record<string, unknown>): ReactNode {
  if (!details || Object.keys(details).length === 0) {
    return <span className="text-muted">—</span>;
  }

  // 1. Quyết toán tiền đơn hàng
  if (details.amount !== undefined && details.grossAmount !== undefined) {
    const net = Number(details.amount) || 0;
    const gross = Number(details.grossAmount) || 0;
    const comm = Number(details.commissionAmount) || 0;
    return (
      <div className="admin-log-summary">
        <div>
          Thực nhận: <strong>{money(net)}</strong>
        </div>
        <small>
          Tổng đơn: {money(gross)} · Phí sàn: {money(comm)}
        </small>
      </div>
    );
  }

  // 2. Gói sử dụng / gia hạn / mở khóa
  if (details.periodEnd) {
    const amt = Number(details.amount) || 0;
    const methodStr = details.method === 'WALLET' ? 'Ví tiền' : details.method ? String(details.method) : '';
    const endDt = new Date(String(details.periodEnd)).toLocaleDateString('vi-VN');
    const rawReason = details.reason || details.note || details.adminNote;
    const reason = rawReason ? String(rawReason) : '';
    return (
      <div className="admin-log-summary">
        <div>
          {amt > 0 ? (
            <>
              <strong>{money(amt)}</strong>
              {methodStr && ` · ${methodStr}`}
            </>
          ) : (
            <strong>Gia hạn / Mở khóa</strong>
          )}
        </div>
        <small>Hạn dùng: {endDt}{reason ? ` · Lý do: ${reason}` : ''}</small>
      </div>
    );
  }

  // 3. Thay đổi cấu hình ngày lễ
  if (details.name && (details.startDate || details.endDate)) {
    return (
      <div className="admin-log-summary">
        <div>
          Sự kiện: <strong>{String(details.name)}</strong>
        </div>
        <small>Thời gian: {String(details.startDate || '')} → {String(details.endDate || '')}</small>
      </div>
    );
  }

  // 3.1. Thống nhất phương án khiếu nại
  if (details.finalOutcome || details.proposedAction) {
    const outcomeMap: Record<string, string> = {
      AGREED_RETURN_REFUND: 'Trả hàng & Hoàn tiền',
      AGREED_REPLACE_0VND: 'Đổi hàng mới 0đ',
      AGREED_DEDUCT_COD: 'Khấu trừ tiền khi nhận hàng',
      AGREED_DISCUSS: 'Hai bên tự trao đổi',
      AGREED_REJECT: 'Từ chối khiếu nại',
      RETURN_REFUND: 'Trả hàng & Hoàn tiền',
      AGREE_REPLACE_0VND: 'Đổi hàng mới 0đ',
      DEDUCT_COD: 'Khấu trừ tiền khi nhận hàng',
      REJECT: 'Từ chối khiếu nại',
    };
    const outcome = outcomeMap[String(details.finalOutcome || details.proposedAction)] || String(details.finalOutcome || details.proposedAction);
    const deduct = details.agreedDeductAmount ? `Khấu trừ: ${money(Number(details.agreedDeductAmount))}` : '';
    const orderStr = details.orderId ? `Đơn hàng #${details.orderId}` : '';
    return (
      <div className="admin-log-summary">
        <div>Phương án: <strong>{outcome}</strong></div>
        <small>{[orderStr, deduct].filter(Boolean).join(' · ')}</small>
      </div>
    );
  }

  // 4. Biến động kho hàng (STOCK_MOVEMENT)
  if (details.type !== undefined && details.before !== undefined && details.after !== undefined) {
    const b = Number(details.before) || 0;
    const a = Number(details.after) || 0;
    const type = String(details.type);
    let title = `Tồn kho: ${b} → ${a}`;
    if (type === 'SALE') {
      title = `Bán lẻ: Tồn ${b} → Còn ${a}`;
    } else if (type === 'RECEIPT') {
      title = `Nhập kho: Tồn ${b} → Tăng lên ${a}`;
    } else if (type === 'ADJUSTMENT') {
      title = `Kiểm kê điều chỉnh: ${b} → ${a}`;
    } else if (type === 'EXPIRED_DISCARD') {
      title = `Hủy hàng hết hạn: Tồn ${b} → Còn ${a}`;
    }

    const price = details.unitSalePrice !== undefined && Number(details.unitSalePrice) > 0
      ? `Đơn giá: ${money(Number(details.unitSalePrice))}`
      : '';

    return (
      <div className="admin-log-summary">
        <div><strong>{title}</strong></div>
        {price && <small>{price}</small>}
      </div>
    );
  }

  // 5. Cập nhật thông tin hàng hóa kho tiệm (INVENTORY_UPDATED)
  if (details.before && details.after && typeof details.before === 'object' && typeof details.after === 'object') {
    const b = details.before as Record<string, unknown>;
    const a = details.after as Record<string, unknown>;

    const changes: string[] = [];
    if (a.name && b.name && a.name !== b.name) {
      changes.push(`Đổi tên: ${String(a.name)}`);
    }
    if (a.sellingPrice !== undefined && b.sellingPrice !== undefined && a.sellingPrice !== b.sellingPrice) {
      changes.push(`Giá bán: ${money(Number(b.sellingPrice) || 0)} → ${money(Number(a.sellingPrice) || 0)}`);
    }
    if (a.quantity !== undefined && b.quantity !== undefined && a.quantity !== b.quantity) {
      changes.push(`Tồn: ${b.quantity} → ${a.quantity} ${String(a.unit || b.unit || '')}`);
    }
    if (a.unit && b.unit && a.unit !== b.unit) {
      changes.push(`Đơn vị: ${String(b.unit)} → ${String(a.unit)}`);
    }

    if (changes.length > 0) {
      return (
        <div className="admin-log-summary">
          <div><strong>{changes[0]}</strong></div>
          {changes.length > 1 && <small>{changes.slice(1).join(' · ')}</small>}
        </div>
      );
    }

    const prodName = String(a.name || b.name || '');
    const priceStr = a.sellingPrice !== undefined ? `Giá: ${money(Number(a.sellingPrice) || 0)}` : '';
    const qtyStr = a.quantity !== undefined ? `Tồn: ${a.quantity} ${String(a.unit || b.unit || '')}` : '';
    return (
      <div className="admin-log-summary">
        <div>Cập nhật hàng: <strong>{prodName || 'Sản phẩm'}</strong></div>
        <small>{[priceStr, qtyStr].filter(Boolean).join(' · ')}</small>
      </div>
    );
  }

  // 6. Thêm hàng vào kho tiệm (INVENTORY_CREATED)
  if (details.name && details.sellingPrice !== undefined && details.quantity !== undefined) {
    return (
      <div className="admin-log-summary">
        <div>Thêm hàng: <strong>{String(details.name)}</strong></div>
        <small>Tồn ban đầu: {String(details.quantity)} · Giá bán: {money(Number(details.sellingPrice) || 0)}</small>
      </div>
    );
  }

  // 7. Nhập kho hàng tiệm (INVENTORY_RECEIVED)
  if (details.total !== undefined && details.quantity !== undefined) {
    return (
      <div className="admin-log-summary">
        <div>Nhập thêm: <strong>+{String(details.quantity)}</strong></div>
        <small>Tổng tồn sau nhập: {String(details.total)}{details.supplierName ? ` · Nguồn: ${String(details.supplierName)}` : ''}</small>
      </div>
    );
  }

  // 8. Thay đổi trạng thái (before -> after)
  if (details.before !== undefined && details.after !== undefined) {
    const rawReason = details.reason || details.note || details.adminNote;
    const reason = rawReason ? String(rawReason) : '';
    const beforeStr = typeof details.before === 'object' ? 'Dữ liệu cũ' : String(details.before);
    const afterStr = typeof details.after === 'object' ? 'Dữ liệu mới' : String(details.after);
    return (
      <div className="admin-log-summary">
        <div>
          <span>{beforeStr}</span>
          {' → '}
          <strong>{afterStr}</strong>
        </div>
        {reason ? <small>Lý do: {reason}</small> : null}
      </div>
    );
  }

  // 5. Giao dịch số tiền đơn lẻ
  if (details.amount !== undefined) {
    const amt = Number(details.amount) || 0;
    const methodStr = details.method === 'VIET_QR' ? 'VietQR' : details.method === 'BANK_TRANSFER' ? 'Chuyển khoản' : '';
    const rawNote = details.adminNote || details.reason || details.note;
    const note = rawNote ? String(rawNote) : '';
    return (
      <div className="admin-log-summary">
        <div>
          Số tiền: <strong>{money(amt)}</strong>
          {methodStr && ` · ${methodStr}`}
        </div>
        {note ? <small>Ghi chú: {note}</small> : null}
      </div>
    );
  }

  // 6. Cập nhật tham số sàn (SYSTEM_CONFIG_UPDATED)
  if (details.strictness !== undefined || details.autoModerationEnabled !== undefined) {
    const isAuto = details.autoModerationEnabled === true ? 'Bật' : 'Tắt';
    const strictMap: Record<string, string> = {
      STANDARD: 'Tiêu chuẩn',
      STRICT: 'Nghiêm ngặt',
      LENIENT: 'Nới lỏng',
    };
    const strictStr = strictMap[String(details.strictness)] || String(details.strictness || 'Tiêu chuẩn');
    const forbidden = details.forbiddenWordsCount !== undefined ? `${details.forbiddenWordsCount} từ cấm` : '';
    const deposit = details.defaultDepositRate !== undefined ? `Cọc: ${details.defaultDepositRate}%` : '';

    return (
      <div className="admin-log-summary">
        <div>
          Kiểm duyệt AI: <strong>{isAuto} ({strictStr})</strong>
        </div>
        <small>{[forbidden, deposit].filter(Boolean).join(' · ')}</small>
      </div>
    );
  }

  // 7. Khôi phục tham số mặc định
  if (details.action === 'RESET_TO_DEFAULT') {
    return (
      <div className="admin-log-summary">
        <strong>Khôi phục tham số mặc định</strong>
      </div>
    );
  }

  // 8. Thêm/xóa từ khóa hoặc cấu hình
  if (details.word) {
    return (
      <div className="admin-log-summary">
        <span>Từ khóa: <strong>{String(details.word)}</strong></span>
      </div>
    );
  }

  // Loại trừ các mã kỹ thuật nội bộ khỏi tóm tắt
  const technicalKeys = new Set([
    'userId',
    'actorId',
    'paymentId',
    'supplierUserId',
    'paymentCreated',
    'periodStart',
    'reference',
  ]);
  const friendlyEntries = Object.entries(details).filter(([k]) => !technicalKeys.has(k));
  if (friendlyEntries.length > 0) {
    return (
      <div className="admin-log-summary">
        <small>
          {friendlyEntries
            .slice(0, 3)
            .map(([k, v]) => {
              const label = fieldTranslations[k] || k;
              const valStr = valueTranslations[String(v)] || String(v);
              return `${label}: ${valStr}`;
            })
            .join(' · ')}
        </small>
      </div>
    );
  }

  return <span className="text-muted">—</span>;
}

export default function AdminAuditLog({ onLogout }: AdminTabProps) {
  const [dates, setDates] = useState(defaultPeriod),
    [action, setAction] = useState(''),
    [entityId, setEntityId] = useState('');
  const [query, setQuery] = useState({ ...defaultPeriod(), action: '', entityId: '', page: 1 }),
    [revision, setRevision] = useState(0);
  const { data, loading, error } = useAdminData<List & { logs: Log[] }>(
    '/admin/audit-logs',
    query,
    onLogout,
    revision,
  );

  return (
    <>
      <Heading
        eyebrow="AUDIT & SECURITY"
        title="Nhật ký hệ thống"
        description="Tra cứu ai đã thay đổi dữ liệu, thay đổi khi nào và nội dung thao tác."
      />
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ ...dates, action, entityId, page: 1 });
          setRevision((n) => n + 1);
        }}
      >
        <DateFields value={dates} onChange={setDates} />
        <label>
          Thao tác
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Tất cả thao tác</option>
            {Object.entries(actionLabels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mã đối tượng
          <input
            maxLength={50}
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="Ví dụ: mã đơn 42"
          />
        </label>
        <button className="admin-primary">Tra cứu</button>
      </form>
      <p className="admin-note">
        Nhật ký chỉ đọc, ghi nhận từ lúc triển khai; không lưu mật khẩu, khóa API hay nội dung hội
        thoại.
      </p>
      <LoadState loading={loading} error={error} />
      {data && (
        <Panel title="Lịch sử thao tác">
          {data.logs.length ? (
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Người thao tác</th>
                    <th>Hoạt động</th>
                    <th>Đối tượng</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => (
                    <tr key={log.id}>
                      <td>{dateTime(log.createdAt)}</td>
                      <td>
                        {log.actor ? (
                          <>
                            <strong>{log.actor.name}</strong>
                            <small>@{log.actor.username}</small>
                          </>
                        ) : log.actorId ? (
                          <>
                            <strong>Tài khoản đã xóa</strong>
                            <small>#{log.actorId}</small>
                          </>
                        ) : (
                          <>
                            <strong>Hệ thống tự động</strong>
                            <small>Tác vụ nền</small>
                          </>
                        )}
                      </td>
                      <td>{actionLabels[log.action] || log.action}</td>
                      <td>
                        <strong>{entityLabels[log.entityType] || log.entityType}</strong>
                        {log.entityId && log.entityId !== 'SYSTEM' && <small> #{log.entityId}</small>}
                        {log.entityId === 'SYSTEM' && <small> (Hệ thống)</small>}
                      </td>
                      <td>{formatLogSummary(log.details)}</td>
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
      )}
    </>
  );
}
