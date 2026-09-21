import type { RegistrationInput } from '../services/auth.api';

export type FieldErrors = Partial<Record<keyof RegistrationInput, string>>;
export const registrationFields: (keyof RegistrationInput)[] = [
  'name', 'username', 'email', 'phone', 'role', 'dateOfBirth', 'password', 'confirmPassword',
];

export function normalizePhone(value: string): string {
  const compact = value.replace(/[\s().-]/g, '');
  if (compact.startsWith('+84')) return `0${compact.slice(3)}`;
  if (compact.startsWith('84') && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
}

export function todayInVietnam(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function normalizeRegistration(values: RegistrationInput): RegistrationInput {
  return {
    ...values,
    name: values.name.trim().replace(/\s+/g, ' '),
    username: values.username.trim().toLowerCase(),
    email: values.email.trim().toLowerCase(),
    phone: normalizePhone(values.phone),
    dateOfBirth: values.dateOfBirth.trim(),
  };
}

// Keep rules and messages aligned with BE services/registrationValidation.js.
export function validateRegistration(values: RegistrationInput, now = new Date()): FieldErrors {
  const { name, username, email, phone, role, dateOfBirth, password, confirmPassword } = normalizeRegistration(values);
  const errors: FieldErrors = {};
  if (!/^[\p{L}\p{M} .'-]{2,100}$/u.test(name) || !/\p{L}/u.test(name))
    errors.name = 'Họ tên cần 2–100 ký tự, gồm chữ cái, khoảng trắng, dấu chấm, nháy hoặc gạch ngang.';
  if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username))
    errors.username = 'Username dùng 3–50 ký tự chữ không dấu, số, chấm, gạch dưới hoặc gạch ngang.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 255 || !/^[\x21-\x7E]+$/.test(email))
    errors.email = 'Nhập email hợp lệ, không dấu và tối đa 255 ký tự.';
  if (!/^0\d{9}$/.test(phone))
    errors.phone = 'Số điện thoại cần 10 số bắt đầu bằng 0; có thể dùng +84 thay cho số 0 đầu.';
  if (!['STORE_OWNER', 'SUPPLIER'].includes(role))
    errors.role = 'Chọn vai trò Chủ tạp hóa hoặc Chủ vựa.';
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(birth.valueOf()) ||
      dateOfBirth < '1900-01-01' || dateOfBirth > todayInVietnam(now) ||
      birth.toISOString().slice(0, 10) !== dateOfBirth)
    errors.dateOfBirth = 'Chọn ngày sinh có thật, từ 01/01/1900 đến hôm nay.';
  if (new TextEncoder().encode(password).length > 72)
    errors.password = 'Mật khẩu quá dài. Hãy dùng mật khẩu ngắn hơn.';
  else if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) ||
      !/\d/.test(password) || !/[^A-Za-z0-9\s]/.test(password))
    errors.password = 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.';
  if (!confirmPassword) errors.confirmPassword = 'Nhập lại mật khẩu của bạn.';
  else if (password !== confirmPassword) errors.confirmPassword = 'Mật khẩu nhập lại không khớp.';
  return errors;
}
