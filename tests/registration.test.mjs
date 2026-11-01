import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBirthDateRange, normalizeRegistration, todayInVietnam, validateRegistration } from '../src/validation/registration.ts';

const base = {
  name: 'Nguyễn Văn An', username: 'nguyen.an', email: 'an@example.com',
  phone: '0912345678', role: 'STORE_OWNER', dateOfBirth: '1998-05-20',
  password: 'Register@2026', confirmPassword: 'Register@2026',
  acceptTerms: true,
};
const now = new Date('2026-09-20T18:00:00Z');

test('chuẩn hóa username, email, họ tên và số điện thoại giống payload BE', () => {
  for (const phone of ['0912345678', '+84 912 345 678', '84912345678']) {
    const input = { ...base, name: ' Nguyễn   Văn An ', username: ' NGUYEN.AN ', email: ' AN@EXAMPLE.COM ', phone };
    assert.deepEqual(validateRegistration(input, now), {});
    assert.deepEqual(normalizeRegistration(input), base);
  }
});

test('họ tên cho phép ký tự đặc biệt, chặn độ dài < 2 hoặc > 100', () => {
  // Cho phép ký tự đặc biệt
  assert.deepEqual(validateRegistration({ ...base, name: 'Nguyễn Văn An #@! 123' }, now), {});
  assert.deepEqual(validateRegistration({ ...base, name: 'An-Tiệm & Tạp Hóa' }, now), {});

  // Chặn độ dài < 2 không tính khoảng trắng hoặc > 100
  assert.ok(validateRegistration({ ...base, name: 'A' }, now).name);
  assert.ok(validateRegistration({ ...base, name: '   A   ' }, now).name);
  assert.ok(validateRegistration({ ...base, name: 'A'.repeat(101) }, now).name);
  assert.equal(
    validateRegistration({ ...base, name: 'A' }, now).name,
    'Họ tên cần 2–100 ký tự (không tính khoảng trắng).'
  );
});

test('tên đăng nhập báo lỗi đúng định dạng không chứa mô tả đuôi', () => {
  assert.ok(validateRegistration({ ...base, username: 'ab' }, now).username);
  assert.ok(validateRegistration({ ...base, username: 'a'.repeat(51) }, now).username);
  assert.ok(validateRegistration({ ...base, username: 'user name' }, now).username);
  assert.ok(validateRegistration({ ...base, username: 'user@123' }, now).username);
  assert.equal(
    validateRegistration({ ...base, username: 'ab' }, now).username,
    'Tên đăng nhập cần 3–50 ký tự (không tính khoảng trắng).'
  );
});

test('báo lỗi đúng ô trước khi gửi email, phone, role và xác nhận mật khẩu không hợp lệ', () => {
  for (const [field, value] of [
    ['email', 'a@@example.com'], ['email', `${'a'.repeat(250)}@example.com`],
    ['phone', '12345'], ['role', 'ADMIN'], ['confirmPassword', ''], ['confirmPassword', 'different'],
    ['acceptTerms', false],
  ]) {
    assert.ok(validateRegistration({ ...base, [field]: value }, now)[field], field);
  }
});

test('mật khẩu đủ độ dài và ký tự; giới hạn tính byte, không tính riêng số ký tự', () => {
  for (const password of ['Ab1!', 'Abcdef12 ', 'Aa1!'.repeat(19), `Aa1!${'ế'.repeat(24)}`]) {
    assert.ok(validateRegistration({ ...base, password, confirmPassword: password }, now).password);
  }
  const password = 'Aa1!'.repeat(18);
  assert.deepEqual(validateRegistration({ ...base, password, confirmPassword: password }, now), {});
});

test('ngày sinh giới hạn trong khoảng 18 đến 100 tuổi theo múi giờ Việt Nam', () => {
  assert.equal(todayInVietnam(now), '2026-09-21');
  const range = getBirthDateRange(now);
  assert.equal(range.maxDate, '2008-09-21');
  assert.equal(range.minDate, '1926-09-21');
  assert.equal(range.maxDateDisplay, '21/09/2008');
  assert.equal(range.minDateDisplay, '21/09/1926');

  // Ngày sai định dạng hoặc ngoài khoảng 18-100 tuổi
  for (const dateOfBirth of ['1926-09-20', '2008-09-22', '2026-09-21', '2001-02-29', '2000-13-01', '']) {
    assert.ok(validateRegistration({ ...base, dateOfBirth }, now).dateOfBirth);
  }

  // Ngày hợp lệ (trong khoảng 18 - 100 tuổi)
  for (const dateOfBirth of ['1926-09-21', '2000-02-29', '2008-09-21']) {
    assert.deepEqual(validateRegistration({ ...base, dateOfBirth }, now), {});
  }
});
