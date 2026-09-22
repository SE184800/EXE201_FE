import { api, withTransientRetry } from './api';
import { ROLE_DETAILS, type AuthUser } from '../types/auth';

function parseUser(value: unknown): AuthUser {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    typeof value.id !== 'number' ||
    !('username' in value) ||
    typeof value.username !== 'string' ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    !('role' in value) ||
    typeof value.role !== 'string' ||
    !Object.hasOwn(ROLE_DETAILS, value.role)
  ) {
    throw new Error('Thông tin tài khoản không hợp lệ.');
  }
  return value as AuthUser;
}

export async function login(input: {
  username: string;
  password: string;
}): Promise<AuthUser> {
  const response = await withTransientRetry(
    () => api.post<{ user: unknown }>('/auth/login', input),
    1,
  );
  return parseUser(response.data.user);
}

export type RegistrationInput = {
  name: string;
  username: string;
  email: string;
  phone: string;
  role: 'STORE_OWNER' | 'SUPPLIER';
  dateOfBirth: string;
  password: string;
  confirmPassword: string;
};

export async function registerAccount(input: RegistrationInput): Promise<AuthUser> {
  const response = await api.post<{ user: unknown }>('/auth/register', input);
  return parseUser(response.data.user);
}

export async function getMe(): Promise<AuthUser> {
  const response = await withTransientRetry(() =>
    api.get<{ user: unknown }>('/auth/me'),
  );
  return parseUser(response.data.user);
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
