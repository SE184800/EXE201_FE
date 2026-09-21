import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 10_000,
  headers: { 'X-CSRF-Protection': 'sg-restock-web' },
});

export function getApiError(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ||
      'Chưa kết nối được máy chủ. Vui lòng thử lại sau.'
    );
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

export function isUnauthenticated(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}
