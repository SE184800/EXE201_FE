import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRegistration, todayInVietnam, validateRegistration } from '../src/validation/registration.ts';

const base = {
  name: 'Nguyễn Văn An', username: 'nguyen.an', email: 'an@example.com',
  phone: '0912345678', role: 'STORE_OWNER', dateOfBirth: '1998-05-20',
  password: 'Register@2026', confirmPassword: 'Register@2026',
};
const now = new Date('2026-09-20T18:00:00Z');

test('chuẩn hóa username, email, họ tên và số điện thoại giống payload BE', () => {
  for (const phone of ['0912345678', '+84 912 345 678', '84912345678']) {
    const input = { ...base, name: ' Nguyễn   Văn An ', username: ' NGUYEN.AN ', email: ' AN@EXAMPLE.COM ', phone };
    assert.deepEqual(validateRegistration(input, now), {});
    assert.deepEqual(normalizeRegistration(input), base);
  }
});

test('báo lỗi đúng ô trước khi gửi tên, email, phone, role và xác nhận mật khẩu không hợp lệ', () => {
  for (const [field, value] of [
    ['name', 'An123'], ['name', '...'], ['name', 'A'.repeat(101)], ['username', 'ab'],
    ['email', 'a@@example.com'], ['email', `${'a'.repeat(250)}@example.com`],
    ['phone', '12345'], ['role', 'ADMIN'], ['confirmPassword', ''], ['confirmPassword', 'different'],
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

test('ngày thật, giới hạn 1900 và ngày hiện tại theo múi giờ Việt Nam', () => {
  assert.equal(todayInVietnam(now), '2026-09-21');
  for (const dateOfBirth of ['1899-12-31', '2001-02-29', '2026-09-22', '2000-13-01', '']) {
    assert.ok(validateRegistration({ ...base, dateOfBirth }, now).dateOfBirth);
  }
  for (const dateOfBirth of ['1900-01-01', '2000-02-29', '2026-09-21']) {
    assert.deepEqual(validateRegistration({ ...base, dateOfBirth }, now), {});
  }
});
