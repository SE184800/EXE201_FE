import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Icon from '../../components/Icon';
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
  onConfirm,
  busy,
}: {
  payload: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  billNumber: string;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [dataUrl, setDataUrl] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);

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

  async function copyToClipboard(text: string, type: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 2000);
    } catch {
      setCopiedType(null);
    }
  }

  return (
    <div className="wallet-qr">
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
          <dd style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{accountNumber}</span>
            <button
              type="button"
              onClick={() => void copyToClipboard(accountNumber, 'acc')}
              title="Sao chép số tài khoản"
              style={{
                border: 'none',
                background: '#e2e8f0',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 600,
                color: '#334155',
              }}
            >
              {copiedType === 'acc' ? 'Đã chép' : 'Chép STK'}
            </button>
          </dd>
        </div>
        <div>
          <dt>Chủ tài khoản</dt>
          <dd>{accountHolder}</dd>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <dt>Nội dung chuyển khoản (Bắt buộc để khớp tự động)</dt>
          <dd style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <code style={{ background: '#ecfdf5', color: '#065f46', padding: '3px 8px', borderRadius: '6px', fontSize: '13px' }}>
              {billNumber}
            </code>
            <button
              type="button"
              onClick={() => void copyToClipboard(billNumber, 'bill')}
              title="Sao chép nội dung chuyển khoản"
              style={{
                border: 'none',
                background: '#d1fae5',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 700,
                color: '#065f46',
              }}
            >
              {copiedType === 'bill' ? '✓ Đã chép' : 'Sao chép'}
            </button>
          </dd>
        </div>
      </dl>

      <p className="wallet-qr-hint">
        Mở ứng dụng ngân hàng bất kỳ để quét mã VietQR. Sau khi ngân hàng báo chuyển tiền thành công,
        bấm xác nhận bên dưới để hệ thống đối soát và cộng tiền vào ví.
      </p>

      <div className="wallet-qr-actions">
        <button
          className="wallet-btn-primary"
          type="button"
          onClick={onConfirm}
          disabled={busy}
          style={{ width: '100%', padding: '12px', fontSize: '14px' }}
        >
          <Icon name="check" /> {busy ? 'Đang gửi đối soát…' : 'Tôi đã chuyển khoản thành công'}
        </button>
      </div>
    </div>
  );
}
