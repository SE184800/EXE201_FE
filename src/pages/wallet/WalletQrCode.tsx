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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#193f32', light: '#ffffff' },
    })
      .then(url => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [payload]);

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="wallet-qr">
      <div className="wallet-qr-code">
        {dataUrl ? (
          <img src={dataUrl} alt={`Mã QR nạp ${money(amount)}`} width={240} height={240} />
        ) : (
          <div className="wallet-qr-placeholder">Đang tạo mã QR…</div>
        )}
      </div>
      <dl className="wallet-qr-details">
        <div>
          <dt>Ngân hàng</dt>
          <dd>{bankName}</dd>
        </div>
        <div>
          <dt>Số tài khoản</dt>
          <dd>{accountNumber}</dd>
        </div>
        <div>
          <dt>Chủ tài khoản</dt>
          <dd>{accountHolder}</dd>
        </div>
        <div>
          <dt>Số tiền</dt>
          <dd className="wallet-qr-amount">{money(amount)}</dd>
        </div>
        <div>
          <dt>Mã phiếu</dt>
          <dd>{billNumber}</dd>
        </div>
      </dl>
      <p className="wallet-qr-hint">
        Mở ứng dụng ngân hàng, chọn quét mã QR, kiểm tra số tiền rồi xác nhận. Toàn bộ tiền trong hệ
        thống là tiền ảo nên không có giao dịch thật nào được thực hiện.
      </p>
      <div className="wallet-qr-actions">
        <button className="primary-button" type="button" onClick={onConfirm} disabled={busy}>
          <Icon name="check" /> {busy ? 'Đang xác nhận…' : 'Tôi đã chuyển khoản'}
        </button>
        <button className="ghost-button" type="button" onClick={() => void copyPayload()}>
          {copied ? 'Đã sao chép' : 'Sao chép mã QR'}
        </button>
      </div>
    </div>
  );
}
