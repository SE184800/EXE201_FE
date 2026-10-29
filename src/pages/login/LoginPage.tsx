import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import {
  isSubscriptionRequiredError,
  login,
  requestForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resendForgotPasswordOtp,
  resetForgotPassword,
} from '../../services/auth.api';
import { getApiError } from '../../services/api';
import { renewExpiredSubscription, type Subscription } from '../../services/subscription.api';
import type { AuthUser } from '../../types/auth';

type ViewMode = 'LOGIN' | 'FORGOT_EMAIL' | 'FORGOT_NEW_PASSWORD';

function ProductPreview() {
  return (
    <div className="product-preview" aria-label="Minh họa đề xuất nhập hàng">
      <div className="preview-heading">
        <span className="preview-icon">
          <Icon name="sparkle" />
        </span>
        <div>
          <strong>Nhập hàng có kế hoạch</strong>
          <span>Đề xuất phù hợp với cửa hàng</span>
        </div>
        <span className="preview-dot" />
      </div>
      <div className="preview-row">
        <span className="product-drawing bottle">▥</span>
        <div>
          <strong>Nước giải khát</strong>
          <span>Sẵn sàng cho những ngày nắng</span>
        </div>
        <span className="preview-status">Nên nhập</span>
      </div>
      <div className="preview-row">
        <span className="product-drawing carton">
          <Icon name="box" />
        </span>
        <div>
          <strong>Hàng tiêu dùng</strong>
          <span>Bổ sung đúng nhu cầu</span>
        </div>
        <span className="preview-status neutral">Đủ hàng</span>
      </div>
      <div className="preview-bottom">
        <span>
          <Icon name="check" /> Bạn luôn là người quyết định
        </span>
        <small>Minh họa</small>
      </div>
      <div className="floating-tag">
        <span className="floating-dot" />
        <span>Kết nối nguồn sỉ gần bạn</span>
        <Icon name="arrow" />
      </div>
    </div>
  );
}

// Validation helpers matching registration standards
function validateForgotEmail(email: string): string | undefined {
  const trimmed = email.trim().toLowerCase();
  const localPart = trimmed.split('@')[0] || '';
  if (!trimmed) {
    return 'Nhập email tài khoản của bạn.';
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) ||
    trimmed.length > 255 ||
    !/^[\x21-\x7E]+$/.test(trimmed) ||
    /\s/.test(trimmed) ||
    localPart.replace(/\s/g, '').length < 2
  ) {
    return 'Nhập email hợp lệ, không chứa khoảng trắng, tên email cần ít nhất 2 ký tự và tối đa 255 ký tự.';
  }
  return undefined;
}

function validateNewPassword(password: string): string | undefined {
  const passwordWithoutSpaces = password.replace(/\s/g, '');
  if (new TextEncoder().encode(password).length > 72)
    return 'Mật khẩu quá dài. Hãy dùng mật khẩu ngắn hơn.';
  if (password.trim() !== password)
    return 'Mật khẩu không được chứa khoảng trắng ở đầu hoặc cuối.';
  if (
    passwordWithoutSpaces.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9\s]/.test(password)
  )
    return 'Mật khẩu cần ít nhất 8 ký tự (không tính khoảng trắng), gồm chữ hoa, chữ thường, số và ký tự đặc biệt.';
  return undefined;
}

export default function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const registrationState: unknown = location.state;
  const registeredUsername =
    registrationState &&
    typeof registrationState === 'object' &&
    'registeredUsername' in registrationState &&
    typeof registrationState.registeredUsername === 'string'
      ? registrationState.registeredUsername
      : '';

  // Mode: LOGIN | FORGOT_EMAIL | FORGOT_NEW_PASSWORD
  const [viewMode, setViewMode] = useState<ViewMode>('LOGIN');

  // Standard Login State
  const [username, setUsername] = useState(registeredUsername);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const [serverError, setServerError] = useState('');
  const [payment, setPayment] = useState<{
    renewalToken: string;
    subscription: Subscription;
  } | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const paymentRequest = useRef<string | null>(null);

  // Forgot Password Flow State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailError, setForgotEmailError] = useState('');
  const [forgotServerError, setForgotServerError] = useState('');
  const [requestingOtp, setRequestingOtp] = useState(false);

  // OTP Modal State
  const [showForgotOtpModal, setShowForgotOtpModal] = useState(false);
  const [resetOtpToken, setResetOtpToken] = useState('');
  const [devOtpNotice, setDevOtpNotice] = useState('');

  // New Password State
  const [resetPassToken, setResetPassToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmNewPasswordError, setConfirmNewPasswordError] = useState('');
  const [newPasswordServerError, setNewPasswordServerError] = useState('');
  const [submittingNewPassword, setSubmittingNewPassword] = useState(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hideRegistrationNotice, setHideRegistrationNotice] = useState(false);

  useEffect(() => {
    document.title =
      viewMode === 'LOGIN'
        ? 'SupplyMind AI · Đăng nhập'
        : viewMode === 'FORGOT_EMAIL'
        ? 'SupplyMind AI · Quên mật khẩu'
        : 'SupplyMind AI · Đặt lại mật khẩu';
    window.scrollTo(0, 0);
  }, [viewMode]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors: typeof errors = {};
    if (!username.trim()) nextErrors.username = 'Nhập username của bạn.';
    else if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username.trim()))
      nextErrors.username =
        'Dùng 3–50 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.';
    if (!password) nextErrors.password = 'Nhập mật khẩu của bạn.';
    else if (new TextEncoder().encode(password).length > 72)
      nextErrors.password = 'Mật khẩu quá dài.';
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length) {
      if (nextErrors.username) usernameRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      onLogin(await login({ username: username.trim(), password }));
    } catch (error) {
      if (isSubscriptionRequiredError(error)) {
        setPayment({ renewalToken: error.renewalToken, subscription: error.subscription });
        setServerError('');
        paymentRequest.current = null;
      } else {
        setServerError(getApiError(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRenewal() {
    if (!payment || paying) return;
    if (!paymentRequest.current) paymentRequest.current = crypto.randomUUID();
    setPaying(true);
    setPaymentError('');
    try {
      await renewExpiredSubscription(payment.renewalToken, paymentRequest.current);
      onLogin(await login({ username: username.trim(), password }));
    } catch (error) {
      setPaymentError(getApiError(error));
    } finally {
      setPaying(false);
    }
  }

  // Handle requesting OTP for forgot password
  async function handleRequestOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestingOtp) return;
    const emailErr = validateForgotEmail(forgotEmail);
    if (emailErr) {
      setForgotEmailError(emailErr);
      return;
    }
    setForgotEmailError('');
    setForgotServerError('');
    setRequestingOtp(true);
    try {
      const res = await requestForgotPasswordOtp(forgotEmail.trim().toLowerCase());
      setResetOtpToken(res.resetOtpToken);
      setDevOtpNotice(res.devOtp || '');
      setShowForgotOtpModal(true);
    } catch (error) {
      setForgotServerError(getApiError(error));
    } finally {
      setRequestingOtp(false);
    }
  }

  // Handle resetting password with verified resetPassToken
  async function handleResetPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingNewPassword) return;

    let hasError = false;
    const passErr = validateNewPassword(newPassword);
    if (passErr) {
      setNewPasswordError(passErr);
      hasError = true;
    } else {
      setNewPasswordError('');
    }

    if (!confirmNewPassword) {
      setConfirmNewPasswordError('Nhập lại mật khẩu mới của bạn.');
      hasError = true;
    } else if (newPassword !== confirmNewPassword) {
      setConfirmNewPasswordError('Mật khẩu nhập lại không khớp.');
      hasError = true;
    } else {
      setConfirmNewPasswordError('');
    }

    if (hasError) return;

    setNewPasswordServerError('');
    setSubmittingNewPassword(true);
    try {
      const res = await resetForgotPassword({
        resetPassToken,
        password: newPassword,
        confirmPassword: confirmNewPassword,
      });

      // If username returned, populate login input
      if (res.username) {
        setUsername(res.username);
      }
      setPassword('');

      // Clear forgot password state
      setForgotEmail('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetPassToken('');
      setResetOtpToken('');
      setDevOtpNotice('');

      // Return to login screen
      setViewMode('LOGIN');
      setHideRegistrationNotice(true);
      navigate(location.pathname, { replace: true, state: {} });
      setErrors({});
      setServerError('');

      // Show success toast notification at top-right
      setToastMessage('Đổi mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.');
    } catch (error) {
      setNewPasswordServerError(getApiError(error));
    } finally {
      setSubmittingNewPassword(false);
    }
  }

  return (
    <main className="login-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 99999,
            backgroundColor: '#10B981',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '14px',
            animation: 'modalPop 0.3s ease',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              fontSize: '12px',
            }}
          >
            OK
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      <section className="story-panel">
        <Brand light />
        <div className="story-content">
          <div className="eyebrow">
            <span /> NGƯỜI BẠN CỦA NHÀ BÁN LẺ
          </div>
          <h1>
            Nhập hàng đúng lúc.
            <br />
            <span>Kinh doanh nhẹ đầu.</span>
          </h1>
          <p className="story-description">
            Từ gợi ý nhập hàng đến kết nối nguồn sỉ.
            <br className="desktop-break" /> Cùng bạn chăm chút cửa hàng mỗi ngày.
          </p>
          <ProductPreview />
        </div>
        <div className="story-footer">
          <span>
            <Icon name="sparkle" /> Gợi ý thông minh
          </span>
          <i />
          <span>
            <Icon name="store" /> Kết nối gần hơn
          </span>
        </div>
        <div className="story-orbit orbit-one" />
        <div className="story-orbit orbit-two" />
      </section>

      <section className="form-panel" aria-labelledby="login-title">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="help-top">
          <span>Một kết nối. Nhiều cơ hội.</span>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            aria-expanded={showHelp}
            aria-controls="login-help"
          >
            <Icon name="help" /> Trợ giúp
          </button>
        </div>
        <div className="login-form-wrap">
          {viewMode === 'LOGIN' && (
            <>
              <div className="welcome-icon">
                <Icon name="store" />
              </div>
              <p className="form-eyebrow">CHÀO MỪNG TRỞ LẠI</p>
              <h2 id="login-title">{payment ? 'Gia hạn sử dụng' : 'Đăng nhập'}</h2>
              <p className="form-description">
                {payment
                  ? 'Tài khoản đã hết hạn và chưa được đăng nhập vào hệ thống.'
                  : 'Cửa hàng của bạn, sẵn sàng cho ngày mới.'}
              </p>
              {registeredUsername && !hideRegistrationNotice && !payment && (
                <p className="success-notice" role="status">
                  Đăng ký thành công! Username đã được điền sẵn. Nhập mật khẩu để đăng nhập.
                </p>
              )}
              {payment ? (
                <section className="login-payment-card" aria-label="Thanh toán gia hạn">
                  <div className="login-payment-status">
                    <Icon name="lock" />
                    <span>
                      <strong>Gói dùng thử đã hết hạn</strong>
                      <small>@{username.trim()}</small>
                    </span>
                  </div>
                  <div className="login-payment-price">
                    <strong>{payment.subscription.monthlyPrice.toLocaleString('vi-VN')} ₫</strong>
                    <span>/ 1 tháng</span>
                  </div>
                  <ul>
                    <li>Mở lại toàn bộ chức năng kho và bán hàng</li>
                    <li>Tiếp tục dùng AI dự báo, nguồn sỉ và đơn hàng</li>
                    <li>Không làm mất dữ liệu đã nhập trước đó</li>
                  </ul>
                  <p>Đây là thanh toán mô phỏng phục vụ demo; hệ thống không trừ tiền thật.</p>
                  {paymentError && (
                    <p className="error-notice" role="alert">
                      {paymentError}
                    </p>
                  )}
                  <button
                    className="primary-button"
                    type="button"
                    disabled={paying}
                    onClick={() => void handleRenewal()}
                  >
                    {paying ? (
                      <>
                        <span className="spinner" /> Đang mở khóa…
                      </>
                    ) : (
                      <>
                        Thanh toán 19.000đ và đăng nhập <Icon name="arrow" />
                      </>
                    )}
                  </button>
                  <button
                    className="login-payment-back"
                    type="button"
                    disabled={paying}
                    onClick={() => {
                      setPayment(null);
                      setPaymentError('');
                      paymentRequest.current = null;
                    }}
                  >
                    ← Quay lại nhập tài khoản
                  </button>
                </section>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="login-form">
                  <div className="field-group">
                    <label htmlFor="username">
                      Tên đăng nhập <span>Username</span>
                    </label>
                    <div className={`input-wrap ${errors.username ? 'input-error' : ''}`}>
                      <Icon name="user" />
                      <input
                        ref={usernameRef}
                        id="username"
                        name="username"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="Nhập tên đăng nhập"
                        value={username}
                        onChange={(event) => {
                          setUsername(event.target.value);
                          setErrors((current) => ({ ...current, username: undefined }));
                          setServerError('');
                        }}
                        aria-invalid={Boolean(errors.username)}
                        aria-describedby={errors.username ? 'username-error' : undefined}
                        disabled={submitting}
                      />
                    </div>
                    {errors.username && (
                      <p className="field-error" id="username-error">
                        {errors.username}
                      </p>
                    )}
                  </div>
                  <div className="field-group">
                    <label htmlFor="password">Mật khẩu</label>
                    <div className={`input-wrap ${errors.password ? 'input-error' : ''}`}>
                      <Icon name="lock" />
                      <input
                        ref={passwordRef}
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Nhập mật khẩu của bạn"
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          setErrors((current) => ({ ...current, password: undefined }));
                          setServerError('');
                        }}
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={errors.password ? 'password-error' : undefined}
                        disabled={submitting}
                      />
                      <button
                        className="password-toggle"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        aria-pressed={showPassword}
                      >
                        <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                      </button>
                    </div>
                    {errors.password && (
                      <p className="field-error" id="password-error">
                        {errors.password}
                      </p>
                    )}
                  </div>
                  {serverError && (
                    <p className="error-notice" role="alert">
                      {serverError}
                    </p>
                  )}
                  <button className="primary-button" type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <span className="spinner" /> Đang đăng nhập…
                      </>
                    ) : (
                      <>
                        Đăng nhập <Icon name="arrow" />
                      </>
                    )}
                  </button>
                </form>
              )}

              <div className="role-section">
                <p>MỘT NỀN TẢNG, BA VAI TRÒ</p>
                <div className="role-chips">
                  <span>
                    <Icon name="store" />
                    Chủ tạp hóa
                  </span>
                  <span>
                    <Icon name="box" />
                    Chủ vựa
                  </span>
                  <span>
                    <Icon name="shield" />
                    Quản trị viên
                  </span>
                </div>
                <p className="role-hint">Hệ thống tự chuyển đến không gian theo vai trò của bạn.</p>
              </div>

              {showHelp && (
                <div className="help-notice" id="login-help" role="status">
                  <strong>Cần hỗ trợ tài khoản?</strong>
                  <p>
                    Bạn có thể chọn “Tạo tài khoản” để đăng ký. Nếu quên mật khẩu, hãy chọn “Quên mật khẩu? Lấy lại tài khoản” bên dưới hoặc liên hệ quản trị viên.
                  </p>
                </div>
              )}

              {/* Vị trí nằm ngay trên phần lựa chọn đăng ký tài khoản */}
              <div
                className="forgot-password-link-wrap"
                style={{
                  textAlign: 'center',
                  marginTop: '18px',
                  marginBottom: '10px',
                }}
              >
                <button
                  type="button"
                  className="account-link"
                  onClick={() => {
                    setViewMode('FORGOT_EMAIL');
                    setForgotEmail('');
                    setForgotEmailError('');
                    setForgotServerError('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px 0',
                    color: '#0f766e',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Quên mật khẩu? Lấy lại tài khoản <span>↗</span>
                </button>
              </div>

              <p className="account-help" style={{ marginTop: '0' }}>
                Chưa có tài khoản?{' '}
                <Link className="account-link" to="/register">
                  Tạo tài khoản <span>↗</span>
                </Link>
              </p>
            </>
          )}

          {viewMode === 'FORGOT_EMAIL' && (
            <>
              <div className="welcome-icon">
                <Icon name="lock" />
              </div>
              <p className="form-eyebrow">KHÔI PHỤC TÀI KHOẢN</p>
              <h2 id="login-title">Quên mật khẩu</h2>
              <p className="form-description">
                Nhập email đã đăng ký để nhận mã OTP xác thực khôi phục tài khoản.
              </p>

              <form onSubmit={handleRequestOtpSubmit} noValidate className="login-form">
                <div className="field-group">
                  <label htmlFor="forgot-email">
                    Email tài khoản <span>Email</span>
                  </label>
                  <div className={`input-wrap ${forgotEmailError ? 'input-error' : ''}`}>
                    <Icon name="mail" />
                    <input
                      id="forgot-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="ban@example.com"
                      value={forgotEmail}
                      onChange={(event) => {
                        setForgotEmail(event.target.value);
                        setForgotEmailError('');
                        setForgotServerError('');
                      }}
                      aria-invalid={Boolean(forgotEmailError)}
                      aria-describedby={forgotEmailError ? 'forgot-email-error' : undefined}
                      disabled={requestingOtp}
                      autoFocus
                    />
                  </div>
                  {forgotEmailError && (
                    <p className="field-error" id="forgot-email-error">
                      {forgotEmailError}
                    </p>
                  )}
                </div>

                {forgotServerError && (
                  <p className="error-notice" role="alert">
                    {forgotServerError}
                  </p>
                )}

                <button className="primary-button" type="submit" disabled={requestingOtp}>
                  {requestingOtp ? (
                    <>
                      <span className="spinner" /> Đang gửi mã OTP…
                    </>
                  ) : (
                    <>
                      Lấy mã OTP <Icon name="arrow" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="login-payment-back"
                  disabled={requestingOtp}
                  onClick={() => {
                    setViewMode('LOGIN');
                    setHideRegistrationNotice(true);
                    navigate(location.pathname, { replace: true, state: {} });
                    setForgotServerError('');
                    setForgotEmailError('');
                    setErrors({});
                    setServerError('');
                  }}
                  style={{ marginTop: '12px' }}
                >
                  ← Quay lại Đăng nhập
                </button>
              </form>
            </>
          )}

          {viewMode === 'FORGOT_NEW_PASSWORD' && (
            <>
              <div className="welcome-icon">
                <Icon name="lock" />
              </div>
              <p className="form-eyebrow">BẢO MẬT TÀI KHOẢN</p>
              <h2 id="login-title">Đổi mật khẩu mới</h2>
              <p className="form-description">
                Tạo mật khẩu mới an toàn cho tài khoản của bạn.
              </p>

              <form onSubmit={handleResetPasswordSubmit} noValidate className="login-form">
                <div className="field-group">
                  <label htmlFor="new-password">Mật khẩu mới</label>
                  <div className={`input-wrap ${newPasswordError ? 'input-error' : ''}`}>
                    <Icon name="lock" />
                    <input
                      id="new-password"
                      name="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Nhập mật khẩu mới"
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(event.target.value);
                        setNewPasswordError('');
                        setNewPasswordServerError('');
                      }}
                      aria-invalid={Boolean(newPasswordError)}
                      aria-describedby={newPasswordError ? 'new-password-error' : undefined}
                      disabled={submittingNewPassword}
                      autoFocus
                    />
                    <button
                      className="password-toggle"
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      aria-pressed={showNewPassword}
                    >
                      <Icon name={showNewPassword ? 'eyeOff' : 'eye'} />
                    </button>
                  </div>
                  <p className="field-hint" style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Ít nhất 8 ký tự không tính khoảng trắng, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
                  </p>
                  {newPasswordError && (
                    <p className="field-error" id="new-password-error">
                      {newPasswordError}
                    </p>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="confirm-new-password">Nhập lại mật khẩu mới</label>
                  <div className={`input-wrap ${confirmNewPasswordError ? 'input-error' : ''}`}>
                    <Icon name="lock" />
                    <input
                      id="confirm-new-password"
                      name="confirm-new-password"
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Nhập lại mật khẩu mới"
                      value={confirmNewPassword}
                      onChange={(event) => {
                        setConfirmNewPassword(event.target.value);
                        setConfirmNewPasswordError('');
                        setNewPasswordServerError('');
                      }}
                      aria-invalid={Boolean(confirmNewPasswordError)}
                      aria-describedby={
                        confirmNewPasswordError ? 'confirm-new-password-error' : undefined
                      }
                      disabled={submittingNewPassword}
                    />
                    <button
                      className="password-toggle"
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      aria-label={showConfirmNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      aria-pressed={showConfirmNewPassword}
                    >
                      <Icon name={showConfirmNewPassword ? 'eyeOff' : 'eye'} />
                    </button>
                  </div>
                  {confirmNewPasswordError && (
                    <p className="field-error" id="confirm-new-password-error">
                      {confirmNewPasswordError}
                    </p>
                  )}
                </div>

                {newPasswordServerError && (
                  <p className="error-notice" role="alert">
                    {newPasswordServerError}
                  </p>
                )}

                <button className="primary-button" type="submit" disabled={submittingNewPassword}>
                  {submittingNewPassword ? (
                    <>
                      <span className="spinner" /> Đang cập nhật mật khẩu…
                    </>
                  ) : (
                    <>
                      Xác nhận đổi mật khẩu <Icon name="check" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="login-payment-back"
                  disabled={submittingNewPassword}
                  onClick={() => {
                    setViewMode('LOGIN');
                    setHideRegistrationNotice(true);
                    navigate(location.pathname, { replace: true, state: {} });
                    setNewPasswordServerError('');
                    setNewPasswordError('');
                    setConfirmNewPasswordError('');
                    setErrors({});
                    setServerError('');
                  }}
                  style={{ marginTop: '12px' }}
                >
                  ← Hủy và quay lại Đăng nhập
                </button>
              </form>
            </>
          )}
        </div>

        <footer className="form-footer">
          <span>© 2026 SupplyMind AI</span>
          <span>
            <Icon name="lock" /> Kết nối an toàn, an tâm kinh doanh
          </span>
        </footer>
      </section>

      {/* Forgot Password OTP Verification Modal */}
      {showForgotOtpModal && (
        <ForgotPasswordOtpModal
          email={forgotEmail.trim().toLowerCase()}
          otpToken={resetOtpToken}
          devOtpNotice={devOtpNotice}
          onClose={() => setShowForgotOtpModal(false)}
          onSuccess={(verifiedToken) => {
            setShowForgotOtpModal(false);
            setResetPassToken(verifiedToken);
            setViewMode('FORGOT_NEW_PASSWORD');
          }}
          onResend={async () => {
            const res = await resendForgotPasswordOtp(forgotEmail.trim().toLowerCase());
            setResetOtpToken(res.resetOtpToken);
            if (res.devOtp) setDevOtpNotice(res.devOtp);
            return res.resetOtpToken;
          }}
        />
      )}
    </main>
  );
}

// Sub-component: OTP verification modal for password reset
function ForgotPasswordOtpModal({
  email,
  otpToken,
  devOtpNotice,
  onClose,
  onSuccess,
  onResend,
}: {
  email: string;
  otpToken: string;
  devOtpNotice: string;
  onClose: () => void;
  onSuccess: (resetPassToken: string) => void;
  onResend: () => Promise<string>;
}) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [currentOtpToken, setCurrentOtpToken] = useState(otpToken);
  const [timeLeft, setTimeLeft] = useState(60);
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [currentDevOtp, setCurrentDevOtp] = useState(devOtpNotice || '');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [prevOtpToken, setPrevOtpToken] = useState(otpToken);
  if (otpToken !== prevOtpToken) {
    setPrevOtpToken(otpToken);
    setCurrentOtpToken(otpToken);
    if (devOtpNotice) setCurrentDevOtp(devOtpNotice);
  }

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleDigitChange(index: number, value: string) {
    const char = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = char;
    setDigits(nextDigits);
    setOtpError('');

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      if (timeLeft > 0 && digits.join('').length === 6) {
        handleVerify();
      } else if (timeLeft === 0) {
        handleResend();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const nextDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = pasted[i] || '';
    }
    setDigits(nextDigits);
    setOtpError('');

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  }

  async function handleVerify() {
    const code = digits.join('');
    if (code.length < 6) {
      setOtpError('Vui lòng nhập đủ 6 chữ số mã OTP.');
      return;
    }

    setVerifying(true);
    setOtpError('');
    try {
      const res = await verifyForgotPasswordOtp({
        resetOtpToken: currentOtpToken,
        otp: code,
      });
      onSuccess(res.resetPassToken);
    } catch (error) {
      setOtpError(getApiError(error) || 'Mã OTP không chính xác. Vui lòng kiểm tra lại.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setOtpError('');
    try {
      const newToken = await onResend();
      setCurrentOtpToken(newToken);
      setDigits(['', '', '', '', '', '']);
      setTimeLeft(60);
      inputRefs.current[0]?.focus();
    } catch (error) {
      setOtpError(getApiError(error) || 'Không thể gửi lại mã OTP. Vui lòng thử lại sau.');
    } finally {
      setResending(false);
    }
  }

  const isComplete = digits.join('').length === 6;

  return (
    <div
      className="otp-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-otp-modal-title"
      onClick={onClose}
    >
      <div className="otp-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="otp-modal-header">
          <div className="otp-modal-title-wrap">
            <h2 id="forgot-otp-modal-title" className="otp-modal-title">
              Xác thực tài khoản
            </h2>
            <p className="otp-modal-subtitle">
              Mã xác thực gồm 6 chữ số đã được gửi đến email:
              <br />
              <strong className="otp-email-highlight">{email}</strong>
              <br />
              Vui lòng nhập mã để xác nhận bạn là chủ nhân tài khoản liên kết với email này.
            </p>
          </div>
          <button
            type="button"
            className="otp-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng popup"
            title="Đóng và quay lại"
          >
            ×
          </button>
        </div>

        {/* 6 Digit Input Row */}
        <div className="otp-inputs-row" onPaste={handlePaste}>
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={verifying || resending}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className={`otp-digit-box ${otpError ? 'has-error' : ''} ${digit ? 'filled' : ''}`}
              aria-label={`Chữ số OTP thứ ${idx + 1}`}
            />
          ))}
        </div>

        {/* Error alert */}
        {otpError && (
          <div className="otp-error-alert" role="alert">
            <Icon name="sparkle" /> {otpError}
          </div>
        )}

        {/* 60s Countdown Timer */}
        <div className="otp-timer-wrap">
          {timeLeft > 0 ? (
            <p className="otp-timer-text active">
              Mã có hiệu lực trong: <strong>00:{String(timeLeft).padStart(2, '0')}s</strong>
            </p>
          ) : (
            <p className="otp-timer-text expired">
              Mã OTP đã hết hiệu lực (quá 60s). Vui lòng bấm <strong>Gửi lại OTP</strong> bên dưới.
            </p>
          )}
        </div>

        {/* Combined Action Button: Xác nhận khi còn giờ, Gửi lại OTP khi hết 60s */}
        <div className="otp-action-wrap">
          {timeLeft > 0 ? (
            <button
              type="button"
              className="otp-action-btn confirm"
              onClick={handleVerify}
              disabled={!isComplete || verifying}
            >
              {verifying ? (
                <>Đang kiểm tra...</>
              ) : (
                <>
                  <Icon name="check" /> Xác nhận
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="otp-action-btn resend"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? (
                <>Đang gửi mã mới...</>
              ) : (
                <>
                  <Icon name="arrow" /> Gửi lại OTP
                </>
              )}
            </button>
          )}
        </div>

        {/* Optional dev mode helper */}
        {currentDevOtp && (
          <div className="otp-dev-notice">
            <strong>Mã thử nghiệm (Dev):</strong> <code>{currentDevOtp}</code>
          </div>
        )}
      </div>
    </div>
  );
}
