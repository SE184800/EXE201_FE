import { useEffect, useState } from 'react';
import { api, getApiError, isUnauthenticated } from '../../services/api';
export function useAdminData<T>(path: string, params: Record<string, string | number>, onLogout: () => void, revision = 0) {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const key = `${path}?${query}#${revision}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  useEffect(() => {
    const abort = new AbortController();
    api.get<T>(`${path}?${query}`, { signal: abort.signal }).then(({ data }) => setResult({ key, data })).catch((error: unknown) => {
      if (!abort.signal.aborted) { setResult({ key, error: getApiError(error) }); if (isUnauthenticated(error)) onLogout(); }
    });
    return () => abort.abort();
  }, [path, query, key, onLogout]);
  return { data: result?.key === key ? result.data : undefined, error: result?.key === key ? result.error : undefined, loading: result?.key !== key };
}
export function money(value: number) { return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' ₫'; }
export function dateTime(value: string | null) { return value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; }
export function defaultPeriod() {
  const to = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  return { from: to.slice(0, 8) + '01', to };
}
