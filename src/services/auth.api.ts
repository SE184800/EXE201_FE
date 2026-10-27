import axios from 'axios';
import { api, withTransientRetry } from './api';
import { ROLE_DETAILS, type AuthUser } from '../types/auth';
import type { Subscription } from './subscription.api';

export class SubscriptionRequiredError extends Error {
  renewalToken: string;
  subscription: Subscription;

  constructor(message: string, renewalToken: string, subscription: Subscription) {
    super(message);
    this.name = 'SubscriptionRequiredError';
    this.renewalToken = renewalToken;
    this.subscription = subscription;
  }
}

export function isSubscriptionRequiredError(error: unknown): error is SubscriptionRequiredError {
  return error instanceof SubscriptionRequiredError;
}

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

export async function login(input: { username: string; password: string }): Promise<AuthUser> {
  try {
    const response = await withTransientRetry(
      () => api.post<{ user: unknown }>('/auth/login', input),
      1,
    );
    return parseUser(response.data.user);
  } catch (error) {
    if (
      axios.isAxiosError<{
        code?: string;
        message?: string;
        renewalToken?: unknown;
        subscription?: unknown;
      }>(error)
    ) {
      const data = error.response?.data;
      if (
        error.response?.status === 402 &&
        data?.code === 'SUBSCRIPTION_REQUIRED' &&
        typeof data.renewalToken === 'string' &&
        data.subscription &&
        typeof data.subscription === 'object'
      ) {
        throw new SubscriptionRequiredError(
          data.message || 'Gói sử dụng đã hết hạn.',
          data.renewalToken,
          data.subscription as Subscription,
        );
      }
    }
    throw error;
  }
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
  acceptTerms?: boolean;
};


export type RequestOtpResponse = {
  success: boolean;
  message: string;
  email: string;
  otpToken: string;
  expiresIn: number;
  devOtp?: string;
};

export async function requestRegistrationOtp(input: RegistrationInput): Promise<RequestOtpResponse> {
  const response = await api.post<RequestOtpResponse>('/auth/register-request-otp', input);
  return response.data;
}

export async function verifyRegistrationOtp(input: {
  otpToken: string;
  otp: string;
}): Promise<AuthUser> {
  const response = await api.post<{ success: boolean; user: unknown }>('/auth/register-verify-otp', input);
  return parseUser(response.data.user);
}

export async function resendRegistrationOtp(input: RegistrationInput): Promise<RequestOtpResponse> {
  const response = await api.post<RequestOtpResponse>('/auth/register-resend-otp', input);
  return response.data;
}

export async function registerAccount(input: RegistrationInput): Promise<AuthUser> {
  const response = await api.post<{ user: unknown }>('/auth/register', input);
  return parseUser(response.data.user);
}

export async function getMe(): Promise<AuthUser> {
  const response = await withTransientRetry(() => api.get<{ user: unknown }>('/auth/me'));
  return parseUser(response.data.user);
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    try {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('just_logged_out', 'true');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('app:logged_out'));
      }
    } catch {
      // ignore
    }
  }
}
