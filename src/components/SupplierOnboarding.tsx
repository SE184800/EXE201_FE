import { useState, type FormEvent } from 'react';
import Brand from './Brand';
import Icon from './Icon';
import { getApiError, getApiFieldErrors, isUnauthenticated } from '../services/api';
import { saveSupplierProfile, type SupplierProfile } from '../services/supplier.api';
import type { AuthUser } from '../types/auth';
import { normalizePhone } from '../validation/registration';

type SupplierOnboardingProps = {
  user: AuthUser;
  initialPhone?: string;
  onCompleted: (profile: SupplierProfile) => void;
  onLogout: () => void;
  loggingOut: boolean;
};

type SupplierOnboardingErrors = {
  businessName?: string;
  warehouseAddress?: string;
  phone?: string;
  taxCode?: string;
};

export default function SupplierOnboarding({
  user,
  initialPhone = '',
  onCompleted,
  onLogout,
  loggingOut,
}: SupplierOnboardingProps) {
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState(initialPhone || user.phone || '');
  const [taxCode, setTaxCode] = useState('');
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SupplierOnboardingErrors>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function validate(): SupplierOnboardingErrors {
    const errors: SupplierOnboardingErrors = {};
    const trimmedName = businessName.trim().replace(/\s+/g, ' ');
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 150) {
      errors.businessName = 'Tên gian hàng / đại lý cần từ 2 đến 150 ký tự.';
    }

    const trimmedAddress = warehouseAddress.trim().replace(/\s+/g, ' ');
    if (!trimmedAddress || trimmedAddress.length < 10 || trimmedAddress.length > 255) {
      errors.warehouseAddress =
        'Địa chỉ kho bãi cần chi tiết từ 10 đến 255 ký tự (Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành).';
    }

    const normPhone = normalizePhone(phone);
    if (!normPhone) {
      errors.phone = 'Vui lòng cung cấp số điện thoại liên hệ nhận đơn của kho.';
    } else if (!/^0\d{9}$/.test(normPhone)) {
      errors.phone = 'Số điện thoại cần 10 số bắt đầu bằng 0.';
    }

    const trimmedTax = taxCode.trim().replace(/\s+/g, '');
    if (trimmedTax && !/^[A-Za-z0-9-]{5,30}$/.test(trimmedTax)) {
      errors.taxCode = 'Mã số thuế / ĐKKD gồm 5–30 ký tự (chữ, số hoặc gạch ngang).';
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    setError('');
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError('Vui lòng kiểm tra và hoàn thiện các trường thông tin bắt buộc bên dưới.');
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const payload = {
        businessName: businessName.trim().replace(/\s+/g, ' '),
        warehouseAddress: warehouseAddress.trim().replace(/\s+/g, ' '),
        deliveryRadiusKm: 10,
        deliveryFee: 0,
        phone: normalizePhone(phone),
        taxCode: taxCode.trim().replace(/\s+/g, '') || null,
        bankName: null,
        bankAccountNumber: null,
        bankAccountHolder: null,
      };

      const saved = await saveSupplierProfile(payload);
      onCompleted(saved);
    } catch (issue) {
      const apiErrors = getApiFieldErrors<keyof SupplierOnboardingErrors>(issue, [
        'businessName',
        'warehouseAddress',
        'phone',
        'taxCode',
      ]);
      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors(apiErrors);
      }
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) {
        onLogout();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f1f5f9',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Brand />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '14px', color: '#64748b' }}>
            Xin chào, <strong>{user.name}</strong> (@{user.username}) · Chủ vựa
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={onLogout}
            disabled={loggingOut || saving}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Icon name="logout" />
            {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
      >
        <div
          style={{
            maxWidth: '680px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* Header Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1b382b 0%, #22543d 100%)',
              color: '#ffffff',
              padding: '28px 32px',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#d1fae5',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                padding: '4px 10px',
                borderRadius: '999px',
                marginBottom: '12px',
              }}
            >
              BƯỚC 1/1 · KHỞI TẠO GIAN HÀNG SỈ
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700 }}>
              Đăng ký thông tin Gian hàng & Kho bãi của bạn
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                lineHeight: 1.5,
                color: '#e2e8f0',
                opacity: 0.95,
              }}
            >
              Chào mừng bạn đến với <strong>SupplyMind AI</strong>! Vui lòng hoàn tất thông tin vựa /
              kho hàng để kích hoạt hệ thống đo khoảng cách giao hàng, liên kết các tiệm tạp hóa trong
              khu vực và mở khóa màn hình Tổng quan.
            </p>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} style={{ padding: '32px' }} noValidate>
            {error && (
              <div
                role="alert"
                style={{
                  padding: '12px 16px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '13px',
                  marginBottom: '20px',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Business Name */}
              <div>
                <label
                  htmlFor="supplier-businessName"
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Tên gian hàng / đại lý vựa <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="supplier-businessName"
                  type="text"
                  required
                  disabled={saving}
                  placeholder="Ví dụ: Đại lý Nông sản Minh Phát, Vựa Bách Hóa Sỉ Tân Bình..."
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    if (fieldErrors.businessName)
                      setFieldErrors({ ...fieldErrors, businessName: undefined });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${fieldErrors.businessName ? '#dc2626' : '#cbd5e1'}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                {fieldErrors.businessName && (
                  <span
                    style={{
                      color: '#dc2626',
                      fontSize: '12px',
                      marginTop: '4px',
                      display: 'block',
                    }}
                  >
                    {fieldErrors.businessName}
                  </span>
                )}
              </div>

              {/* Contact Phone */}
              <div>
                <label
                  htmlFor="supplier-phone"
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Số điện thoại nhận đơn / hotline kho <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="supplier-phone"
                  type="tel"
                  required
                  disabled={saving}
                  placeholder="Ví dụ: 0908123789"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${fieldErrors.phone ? '#dc2626' : '#cbd5e1'}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <small
                  style={{
                    color: '#64748b',
                    display: 'block',
                    marginTop: '4px',
                    fontSize: '12px',
                  }}
                >
                  Tự động điền số điện thoại lúc bạn đăng ký tài khoản. Bạn có thể sửa nếu vựa dùng số hotline riêng.
                </small>
                {fieldErrors.phone && (
                  <span
                    style={{
                      color: '#dc2626',
                      fontSize: '12px',
                      marginTop: '4px',
                      display: 'block',
                    }}
                  >
                    {fieldErrors.phone}
                  </span>
                )}
              </div>

              {/* Tax Code */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <label
                    htmlFor="supplier-taxCode"
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1e293b',
                      margin: 0,
                    }}
                  >
                    Mã số thuế / Mã ĐKKD
                  </label>
                  <a
                    href="https://masothue.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '12px',
                      color: '#2563eb',
                      textDecoration: 'underline',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    🔍 Tra cứu mã số thuế (masothue.com)
                  </a>
                </div>
                <input
                  id="supplier-taxCode"
                  type="text"
                  maxLength={30}
                  disabled={saving}
                  placeholder="Ví dụ: 0312345678 (5–30 số hoặc gạch ngang)"
                  value={taxCode}
                  onChange={(e) => {
                    setTaxCode(e.target.value);
                    if (fieldErrors.taxCode) setFieldErrors({ ...fieldErrors, taxCode: undefined });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${fieldErrors.taxCode ? '#dc2626' : '#cbd5e1'}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <small
                  style={{
                    color: '#64748b',
                    display: 'block',
                    marginTop: '4px',
                    fontSize: '12px',
                  }}
                >
                  Có thể tra cứu trực tiếp theo tên doanh nghiệp/hộ kinh doanh hoặc tên chủ vựa trên masothue.com.
                </small>
                {fieldErrors.taxCode && (
                  <span
                    style={{
                      color: '#dc2626',
                      fontSize: '12px',
                      marginTop: '4px',
                      display: 'block',
                    }}
                  >
                    {fieldErrors.taxCode}
                  </span>
                )}
              </div>

              {/* Warehouse Address */}
              <div>
                <label
                  htmlFor="supplier-warehouseAddress"
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Địa chỉ kho bãi chi tiết <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="supplier-warehouseAddress"
                  type="text"
                  required
                  disabled={saving}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
                  value={warehouseAddress}
                  onChange={(e) => {
                    setWarehouseAddress(e.target.value);
                    if (fieldErrors.warehouseAddress)
                      setFieldErrors({ ...fieldErrors, warehouseAddress: undefined });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${fieldErrors.warehouseAddress ? '#dc2626' : '#cbd5e1'}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <small
                  style={{
                    color: '#64748b',
                    display: 'block',
                    marginTop: '4px',
                    fontSize: '12px',
                  }}
                >
                  Địa chỉ kho dùng để <strong>đo khoảng cách giao hàng đến các tiệm tạp hóa</strong>,
                  đối chiếu bán kính nhận đơn và xác thực địa chỉ hợp lệ tránh địa chỉ ma.
                </small>
                {fieldErrors.warehouseAddress && (
                  <span
                    style={{
                      color: '#dc2626',
                      fontSize: '12px',
                      marginTop: '4px',
                      display: 'block',
                    }}
                  >
                    {fieldErrors.warehouseAddress}
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: '28px',
                paddingTop: '20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: '#214e39',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(33, 78, 57, 0.2)',
                }}
              >
                {saving ? 'Đang lưu thông tin…' : 'Hoàn tất đăng ký & Vào Tổng quan →'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
