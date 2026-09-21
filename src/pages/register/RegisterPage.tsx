import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand';
import BirthDateInput from '../../components/BirthDateInput';
import Icon from '../../components/Icon';
import { getApiError, getApiFieldErrors } from '../../services/api';
import { registerAccount, type RegistrationInput } from '../../services/auth.api';

import {
  normalizeRegistration, registrationFields,
  validateRegistration, type FieldErrors,
} from '../../validation/registration';

const initialValues: RegistrationInput = { name: '', username: '', email: '', phone: '', role: 'STORE_OWNER', dateOfBirth: '', password: '', confirmPassword: '' };

export default function RegisterPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ field: keyof RegistrationInput | null } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    document.title = 'SupplyMind AI · Đăng ký';
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    // Wait for React to render the errors and re-enable inputs after the API call.
    if (!focusRequest || submitting) return;
    const control = focusRequest.field
      ? formRef.current?.elements.namedItem(focusRequest.field)
      : noticeRef.current;
    if (control instanceof HTMLElement) {
      control.focus();
      control.scrollIntoView({ block: 'center' });
    }
  }, [focusRequest, submitting]);

  function focusFirstError(nextErrors: FieldErrors) {
    setFocusRequest({ field: registrationFields.find((key) => nextErrors[key]) ?? null });
  }

  function inputProps(field: keyof RegistrationInput, hint = false) {
    const descriptions = [hint ? `${field}-hint` : '', errors[field] ? `${field}-error` : ''].filter(Boolean);
    return {
      id: field,
      name: field,
      disabled: submitting,
      'aria-invalid': Boolean(errors[field]),
      'aria-describedby': descriptions.join(' ') || undefined,
      onBlur: () => setErrors((current) => ({ ...current, [field]: validateRegistration(values)[field] })),
    };
  }

  function update<K extends keyof RegistrationInput>(key: K, value: RegistrationInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
      ...(key === 'password' && values.confirmPassword ? {
        confirmPassword: value === values.confirmPassword ? undefined : 'Mật khẩu nhập lại không khớp.',
      } : {}),
    }));
    setServerError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validateRegistration(values);
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length) {
      focusFirstError(nextErrors);
      return;
    }
    setSubmitting(true);
    try {
      const user = await registerAccount(normalizeRegistration(values));
      navigate('/login', { replace: true, state: { registeredUsername: user.username } });
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error, registrationFields);
      setErrors(fieldErrors);
      setServerError(Object.keys(fieldErrors).length
        ? 'Vui lòng kiểm tra các thông tin được đánh dấu bên dưới.'
        : getApiError(error));
      focusFirstError(fieldErrors);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="register-page">
      <section className="register-card" aria-labelledby="register-title">
        <div className="register-top"><Brand /><Link to="/login">Đã có tài khoản? Đăng nhập</Link></div>
        <div className="register-heading"><div className="welcome-icon"><Icon name="store" /></div><p className="form-eyebrow">BẮT ĐẦU CÙNG SUPPLYMIND</p><h1 id="register-title">Tạo tài khoản</h1><p className="form-description">Điền thông tin để kết nối cửa hàng và nguồn sỉ.</p></div>
        <form ref={formRef} className="register-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          {serverError && <p ref={noticeRef} className="error-notice" role="alert" tabIndex={-1}>{serverError}</p>}
          <div className="register-grid">
            <Field label="Họ và tên" id="name" error={errors.name}>
              <input {...inputProps('name')} value={values.name} onChange={(e) => update('name', e.target.value)} placeholder="Nguyễn Văn An" autoComplete="name" />
            </Field>
            <Field label="Tên đăng nhập" id="username" hint="Username" error={errors.username}>
              <input {...inputProps('username')} value={values.username} onChange={(e) => update('username', e.target.value)} placeholder="ten.dangnhap" autoComplete="username" autoCapitalize="none" spellCheck={false} />
            </Field>
            <Field label="Email" id="email" error={errors.email}>
              <input {...inputProps('email')} type="email" value={values.email} onChange={(e) => update('email', e.target.value)} placeholder="ban@example.com" autoComplete="email" autoCapitalize="none" spellCheck={false} />
            </Field>
            <Field label="Số điện thoại" id="phone" error={errors.phone}>
              <input {...inputProps('phone')} type="tel" value={values.phone} onChange={(e) => update('phone', e.target.value)} placeholder="0912345678 hoặc +84912345678" autoComplete="tel" />
            </Field>
            <Field label="Vai trò" id="role" error={errors.role}>
              <select {...inputProps('role')} value={values.role} onChange={(e) => update('role', e.target.value as RegistrationInput['role'])}>
                <option value="STORE_OWNER">Chủ tạp hóa</option><option value="SUPPLIER">Chủ vựa</option>
              </select>
            </Field>
            <Field label="Ngày tháng năm sinh" id="dateOfBirth" error={errors.dateOfBirth}
              description="Nhập năm trực tiếp hoặc bấm vào ô năm rồi cuộn chuột: mỗi nấc 5 năm.">
              <BirthDateInput value={values.dateOfBirth} onChange={(value) => update('dateOfBirth', value)}
                onBlur={inputProps('dateOfBirth').onBlur} disabled={submitting}
                invalid={Boolean(errors.dateOfBirth)} describedBy={inputProps('dateOfBirth', true)['aria-describedby']} />
            </Field>
            <Field label="Mật khẩu" id="password" error={errors.password}
              description="Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt (ví dụ @, #, !).">
              <div className="register-password">
                <input {...inputProps('password', true)} type={showPassword ? 'text' : 'password'} value={values.password} onChange={(e) => update('password', e.target.value)} placeholder="Tạo mật khẩu của bạn" autoComplete="new-password" />
                <button type="button" disabled={submitting} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}><Icon name={showPassword ? 'eyeOff' : 'eye'} /></button>
              </div>
            </Field>
            <Field label="Nhập lại mật khẩu" id="confirmPassword" error={errors.confirmPassword}>
              <div className="register-password">
                <input {...inputProps('confirmPassword')} type={showConfirm ? 'text' : 'password'} value={values.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} placeholder="Nhập lại mật khẩu" autoComplete="new-password" />
                <button type="button" disabled={submitting} onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'} aria-pressed={showConfirm}><Icon name={showConfirm ? 'eyeOff' : 'eye'} /></button>
              </div>
            </Field>
          </div>
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? <><span className="spinner" /> Đang tạo tài khoản…</> : <>Tạo tài khoản <Icon name="arrow" /></>}</button>
        </form>
        <p className="register-note">Tài khoản quản trị viên chỉ được cấp bởi hệ thống.</p>
      </section>
    </main>
  );
}

function Field({ label, id, hint, error, description, children }: {
  label: string; id: string; hint?: string; error?: string; description?: string; children: ReactNode;
}) {
  return (
    <div className="field-group register-field">
      <label htmlFor={id}>{label}{' '}<span>{hint}</span></label>
      <div className={`input-wrap ${error ? 'input-error' : ''}`}>{children}</div>
      {description && <p className="field-hint" id={`${id}-hint`}>{description}</p>}
      {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}
