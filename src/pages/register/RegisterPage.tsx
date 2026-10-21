import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand';
import BirthDateInput from '../../components/BirthDateInput';
import Icon from '../../components/Icon';
import { getApiError, getApiFieldErrors } from '../../services/api';
import { requestRegistrationOtp, resendRegistrationOtp, verifyRegistrationOtp, type RegistrationInput } from '../../services/auth.api';
import type { AuthUser } from '../../types/auth';

import {
  normalizeRegistration,
  registrationFields,
  validateRegistration,
  type FieldErrors,
} from '../../validation/registration';

const initialValues: RegistrationInput = {
  name: '',
  username: '',
  email: '',
  phone: '',
  role: 'STORE_OWNER',
  dateOfBirth: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [devOtpNotice, setDevOtpNotice] = useState('');
  const [focusRequest, setFocusRequest] = useState<{
    field: keyof RegistrationInput | null;
  } | null>(null);
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

  // Handle ESC key to close Terms Modal
  useEffect(() => {
    if (!showTermsModal) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowTermsModal(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTermsModal]);

  function focusFirstError(nextErrors: FieldErrors) {
    setFocusRequest({ field: registrationFields.find((key) => nextErrors[key]) ?? null });
  }

  function inputProps(field: keyof RegistrationInput, hint = false) {
    const descriptions = [
      hint ? `${field}-hint` : '',
      errors[field] ? `${field}-error` : '',
    ].filter(Boolean);
    return {
      id: field,
      name: field,
      disabled: submitting,
      'aria-invalid': Boolean(errors[field]),
      'aria-describedby': descriptions.join(' ') || undefined,
      onBlur: () =>
        setErrors((current) => ({ ...current, [field]: validateRegistration(values)[field] })),
    };
  }

  function update<K extends keyof RegistrationInput>(key: K, value: RegistrationInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
      ...(key === 'password' && values.confirmPassword
        ? {
            confirmPassword:
              value === values.confirmPassword ? undefined : 'Mật khẩu nhập lại không khớp.',
          }
        : {}),
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
      const normalized = normalizeRegistration(values);
      const res = await requestRegistrationOtp(normalized);
      setOtpToken(res.otpToken);
      setDevOtpNotice(res.devOtp || '');
      setShowOtpModal(true);
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error, registrationFields);
      setErrors(fieldErrors);
      setServerError(
        Object.keys(fieldErrors).length
          ? 'Vui lòng kiểm tra các thông tin được đánh dấu bên dưới.'
          : getApiError(error),
      );
      focusFirstError(fieldErrors);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="register-page">
      <section className="register-card" aria-labelledby="register-title">
        <div className="register-top">
          <Brand />
          <Link to="/login">Đã có tài khoản? Đăng nhập</Link>
        </div>
        <div className="register-heading">
          <div className="welcome-icon">
            <Icon name="store" />
          </div>
          <p className="form-eyebrow">BẮT ĐẦU CÙNG SUPPLYMIND</p>
          <h1 id="register-title">Tạo tài khoản</h1>
          <p className="form-description">Điền thông tin để kết nối cửa hàng và nguồn sỉ.</p>
        </div>
        <form
          ref={formRef}
          className="register-form"
          onSubmit={handleSubmit}
          noValidate
          aria-busy={submitting}
        >
          {serverError && (
            <p ref={noticeRef} className="error-notice" role="alert" tabIndex={-1}>
              {serverError}
            </p>
          )}
          <div className="register-grid">
            <Field label="Họ và tên" id="name" error={errors.name}>
              <input
                {...inputProps('name')}
                value={values.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Nguyễn Văn An"
                autoComplete="name"
              />
            </Field>
            <Field label="Tên đăng nhập" id="username" hint="Username" error={errors.username}>
              <input
                {...inputProps('username')}
                value={values.username}
                onChange={(e) => update('username', e.target.value)}
                placeholder="ten.dangnhap"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Field>
            <Field label="Email" id="email" error={errors.email}>
              <input
                {...inputProps('email')}
                type="email"
                value={values.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="ban@example.com"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Field>
            <Field label="Số điện thoại" id="phone" error={errors.phone}>
              <input
                {...inputProps('phone')}
                type="tel"
                value={values.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="0912345678 hoặc +84912345678"
                autoComplete="tel"
              />
            </Field>
            <Field label="Vai trò" id="role" error={errors.role}>
              <select
                {...inputProps('role')}
                value={values.role}
                onChange={(e) => update('role', e.target.value as RegistrationInput['role'])}
              >
                <option value="STORE_OWNER">Chủ tạp hóa</option>
                <option value="SUPPLIER">Chủ vựa</option>
              </select>
            </Field>
            <Field
              label="Ngày tháng năm sinh"
              id="dateOfBirth"
              error={errors.dateOfBirth}
              description="Bấm để chọn ngày sinh trên lịch hoặc nhập trực tiếp (DD/MM/YYYY)."
            >
              <BirthDateInput
                value={values.dateOfBirth}
                onChange={(value) => update('dateOfBirth', value)}
                onBlur={inputProps('dateOfBirth').onBlur}
                disabled={submitting}
                invalid={Boolean(errors.dateOfBirth)}
                describedBy={inputProps('dateOfBirth', true)['aria-describedby']}
              />
            </Field>
            <Field
              label="Mật khẩu"
              id="password"
              error={errors.password}
              description="Ít nhất 8 ký tự không tính khoảng trắng, gồm chữ hoa, chữ thường, số và ký tự đặc biệt."
            >
              <div className="register-password">
                <input
                  {...inputProps('password', true)}
                  type={showPassword ? 'text' : 'password'}
                  value={values.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="Tạo mật khẩu của bạn"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </Field>
            <Field label="Nhập lại mật khẩu" id="confirmPassword" error={errors.confirmPassword}>
              <div className="register-password">
                <input
                  {...inputProps('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  value={values.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'}
                  aria-pressed={showConfirm}
                >
                  <Icon name={showConfirm ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </Field>
          </div>

          {/* Terms and Service Checkbox & Link */}
          <div className={`register-terms-row ${errors.acceptTerms ? 'has-error' : ''}`}>
            <label className="register-terms-label" htmlFor="acceptTerms">
              <input
                type="checkbox"
                id="acceptTerms"
                name="acceptTerms"
                checked={Boolean(values.acceptTerms)}
                onChange={(e) => update('acceptTerms', e.target.checked)}
                disabled={submitting}
                aria-invalid={Boolean(errors.acceptTerms)}
                aria-describedby={errors.acceptTerms ? 'acceptTerms-error' : undefined}
              />
              <span className="register-terms-text">
                Tôi đã đọc và đồng ý với{' '}
                <button
                  type="button"
                  className="terms-link-btn"
                  onClick={() => setShowTermsModal(true)}
                >
                  Điều khoản và Dịch vụ
                </button>{' '}
                của nền tảng SupplyMind AI
              </span>
            </label>
            {errors.acceptTerms && (
              <p className="terms-error-msg" id="acceptTerms-error" role="alert">
                {errors.acceptTerms}
              </p>
            )}
          </div>

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner" /> Đang tạo tài khoản…
              </>
            ) : (
              <>
                Tạo tài khoản <Icon name="arrow" />
              </>
            )}
          </button>
        </form>
        <p className="register-note">Tài khoản quản trị viên chỉ được cấp bởi hệ thống.</p>
      </section>

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <TermsModal
          onClose={() => setShowTermsModal(false)}
          onAccept={() => {
            update('acceptTerms', true);
            setShowTermsModal(false);
          }}
        />
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <OtpModal
          email={values.email}
          otpToken={otpToken}
          devOtpNotice={devOtpNotice}
          onClose={() => setShowOtpModal(false)}
          onSuccess={(user) => {
            setShowOtpModal(false);
            navigate('/login', { replace: true, state: { registeredUsername: user.username } });
          }}
          onResend={async () => {
            const res = await resendRegistrationOtp(normalizeRegistration(values));
            setOtpToken(res.otpToken);
            if (res.devOtp) setDevOtpNotice(res.devOtp);
            return res.otpToken;
          }}
        />
      )}
    </main>
  );
}

function Field({
  label,
  id,
  hint,
  error,
  description,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  error?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="field-group register-field">
      <label htmlFor={id}>
        {label} <span>{hint}</span>
      </label>
      <div className={`input-wrap ${error ? 'input-error' : ''}`}>{children}</div>
      {description && (
        <p className="field-hint" id={`${id}-hint`}>
          {description}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function TermsModal({
  onClose,
  onAccept,
}: {
  onClose: () => void;
  onAccept: () => void;
}) {
  return (
    <div
      className="terms-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      onClick={onClose}
    >
      <div className="terms-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="terms-modal-header">
          <div className="terms-modal-title-wrap">
            <h2 id="terms-modal-title">Điều khoản và Dịch vụ Nền tảng SupplyMind AI</h2>
            <p className="terms-modal-subtitle">
              Quy chế hoạt động và thỏa thuận sử dụng dịch vụ thương mại điện tử B2B
            </p>
            <div className="terms-legal-badges">
              <span className="terms-legal-badge">Luật Thương mại 2005</span>
              <span className="terms-legal-badge">Nghị định 52/2013/NĐ-CP & 85/2021/NĐ-CP</span>
              <span className="terms-legal-badge">Nghị định 69/2018/NĐ-CP</span>
              <span className="terms-legal-badge">Nghị định 13/2023/NĐ-CP (PDPD)</span>
            </div>
          </div>
          <button
            type="button"
            className="terms-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng bảng điều khoản"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="terms-modal-body">
          <div className="terms-preamble-box">
            <strong>Lời mở đầu:</strong> Chào mừng bạn đến với <strong>SupplyMind AI</strong> (SGRestockAI) — nền tảng công nghệ trung gian kết nối Thương mại Điện tử B2B giữa Nhà bán sỉ / Chủ vựa (<code>SUPPLIER</code>) và Các cơ sở kinh doanh, Cửa hàng tạp hóa bán lẻ (<code>STORE_OWNER</code>). Bằng việc tích chọn đồng ý và hoàn tất đăng ký, bạn xác nhận đã đọc, hiểu và cam kết tuân thủ đầy đủ các điều khoản dưới đây.
          </div>

          {/* Điều 1 */}
          <section className="terms-article">
            <h3 className="terms-article-title">Điều 1: Tư cách và Điều kiện Tham gia Hệ thống</h3>
            <ul>
              <li>
                <strong>1.1. Năng lực pháp lý:</strong> Người đại diện đăng ký tài khoản phải từ đủ 18 tuổi trở lên, có đầy đủ năng lực hành vi dân sự theo quy định của Bộ luật Dân sự 2015 và có thẩm quyền đại diện hợp pháp cho cơ sở kinh doanh hoặc kho vựa hàng sỉ.
              </li>
              <li>
                <strong>1.2. Tính trung thực của thông tin:</strong> Người dùng cam kết cung cấp thông tin đăng ký chính xác (Họ tên, Tên đăng nhập, Email, Số điện thoại, Ngày sinh, Vai trò). Nghiêm cấm sử dụng thông tin giả mạo, chèn khoảng trắng lừa dối hệ thống hoặc mạo danh thương nhân khác.
              </li>
              <li>
                <strong>1.3. Trách nhiệm bảo mật tài khoản:</strong> Người dùng có nghĩa vụ tự bảo quản mật khẩu và tài khoản của mình. Mọi đơn đặt hàng, bài đăng bán hoặc tương tác phát sinh từ tài khoản được xác lập sẽ được pháp luật coi là hành vi của chính chủ tài khoản.
              </li>
            </ul>
          </section>

          {/* Điều 2 */}
          <section className="terms-article">
            <h3 className="terms-article-title">Điều 2: Tiêu chuẩn Hàng hóa & Cơ chế Kiểm duyệt Tự động AI 3 Cấp độ</h3>
            <p>
              Nhằm bảo vệ thị trường sỉ lành mạnh và tuân thủ Luật Thương mại 2005 cùng Nghị định 69/2018/NĐ-CP, nền tảng áp dụng quy trình kiểm soát hàng hóa và cơ chế AI tự động kiểm duyệt hàng bán theo <strong>3 cấp độ</strong> minh bạch:
            </p>
            <div className="terms-tier-card">
              <div className="terms-tier-item">
                <span className="terms-tier-pill approved">Cấp độ 1 · Đã duyệt</span>
                <div>
                  <strong>Phê duyệt tự động (Auto Approved):</strong> Dành cho các mặt hàng thiết yếu, thông tin rõ ràng, nguồn gốc minh bạch, giá cả và số lượng nằm trong ngưỡng tiêu chuẩn. Bài đăng được đăng bán công khai ngay lập tức lên kênh sỉ.
                </div>
              </div>
              <div className="terms-tier-item">
                <span className="terms-tier-pill review">Cấp độ 2 · Cần kiểm tra</span>
                <div>
                  <strong>Tạm ẩn và Quản trị viên duyệt (Needs Review):</strong> Áp dụng khi bài đăng có 1 lỗi nhẹ (hình ảnh chưa đủ nét, mô tả chưa cụ thể hoặc chứa từ khóa cần xác minh bổ sung). Sản phẩm được tạm ẩn khỏi kênh bán và chuyển đến đội ngũ Admin để thẩm định, bảo đảm quyền lợi trước khi công khai.
                </div>
              </div>
              <div className="terms-tier-item">
                <span className="terms-tier-pill rejected">Cấp độ 3 · Vi phạm nghiêm trọng</span>
                <div>
                  <strong>AI tự động cấm thẳng (Auto Rejected):</strong> Áp dụng khi phát hiện từ 2 lỗi trở lên, hoặc xuất hiện từ cấm nghiêm trọng (vũ khí, ma túy, chất nổ, tài liệu phản động, hàng giả mạo nhãn hiệu sở hữu trí tuệ), hoặc quy cách/số lượng đăng bán vượt ngưỡng phi thực tế. Hệ thống AI tự động chặn và cấm thẳng mà không cần quản trị viên duyệt. Tài khoản vi phạm tái diễn sẽ bị khóa vĩnh viễn.
                </div>
              </div>
            </div>
          </section>

          {/* Điều 3 */}
          <section className="terms-article">
            <h3 className="terms-article-title">Điều 3: Quy cách Bán sỉ, Đơn vị Đóng gói & Giới hạn Cung ứng</h3>
            <ul>
              <li>
                <strong>3.1. Chuẩn hóa đơn vị đóng gói sỉ:</strong> Sản phẩm đăng bán phải tuân theo các quy cách phổ biến ngoài thực tế (thùng, lốc, bao, kiện...) với số lượng đóng gói được thiết lập rõ ràng và số lượng đơn vị bán không vượt quá 100 đơn vị quy cách theo định mức thực tế của nền tảng.
              </li>
              <li>
                <strong>3.2. Giới hạn tồn kho khả dụng:</strong> Số lượng hàng hóa xuất bán đăng lên sàn phải nhỏ hơn hoặc bằng số lượng tồn kho thực tế của Chủ vựa để đảm bảo luôn đủ hàng giao khi tiệm tạp hóa phát sinh đơn.
              </li>
              <li>
                <strong>3.3. Chất lượng & Hạn sử dụng:</strong> Chủ vựa cam kết hàng hóa có tem nhãn, nguồn gốc xuất xứ rõ ràng và hạn sử dụng (date) còn bảo đảm tối thiểu theo tiêu chuẩn lưu thông thị trường.
              </li>
            </ul>
          </section>

          {/* Điều 4 */}
          <section className="terms-article">
            <h3 className="terms-article-title">Điều 4: Đặt hàng, Giao nhận và Giải quyết Tranh chấp</h3>
            <ul>
              <li>
                <strong>4.1. Quy trình giao nhận & Đồng kiểm:</strong> Khi giao nhận hàng sỉ, Chủ tiệm tạp hóa có quyền và nghĩa vụ đối soát số lượng kiện/thùng, quy cách đóng gói và hạn sử dụng với tài xế giao hàng trước khi ký biên bản nghiệm thu.
              </li>
              <li>
                <strong>4.2. Thời hạn xử lý khiếu nại:</strong> Mọi phát sinh về sai lệch số lượng, hàng móp méo hư hỏng hoặc sai quy cách cần được phản hồi trên hệ thống trong vòng 48 giờ kể từ lúc nhận hàng để được giải quyết theo chính sách đổi trả/hoàn tiền.
              </li>
              <li>
                <strong>4.3. Vai trò trung gian hòa giải:</strong> SupplyMind AI đóng vai trò làm trung gian ghi nhận dữ liệu giao dịch, lịch sử kiểm duyệt AI và hỗ trợ hai bên thương lượng công bằng dựa trên hợp đồng nguyên tắc.
              </li>
            </ul>
          </section>

          {/* Điều 5 */}
          <section className="terms-article">
            <h3 className="terms-article-title">Điều 5: Bảo vệ Dữ liệu Cá nhân & An toàn Thông tin</h3>
            <ul>
              <li>
                <strong>5.1. Tuân thủ Nghị định 13/2023/NĐ-CP:</strong> SupplyMind AI thực hiện đầy đủ các biện pháp kỹ thuật và tổ chức để bảo vệ dữ liệu cá nhân của người dùng (tên, số điện thoại, email, địa chỉ cơ sở kinh doanh, số liệu giao dịch).
              </li>
              <li>
                <strong>5.2. Cam kết không bán dữ liệu:</strong> Toàn bộ dữ liệu doanh thu, chu kỳ nhập hàng và danh mục hàng bán đều được mã hóa. Chúng tôi cam kết tuyệt đối không bán hoặc chuyển giao dữ liệu kinh doanh của bạn cho bên thứ ba vì mục đích cạnh tranh thương mại.
              </li>
            </ul>
          </section>

          {/* Điều 6 */}
          <section className="terms-article">
            <h3 className="terms-article-title">Điều 6: Quyền và Trách nhiệm của Nền tảng SupplyMind AI</h3>
            <ul>
              <li>
                <strong>6.1. Cung cấp nền tảng số hóa:</strong> SupplyMind AI cung cấp công cụ AI dự đoán nhập hàng thông minh, tối ưu kho bãi và hệ thống kết nối B2B. Nền tảng không phải là đơn vị sở hữu hàng hóa của Chủ vựa hay trực tiếp thực hiện bán lẻ đến người tiêu dùng cuối cùng.
              </li>
              <li>
                <strong>6.2. Quyền xử lý vi phạm:</strong> Nền tảng có toàn quyền tạm ngừng, từ chối cung cấp dịch vụ hoặc chấm dứt tài khoản nếu phát hiện hành vi gian lận thương mại, tạo đơn ảo hoặc can thiệp phá hoại tính toàn vẹn của hệ thống.
              </li>
            </ul>
          </section>

          {/* Điều 7 */}
          <section className="terms-article">
            <h3 className="terms-article-title">Điều 7: Hiệu lực Thỏa thuận & Cập nhật Điều khoản</h3>
            <ul>
              <li>
                <strong>7.1. Hiệu lực ràng buộc:</strong> Thỏa thuận này có hiệu lực pháp lý ràng buộc giữa Người dùng và SupplyMind AI ngay khi Người dùng tích chọn "Tôi đã đọc và đồng ý" và kích hoạt tài khoản thành công.
              </li>
              <li>
                <strong>7.2. Điều chỉnh quy chế:</strong> Nền tảng có quyền sửa đổi, bổ sung các điều khoản này để phù hợp với định hướng phát triển và pháp luật hiện hành. Nội dung sửa đổi sẽ được công bố chính thức trên ứng dụng tối thiểu 07 ngày làm việc trước khi áp dụng.
              </li>
            </ul>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="terms-modal-footer">
          <button type="button" className="terms-btn-secondary" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="terms-btn-primary" onClick={onAccept}>
            <Icon name="check" /> Tôi đã đọc và đồng ý điều khoản
          </button>
        </div>
      </div>
    </div>
  );
}


function OtpModal({
  email,
  otpToken,
  devOtpNotice,
  onClose,
  onSuccess,
  onResend,
}: {
  email: string;
  otpToken: string;
  devOtpNotice?: string;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  onResend: () => Promise<string>;
}) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [currentOtpToken, setCurrentOtpToken] = useState(otpToken);
  const [timeLeft, setTimeLeft] = useState(60);
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [currentDevOtp, setCurrentDevOtp] = useState(devOtpNotice || '');
  const [successUser, setSuccessUser] = useState<AuthUser | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [prevOtpToken, setPrevOtpToken] = useState(otpToken);
  if (otpToken !== prevOtpToken) {
    setPrevOtpToken(otpToken);
    setCurrentOtpToken(otpToken);
    if (devOtpNotice) setCurrentDevOtp(devOtpNotice);
  }

  useEffect(() => {
    if (timeLeft <= 0 || successUser) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, successUser]);

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
      const user = await verifyRegistrationOtp({
        otpToken: currentOtpToken,
        otp: code,
      });
      setSuccessUser(user);
      setTimeout(() => {
        onSuccess(user);
      }, 1600);
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
      aria-labelledby="otp-modal-title"
      onClick={successUser ? () => onSuccess(successUser) : onClose}
    >
      <div className="otp-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {successUser ? (
          <div className="otp-success-state">
            <div className="otp-success-icon-wrap">
              <Icon name="check" />
            </div>
            <h2 className="otp-success-title">Đăng ký tài khoản thành công! 🎉</h2>
            <p className="otp-success-subtitle">
              Mã OTP chính xác. Tài khoản <strong>{successUser.username}</strong> của bạn đã được kích hoạt thành công.
            </p>
            <p className="otp-success-redirect-hint">
              Đang chuyển đến trang đăng nhập trong giây lát...
            </p>
            <button
              type="button"
              className="otp-action-btn confirm"
              onClick={() => onSuccess(successUser)}
            >
              <Icon name="check" /> Đăng nhập ngay
            </button>
          </div>
        ) : (
          <>
        {/* Header */}
        <div className="otp-modal-header">
          <div className="otp-modal-title-wrap">
            <h2 id="otp-modal-title" className="otp-modal-title">
              Xác thực mã OTP
            </h2>
            <p className="otp-modal-subtitle">
              Mã xác thực gồm 6 chữ số đã được gửi đến email:
              <br />
              <strong className="otp-email-highlight">{email}</strong>
            </p>
          </div>
          <button
            type="button"
            className="otp-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng popup và ở lại màn hình đăng ký"
            title="Đóng và quay lại biểu mẫu đăng ký"
          >
            ✕
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
            💡 <strong>Mã thử nghiệm (Dev):</strong> <code>{currentDevOtp}</code>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
