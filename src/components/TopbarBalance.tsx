import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWallet, type WalletInfo } from '../services/wallet.api';
import Icon from './Icon';

const money = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

interface Props {
  onNavigateWallet?: () => void;
  linkTo?: string;
  className?: string;
}

export default function TopbarBalance({ onNavigateWallet, linkTo, className = '' }: Props) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const { wallet: balance } = await getWallet();
        if (active) {
          setWallet({
            availableBalance: balance.balance,
            lockedBalance: balance.heldBalance,
            totalBalance: balance.total,
          });
        }
      } catch {
        // Keep the last balance when a refresh fails.
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };
    void refresh();
    const interval = setInterval(refresh, 4000);
    window.addEventListener('supplymind:wallet-changed', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('supplymind:wallet-changed', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      active = false;
    };
  }, []);

  const displayAmount = loading
    ? '…'
    : show
      ? wallet ? money(wallet.availableBalance) : 'Không tải được'
      : '****** ₫';

  const content = (
    <div
      className={`topbar-balance-widget ${className}`}
      title={show ? 'Bấm con mắt để ẩn số dư' : 'Bấm con mắt để xem số dư thực'}
    >
      <span
        className="topbar-balance-label"
        onClick={() => {
          if (onNavigateWallet) onNavigateWallet();
        }}
        role={onNavigateWallet ? 'button' : undefined}
        tabIndex={onNavigateWallet ? 0 : undefined}
      >
        <span className="balance-text-prefix">Số dư:</span>
        <strong className="balance-amount">{displayAmount}</strong>
      </span>
      <button
        type="button"
        className="topbar-balance-eye-btn"
        aria-label={show ? 'Ẩn số dư' : 'Hiện số dư'}
        title={show ? 'Ẩn số dư' : 'Hiện số dư'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShow(!show);
        }}
      >
        <Icon name={show ? 'eyeOff' : 'eye'} />
      </button>
    </div>
  );

  if (linkTo && !onNavigateWallet) {
    return (
      <Link to={linkTo} className="topbar-balance-link">
        {content}
      </Link>
    );
  }

  return content;
}
