import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import { getApiError } from '../../services/api';
import { registerAccount, type RegistrationInput } from '../../services/auth.api';

type FieldErrors = Partial<Record<keyof RegistrationInput, string>>;

function validate(values: RegistrationInput): FieldErrors {
  const errors: FieldErrors = {};
  if (values.name.trim().length < 2) errors.name = 'Nhập họ và tên của bạn.';
  if (!/^[a-zA-Z0-9._-]{3,50}$/.test(values.username.trim())) errors.username = 'Username 3–50 ký tự chữ không dấu, số, chấm, gạch dưới hoặc gạch ngang.';
  if (!/^\S+@\S+\.\S{2,}$/.test(values.email.trim())) errors.email = 'Email không hợp lệ.';
  if (!/^0\d{9}$/.test(values.phone.replace(/[\s().-]/g, '').replace(/^\+84/, '0'))) errors.phone = 'Số điện thoại cần đủ 10 số.';
  if (!values.role) errors.role = 'Chọn vai trò của bạn.';
  const birth = new Date(`${values.dateOfBirth}T00:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.dateOfBirth) || Number.isNaN(birth.valueOf()) || birth > new Date()) errors.dateOfBirth = 'Ngày sinh không hợp lệ.';
  if (values.password.length < 8 || !/[a-z]/.test(values.password) || !/[A-Z]/.test(values.password) || !/\d/.test(values.password) || !/[^A-Za-z0-9]/.test(values.password)) errors.password = 'Mật khẩu cần chữ hoa, chữ thường, số và ký tự đặc biệt.';
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Mật khẩu nhập lại không khớp.';
  return errors;
}

const initialValues: RegistrationInput = { name: '', username: '', email: '', phone: '', role: 'STORE_OWNER', dateOfBirth: '', password: '', confirmPassword: '' };

export default function RegisterPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const firstInvalid = useRef<HTMLInputElement | null>(null);

  function update<K extends keyof RegistrationInput>(key: K, value: RegistrationInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setServerError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      firstInvalid.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await registerAccount({ ...values, name: values.name.trim(), username: values.username.trim().toLowerCase(), email: values.email.trim().toLowerCase(), phone: values.phone.replace(/[\s().-]/g, '').replace(/^\+84/, '0') });
      navigate('/login?registered=1', { replace: true });
    } catch (error) {
      setServerError(getApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="register-page">
      <section className="register-card" aria-labelledby="register-title">
        <div className="register-top"><Brand /><Link to="/login">Đã có tài khoản? Đăng nhập</Link></div>
        <div className="register-heading"><div className="welcome-icon"><Icon name="store" /></div><p className="form-eyebrow">BẮT ĐẦU CÙNG SUPPLYMIND</p><h1 id="register-title">Tạo tài khoản</h1><p className="form-description">Điền thông tin để kết nối cửa hàng và nguồn sỉ.</p></div>
        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <div className="register-grid">
            <Field label="Họ và tên" id="name" error={errors.name}><input ref={(node) => { if (!firstInvalid.current) firstInvalid.current = node; }} id="name" value={values.name} onChange={(e) => update('name', e.target.value)} placeholder="Nguyễn Văn An" autoComplete="name" disabled={submitting} /></Field>
            <Field label="Tên đăng nhập" id="username" hint="Username" error={errors.username}><input id="username" value={values.username} onChange={(e) => update('username', e.target.value)} placeholder="ten.dangnhap" autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={submitting} /></Field>
            <Field label="Email" id="email" error={errors.email}><input type="email" id="email" value={values.email} onChange={(e) => update('email', e.target.value)} placeholder="ban@example.com" autoComplete="email" disabled={submitting} /></Field>
            <Field label="Số điện thoại" id="phone" error={errors.phone}><input type="tel" id="phone" value={values.phone} onChange={(e) => update('phone', e.target.value)} placeholder="0912345678" autoComplete="tel" disabled={submitting} /></Field>
            <Field label="Vai trò" id="role" error={errors.role}><select id="role" value={values.role} onChange={(e) => update('role', e.target.value as RegistrationInput['role'])} disabled={submitting}><option value="STORE_OWNER">Chủ tạp hóa</option><option value="SUPPLIER">Chủ vựa</option></select></Field>
            <Field label="Ngày tháng năm sinh" id="dateOfBirth" error={errors.dateOfBirth}><input type="date" id="dateOfBirth" value={values.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} max={new Date().toISOString().slice(0, 10)} disabled={submitting} /></Field>
            <Field label="Mật khẩu" id="password" error={errors.password}><div className="register-password"><input type={showPassword ? 'text' : 'password'} id="password" value={values.password} onChange={(e) => update('password', e.target.value)} placeholder="Ít nhất 8 ký tự" autoComplete="new-password" disabled={submitting} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}><Icon name={showPassword ? 'eyeOff' : 'eye'} /></button></div></Field>
            <Field label="Nhập lại mật khẩu" id="confirmPassword" error={errors.confirmPassword}><div className="register-password"><input type={showConfirm ? 'text' : 'password'} id="confirmPassword" value={values.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} placeholder="Nhập lại mật khẩu" autoComplete="new-password" disabled={submitting} /><button type="button" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}><Icon name={showConfirm ? 'eyeOff' : 'eye'} /></button></div></Field>
          </div>
          {serverError && <p className="error-notice" role="alert">{serverError}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? <><span className="spinner" /> Đang tạo tài khoản…</> : <>Tạo tài khoản <Icon name="arrow" /></>}</button>
        </form>
        <p className="register-note">Tài khoản quản trị viên chỉ được cấp bởi hệ thống.</p>
      </section>
    </main>
  );
}

function Field({ label, id, hint, error, children }: { label: string; id: string; hint?: string; error?: string; children: ReactNode }) {
  return <div className="field-group register-field"><label htmlFor={id}>{label}<span>{hint}</span></label><div className={`input-wrap ${error ? 'input-error' : ''}`}>{children}</div>{error && <p className="field-error">{error}</p>}</div>;
}
