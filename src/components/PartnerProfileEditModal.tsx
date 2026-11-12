import { useState, type ChangeEvent, type FormEvent } from 'react';
import { api, getApiError, getApiFieldErrors } from '../services/api';
import { POPULAR_BANKS } from '../constants/banks';
import type { StoreProfile } from '../pages/ProfilePage';
import { saveSupplierProfile, type SupplierProfile } from '../services/supplier.api';
import { validateQrCodeImage } from '../utils/qrValidator';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  role: 'STORE_OWNER' | 'SUPPLIER';
  storeProfile?: StoreProfile | null;
  supplierProfile?: SupplierProfile | null;
  onSaved: (updatedProfile: any) => void;
};

export default function PartnerProfileEditModal(props: Props) {
  return props.isOpen ? <PartnerProfileEditContent {...props} /> : null;
}

function PartnerProfileEditContent({
  onClose,
  role,
  storeProfile,
  supplierProfile,
  onSaved,
}: Props) {
  const isStore = role === 'STORE_OWNER';

  const [businessName, setBusinessName] = useState(
    isStore ? storeProfile?.storeName || '' : supplierProfile?.businessName || ''
  );
  const [phone, setPhone] = useState(
    isStore ? storeProfile?.storePhone || '' : supplierProfile?.phone || ''
  );
  const [taxCode, setTaxCode] = useState(
    isStore ? storeProfile?.taxCode || '' : supplierProfile?.taxCode || ''
  );
  const [address, setAddress] = useState(
    isStore ? storeProfile?.storeAddress || '' : supplierProfile?.warehouseAddress || ''
  );

  // Store-specific state
  const [businessType, setBusinessType] = useState(
    storeProfile?.businessType || 'Tạp hóa tổng hợp'
  );
  const [locationType, setLocationType] = useState<'STREET_FRONT' | 'ALLEY'>(
    storeProfile?.locationType || 'STREET_FRONT'
  );
  const [alleyDetail, setAlleyDetail] = useState(storeProfile?.alleyDetail || '');

  // Supplier-specific state
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(
    supplierProfile?.deliveryRadiusKm ? String(supplierProfile.deliveryRadiusKm) : '10'
  );
  const [deliveryFee, setDeliveryFee] = useState(
    supplierProfile?.deliveryFee ? String(supplierProfile.deliveryFee) : '25000'
  );

  // Bank state
  const initialBankName = isStore ? storeProfile?.bankName : supplierProfile?.bankName;
  const initialBankAcc = isStore ? storeProfile?.bankAccountNumber : supplierProfile?.bankAccountNumber;
  const initialBankHolder = isStore ? storeProfile?.bankAccountHolder : supplierProfile?.bankAccountHolder;

  const isKnownBank = initialBankName && POPULAR_BANKS.includes(initialBankName);
  const [bankSelect, setBankSelect] = useState(
    initialBankName ? (isKnownBank ? initialBankName : 'Khác') : ''
  );
  const [customBank, setCustomBank] = useState(!isKnownBank && initialBankName ? initialBankName : '');
  const [bankAccountNumber, setBankAccountNumber] = useState(initialBankAcc || '');
  const [bankAccountHolder, setBankAccountHolder] = useState(initialBankHolder || '');
  const [bankQrImageUrl, setBankQrImageUrl] = useState(
    isStore ? storeProfile?.bankQrImageUrl || '' : ''
  );
  const [uploadingQr, setUploadingQr] = useState(false);
  const [qrUploadError, setQrUploadError] = useState('');

  const [saving, setSaving] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
            'Ảnh được tải lên không phải là mã QR. Vui lòng chọn đúng ảnh mã QR ngân hàng.'
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

  function validate() {
    const errors: Record<string, string> = {};

    const cleanName = businessName.trim();
    if (!cleanName || cleanName.length < 2 || cleanName.length > 150) {
      errors.businessName = isStore
        ? 'Tên tiệm tạp hóa cần từ 2 đến 100 ký tự.'
        : 'Tên kho vựa cần từ 2 đến 150 ký tự.';
    }

    const cleanPhone = phone.trim().replace(/[\s().-]/g, '');
    if (!cleanPhone) {
      errors.phone = 'Vui lòng cung cấp số điện thoại liên hệ.';
    } else if (!/^0\d{9}$/.test(cleanPhone)) {
      errors.phone = 'Số điện thoại cần đúng 10 số bắt đầu bằng 0.';
    }

    const cleanTax = taxCode.trim().replace(/\s+/g, '');
    if (!cleanTax) {
      errors.taxCode = 'Vui lòng cung cấp mã số thuế của cơ sở kinh doanh.';
    } else if (!/^[A-Za-z0-9-]{10,14}$/.test(cleanTax)) {
      errors.taxCode = 'Mã số thuế gồm 10 đến 14 ký tự (chữ, số hoặc gạch ngang).';
    }

    const cleanAddr = address.trim();
    if (!cleanAddr || cleanAddr.length < 10 || cleanAddr.length > 255) {
      errors.address = 'Địa chỉ cần chi tiết từ 10 đến 255 ký tự.';
    } else {
      const hasAdmin =
        /(phường|xã|thị trấn|quận|huyện|thị xã|thành phố|tỉnh|tp\.|q\.|h\.|p\.|x\.)/i.test(cleanAddr) ||
        cleanAddr.includes(',') ||
        cleanAddr.split(/\s+/).length >= 5;
      if (!hasAdmin) {
        errors.address = 'Địa chỉ cần ghi rõ cấp hành chính (Số nhà, đường, Phường/Xã, Quận/Huyện, Tỉnh/TP).';
      }
    }

    const effectiveBank = bankSelect === 'Khác' ? customBank.trim() : bankSelect;
    if (!effectiveBank) {
      errors.bankName = 'Vui lòng chọn hoặc nhập tên ngân hàng.';
    }

    const cleanBankAcc = bankAccountNumber.trim().replace(/[\s.-]/g, '');
    if (!cleanBankAcc) {
      errors.bankAccountNumber = 'Vui lòng nhập số tài khoản ngân hàng.';
    } else if (isStore && !/^[A-Za-z0-9]{4,34}$/.test(cleanBankAcc)) {
      errors.bankAccountNumber = 'Số tài khoản ngân hàng không hợp lệ (gồm 4-34 ký tự).';
    } else if (!isStore && !/^\d{6,30}$/.test(cleanBankAcc)) {
      errors.bankAccountNumber = 'Số tài khoản ngân hàng gồm từ 6 đến 30 chữ số.';
    }

    const cleanHolder = bankAccountHolder.trim();
    if (!cleanHolder || cleanHolder.length < 2) {
      errors.bankAccountHolder = 'Vui lòng nhập tên chủ tài khoản ngân hàng.';
    }

    if (!isStore) {
      const radius = Number(deliveryRadiusKm);
      if (Number.isNaN(radius) || radius < 1 || radius > 100) {
        errors.deliveryRadiusKm = 'Bán kính giao hàng từ 1 đến 100 km.';
      }
      const fee = Number(deliveryFee);
      if (Number.isNaN(fee) || fee < 0) {
        errors.deliveryFee = 'Phí giao hàng không hợp lệ.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || uploadingQr) return;
    setError('');

    if (!validate()) return;

    setSaving(true);
    const effectiveBank = bankSelect === 'Khác' ? customBank.trim() : bankSelect;
    const cleanBankAcc = bankAccountNumber.trim().replace(/[\s.-]/g, '');
    const cleanPhone = phone.trim().replace(/[\s().-]/g, '');
    const cleanTax = taxCode.trim().replace(/\s+/g, '');

    try {
      if (isStore) {
        const payload = {
          storeName: businessName.trim().replace(/\s+/g, ' '),
          storeAddress: address.trim().replace(/\s+/g, ' '),
          storePhone: cleanPhone,
          taxCode: cleanTax,
          businessType: businessType.trim() || 'Tạp hóa tổng hợp',
          locationType,
          alleyDetail: locationType === 'ALLEY' ? alleyDetail.trim() : null,
          bankName: effectiveBank,
          bankAccountNumber: cleanBankAcc,
          bankAccountHolder: bankAccountHolder.trim().toUpperCase(),
          bankQrImageUrl: bankQrImageUrl || null,
          resubmit: true,
        };

        const { data } = await api.put<{ storeProfile: StoreProfile; message?: string }>(
          '/profile/store',
          payload
        );
        onSaved(data.storeProfile);
        setSubmittedSuccess(true);
      } else {
        const payload = {
          businessName: businessName.trim().replace(/\s+/g, ' '),
          warehouseAddress: address.trim().replace(/\s+/g, ' '),
          deliveryRadiusKm: Number(deliveryRadiusKm) || 10,
          deliveryFee: Number(deliveryFee) || 0,
          phone: cleanPhone,
          taxCode: cleanTax,
          bankName: effectiveBank,
          bankAccountNumber: cleanBankAcc,
          bankAccountHolder: bankAccountHolder.trim().toUpperCase(),
          resubmit: true,
        };

        const saved = await saveSupplierProfile(payload);
        onSaved(saved);
        setSubmittedSuccess(true);
      }
    } catch (err: unknown) {
      const apiErrs = getApiFieldErrors(err, [
        'storeName',
        'businessName',
        'storeAddress',
        'warehouseAddress',
        'storePhone',
        'phone',
        'taxCode',
        'bankName',
        'bankAccountNumber',
        'bankAccountHolder',
      ]);
      const mapped: Record<string, string> = {};
      if (apiErrs.storeName || apiErrs.businessName) {
        mapped.businessName = (apiErrs.storeName || apiErrs.businessName) as string;
      }
      if (apiErrs.storeAddress || apiErrs.warehouseAddress) {
        mapped.address = (apiErrs.storeAddress || apiErrs.warehouseAddress) as string;
      }
      if (apiErrs.storePhone || apiErrs.phone) {
        mapped.phone = (apiErrs.storePhone || apiErrs.phone) as string;
      }
      if (apiErrs.taxCode) mapped.taxCode = apiErrs.taxCode;
      if (apiErrs.bankName) mapped.bankName = apiErrs.bankName;
      if (apiErrs.bankAccountNumber) mapped.bankAccountNumber = apiErrs.bankAccountNumber;
      if (apiErrs.bankAccountHolder) mapped.bankAccountHolder = apiErrs.bankAccountHolder;
      if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped);
        setError(
          Object.keys(mapped).length === 1
            ? Object.values(mapped)[0]
            : 'Vui lòng kiểm tra lại các thông tin được đánh dấu đỏ bên dưới.'
        );
      } else {
        setError(getApiError(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: submittedSuccess ? '460px' : '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              {submittedSuccess ? 'Thông báo cập nhật' : 'Cập nhật thông tin đăng ký'}
            </h2>
            {!submittedSuccess && (
              <small style={{ color: '#64748b', fontSize: '12.5px' }}>
                Cập nhật lại thông tin đăng ký đầy đủ để gửi Quản trị viên phê duyệt
              </small>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              fontWeight: 700,
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            X
          </button>
        </div>

        {submittedSuccess ? (
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <div
              style={{
                padding: '16px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                color: '#166534',
                fontSize: '15px',
                fontWeight: 600,
                lineHeight: 1.5,
                marginBottom: '20px',
              }}
            >
              Cập nhật thông tin thành công, vui lòng đợi Admin phê duyệt
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 26px',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 650,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#dc2626',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                {isStore ? 'Tên tiệm tạp hóa *' : 'Tên kho vựa / Doanh nghiệp *'}
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={isStore ? 'Ví dụ: Tạp hóa An Khang' : 'Ví dụ: Kho vựa Nông sản Bình Điền'}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${fieldErrors.businessName ? '#dc2626' : '#cbd5e1'}`,
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.businessName && (
                <small style={{ color: '#dc2626', fontSize: '12px' }}>{fieldErrors.businessName}</small>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                  Số điện thoại liên hệ *
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0901234567"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${fieldErrors.phone ? '#dc2626' : '#cbd5e1'}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
                {fieldErrors.phone && (
                  <small style={{ color: '#dc2626', fontSize: '12px' }}>{fieldErrors.phone}</small>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                  Mã số thuế / Mã ĐKKD *
                </label>
                <input
                  type="text"
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  placeholder="0312345678"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${fieldErrors.taxCode ? '#dc2626' : '#cbd5e1'}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
                {fieldErrors.taxCode && (
                  <small style={{ color: '#dc2626', fontSize: '12px' }}>{fieldErrors.taxCode}</small>
                )}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                {isStore ? 'Địa chỉ tiệm tạp hóa *' : 'Địa chỉ kho hàng vựa *'}
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Số nhà, Tên đường, Phường/Xã, Quận/Huyện, Tỉnh/TP"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${fieldErrors.address ? '#dc2626' : '#cbd5e1'}`,
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.address && (
                <small style={{ color: '#dc2626', fontSize: '12px' }}>{fieldErrors.address}</small>
              )}
            </div>

            {isStore && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                    Loại hình kinh doanh
                  </label>
                  <input
                    type="text"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    placeholder="Tạp hóa tổng hợp"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                    Vị trí mặt bằng
                  </label>
                  <select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value as 'STREET_FRONT' | 'ALLEY')}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="STREET_FRONT">Mặt tiền đường lớn</option>
                    <option value="ALLEY">Trong hẻm</option>
                  </select>
                </div>

                {locationType === 'ALLEY' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                      Chi tiết hẻm (độ rộng xe vào)
                    </label>
                    <input
                      type="text"
                      value={alleyDetail}
                      onChange={(e) => setAlleyDetail(e.target.value)}
                      placeholder="Ví dụ: Xe tải nhỏ vào được / Hẻm xe máy"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {!isStore && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                    Bán kính giao hàng (km) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={deliveryRadiusKm}
                    onChange={(e) => setDeliveryRadiusKm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${fieldErrors.deliveryRadiusKm ? '#dc2626' : '#cbd5e1'}`,
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                  {fieldErrors.deliveryRadiusKm && (
                    <small style={{ color: '#dc2626', fontSize: '12px' }}>{fieldErrors.deliveryRadiusKm}</small>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                    Phí giao hàng cơ bản (VNĐ) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${fieldErrors.deliveryFee ? '#dc2626' : '#cbd5e1'}`,
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                  {fieldErrors.deliveryFee && (
                    <small style={{ color: '#dc2626', fontSize: '12px' }}>{fieldErrors.deliveryFee}</small>
                  )}
                </div>
              </div>
            )}

            {/* Banking section */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: '#334155' }}>
                Thông tin tài khoản ngân hàng (nhận thanh toán / đối soát) *
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                    Ngân hàng *
                  </label>
                  <select
                    value={bankSelect}
                    onChange={(e) => {
                      setBankSelect(e.target.value);
                      if (fieldErrors.bankName) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.bankName;
                          return next;
                        });
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${fieldErrors.bankName ? '#dc2626' : '#cbd5e1'}`,
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">-- Chọn ngân hàng --</option>
                    {POPULAR_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  {bankSelect === 'Khác' && (
                    <input
                      type="text"
                      value={customBank}
                      onChange={(e) => {
                        setCustomBank(e.target.value);
                        if (fieldErrors.bankName) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.bankName;
                            return next;
                          });
                        }
                      }}
                      placeholder="Nhập tên ngân hàng"
                      style={{
                        width: '100%',
                        marginTop: '6px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13.5px',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                  {fieldErrors.bankName && (
                    <small style={{ color: '#dc2626', fontSize: '12px' }}>{fieldErrors.bankName}</small>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                    Số tài khoản *
                  </label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={(e) => {
                      setBankAccountNumber(e.target.value.replace(/[^A-Za-z0-9]/g, ''));
                      if (fieldErrors.bankAccountNumber) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.bankAccountNumber;
                          return next;
                        });
                      }
                    }}
                    placeholder="Ví dụ: 0071001234567"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${fieldErrors.bankAccountNumber ? '#dc2626' : '#cbd5e1'}`,
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                  {fieldErrors.bankAccountNumber && (
                    <small style={{ color: '#dc2626', fontSize: '12px' }}>{fieldErrors.bankAccountNumber}</small>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                  Tên chủ tài khoản (In hoa không dấu) *
                </label>
                <input
                  type="text"
                  value={bankAccountHolder}
                  onChange={(e) => {
                    setBankAccountHolder(e.target.value.toUpperCase());
                    if (fieldErrors.bankAccountHolder) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.bankAccountHolder;
                        return next;
                      });
                    }
                  }}
                  placeholder="NGUYEN VAN A"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${fieldErrors.bankAccountHolder ? '#dc2626' : '#cbd5e1'}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
                {fieldErrors.bankAccountHolder && (
                  <small style={{ color: '#dc2626', fontSize: '12px' }}>{fieldErrors.bankAccountHolder}</small>
                )}
              </div>

              {isStore && (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '6px' }}>
                    Ảnh mã QR thanh toán ngân hàng (nếu có)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {bankQrImageUrl && (
                      <div style={{ position: 'relative' }}>
                        <img
                          src={bankQrImageUrl}
                          alt="QR ngân hàng"
                          style={{
                            width: '92px',
                            height: '92px',
                            objectFit: 'contain',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            backgroundColor: '#f8fafc',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setBankQrImageUrl('')}
                          style={{
                            display: 'block',
                            marginTop: '4px',
                            fontSize: '11.5px',
                            color: '#dc2626',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Xóa ảnh QR
                        </button>
                      </div>
                    )}
                    <div>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          background: uploadingQr ? '#f1f5f9' : '#ffffff',
                          color: '#0f172a',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: uploadingQr ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={uploadingQr}
                          onChange={(e) => void handleQrUpload(e)}
                          style={{ display: 'none' }}
                        />
                        <span>{uploadingQr ? 'Đang tải ảnh lên...' : bankQrImageUrl ? 'Đổi ảnh QR' : 'Thêm ảnh'}</span>
                      </label>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                        {uploadingQr ? 'Đang kiểm tra và tải ảnh mã QR...' : 'Định dạng JPG, PNG hoặc WEBP (tối đa 3MB).'}
                      </div>
                      {qrUploadError && (
                        <small style={{ color: '#dc2626', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                          {qrUploadError}
                        </small>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e8f0',
                marginTop: '10px',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || uploadingQr}
                style={{
                  padding: '9px 22px',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: saving || uploadingQr ? 'not-allowed' : 'pointer',
                  opacity: saving || uploadingQr ? 0.7 : 1,
                }}
              >
                {saving ? 'Đang xác nhận...' : 'Xác nhận'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
