import { useEffect, useState, type FormEvent } from 'react';
import BirthDateInput from '../components/BirthDateInput';
import { api, getApiError, getApiFieldErrors, isUnauthenticated } from '../services/api';
import { ROLE_DETAILS, type Role } from '../types/auth';
import { getBirthDateRange, normalizePhone } from '../validation/registration';
import { getMyContract, type UserContract } from '../services/contract.api';
import type { SupplierProfile } from '../services/supplier.api';
import ContractSigningModal from '../components/ContractSigningModal';
import ContractViewModal from '../components/ContractViewModal';
import { POPULAR_BANKS } from '../constants/banks';
import { validateQrCodeImage } from '../utils/qrValidator';
import { resolveAddressCoordinates } from '../utils/geo';

export type StoreProfile = {
  userId: number;
  storeName: string;
  storeAddress: string;
  storePhone: string | null;
  taxCode?: string | null;
  businessType: string;
  isConfigured: boolean;
  locationType?: 'STREET_FRONT' | 'ALLEY';
  alleyDetail?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isAddressVerified?: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankQrImageUrl?: string | null;
};

export type Profile = {
  id?: number;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  role: Role;
  createdAt: string;
  storeProfile?: StoreProfile | null;
  supplierProfile?: SupplierProfile | null;
};

export type ProfileFieldErrors = Partial<
  Record<
    | 'name'
    | 'email'
    | 'phone'
    | 'dateOfBirth'
    | 'storeName'
    | 'storeAddress'
    | 'storePhone'
    | 'taxCode'
    | 'businessName'
    | 'warehouseAddress',
    string
  >
>;

const profileFields: (keyof ProfileFieldErrors)[] = [
  'name',
  'email',
  'phone',
  'dateOfBirth',
  'storeName',
  'storeAddress',
  'storePhone',
  'taxCode',
  'businessName',
  'warehouseAddress',
];

export function validateProfileForm(
  values: {
    name: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    storeName: string;
    storeAddress: string;
    storePhone: string;
    taxCode: string;
    businessName?: string;
    warehouseAddress?: string;
  },
  isStoreOwner: boolean,
  isSupplier: boolean = false
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  // 1. Họ và tên
  const name = values.name.trim().replace(/\s+/g, ' ');
  const nameWithoutSpaces = name.replace(/\s/g, '');
  if (nameWithoutSpaces.length < 2 || name.length > 100) {
    errors.name = 'Họ tên cần 2–100 ký tự (không tính khoảng trắng).';
  }

  // 2. Email (nếu nhập)
  const email = values.email.trim().toLowerCase();
  if (email) {
    const localPart = email.split('@')[0] || '';
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ||
      email.length > 255 ||
      !/^[\x21-\x7E]+$/.test(email) ||
      /\s/.test(email) ||
      localPart.replace(/\s/g, '').length < 2
    ) {
      errors.email = 'Nhập email hợp lệ, không dấu và tối đa 255 ký tự.';
    }
  }

  // 3. Số điện thoại cá nhân (nếu nhập)
  if (values.phone.trim()) {
    const phone = normalizePhone(values.phone);
    if (!/^0\d{9}$/.test(phone)) {
      errors.phone = 'Số điện thoại cần 10 số bắt đầu bằng 0 hoặc dùng +84.';
    }
  }

  // 4. Ngày sinh (nếu nhập)
  const dateOfBirth = values.dateOfBirth.trim();
  if (dateOfBirth) {
    const { minDate, maxDate, minDateDisplay, maxDateDisplay } = getBirthDateRange();
    const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
      Number.isNaN(birth.valueOf()) ||
      dateOfBirth < minDate ||
      dateOfBirth > maxDate ||
      birth.toISOString().slice(0, 10) !== dateOfBirth
    ) {
      errors.dateOfBirth = `Vui lòng chọn ngày sinh trong khoảng ${minDateDisplay} đến ${maxDateDisplay} (từ 18 đến 100 tuổi).`;
    }
  }

  // 5. Store information for STORE_OWNER
  if (isStoreOwner) {
    const storeName = values.storeName.trim().replace(/\s+/g, ' ');
    if (!storeName || storeName.length < 2 || storeName.length > 100) {
      errors.storeName = 'Tên tiệm tạp hóa cần từ 2 đến 100 ký tự.';
    }

    const storeAddress = values.storeAddress.trim().replace(/\s+/g, ' ');
    if (!storeAddress || storeAddress.length < 10 || storeAddress.length > 255) {
      errors.storeAddress =
        'Địa chỉ cửa hàng cần chi tiết từ 10 đến 255 ký tự (Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành).';
    } else {
      const hasAdmin =
        /(phường|xã|thị trấn|quận|huyện|thị xã|thành phố|tỉnh|tp\.|q\.|h\.|p\.|x\.)/i.test(storeAddress) ||
        storeAddress.includes(',') ||
        storeAddress.split(/\s+/).length >= 5;
      if (!hasAdmin) {
        errors.storeAddress =
          'Địa chỉ cần ghi rõ cấu trúc: Số nhà, tên đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố.';
      }
    }

    const storePhone = normalizePhone(values.storePhone);
    if (!storePhone) {
      errors.storePhone = 'Vui lòng cung cấp số điện thoại nhận hàng tại cửa hàng.';
    } else if (!/^0\d{9}$/.test(storePhone)) {
      errors.storePhone = 'Số điện thoại nhận hàng tại tiệm cần 10 số bắt đầu bằng 0.';
    }

    const taxCode = values.taxCode.trim().replace(/\s+/g, '');
    if (taxCode && !/^[A-Za-z0-9-]{10,14}$/.test(taxCode)) {
      errors.taxCode = 'Mã số thuế gồm 10–14 ký tự (chữ, số hoặc gạch ngang).';
    }
  }

  // 6. Supplier information for SUPPLIER
  if (isSupplier) {
    const businessName = (values.businessName || '').trim().replace(/\s+/g, ' ');
    if (!businessName || businessName.length < 2 || businessName.length > 150) {
      errors.businessName = 'Tên gian hàng / vựa sỉ cần từ 2 đến 150 ký tự.';
    }

    const warehouseAddress = (values.warehouseAddress || '').trim().replace(/\s+/g, ' ');
    if (!warehouseAddress || warehouseAddress.length < 10 || warehouseAddress.length > 255) {
      errors.warehouseAddress =
        'Địa chỉ kho bãi cần chi tiết từ 10 đến 255 ký tự (Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành).';
    } else {
      const hasAdmin =
        /(phường|xã|thị trấn|quận|huyện|thị xã|thành phố|tỉnh|tp\.|q\.|h\.|p\.|x\.)/i.test(warehouseAddress) ||
        warehouseAddress.includes(',') ||
        warehouseAddress.split(/\s+/).length >= 5;
      if (!hasAdmin) {
        errors.warehouseAddress =
          'Địa chỉ cần ghi rõ cấu trúc: Số nhà, tên đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố.';
      }
    }

    const taxCode = values.taxCode.trim().replace(/\s+/g, '');
    if (taxCode && !/^[A-Za-z0-9-]{5,30}$/.test(taxCode)) {
      errors.taxCode = 'Mã số thuế / ĐKKD gồm 5–30 ký tự (chữ, số hoặc gạch ngang).';
    }
  }

  return errors;
}

export default function ProfilePage({
  onSaved,
  onLogout,
  contractRefreshKey,
}: {
  onSaved: (name: string) => void;
  onLogout: () => void;
  contractRefreshKey?: number;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contract, setContract] = useState<UserContract | null>(null);
  const [canonicalText, setCanonicalText] = useState('');
  const [showSigningModal, setShowSigningModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    storeName: '',
    storeAddress: '',
    storePhone: '',
    taxCode: '',
    locationType: 'STREET_FRONT' as 'STREET_FRONT' | 'ALLEY',
    alleyDetail: 'MOTORBIKE' as 'TRUCK' | 'MOTORBIKE',
    alleyNote: '',
    latitude: null as number | null,
    longitude: null as number | null,
    isAddressVerified: false,
    businessName: '',
    warehouseAddress: '',
    deliveryRadiusKm: 10,
    bankName: 'Vietcombank',
    bankAccountNumber: '',
    bankAccountHolder: '',
    bankQrImageUrl: '',
  });

  const [uploadingQr, setUploadingQr] = useState(false);
  const [qrUploadError, setQrUploadError] = useState('');

  const [verifyingMap, setVerifyingMap] = useState(false);
  const [mapVerifiedAddress, setMapVerifiedAddress] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<'idle' | 'success' | 'not_found' | 'error'>('idle');
  const [customBankName, setCustomBankName] = useState('');

  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);

  function fill(value: Profile) {
    const sp = value.storeProfile;
    const supp = value.supplierProfile;
    const isAlley = sp?.locationType === 'ALLEY';
    let alleyType: 'TRUCK' | 'MOTORBIKE' = 'MOTORBIKE';
    let alleyNoteStr = '';
    if (sp?.alleyDetail) {
      if (sp.alleyDetail.includes('ba gác') || sp.alleyDetail.includes('TRUCK')) {
        alleyType = 'TRUCK';
      }
      const parts = sp.alleyDetail.split(' · ');
      if (parts.length > 1) alleyNoteStr = parts.slice(1).join(' · ');
    }

    const rawBank = sp?.bankName || supp?.bankName || 'Vietcombank';
    const isOtherBank = rawBank && !POPULAR_BANKS.filter((b) => b !== 'Khác').includes(rawBank);
    if (isOtherBank) {
      setCustomBankName(rawBank);
    }

    setForm({
      name: value.name,
      email: value.email || '',
      phone: value.phone || '',
      dateOfBirth: value.dateOfBirth?.slice(0, 10) || '',
      storeName: sp?.storeName || 'Tiệm Tạp Hóa An Khang',
      storeAddress:
        sp?.storeAddress ||
        '123 Đường Số 4, Phường Bình Trị Đông B, Quận Bình Tân, TP. Hồ Chí Minh',
      storePhone: sp?.storePhone || value.phone || '',
      taxCode: sp?.taxCode || supp?.taxCode || '',
      locationType: isAlley ? 'ALLEY' : 'STREET_FRONT',
      alleyDetail: alleyType,
      alleyNote: alleyNoteStr,
      latitude: sp?.latitude || null,
      longitude: sp?.longitude || null,
      isAddressVerified: Boolean(sp?.isAddressVerified),
      businessName: supp?.businessName || '',
      warehouseAddress: supp?.warehouseAddress || '',
      deliveryRadiusKm: supp?.deliveryRadiusKm || 10,
      bankName: isOtherBank ? 'Khác' : rawBank,
      bankAccountNumber: sp?.bankAccountNumber || supp?.bankAccountNumber || '',
      bankAccountHolder:
        sp?.bankAccountHolder || supp?.bankAccountHolder || (value.name || '').toUpperCase(),
      bankQrImageUrl: sp?.bankQrImageUrl || '',
    });
    setFieldErrors({});
    setMapStatus(sp?.isAddressVerified ? 'success' : 'idle');
    setMapVerifiedAddress(sp?.isAddressVerified ? sp.storeAddress : null);
  }

  useEffect(() => {
    let active = true;
    api
      .get<{ profile: Profile }>('/profile')
      .then(({ data }) => {
        if (active) {
          setProfile(data.profile);
          fill(data.profile);
          setError('');
        }
      })
      .catch((issue: unknown) => {
        if (active) {
          setError(getApiError(issue));
          if (isUnauthenticated(issue)) onLogout();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [retry, onLogout]);

  useEffect(() => {
    let active = true;
    getMyContract()
      .then((res) => {
        if (active) {
          setContract(res.contract);
          setCanonicalText(res.canonicalText);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [retry, contractRefreshKey]);

  const isStoreOwner = profile?.role === 'STORE_OWNER';
  const isSupplier = profile?.role === 'SUPPLIER';

  async function verifyAddressOnMap() {
    const addressToVerify = isSupplier ? form.warehouseAddress : form.storeAddress;
    const fieldKey: keyof ProfileFieldErrors = isSupplier ? 'warehouseAddress' : 'storeAddress';
    const trimmed = addressToVerify.trim();
    if (!trimmed || trimmed.length < 5) {
      setFieldErrors((prev) => ({
        ...prev,
        [fieldKey]: 'Vui lòng nhập địa chỉ trước khi định vị bản đồ.',
      }));
      return;
    }
    setVerifyingMap(true);
    setMapStatus('idle');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=vn&limit=1&q=${encodeURIComponent(
          trimmed
        )}`,
        { headers: { 'Accept-Language': 'vi' } }
      );
      const results = await response.json();
      if (Array.isArray(results) && results.length > 0) {
        const first = results[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        setForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lon,
          isAddressVerified: true,
        }));
        setMapVerifiedAddress(first.display_name || trimmed);
        setMapStatus('success');
        setFieldErrors((prev) => ({ ...prev, [fieldKey]: undefined }));
      } else {
        const fallback = resolveAddressCoordinates(trimmed);
        if (fallback) {
          setForm((prev) => ({
            ...prev,
            latitude: fallback.lat,
            longitude: fallback.lon,
            isAddressVerified: true,
          }));
          setMapVerifiedAddress(trimmed);
          setMapStatus('success');
          setFieldErrors((prev) => ({ ...prev, [fieldKey]: undefined }));
        } else {
          setMapStatus('not_found');
          setForm((prev) => ({ ...prev, isAddressVerified: false }));
        }
      }
    } catch {
      const fallback = resolveAddressCoordinates(trimmed);
      if (fallback) {
        setForm((prev) => ({
          ...prev,
          latitude: fallback.lat,
          longitude: fallback.lon,
          isAddressVerified: true,
        }));
        setMapVerifiedAddress(trimmed);
        setMapStatus('success');
        setFieldErrors((prev) => ({ ...prev, [fieldKey]: undefined }));
      } else {
        setMapStatus('error');
      }
    } finally {
      setVerifyingMap(false);
    }
  }

  async function handleQrUploadInProfile(e: React.ChangeEvent<HTMLInputElement>) {
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
        setForm((prev) => ({ ...prev, bankQrImageUrl: res.data.imageUrl }));
      }
    } catch (issue) {
      setQrUploadError(getApiError(issue));
    } finally {
      setUploadingQr(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setError('');
    setNotice('');

    // Client-side validation
    const nextErrors = validateProfileForm(form, Boolean(isStoreOwner), Boolean(isSupplier));
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError('Vui lòng kiểm tra và sửa các thông tin chưa hợp lệ bên dưới.');
      return;
    }
    setFieldErrors({});

    setBusy(true);
    try {
      const combinedAlley =
        form.locationType === 'ALLEY'
          ? `${form.alleyDetail === 'TRUCK' ? 'Hẻm xe ba gác (≥ 3m)' : 'Hẻm nhỏ chỉ xe máy (< 3m)'}${
              form.alleyNote.trim() ? ` · ${form.alleyNote.trim()}` : ''
            }`
          : null;

      const effectiveBank =
        form.bankName === 'Khác' ? customBankName.trim() || 'Khác' : form.bankName || null;

      const payload = {
        name: form.name.trim().replace(/\s+/g, ' '),
        email: form.email.trim().toLowerCase() || null,
        phone: normalizePhone(form.phone) || null,
        dateOfBirth: form.dateOfBirth.trim() || null,
        bankName: effectiveBank,
        bankAccountNumber: form.bankAccountNumber.trim().replace(/[\s.-]/g, '') || null,
        bankAccountHolder: form.bankAccountHolder.trim().toUpperCase() || null,
        bankQrImageUrl: form.bankQrImageUrl || null,
        ...(isStoreOwner
          ? {
              storeName: form.storeName.trim().replace(/\s+/g, ' '),
              storeAddress: form.storeAddress.trim().replace(/\s+/g, ' '),
              storePhone: normalizePhone(form.storePhone),
              taxCode: form.taxCode.trim().replace(/\s+/g, '') || null,
              locationType: form.locationType,
              alleyDetail: combinedAlley,
              latitude: form.latitude,
              longitude: form.longitude,
              isAddressVerified: form.isAddressVerified,
            }
          : {}),
        ...(isSupplier
          ? {
              businessName: form.businessName.trim().replace(/\s+/g, ' '),
              warehouseAddress: form.warehouseAddress.trim().replace(/\s+/g, ' '),
              taxCode: form.taxCode.trim().replace(/\s+/g, '') || null,
              deliveryRadiusKm: form.deliveryRadiusKm,
            }
          : {}),
      };

      const { data } = await api.put<{ profile: Profile; message?: string }>('/profile', payload);
      setProfile(data.profile);
      fill(data.profile);
      onSaved(data.profile.name);
      setNotice(data.message || 'Đã lưu thông tin cá nhân và cơ sở kinh doanh thành công.');
    } catch (issue) {
      const apiErrors = getApiFieldErrors(issue, profileFields);
      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors(apiErrors);
      }
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Đang tải thông tin cá nhân…</p>;
  if (!profile)
    return (
      <div role="alert" className="error-notice">
        {error}
        <button
          onClick={() => {
            setLoading(true);
            setRetry(retry + 1);
          }}
        >
          Thử lại
        </button>
      </div>
    );

  return (
    <div className="profile-layout">
      <aside className="profile-identity">
        <span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span>
        <h2>{profile.name}</h2>
        <p>@{profile.username}</p>
        <span className="status-pill available">{ROLE_DETAILS[profile.role].label}</span>
        <small>Tham gia {new Date(profile.createdAt).toLocaleDateString('vi-VN')}</small>

        {/* Platform Electronic Agreement / Contract Card */}
        <div
          style={{
            marginTop: '16px',
            padding: '14px',
            background: '#ffffff',
            borderRadius: '10px',
            border: `1px solid ${contract?.isSigned ? '#bbf7d0' : '#fed7aa'}`,
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: contract?.isSigned ? '#166534' : '#c2410c', textTransform: 'uppercase' }}>
              HỢP ĐỒNG LIÊN KẾT
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: contract?.isSigned ? '#dcfce7' : '#ffedd5',
                color: contract?.isSigned ? '#15803d' : '#c2410c',
                fontWeight: 600,
              }}
            >
              {contract?.isSigned ? 'ĐÃ KÝ KẾT' : 'CHƯA KÝ'}
            </span>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
            Thỏa thuận dịch vụ SupplyMind
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
            {contract?.isSigned
              ? `Hợp đồng số ${contract.contractNumber} đã được ký số điện tử ngày ${new Date(contract.signedAt || '').toLocaleDateString('vi-VN')}.`
              : 'Chưa hoàn tất ký số hợp đồng liên kết và thỏa thuận luồng tiền ký quỹ 10%.'}
          </p>

          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {contract?.isSigned ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowViewModal(true)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Xem nội dung hợp đồng
                </button>
                <button
                  type="button"
                  onClick={() => setShowViewModal(true)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid #16a34a',
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    cursor: 'pointer',
                  }}
                >
                  Tải file PDF & In hợp đồng
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowSigningModal(true)}
                style={{
                  padding: '7px 12px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#ea580c',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(234, 88, 12, 0.3)',
                }}
              >
                Ký hợp đồng điện tử ngay
              </button>
            )}
          </div>
        </div>

        {/* Store Owner identity card */}
        {isStoreOwner && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
              {form.storeName || 'Tiệm Tạp Hóa'}
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
              {form.storeAddress || 'Chưa cập nhật địa chỉ tiệm'}
            </p>
            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: form.locationType === 'ALLEY' ? '#fef3c7' : '#ecfdf5',
                  color: form.locationType === 'ALLEY' ? '#92400e' : '#065f46',
                  fontWeight: 600,
                }}
              >
                {form.locationType === 'ALLEY' ? 'Trong hẻm' : 'Mặt tiền đường'}
              </span>
              {form.isAddressVerified && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontWeight: 600,
                  }}
                >
                  Bản đồ đã định vị
                </span>
              )}
            </div>
            {form.taxCode && (
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                MST: <strong>{form.taxCode}</strong>
              </p>
            )}
          </div>
        )}

        {/* Supplier identity card */}
        {isSupplier && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
              {form.businessName || 'Gian hàng sỉ / Kho vựa'}
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
              {form.warehouseAddress || 'Chưa cập nhật địa chỉ kho'}
            </p>
            {form.taxCode && (
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                MST/ĐKKD: <strong>{form.taxCode}</strong>
              </p>
            )}
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#166534' }}>
              Bán kính phục vụ: <strong>{form.deliveryRadiusKm} km</strong>
            </p>
          </div>
        )}
      </aside>

      <section className="dashboard-card">
        <span className="section-kicker">TÀI KHOẢN CỦA BẠN</span>
        <h2>Thông tin cá nhân & Cơ sở kinh doanh</h2>
        <p className="stock-help">
          {isSupplier
            ? 'Cập nhật thông tin liên hệ và cơ sở kho bãi của bạn để kết nối với các cửa hàng tạp hóa.'
            : 'Cập nhật thông tin liên hệ và địa chỉ tiệm tạp hóa chính thức để phục vụ giao nhận hàng.'}
        </p>

        <form className="inventory-form profile-form" onSubmit={save} noValidate>
          <label>
            Tên đăng nhập
            <input value={profile.username} readOnly />
          </label>
          <label>
            Vai trò
            <input value={ROLE_DETAILS[profile.role].label} readOnly />
          </label>
          <label className="inventory-name">
            Họ và tên chủ tài khoản <span style={{ color: '#dc2626' }}>*</span>
            <input
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              disabled={busy}
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: undefined });
              }}
            />
            {fieldErrors.name && (
              <span
                className="field-error"
                style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}
              >
                {fieldErrors.name}
              </span>
            )}
          </label>
          <label>
            Email
            <input
              type="email"
              maxLength={255}
              autoComplete="email"
              disabled={busy}
              placeholder="ban@example.com"
              value={form.email}
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
                if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
              }}
            />
            {fieldErrors.email && (
              <span
                className="field-error"
                style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}
              >
                {fieldErrors.email}
              </span>
            )}
          </label>
          <label>
            Số điện thoại cá nhân (Hotline)
            <input
              type="tel"
              maxLength={20}
              autoComplete="tel"
              disabled={busy}
              placeholder="0912345678"
              value={form.phone}
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined });
              }}
            />
            {fieldErrors.phone && (
              <span
                className="field-error"
                style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}
              >
                {fieldErrors.phone}
              </span>
            )}
          </label>
          <label className="inventory-name">
            Ngày tháng năm sinh
            <BirthDateInput
              disabled={busy}
              value={form.dateOfBirth}
              onChange={(val) => {
                setForm({ ...form, dateOfBirth: val });
                if (fieldErrors.dateOfBirth)
                  setFieldErrors({ ...fieldErrors, dateOfBirth: undefined });
              }}
              onBlur={() => {}}
              invalid={Boolean(fieldErrors.dateOfBirth)}
            />
            {fieldErrors.dateOfBirth && (
              <span
                className="field-error"
                style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}
              >
                {fieldErrors.dateOfBirth}
              </span>
            )}
          </label>

          {/* Store Owner specific fields: Section 1 */}
          {isStoreOwner && (
            <div
              style={{
                gridColumn: '1 / -1',
                marginTop: '28px',
                paddingTop: '24px',
                borderTop: '2px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#214e39',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  1
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Thông tin Cửa hàng / Tiệm tạp hóa của bạn
                </h3>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', paddingLeft: '34px' }}>
                Thông tin này được dùng khi đặt đơn hàng sỉ với các chủ vựa trên SupplyMind,
                đảm bảo cửa hàng có địa chỉ hợp lệ tránh địa chỉ ma và dùng để đo khoảng cách giao hàng.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '14px',
                  marginBottom: '14px',
                }}
              >
                <label>
                  Tên tiệm tạp hóa <span style={{ color: '#dc2626' }}>*</span>
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    disabled={busy}
                    placeholder="Ví dụ: Tạp hóa An Khang, Tiệm Cô Ba..."
                    value={form.storeName}
                    onChange={(e) => {
                      setForm({ ...form, storeName: e.target.value });
                      if (fieldErrors.storeName) setFieldErrors({ ...fieldErrors, storeName: undefined });
                    }}
                  />
                  {fieldErrors.storeName && (
                    <span
                      className="field-error"
                      style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}
                    >
                      {fieldErrors.storeName}
                    </span>
                  )}
                </label>
                <label>
                  Số điện thoại tiệm (Hotline nhận hàng) <span style={{ color: '#dc2626' }}>*</span>
                  <input
                    type="tel"
                    maxLength={20}
                    disabled={busy}
                    placeholder="Số điện thoại nhận hàng tại tiệm"
                    value={form.storePhone}
                    onChange={(e) => {
                      setForm({ ...form, storePhone: e.target.value });
                      if (fieldErrors.storePhone) setFieldErrors({ ...fieldErrors, storePhone: undefined });
                    }}
                  />
                  {fieldErrors.storePhone && (
                    <span
                      className="field-error"
                      style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}
                    >
                      {fieldErrors.storePhone}
                    </span>
                  )}
                </label>
              </div>

              {/* Vị trí mặt bằng (Mặt tiền vs Trong hẻm) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
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
                      border: `2px solid ${form.locationType === 'STREET_FRONT' ? '#214e39' : '#e2e8f0'}`,
                      background: form.locationType === 'STREET_FRONT' ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="locationTypeProfile"
                      checked={form.locationType === 'STREET_FRONT'}
                      onChange={() => setForm({ ...form, locationType: 'STREET_FRONT' })}
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
                      border: `2px solid ${form.locationType === 'ALLEY' ? '#214e39' : '#e2e8f0'}`,
                      background: form.locationType === 'ALLEY' ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="locationTypeProfile"
                      checked={form.locationType === 'ALLEY'}
                      onChange={() => setForm({ ...form, locationType: 'ALLEY' })}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>
                        Trong hẻm / ngõ
                      </strong>
                      <small style={{ color: '#64748b', fontSize: '12px' }}>Đường hẹp, chuyển hàng bằng xe máy / ba gác</small>
                    </div>
                  </label>
                </div>

                {form.locationType === 'ALLEY' && (
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
                          name="alleyWidthProfile"
                          value="TRUCK"
                          checked={form.alleyDetail === 'TRUCK'}
                          onChange={() => setForm({ ...form, alleyDetail: 'TRUCK' })}
                        />
                        Hẻm rộng (≥ 3m) - Ba gác / Xe tải nhỏ vào được
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="alleyWidthProfile"
                          value="MOTORBIKE"
                          checked={form.alleyDetail === 'MOTORBIKE'}
                          onChange={() => setForm({ ...form, alleyDetail: 'MOTORBIKE' })}
                        />
                        Hẻm nhỏ (&lt; 3m) - Chỉ xe máy / Xe đẩy bộ
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="Ghi chú thêm về lối vào (Ví dụ: Cách đầu đường 50m, cua ngã ba thứ hai...)"
                      value={form.alleyNote}
                      onChange={(e) => setForm({ ...form, alleyNote: e.target.value })}
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

              {/* Tax Code */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="taxCode" style={{ margin: 0, fontWeight: 500, fontSize: '14px', color: '#1e293b' }}>
                    Mã số thuế (Hộ kinh doanh / Doanh nghiệp)
                  </label>
                  <a
                    href="https://masothue.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '12px',
                      color: '#2563eb',
                      textDecoration: 'underline',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 500,
                    }}
                  >
                    Tra cứu mã số thuế (masothue.com)
                  </a>
                </div>
                <input
                  id="taxCode"
                  maxLength={14}
                  disabled={busy}
                  placeholder="Ví dụ: 0312345678 (10–14 số hoặc gạch ngang)"
                  value={form.taxCode}
                  onChange={(e) => {
                    setForm({ ...form, taxCode: e.target.value });
                    if (fieldErrors.taxCode) setFieldErrors({ ...fieldErrors, taxCode: undefined });
                  }}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
                <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Có thể tra cứu trực tiếp bằng tên tiệm hoặc họ tên chủ tiệm trên masothue.com.
                </small>
                {fieldErrors.taxCode && (
                  <span
                    className="field-error"
                    style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}
                  >
                    {fieldErrors.taxCode}
                  </span>
                )}
              </div>

              {/* Store Address with Geocoding Map button */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="storeAddress" style={{ margin: 0, fontWeight: 500, fontSize: '14px', color: '#1e293b' }}>
                    Địa chỉ cửa hàng chi tiết <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={verifyAddressOnMap}
                    disabled={verifyingMap || !form.storeAddress.trim()}
                    style={{
                      fontSize: '12px',
                      color: '#1d4ed8',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: verifyingMap || !form.storeAddress.trim() ? 'not-allowed' : 'pointer',
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
                  id="storeAddress"
                  required
                  minLength={10}
                  maxLength={255}
                  autoComplete="street-address"
                  disabled={busy}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
                  value={form.storeAddress}
                  onChange={(e) => {
                    setForm({ ...form, storeAddress: e.target.value });
                    if (fieldErrors.storeAddress) setFieldErrors({ ...fieldErrors, storeAddress: undefined });
                    setMapStatus('idle');
                  }}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />

                {/* Map verification badge */}
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
                    {form.latitude && form.longitude && (
                      <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                        Tọa độ: {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)} (Sẵn sàng đo khoảng cách đến chủ vựa)
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
                    <strong>Chưa tìm thấy vị trí chính xác trên bản đồ.</strong> Vui lòng ghi rõ: <em>Số nhà, Tên đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố</em> (ví dụ: 123 Đường Số 4, Phường Bình Trị Đông B, Quận Bình Tân, TP. Hồ Chí Minh).
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
                    Lưu ý: Tạm thời không kết nối được dịch vụ bản đồ số, hệ thống sẽ lưu địa chỉ và xác thực qua cấu trúc hành chính.
                  </div>
                )}

                <small style={{ color: '#64748b', display: 'block', marginTop: '6px' }}>
                  Địa chỉ hợp lệ giúp tài xế định vị chính xác cửa hàng, đo khoảng cách giao hàng và chống trùng lặp.
                </small>
                {fieldErrors.storeAddress && (
                  <span
                    className="field-error"
                    style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}
                  >
                    {fieldErrors.storeAddress}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Supplier specific fields: Section 1 */}
          {isSupplier && (
            <div
              style={{
                gridColumn: '1 / -1',
                marginTop: '28px',
                paddingTop: '24px',
                borderTop: '2px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#214e39',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  1
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Thông tin Gian hàng & Kho bãi của bạn
                </h3>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', paddingLeft: '34px' }}>
                Thông tin này giúp các cửa hàng tạp hóa tìm kiếm nguồn sỉ và tính khoảng cách giao hàng.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '14px',
                  marginBottom: '14px',
                }}
              >
                <label>
                  Tên gian hàng / vựa sỉ <span style={{ color: '#dc2626' }}>*</span>
                  <input
                    required
                    minLength={2}
                    maxLength={150}
                    disabled={busy}
                    placeholder="Ví dụ: Vựa Gạo Phúc Thịnh, Đại Lý Nông Sản Ba Tri..."
                    value={form.businessName}
                    onChange={(e) => {
                      setForm({ ...form, businessName: e.target.value });
                      if (fieldErrors.businessName) setFieldErrors({ ...fieldErrors, businessName: undefined });
                    }}
                  />
                  {fieldErrors.businessName && (
                    <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.businessName}
                    </span>
                  )}
                </label>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label htmlFor="supplierTaxCode" style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                      Mã số thuế / Mã số ĐKKD
                    </label>
                    <a
                      href="https://masothue.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}
                    >
                      Tra cứu (masothue.com)
                    </a>
                  </div>
                  <input
                    id="supplierTaxCode"
                    type="text"
                    maxLength={30}
                    disabled={busy}
                    placeholder="Ví dụ: 0312345678"
                    value={form.taxCode}
                    onChange={(e) => {
                      setForm({ ...form, taxCode: e.target.value });
                      if (fieldErrors.taxCode) setFieldErrors({ ...fieldErrors, taxCode: undefined });
                    }}
                  />
                  {fieldErrors.taxCode && (
                    <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.taxCode}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="warehouseAddress" style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                    Địa chỉ kho bãi chi tiết <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={verifyAddressOnMap}
                    disabled={verifyingMap || !form.warehouseAddress.trim()}
                    style={{
                      fontSize: '12px',
                      color: '#1d4ed8',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: verifyingMap || !form.warehouseAddress.trim() ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {verifyingMap ? 'Đang định vị…' : 'Kiểm tra trên bản đồ số'}
                  </button>
                </div>
                <input
                  id="warehouseAddress"
                  required
                  disabled={busy}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
                  value={form.warehouseAddress}
                  onChange={(e) => {
                    setForm({ ...form, warehouseAddress: e.target.value });
                    if (fieldErrors.warehouseAddress) setFieldErrors({ ...fieldErrors, warehouseAddress: undefined });
                    setMapStatus('idle');
                  }}
                />
                {fieldErrors.warehouseAddress && (
                  <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                    {fieldErrors.warehouseAddress}
                  </span>
                )}
              </div>

              <div style={{ maxWidth: '240px', marginBottom: '14px' }}>
                <label>
                  Bán kính phục vụ giao hàng (km)
                  <input
                    type="number"
                    min={1}
                    max={200}
                    disabled={busy}
                    value={form.deliveryRadiusKm}
                    onChange={(e) => setForm({ ...form, deliveryRadiusKm: Number(e.target.value) || 10 })}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Default Banking & Payout Account: Section 2 */}
          <div
            style={{
              gridColumn: '1 / -1',
              marginTop: '28px',
              paddingTop: '24px',
              borderTop: '2px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#214e39',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                2
              </span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Tài khoản thanh toán & Nhận tiền mặc định
              </h3>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', paddingLeft: '34px' }}>
              Dùng để tự động điền nhanh khi bạn thực hiện nạp hoặc rút tiền trong Ví. Bạn vẫn có thể nhập tài khoản khác khi rút tiền.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '14px',
                marginBottom: '14px',
              }}
            >
              <label>
                Ngân hàng thụ hưởng
                <select
                  disabled={busy}
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '14px',
                  }}
                >
                  {POPULAR_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {form.bankName === 'Khác' && (
                  <div style={{ marginTop: '8px' }}>
                    <small style={{ fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Nhập tên ngân hàng của bạn:
                    </small>
                    <input
                      type="text"
                      disabled={busy}
                      placeholder="Ví dụ: Shinhan Bank, Woori Bank, PVcomBank..."
                      value={customBankName}
                      onChange={(e) => setCustomBankName(e.target.value)}
                      maxLength={100}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
              </label>

              <label>
                Số tài khoản ngân hàng
                <input
                  type="text"
                  disabled={busy}
                  placeholder="Ví dụ: 0071001234567"
                  maxLength={34}
                  value={form.bankAccountNumber}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bankAccountNumber: e.target.value.replace(/[^A-Za-z0-9]/g, ''),
                    })
                  }
                  style={{ fontFamily: 'monospace' }}
                />
              </label>

              <label>
                Tên chủ tài khoản (In hoa không dấu)
                <input
                  type="text"
                  disabled={busy}
                  placeholder="Ví dụ: NGUYEN VAN A"
                  maxLength={100}
                  value={form.bankAccountHolder}
                  onChange={(e) =>
                    setForm({ ...form, bankAccountHolder: e.target.value.toUpperCase() })
                  }
                  style={{ textTransform: 'uppercase' }}
                />
              </label>
            </div>

            {/* QR upload preview */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Ảnh mã QR nhận tiền (Không bắt buộc)
              </label>
              {form.bankQrImageUrl ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    maxWidth: '400px',
                  }}
                >
                  <img
                    src={form.bankQrImageUrl}
                    alt="Mã QR ngân hàng"
                    style={{
                      width: '70px',
                      height: '70px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                    }}
                  />
                  <div>
                    <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Đã lưu ảnh mã QR
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setForm({ ...form, bankQrImageUrl: '' })}
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
                      Xóa ảnh QR
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingQr || busy}
                    onChange={(e) => void handleQrUploadInProfile(e)}
                    style={{ fontSize: '13px' }}
                  />
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
                    Chấp nhận file ảnh JPG, PNG, WEBP (tối đa 3MB).
                  </small>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="error-notice inventory-name" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="inventory-notice inventory-name" role="status">
              {notice}
            </p>
          )}
          <div className="inventory-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                fill(profile);
                setError('');
                setNotice('');
              }}
            >
              Hủy thay đổi
            </button>
            <button className="dash-primary" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu thông tin'}
            </button>
          </div>
        </form>
      </section>

      {profile && (
        <>
          <ContractSigningModal
            isOpen={showSigningModal}
            onClose={() => setShowSigningModal(false)}
            onSignedSuccess={(updated) => {
              setContract((prev) => (prev ? { ...prev, ...updated, isSigned: true } : (updated as any)));
              setShowSigningModal(false);
              setNotice('Đã ký kết hợp đồng điện tử thành công!');
              getMyContract().then((res) => {
                setContract(res.contract);
                setCanonicalText(res.canonicalText);
              }).catch(() => {});
            }}
            user={{
              id: profile.id ?? 1,
              username: profile.username,
              name: profile.name,
              role: profile.role,
              phone: profile.phone || '',
            }}
          />
          <ContractViewModal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            contract={contract}
            canonicalText={canonicalText}
          />
        </>
      )}
    </div>
  );
}
