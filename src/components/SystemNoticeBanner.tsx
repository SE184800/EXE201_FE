import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { logout } from '../services/auth.api';
import type { AuthUser } from '../types/auth';

interface SystemNotice {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maintenanceUntil?: string | null;
}

interface Props {
  user: AuthUser | null;
  onLogout?: () => void;
}

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function getEffectiveMaintenanceUntil(iso?: string | null): string {
  if (iso) {
    const t = new Date(iso).getTime();
    if (!isNaN(t) && t > Date.now()) return iso;
  }
  let fallback = sessionStorage.getItem('supplymind_maintenance_until');
  if (!fallback || isNaN(new Date(fallback).getTime()) || new Date(fallback).getTime() <= Date.now()) {
    fallback = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    sessionStorage.setItem('supplymind_maintenance_until', fallback);
  }
  return fallback;
}

function calculateTimeLeft(targetIso?: string | null): TimeLeft {
  const effectiveIso = getEffectiveMaintenanceUntil(targetIso);
  const targetTime = new Date(effectiveIso).getTime();
  const diff = targetTime - Date.now();
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { hours, minutes, seconds, totalMs: diff };
}

export default function SystemNoticeBanner({ user, onLogout }: Props) {
  const [notice, setNotice] = useState<SystemNotice | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function fetchNotice() {
      try {
        const res = await fetch('/api/system-notice');
        if (!res.ok) return;
        const data = (await res.json()) as SystemNotice;
        if (!cancelled && data) {
          setNotice(data);
          if (data.maintenanceMode) {
            setTimeLeft(calculateTimeLeft(data.maintenanceUntil));
          }
        }
      } catch {
        // ignore network error
      }
    }

    void fetchNotice();
    const interval = setInterval(fetchNotice, 15000); // 15s polling check

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // 1. TỰ ĐỘNG ĐĂNG XUẤT USER THƯỜNG KHI HỆ THỐNG BẢO TRÌ ĐỂ ĐẢM BẢO BẢO MẬT
  useEffect(() => {
    if (notice?.maintenanceMode && user && user.role !== 'ADMIN') {
      void (async () => {
        try {
          await logout();
        } catch {
          // ignore
        } finally {
          sessionStorage.removeItem('supplymind_active_tab');
          localStorage.removeItem('supplymind_active_tab');
          sessionStorage.setItem('maintenance_logged_out', 'true');
          window.dispatchEvent(new Event('app:logged_out'));
          onLogout?.();
        }
      })();
    }
  }, [notice?.maintenanceMode, user, onLogout]);

  // 2. BỘ ĐẾM NGƯỢC (COUNTDOWN TIMER)
  useEffect(() => {
    if (!notice?.maintenanceMode) {
      setTimeLeft(null);
      sessionStorage.removeItem('supplymind_maintenance_until');
      return;
    }

    const updateTimer = () => {
      const remaining = calculateTimeLeft(notice.maintenanceUntil);
      if (remaining.totalMs <= 0) {
        setTimeLeft(null);
        sessionStorage.removeItem('supplymind_maintenance_until');
        setNotice((prev) => (prev ? { ...prev, maintenanceMode: false, maintenanceUntil: null } : null));
        window.location.reload();
      } else {
        setTimeLeft(remaining);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [notice?.maintenanceMode, notice?.maintenanceUntil]);

  if (!notice) return null;

  // CHẾ ĐỘ BẢO TRÌ (MAINTENANCE MODE)
  const isAdmin = user?.role === 'ADMIN';
  const isExemptRoute =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname.startsWith('/admin');

  const shouldBlockForMaintenance = Boolean(notice.maintenanceMode) && !isAdmin && !isExemptRoute;

  return (
    <>
      {/* FULL SCREEN MAINTENANCE OVERLAY */}
      {shouldBlockForMaintenance && (
        <div
          role="alertdialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999999,
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🚧</div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 12px', color: '#f8fafc' }}>
            HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP
          </h1>
          <p
            style={{
              maxWidth: '560px',
              fontSize: '15.5px',
              color: '#cbd5e1',
              lineHeight: '1.6',
              margin: '0 0 24px',
            }}
          >
            {notice.maintenanceMessage ||
              'Hệ thống SupplyMind đang bảo trì nâng cấp hệ thống định kỳ. Quý khách vui lòng quay lại sau.'}
          </p>

          {/* COUNTDOWN TIMER */}
          {timeLeft && (
            <div
              style={{
                marginBottom: '28px',
                padding: '18px 28px',
                background: 'rgba(30, 41, 59, 0.75)',
                borderRadius: '16px',
                border: '1px solid rgba(52, 211, 153, 0.35)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
                maxWidth: '440px',
                width: '100%',
              }}
            >
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: '#34d399',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '15px' }}>⏳</span> Thời gian dự kiến hoàn tất bảo trì
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '32px',
                      fontWeight: 800,
                      fontFamily: '"SF Mono", Menlo, Consolas, Monaco, monospace',
                      backgroundColor: '#0f172a',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      minWidth: '60px',
                      color: '#f8fafc',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                    }}
                  >
                    {String(timeLeft.hours).padStart(2, '0')}
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '6px', display: 'block', fontWeight: 600 }}>
                    Giờ
                  </span>
                </div>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#64748b', paddingBottom: '20px' }}>:</span>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '32px',
                      fontWeight: 800,
                      fontFamily: '"SF Mono", Menlo, Consolas, Monaco, monospace',
                      backgroundColor: '#0f172a',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      minWidth: '60px',
                      color: '#f8fafc',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                    }}
                  >
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '6px', display: 'block', fontWeight: 600 }}>
                    Phút
                  </span>
                </div>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#64748b', paddingBottom: '20px' }}>:</span>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '32px',
                      fontWeight: 800,
                      fontFamily: '"SF Mono", Menlo, Consolas, Monaco, monospace',
                      backgroundColor: '#0f172a',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(52, 211, 153, 0.4)',
                      minWidth: '60px',
                      color: '#34d399',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), 0 0 12px rgba(52, 211, 153, 0.2)',
                    }}
                  >
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#34d399', marginTop: '6px', display: 'block', fontWeight: 600 }}>
                    Giây
                  </span>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '11px 24px',
                borderRadius: '8px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '14.5px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              }}
            >
              ↻ Tải lại trang kiểm tra
            </button>
            <Link
              to="/"
              style={{
                padding: '11px 22px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                color: '#e2e8f0',
                fontSize: '14.5px',
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              🏠 Đến trang mở đầu
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
