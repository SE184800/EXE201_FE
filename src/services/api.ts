import axios from 'axios';
import { Capacitor } from '@capacitor/core';

export const api = axios.create({
  baseURL: Capacitor.isNativePlatform() ? '/api' : import.meta.env?.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 10_000,
  headers: { 'X-CSRF-Protection': 'sg-restock-web' },
});

const transientStatus = new Set([408, 425, 500, 502, 503, 504]);

function isTransient(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  return (
    error.code !== 'ERR_CANCELED' && (!error.response || transientStatus.has(error.response.status))
  );
}

// Vercel and a sleeping SQL database can make the first request of a warm-up
// window fail. Retry only transient failures; auth/validation errors are never
// retried and therefore remain immediate for the user.
export async function withTransientRetry<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransient(error) || attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
}

export function isMissingApiRoute(error: unknown): boolean {
  if (!axios.isAxiosError<{ code?: string; message?: string }>(error)) return false;
  return (
    error.response?.status === 404 &&
    (error.response.data?.code === 'API_ROUTE_NOT_FOUND' ||
      error.response.data?.message === 'Không tìm thấy API.')
  );
}

export class ApiCompatibilityError extends Error {
  readonly response = { status: 404 };
}

export function getApiError(error: unknown): string {
  if (error instanceof ApiCompatibilityError) return error.message;
  if (isMissingApiRoute(error))
    return 'Máy chủ chưa hỗ trợ chức năng này. Cần cập nhật backend SupplyMind để tiếp tục.';
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || 'Chưa kết nối được máy chủ. Vui lòng thử lại sau.';
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

export function isUnauthenticated(error: unknown): boolean {
  return (
    axios.isAxiosError<{ code?: string }>(error) &&
    (error.response?.status === 401 ||
      (error.response?.status === 402 && error.response.data?.code === 'SUBSCRIPTION_REQUIRED'))
  );
}

export function getApiFieldErrors<T extends string>(
  error: unknown,
  fields: T[],
): Partial<Record<T, string>> {
  const result: Partial<Record<T, string>> = {};
  if (!axios.isAxiosError<{ errors?: unknown }>(error)) return result;
  const errors = error.response?.data?.errors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return result;
  for (const field of fields) {
    if (Object.hasOwn(errors, field)) {
      const message = (errors as Record<string, unknown>)[field];
      if (typeof message === 'string' && message) result[field] = message;
    }
  }
  return result;
}
