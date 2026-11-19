import { useEffect, useState } from 'react';

const DEFAULT_MESSAGE = 'Tài khoản chưa được kích hoạt. Vui lòng đợi admin xác minh';

export function showUnverifiedNotice(message: string = DEFAULT_MESSAGE) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('supplymind:unverified-notice', {
        detail: { message },
      })
    );
  }
}

export default function UnverifiedToast() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const handleEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const msg = customEvent.detail?.message || DEFAULT_MESSAGE;
      setNotice(msg);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setNotice(null);
      }, 1500); // Kéo dài chính xác 1.5s theo yêu cầu
    };

    window.addEventListener('supplymind:unverified-notice', handleEvent);
    return () => {
      window.removeEventListener('supplymind:unverified-notice', handleEvent);
      clearTimeout(timer);
    };
  }, []);

  if (!notice) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: '28px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        backgroundColor: '#dc2626',
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '10px',
        boxShadow: '0 12px 28px -4px rgba(220, 38, 38, 0.4), 0 8px 12px -6px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontWeight: 600,
        fontSize: '14.5px',
        lineHeight: 1.4,
        pointerEvents: 'none',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        transition: 'all 0.2s ease',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          fontSize: '14px',
          flexShrink: 0,
        }}
      >
        ⚠️
      </span>
      <span>{notice}</span>
    </div>
  );
}
