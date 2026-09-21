import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import { login } from '../../services/auth.api';
import { getApiError } from '../../services/api';
import type { AuthUser } from '../../types/auth';

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

export default function LoginPage({
  onLogin,
}: {
  onLogin: (user: AuthUser) => void;
}) {
  const location = useLocation();
  const registrationState: unknown = location.state;
  const registeredUsername = registrationState && typeof registrationState === 'object' &&
    'registeredUsername' in registrationState && typeof registrationState.registeredUsername === 'string'
    ? registrationState.registeredUsername : '';
  const [username, setUsername] = useState(registeredUsername);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const [serverError, setServerError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'SupplyMind AI · Đăng nhập';
    window.scrollTo(0, 0);
  }, []);

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
      setServerError(getApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
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
            <br className="desktop-break" /> Cùng bạn chăm chút cửa hàng mỗi
            ngày.
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
          <div className="welcome-icon">
            <Icon name="store" />
          </div>
          <p className="form-eyebrow">CHÀO MỪNG TRỞ LẠI</p>
          <h2 id="login-title">Đăng nhập</h2>
          <p className="form-description">
            Cửa hàng của bạn, sẵn sàng cho ngày mới.
          </p>
          {registeredUsername && (
            <p className="success-notice" role="status">
              Đăng ký thành công! Username đã được điền sẵn. Nhập mật khẩu để đăng nhập.
            </p>
          )}
          <form onSubmit={handleSubmit} noValidate className="login-form">
            <div className="field-group">
              <label htmlFor="username">
                Tên đăng nhập <span>Username</span>
              </label>
              <div
                className={`input-wrap ${errors.username ? 'input-error' : ''}`}
              >
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
                  aria-describedby={
                    errors.username ? 'username-error' : undefined
                  }
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
              <div
                className={`input-wrap ${errors.password ? 'input-error' : ''}`}
              >
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
                  aria-describedby={
                    errors.password ? 'password-error' : undefined
                  }
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
            <button
              className="primary-button"
              type="submit"
              disabled={submitting}
            >
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
            <p className="role-hint">
              Hệ thống tự chuyển đến không gian theo vai trò của bạn.
            </p>
          </div>
          {showHelp && (
            <div className="help-notice" id="login-help" role="status">
              <strong>Cần hỗ trợ tài khoản?</strong>
              <p>
                Bạn có thể chọn “Tạo tài khoản” để đăng ký. Nếu quên mật khẩu
                hoặc cần tài khoản quản trị, hãy liên hệ quản trị viên.
              </p>
            </div>
          )}
          <p className="account-help">
            Chưa có tài khoản?{' '}
            <Link className="account-link" to="/register">Tạo tài khoản <span>↗</span></Link>
          </p>
        </div>
        <footer className="form-footer">
          <span>© 2026 SupplyMind AI</span>
          <span>
            <Icon name="lock" /> Kết nối an toàn, an tâm kinh doanh
          </span>
        </footer>
      </section>
    </main>
  );
}
