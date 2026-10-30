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
    getWallet()
      .then((data: any) => {
        if (active) {
          const available = data?.wallet?.balance ?? data?.availableBalance ?? data?.balance ?? 0;
          const held = data?.wallet?.heldBalance ?? data?.lockedBalance ?? 0;
          const total = data?.wallet?.total ?? data?.totalBalance ?? (available + held);
          setWallet({
            availableBalance: available,
            lockedBalance: held,
            totalBalance: total,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const displayAmount = loading
    ? '…'
    : show
      ? money(wallet?.availableBalance ?? 0)
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
