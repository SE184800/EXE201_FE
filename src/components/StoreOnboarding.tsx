import { useState, type FormEvent, type ChangeEvent } from 'react';
import Brand from './Brand';
import Icon from './Icon';
import { api, getApiError, getApiFieldErrors, isUnauthenticated } from '../services/api';
import type { AuthUser } from '../types/auth';
import type { StoreProfile } from '../pages/ProfilePage';
import { normalizePhone } from '../validation/registration';
import { POPULAR_BANKS } from '../constants/banks';
import { validateQrCodeImage } from '../utils/qrValidator';
import { verifyAddressWithBackend } from '../services/address.api';

type StoreOnboardingProps = {
  user: AuthUser;
  initialPhone?: string;
  onCompleted: (storeProfile: StoreProfile) => void;
  onSignOut: () => void;
  signingOut: boolean;
};

type StoreOnboardingErrors = {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  taxCode?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
};

export default function StoreOnboarding({
  user,
  initialPhone = '',
  onCompleted,
  onSignOut,
  signingOut,
}: StoreOnboardingProps) {
  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState(initialPhone || user.phone || '');
  const [storeAddress, setStoreAddress] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [locationType, setLocationType] = useState<'STREET_FRONT' | 'ALLEY'>('STREET_FRONT');
  const [alleyDetail, setAlleyDetail] = useState<'TRUCK' | 'MOTORBIKE'>('MOTORBIKE');
  const [alleyNote, setAlleyNote] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isAddressVerified, setIsAddressVerified] = useState(false);
  const [verifyingMap, setVerifyingMap] = useState(false);
  const [mapVerifiedAddress, setMapVerifiedAddress] = useState<string | null>(null);
  const [mapVerifyMessage, setMapVerifyMessage] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<'idle' | 'success' | 'not_found' | 'error'>('idle');

  const [fieldErrors, setFieldErrors] = useState<StoreOnboardingErrors>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // 2-Step Onboarding State
  const [step, setStep] = useState<1 | 2>(1);
  const [bankName, setBankName] = useState('Vietcombank');
  const [customBankName, setCustomBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState((user.name || '').toUpperCase());
  const [bankQrImageUrl, setBankQrImageUrl] = useState('');
  const [uploadingQr, setUploadingQr] = useState(false);
  const [qrUploadError, setQrUploadError] = useState('');
  const [bankingError, setBankingError] = useState('');

  async function verifyAddressOnMap() {
    const trimmed = storeAddress.trim();
    if (!trimmed || trimmed.length < 5) {
      setFieldErrors((prev) => ({
        ...prev,
        storeAddress: 'Vui lòng nhập địa chỉ trước khi định vị bản đồ.',
      }));
      return;
    }
    setVerifyingMap(true);
    setMapStatus('idle');
    setMapVerifyMessage(null);

    try {
      const result = await verifyAddressWithBackend(trimmed);
      if (result.verified && result.lat !== null && result.lon !== null) {
        setLatitude(result.lat);
        setLongitude(result.lon);
        setIsAddressVerified(true);
        setMapVerifiedAddress(result.displayName || trimmed);
        setMapStatus('success');
        setFieldErrors((prev) => ({ ...prev, storeAddress: undefined }));
      } else {
        setLatitude(null);
        setLongitude(null);
        setIsAddressVerified(false);
        setMapVerifiedAddress(null);
        setMapVerifyMessage(result.message || null);
        setMapStatus(result.status === 'error' ? 'error' : 'not_found');
      }
    } catch {
      setLatitude(null);
      setLongitude(null);
      setIsAddressVerified(false);
      setMapVerifiedAddress(null);
      setMapVerifyMessage('Không thể kết nối dịch vụ bản đồ số lúc này. Vui lòng thử lại sau.');
      setMapStatus('error');
    } finally {
      setVerifyingMap(false);
    }
  }

  function validate(): StoreOnboardingErrors {
    const errors: StoreOnboardingErrors = {};
    const trimmedName = storeName.trim().replace(/\s+/g, ' ');
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
      errors.storeName = 'Tên tiệm tạp hóa cần từ 2 đến 100 ký tự.';
    }

    const trimmedAddress = storeAddress.trim().replace(/\s+/g, ' ');
    if (!trimmedAddress || trimmedAddress.length < 10 || trimmedAddress.length > 255) {
      errors.storeAddress =
        'Địa chỉ cửa hàng cần chi tiết từ 10 đến 255 ký tự (Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành).';
    } else {
      const hasAdmin =
        /(phường|xã|thị trấn|quận|huyện|thị xã|thành phố|tỉnh|tp\.|q\.|h\.|p\.|x\.)/i.test(trimmedAddress) ||
        trimmedAddress.includes(',') ||
        trimmedAddress.split(/\s+/).length >= 5;
      if (!hasAdmin) {
        errors.storeAddress =
          'Địa chỉ cần ghi rõ cấu trúc: Số nhà, tên đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố.';
      }
    }

    const normPhone = normalizePhone(storePhone);
    if (!normPhone) {
      errors.storePhone = 'Vui lòng cung cấp số điện thoại nhận hàng tại cửa hàng.';
    } else if (!/^0\d{9}$/.test(normPhone)) {
      errors.storePhone = 'Số điện thoại nhận hàng tại tiệm cần 10 số bắt đầu bằng 0.';
    }

    const trimmedTax = taxCode.trim().replace(/\s+/g, '');
    if (!trimmedTax) {
      errors.taxCode = 'Vui lòng nhập mã số thuế của cơ sở kinh doanh.';
    } else if (!/^[A-Za-z0-9-]{10,14}$/.test(trimmedTax)) {
      errors.taxCode = 'Mã số thuế gồm 10–14 ký tự (chữ, số hoặc gạch ngang).';
    }

    return errors;
  }

  async function handleQrUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrUploadError('');

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setQrUploadError('Chỉ chấp nhận file ảnh định dạng JPG, PNG hoặc WEBP.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setQrUploadError('Kích thước ảnh mã QR không được vượt quá 3MB.');
      return;
    }

    setUploadingQr(true);
    try {
      const qrCheck = await validateQrCodeImage(file);
      if (!qrCheck.isValid) {
        setQrUploadError(
          qrCheck.message ||
            'Ảnh được đăng lên không phải là mã QR. Vui lòng chụp hoặc tải lại đúng ảnh mã QR thanh toán của ngân hàng.'
        );
        return;
      }

      const formData = new FormData();
      formData.append('qrImage', file);
      const res = await api.post<{ success: boolean; imageUrl: string; message?: string }>(
        '/profile/upload-bank-qr',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (res.data.imageUrl) {
        setBankQrImageUrl(res.data.imageUrl);
      }
    } catch (issue) {
      setQrUploadError(getApiError(issue));
    } finally {
      setUploadingQr(false);
    }
  }

  function goToStep2(event?: FormEvent) {
    if (event) event.preventDefault();
    setError('');
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError('Vui lòng kiểm tra và hoàn thiện các trường thông tin bắt buộc của cửa hàng bên dưới.');
      return;
    }
    setFieldErrors({});
    setStep(2);
  }

  async function handleSave() {
    if (saving) return;

    setError('');
    setBankingError('');
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setStep(1);
      setError('Vui lòng kiểm tra và hoàn thiện các trường thông tin bắt buộc bên dưới.');
      return;
    }
    setFieldErrors({});

    const cleanAccount = bankAccountNumber.trim().replace(/[\s.-]/g, '');
    const effectiveBankName =
      bankName === 'Khác' ? customBankName.trim() : bankName;
    const bankErrors: StoreOnboardingErrors = {};
    if (!effectiveBankName) {
      bankErrors.bankName = 'Vui lòng chọn hoặc nhập tên ngân hàng thụ hưởng.';
    }
    if (!cleanAccount) {
      bankErrors.bankAccountNumber = 'Vui lòng nhập số tài khoản ngân hàng để phục vụ đối soát và thanh toán.';
    } else if (!/^[A-Za-z0-9]{4,34}$/.test(cleanAccount)) {
      bankErrors.bankAccountNumber = 'Số tài khoản ngân hàng không hợp lệ (4–34 ký tự, chỉ gồm chữ cái và số).';
    }
    const cleanHolder = bankAccountHolder.trim().replace(/\s+/g, ' ');
    if (!cleanHolder || cleanHolder.length < 2) {
      bankErrors.bankAccountHolder = 'Vui lòng nhập tên chủ tài khoản thụ hưởng.';
    }
    if (Object.keys(bankErrors).length > 0) {
      setFieldErrors(bankErrors);
      setBankingError('');
      return;
    }

    setSaving(true);
    try {
      const combinedAlley =
        locationType === 'ALLEY'
          ? `${alleyDetail === 'TRUCK' ? 'Hẻm xe ba gác (≥ 3m)' : 'Hẻm nhỏ chỉ xe máy (< 3m)'}${
              alleyNote.trim() ? ` · ${alleyNote.trim()}` : ''
            }`
          : null;

      const payload = {
        storeName: storeName.trim().replace(/\s+/g, ' '),
        storeAddress: storeAddress.trim().replace(/\s+/g, ' '),
        storePhone: normalizePhone(storePhone),
        taxCode: taxCode.trim().replace(/\s+/g, '') || null,
        businessType: 'Tạp hóa tổng hợp',
        locationType,
        alleyDetail: combinedAlley,
        latitude,
        longitude,
        isAddressVerified,
        bankName: effectiveBankName,
        bankAccountNumber: cleanAccount,
        bankAccountHolder: cleanHolder.toUpperCase(),
        bankQrImageUrl: bankQrImageUrl || null,
      };

      const { data } = await api.put<{ storeProfile: StoreProfile; message?: string }>(
        '/profile/store',
        payload
      );

      onCompleted(data.storeProfile);
    } catch (issue) {
      const apiErrors = getApiFieldErrors<keyof StoreOnboardingErrors>(issue, [
        'storeName',
        'storeAddress',
        'storePhone',
        'taxCode',
        'bankName',
        'bankAccountNumber',
        'bankAccountHolder',
      ]);
      const hasStep1Error = Boolean(
        apiErrors.storeName || apiErrors.storeAddress || apiErrors.storePhone || apiErrors.taxCode
      );
      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors(apiErrors);
        if (hasStep1Error) {
          setStep(1);
          setError(getApiError(issue));
        } else {
          setError('');
          setBankingError('');
        }
      } else {
        setError(getApiError(issue));
      }
      if (isUnauthenticated(issue)) {
        onSignOut();
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
            Xin chào, <strong>{user.name}</strong> (@{user.username})
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={onSignOut}
            disabled={signingOut || saving}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Icon name="logout" />
            {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
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
              background: 'linear-gradient(135deg, #1e3a2f 0%, #295c47 100%)',
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
              {step === 1 ? 'BƯỚC 1/2 · THÔNG TIN CỬA HÀNG' : 'BƯỚC 2/2 · TÀI KHOẢN THANH TOÁN (TÙY CHỌN)'}
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 700 }}>
              {step === 1
                ? 'Đăng ký thông tin Cửa hàng của bạn'
                : 'Thiết lập tài khoản thanh toán & Nhận tiền mặc định'}
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
              {step === 1 ? (
                <>
                  Chào mừng bạn đến với <strong>SupplyMind AI</strong>! Vui lòng hoàn tất thông tin tiệm
                  tạp hóa để kích hoạt hệ thống đo khoảng cách giao hàng, liên kết nguồn sỉ từ các vựa và
                  mở khóa màn hình Tổng quan.
                </>
              ) : (
                <>
                  Thông tin này bắt buộc để kích hoạt thanh toán đơn hàng sỉ, đối soát doanh thu và rút tiền từ Ví nền tảng.
                </>
              )}
            </p>
          </div>

          {/* Form Content */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 1) goToStep2();
              else void handleSave();
            }}
            style={{ padding: '32px' }}
            noValidate
          >
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

            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Store Name */}
              <div>
                <label
                  htmlFor="onboarding-storeName"
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Tên tiệm tạp hóa / cửa hàng <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="onboarding-storeName"
                  type="text"
                  required
                  disabled={saving}
                  placeholder="Ví dụ: Tạp Hóa An Khang, Tiệm Cô Ba, Đại Lý Phúc Lộc..."
                  value={storeName}
                  onChange={(e) => {
                    setStoreName(e.target.value);
                    if (fieldErrors.storeName) setFieldErrors({ ...fieldErrors, storeName: undefined });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${fieldErrors.storeName ? '#dc2626' : '#cbd5e1'}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                {fieldErrors.storeName && (
                  <span
                    style={{
                      color: '#dc2626',
                      fontSize: '12px',
                      marginTop: '4px',
                      display: 'block',
                    }}
                  >
                    {fieldErrors.storeName}
                  </span>
                )}
              </div>

              {/* Store Phone */}
              <div>
                <label
                  htmlFor="onboarding-storePhone"
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Số điện thoại nhận hàng tại tiệm (Hotline cửa hàng){' '}
                  <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="onboarding-storePhone"
                  type="tel"
                  required
                  disabled={saving}
                  placeholder="Ví dụ: 0908123456"
                  value={storePhone}
                  onChange={(e) => {
                    setStorePhone(e.target.value);
                    if (fieldErrors.storePhone) setFieldErrors({ ...fieldErrors, storePhone: undefined });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${fieldErrors.storePhone ? '#dc2626' : '#cbd5e1'}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <small style={{ color: '#64748b', display: 'block', marginTop: '4px', fontSize: '12px' }}>
                  Tự động điền số điện thoại lúc bạn đăng ký. Hệ thống sẽ so sánh để đảm bảo không trùng với tiệm khác.
                </small>
                {fieldErrors.storePhone && (
                  <span
                    style={{
                      color: '#dc2626',
                      fontSize: '12px',
                      marginTop: '4px',
                      display: 'block',
                    }}
                  >
                    {fieldErrors.storePhone}
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
                    htmlFor="onboarding-taxCode"
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1e293b',
                      margin: 0,
                    }}
                  >
                    Mã số thuế (Hộ kinh doanh / Doanh nghiệp) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                </div>
                <input
                  id="onboarding-taxCode"
                  type="text"
                  maxLength={14}
                  disabled={saving}
                  placeholder="Ví dụ: 0316789123 hoặc 0300588569-001"
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
                <small style={{ color: '#64748b', display: 'block', marginTop: '4px', fontSize: '12px' }}>
                  Mã số thuế gồm 10 đến 14 ký tự của cơ sở kinh doanh đã đăng ký.
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

              {/* Location Type (Mặt tiền vs Trong hẻm) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1e293b',
                    marginBottom: '8px',
                  }}
                >
                  Vị trí mặt bằng cửa hàng <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: `2px solid ${locationType === 'STREET_FRONT' ? '#214e39' : '#e2e8f0'}`,
                      background: locationType === 'STREET_FRONT' ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="locationType"
                      checked={locationType === 'STREET_FRONT'}
                      onChange={() => setLocationType('STREET_FRONT')}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>
                        Mặt tiền đường lớn
                      </strong>
                      <small style={{ color: '#64748b', fontSize: '12px' }}>Xe tải giao hàng đỗ tận cửa tiệm</small>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: `2px solid ${locationType === 'ALLEY' ? '#214e39' : '#e2e8f0'}`,
                      background: locationType === 'ALLEY' ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="locationType"
                      checked={locationType === 'ALLEY'}
                      onChange={() => setLocationType('ALLEY')}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>
                        Trong hẻm / ngõ
                      </strong>
                      <small style={{ color: '#64748b', fontSize: '12px' }}>Đường hẹp, chuyển hàng bằng xe máy / ba gác</small>
                    </div>
                  </label>
                </div>

                {locationType === 'ALLEY' && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px 14px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                      Độ rộng hẻm ước lượng để điều phối xe:
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '10px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="alleyWidth"
                          value="TRUCK"
                          checked={alleyDetail === 'TRUCK'}
                          onChange={() => setAlleyDetail('TRUCK')}
                        />
                        Hẻm rộng (≥ 3m) - Ba gác / Xe tải nhỏ vào được
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="alleyWidth"
                          value="MOTORBIKE"
                          checked={alleyDetail === 'MOTORBIKE'}
                          onChange={() => setAlleyDetail('MOTORBIKE')}
                        />
                        Hẻm nhỏ (&lt; 3m) - Chỉ xe máy / Xe đẩy bộ
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="Ghi chú thêm về lối vào (Ví dụ: Cách đầu đường 50m, cua ngã ba thứ hai...)"
                      value={alleyNote}
                      onChange={(e) => setAlleyNote(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Store Address */}
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
                    htmlFor="onboarding-storeAddress"
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1e293b',
                      margin: 0,
                    }}
                  >
                    Địa chỉ cửa hàng chi tiết <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={verifyAddressOnMap}
                    disabled={verifyingMap || !storeAddress.trim()}
                    style={{
                      fontSize: '12px',
                      color: '#1d4ed8',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: verifyingMap || !storeAddress.trim() ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {verifyingMap ? 'Đang định vị…' : 'Kiểm tra trên bản đồ số'}
                  </button>
                </div>
                <input
                  id="onboarding-storeAddress"
                  type="text"
                  required
                  disabled={saving}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
                  value={storeAddress}
                  onChange={(e) => {
                    setStoreAddress(e.target.value);
                    if (fieldErrors.storeAddress) setFieldErrors({ ...fieldErrors, storeAddress: undefined });
                    setMapStatus('idle');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${fieldErrors.storeAddress ? '#dc2626' : '#cbd5e1'}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />

                {/* Map verification status badge */}
                {mapStatus === 'success' && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '10px 14px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: '#166534',
                    }}
                  >
                    <strong>Đã tìm thấy trên bản đồ số:</strong> {mapVerifiedAddress}
                    {latitude && longitude && (
                      <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                        Tọa độ: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                      </div>
                    )}
                  </div>
                )}

                {mapStatus === 'not_found' && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '10px 14px',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#92400e',
                    }}
                  >
                    <strong>Chưa xác minh được địa chỉ trên bản đồ số.</strong>{' '}
                    {mapVerifyMessage ||
                      'Vui lòng ghi rõ: Số nhà, Tên đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố đầy đủ (ví dụ: 221 Đường Trịnh Đình Trọng, Tân Phú, TP. Hồ Chí Minh).'}
                  </div>
                )}

                {mapStatus === 'error' && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#64748b',
                    }}
                  >
                    {mapVerifyMessage || 'Tạm thời không kết nối được dịch vụ bản đồ số. Vui lòng thử lại sau.'}
                  </div>
                )}

                <small style={{ color: '#64748b', display: 'block', marginTop: '6px', fontSize: '12px' }}>
                  Địa chỉ này sẽ dùng làm <strong>địa chỉ mặc định khi tạo đơn mua sỉ</strong> từ các
                  vựa, đo khoảng cách giao hàng và chống trùng lặp với các tiệm khác.
                </small>
                {fieldErrors.storeAddress && (
                  <span
                    style={{
                      color: '#dc2626',
                      fontSize: '12px',
                      marginTop: '4px',
                      display: 'block',
                    }}
                  >
                    {fieldErrors.storeAddress}
                  </span>
                )}
              </div>
            </div>
          )}

            {/* Bottom Actions for Step 1 */}
            {step === 1 && (
              <div
                style={{
                  marginTop: '28px',
                  paddingTop: '20px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => goToStep2()}
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
                    Thiết lập tài khoản ngân hàng →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Banking & Default Payout Account */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div
                  style={{
                    padding: '14px 16px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '10px',
                    color: '#166534',
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Tiện ích tự động điền (Không bắt buộc):</strong> Tài khoản này sẽ được lưu làm thông tin mặc định khi bạn thực hiện nạp hoặc rút tiền trong Ví. Khi rút tiền, bạn vẫn có quyền nhập một tài khoản khác nếu cần.
                </div>

                {bankingError && (
                  <div
                    role="alert"
                    style={{
                      padding: '12px 16px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      color: '#b91c1c',
                      fontSize: '13px',
                    }}
                  >
                    {bankingError}
                  </div>
                )}

                {/* Ngân hàng */}
                <div>
                  <label
                    htmlFor="onboarding-bankName"
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1e293b',
                      marginBottom: '6px',
                    }}
                  >
                    Ngân hàng nhận tiền / chuyển khoản
                  </label>
                  <select
                    id="onboarding-bankName"
                    value={bankName}
                    disabled={saving}
                    onChange={(e) => {
                      setBankName(e.target.value);
                      if (fieldErrors.bankName) setFieldErrors((prev) => ({ ...prev, bankName: undefined }));
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: `1px solid ${fieldErrors.bankName ? '#dc2626' : '#cbd5e1'}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {POPULAR_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  {bankName === 'Khác' && (
                    <div style={{ marginTop: '10px' }}>
                      <label
                        htmlFor="onboarding-customBankName"
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#1e293b',
                          marginBottom: '4px',
                        }}
                      >
                        Nhập tên ngân hàng của bạn
                      </label>
                      <input
                        id="onboarding-customBankName"
                        type="text"
                        disabled={saving}
                        value={customBankName}
                        onChange={(e) => {
                          setCustomBankName(e.target.value);
                          if (fieldErrors.bankName) setFieldErrors((prev) => ({ ...prev, bankName: undefined }));
                        }}
                        placeholder="Ví dụ: Shinhan Bank, Woori Bank, PVcomBank..."
                        maxLength={100}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: `1px solid ${fieldErrors.bankName ? '#dc2626' : '#cbd5e1'}`,
                          borderRadius: '8px',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}
                  {fieldErrors.bankName && (
                    <small style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.bankName}
                    </small>
                  )}
                </div>

                {/* Số tài khoản */}
                <div>
                  <label
                    htmlFor="onboarding-bankAccountNumber"
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1e293b',
                      marginBottom: '6px',
                    }}
                  >
                    Số tài khoản ngân hàng
                  </label>
                  <input
                    id="onboarding-bankAccountNumber"
                    type="text"
                    disabled={saving}
                    value={bankAccountNumber}
                    aria-invalid={Boolean(fieldErrors.bankAccountNumber)}
                    onChange={(e) => {
                      setBankingError('');
                      setError('');
                      setBankAccountNumber(e.target.value.replace(/[^A-Za-z0-9]/g, ''));
                      if (fieldErrors.bankAccountNumber) {
                        setFieldErrors((prev) => ({ ...prev, bankAccountNumber: undefined }));
                      }
                    }}
                    placeholder="Ví dụ: 0071001234567"
                    maxLength={34}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: `1px solid ${fieldErrors.bankAccountNumber ? '#dc2626' : '#cbd5e1'}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      letterSpacing: '0.04em',
                    }}
                  />
                  {fieldErrors.bankAccountNumber ? (
                    <small role="alert" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block', fontWeight: 500 }}>
                      {fieldErrors.bankAccountNumber}
                    </small>
                  ) : (
                    <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      Chỉ gồm chữ số và chữ cái (từ 4 đến 34 ký tự), không dấu và không khoảng trắng.
                    </small>
                  )}
                </div>

                {/* Tên chủ tài khoản */}
                <div>
                  <label
                    htmlFor="onboarding-bankAccountHolder"
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1e293b',
                      marginBottom: '6px',
                    }}
                  >
                    Tên chủ tài khoản (In hoa không dấu)
                  </label>
                  <input
                    id="onboarding-bankAccountHolder"
                    type="text"
                    disabled={saving}
                    value={bankAccountHolder}
                    aria-invalid={Boolean(fieldErrors.bankAccountHolder)}
                    onChange={(e) => {
                      setBankAccountHolder(e.target.value.toUpperCase());
                      if (fieldErrors.bankAccountHolder) {
                        setFieldErrors((prev) => ({ ...prev, bankAccountHolder: undefined }));
                      }
                    }}
                    placeholder="Ví dụ: NGUYEN VAN A"
                    maxLength={100}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: `1px solid ${fieldErrors.bankAccountHolder ? '#dc2626' : '#cbd5e1'}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      textTransform: 'uppercase',
                    }}
                  />
                  {fieldErrors.bankAccountHolder && (
                    <small style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.bankAccountHolder}
                    </small>
                  )}
                </div>

                {/* Tải ảnh mã QR */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1e293b',
                      marginBottom: '6px',
                    }}
                  >
                    Ảnh mã QR nhận tiền (Không bắt buộc)
                  </label>
                  {bankQrImageUrl ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        background: '#f8fafc',
                      }}
                    >
                      <img
                        src={bankQrImageUrl}
                        alt="Mã QR ngân hàng"
                        style={{
                          width: '80px',
                          height: '80px',
                          objectFit: 'cover',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#15803d', fontWeight: 600 }}>
                          Đã tải ảnh mã QR lên hệ thống
                        </p>
                        <button
                          type="button"
                          onClick={() => setBankQrImageUrl('')}
                          style={{
                            fontSize: '12px',
                            color: '#dc2626',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Xóa ảnh QR này
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '9px 16px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          background: uploadingQr || saving ? '#f1f5f9' : '#ffffff',
                          color: '#0f172a',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          cursor: uploadingQr || saving ? 'not-allowed' : 'pointer',
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                        }}
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={uploadingQr || saving}
                          onChange={(e) => void handleQrUpload(e)}
                          style={{ display: 'none' }}
                        />
                        <span>{uploadingQr ? 'Đang tải ảnh lên...' : bankQrImageUrl ? 'Đổi ảnh QR' : 'Thêm ảnh'}</span>
                      </label>
                      {uploadingQr && (
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#2563eb' }}>
                          Đang tải ảnh lên…
                        </span>
                      )}
                      {qrUploadError && (
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626' }}>
                          {qrUploadError}
                        </p>
                      )}
                      <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        Hỗ trợ ảnh JPG, PNG, WEBP tối đa 3MB. Máy chủ tự động kiểm tra định dạng an toàn.
                      </small>
                    </div>
                  )}
                </div>

                {/* Bottom Actions for Step 2 - Side by Side */}
                <div
                  style={{
                    marginTop: '28px',
                    paddingTop: '20px',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={saving}
                    style={{
                      background: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '12px 20px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ← Quay lại sửa thông tin tiệm
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSave()}
                    style={{
                      background: '#214e39',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 26px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.7 : 1,
                      boxShadow: '0 2px 4px rgba(33, 78, 57, 0.2)',
                    }}
                  >
                    {saving ? 'Đang lưu…' : 'Lưu tài khoản & Hoàn tất →'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
