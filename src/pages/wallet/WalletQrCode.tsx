import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { money } from './walletFormat';

/**
 * Renders a VietQR code for a wallet deposit.
 * The QR embeds the amount so the banking app pre-fills the transfer value.
 */
export default function WalletQrCode({
  payload,
  amount,
  bankName,
  accountNumber,
  accountHolder,
  billNumber,
  onClose,
  onChangeAmount,
}: {
  payload: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  billNumber: string;
  onClose?: () => void;
  onChangeAmount?: () => void;
}) {
  const [dataUrl, setDataUrl] = useState('');
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#14382c', light: '#ffffff' },
    })
      .then((url: string) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [payload]);

  async function copyText(textToCopy: string, setCopied: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="wallet-qr" style={{ width: '100%' }}>
      <div className="wallet-qr-code">
        {dataUrl ? (
          <img src={dataUrl} alt={`Mã VietQR nạp ${money(amount)}`} width={200} height={200} />
        ) : (
          <div className="wallet-qr-placeholder">Đang tạo mã VietQR…</div>
        )}
      </div>

      <dl className="wallet-qr-details">
        <div>
          <dt>Ngân hàng nhận</dt>
          <dd>{bankName}</dd>
        </div>
        <div>
          <dt>Số tiền nạp</dt>
          <dd className="wallet-qr-amount">{money(amount)}</dd>
        </div>
        <div>
          <dt>Số tài khoản</dt>
          <dd style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span>{accountNumber}</span>
            <button
              type="button"
              className="ghost-button"
              style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
              onClick={() => void copyText(accountNumber, setCopiedAccount)}
            >
              {copiedAccount ? 'Đã sao chép' : 'Sao chép'}
            </button>
          </dd>
        </div>
        <div>
          <dt>Chủ tài khoản</dt>
          <dd>{accountHolder}</dd>
        </div>
        <div>
          <dt>Nội dung CK</dt>
          <dd style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: '#166534' }}>{billNumber}</span>
            <button
              type="button"
              className="ghost-button"
              style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
              onClick={() => void copyText(billNumber, setCopiedMemo)}
            >
              {copiedMemo ? 'Đã sao chép' : 'Sao chép'}
            </button>
          </dd>
        </div>
      </dl>

      <div
        className="wallet-qr-actions"
        style={{
          marginTop: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
          justifySelf: 'stretch',
          boxSizing: 'border-box',
        }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '13px 20px',
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.28)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              letterSpacing: '0.2px',
            }}
          >
            Đóng cửa sổ
          </button>
        )}
        {onChangeAmount && (
          <button
            type="button"
            onClick={onChangeAmount}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 20px',
              backgroundColor: '#f8fafc',
              color: '#1e293b',
              border: '1.5px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 650,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            ← Đổi số tiền khác
          </button>
        )}
      </div>
    </div>
  );
}
