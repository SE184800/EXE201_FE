import { useEffect, useState, type FormEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';
import { ROLE_DETAILS, type Role } from '../types/auth';
type Profile = { username: string; name: string; email: string | null; phone: string | null; dateOfBirth: string | null; role: Role; createdAt: string };
export default function ProfilePage({ onSaved, onLogout }: { onSaved: (name: string) => void; onLogout: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', dateOfBirth: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [today] = useState(() => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10));
  function fill(value: Profile) { setForm({ name: value.name, email: value.email || '', phone: value.phone || '', dateOfBirth: value.dateOfBirth?.slice(0, 10) || '' }); }
  useEffect(() => {
    let active = true;
    api.get<{ profile: Profile }>('/profile').then(({ data }) => { if (active) { setProfile(data.profile); fill(data.profile); setError(''); } })
      .catch((issue: unknown) => { if (active) { setError(getApiError(issue)); if (isUnauthenticated(issue)) onLogout(); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry, onLogout]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await api.put<{ profile: Profile }>('/profile', form);
      setProfile(data.profile); fill(data.profile); onSaved(data.profile.name); setNotice('Đã lưu thông tin cá nhân.');
    } catch (issue) { setError(getApiError(issue)); if (isUnauthenticated(issue)) onLogout(); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Đang tải thông tin cá nhân…</p>;
  if (!profile) return <div role="alert" className="error-notice">{error}<button onClick={() => { setLoading(true); setRetry(retry + 1); }}>Thử lại</button></div>;
  return <div className="profile-layout"><aside className="profile-identity"><span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span><h2>{profile.name}</h2><p>@{profile.username}</p><span className="status-pill available">{ROLE_DETAILS[profile.role].label}</span><small>Tham gia {new Date(profile.createdAt).toLocaleDateString('vi-VN')}</small></aside><section className="dashboard-card"><span className="section-kicker">TÀI KHOẢN CỦA BẠN</span><h2>Thông tin cá nhân</h2><p className="stock-help">Cập nhật thông tin liên hệ. Tên đăng nhập và vai trò do hệ thống quản lý.</p><form className="inventory-form profile-form" onSubmit={save}><label>Tên đăng nhập<input value={profile.username} readOnly /></label><label>Vai trò<input value={ROLE_DETAILS[profile.role].label} readOnly /></label><label className="inventory-name">Họ và tên<input required minLength={2} maxLength={100} autoComplete="name" disabled={busy} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Email<input type="email" maxLength={255} autoComplete="email" disabled={busy} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Số điện thoại<input type="tel" maxLength={30} autoComplete="tel" disabled={busy} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label className="inventory-name">Ngày sinh<input type="date" min="1900-01-01" max={today} disabled={busy} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></label>{error && <p className="error-notice inventory-name" role="alert">{error}</p>}{notice && <p className="inventory-notice inventory-name" role="status">{notice}</p>}<div className="inventory-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => { fill(profile); setError(''); setNotice(''); }}>Hủy thay đổi</button><button className="dash-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thông tin'}</button></div></form></section></div>;
}

