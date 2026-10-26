import { useEffect, useState, type FormEvent } from 'react';
import BirthDateInput from '../components/BirthDateInput';
import { api, getApiError, isUnauthenticated } from '../services/api';
import { ROLE_DETAILS, type Role } from '../types/auth';

export type StoreProfile = {
  userId: number;
  storeName: string;
  storeAddress: string;
  storePhone: string | null;
  businessType: string;
  isConfigured: boolean;
};

type Profile = {
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  role: Role;
  createdAt: string;
  storeProfile?: StoreProfile | null;
};

export default function ProfilePage({
  onSaved,
  onLogout,
}: {
  onSaved: (name: string) => void;
  onLogout: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    storeName: '',
    storeAddress: '',
    storePhone: '',
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);

  function fill(value: Profile) {
    setForm({
      name: value.name,
      email: value.email || '',
      phone: value.phone || '',
      dateOfBirth: value.dateOfBirth?.slice(0, 10) || '',
      storeName: value.storeProfile?.storeName || 'Tiệm Tạp Hóa An Khang',
      storeAddress:
        value.storeProfile?.storeAddress ||
        '123 Đường Số 4, Phường Bình Trị Đông B, Quận Bình Tân, TP. Hồ Chí Minh',
      storePhone: value.storeProfile?.storePhone || value.phone || '',
    });
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

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.put<{ profile: Profile }>('/profile', form);
      setProfile(data.profile);
      fill(data.profile);
      onSaved(data.profile.name);
      setNotice('Đã lưu thông tin cá nhân và cửa hàng thành công.');
    } catch (issue) {
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

  const isStoreOwner = profile.role === 'STORE_OWNER';

  return (
    <div className="profile-layout">
      <aside className="profile-identity">
        <span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span>
        <h2>{profile.name}</h2>
        <p>@{profile.username}</p>
        <span className="status-pill available">{ROLE_DETAILS[profile.role].label}</span>
        <small>Tham gia {new Date(profile.createdAt).toLocaleDateString('vi-VN')}</small>
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
              🏪 {form.storeName || 'Tiệm Tạp Hóa'}
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
              {form.storeAddress || 'Chưa cập nhật địa chỉ tiệm'}
            </p>
          </div>
        )}
      </aside>

      <section className="dashboard-card">
        <span className="section-kicker">TÀI KHOẢN CỦA BẠN</span>
        <h2>Thông tin cá nhân & Cửa hàng</h2>
        <p className="stock-help">
          Cập nhật thông tin liên hệ và địa chỉ tiệm tạp hóa chính thức để phục vụ giao nhận hàng.
        </p>

        <form className="inventory-form profile-form" onSubmit={save}>
          <label>
            Tên đăng nhập
            <input value={profile.username} readOnly />
          </label>
          <label>
            Vai trò
            <input value={ROLE_DETAILS[profile.role].label} readOnly />
          </label>
          <label className="inventory-name">
            Họ và tên chủ tài khoản
            <input
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              disabled={busy}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              maxLength={255}
              autoComplete="email"
              disabled={busy}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Số điện thoại cá nhân
            <input
              type="tel"
              maxLength={30}
              autoComplete="tel"
              disabled={busy}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="inventory-name">
            Ngày sinh (Ngày / Tháng / Năm)
            <BirthDateInput
              disabled={busy}
              invalid={false}
              value={form.dateOfBirth}
              onChange={(val) => setForm({ ...form, dateOfBirth: val })}
              onBlur={() => {}}
            />
          </label>

          {isStoreOwner && (
            <div
              className="inventory-name"
              style={{
                marginTop: '16px',
                paddingTop: '20px',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '18px' }}>🏪</span>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  Thông tin Tiệm tạp hóa & Địa chỉ nhận hàng mặc định (Bắt buộc)
                </h3>
              </div>
              <p
                className="stock-help"
                style={{ marginBottom: '14px', fontSize: '13px', color: '#64748b' }}
              >
                Địa chỉ này sẽ dùng làm <strong>địa chỉ mặc định khi tạo đơn mua sỉ</strong> từ các vựa,
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
                    onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                  />
                </label>
                <label>
                  Số điện thoại tiệm (Hotline nhận hàng)
                  <input
                    type="tel"
                    maxLength={20}
                    disabled={busy}
                    placeholder="Số điện thoại nhận hàng tại tiệm"
                    value={form.storePhone}
                    onChange={(e) => setForm({ ...form, storePhone: e.target.value })}
                  />
                </label>
              </div>

              <label className="inventory-name" style={{ display: 'block', marginBottom: '14px' }}>
                Địa chỉ cửa hàng chi tiết <span style={{ color: '#dc2626' }}>*</span>
                <input
                  required
                  minLength={10}
                  maxLength={255}
                  autoComplete="street-address"
                  disabled={busy}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
                  value={form.storeAddress}
                  onChange={(e) => setForm({ ...form, storeAddress: e.target.value })}
                />
                <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Địa chỉ hợp lệ giúp tài xế định vị chính xác cửa hàng và đối chiếu khoảng cách giao hàng với chủ vựa.
                </small>
              </label>
            </div>
          )}

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
    </div>
  );
}
