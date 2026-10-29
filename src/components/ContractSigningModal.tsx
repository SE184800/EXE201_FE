import { useState, useEffect } from 'react';
import {
  getMyContract,
  signContract,
  type UserContract,
} from '../services/contract.api';
import type { AuthUser } from '../types/auth';

interface ContractSigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignedSuccess: (contract: Partial<UserContract>) => void;
  user: AuthUser;
}

export default function ContractSigningModal({
  isOpen,
  onClose,
  onSignedSuccess,
  user,
}: ContractSigningModalProps) {
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [contract, setContract] = useState<UserContract | null>(null);
  const [canonicalText, setCanonicalText] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [errorNotice, setErrorNotice] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setErrorNotice('');
    setAgreed(false);
    setPrivateKey('');

    getMyContract()
      .then((res) => {
        if (!active) return;
        setContract(res.contract);
        setCanonicalText(res.canonicalText);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setErrorNotice(err.response?.data?.message || 'Không thể tải thông tin hợp đồng. Vui lòng thử lại.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmSign = async () => {
    setErrorNotice('');

    if (!agreed) {
      setErrorNotice('Vui lòng tích chọn đồng ý với tất cả điều khoản hợp đồng trước khi xác nhận.');
      return;
    }

    if (!privateKey.trim()) {
      setErrorNotice('Vui lòng nhập hoặc dán khóa bí mật cá nhân (Private Key) vào ô ký tên.');
      return;
    }

    try {
      setSigning(true);
      const res = await signContract({
        privateKey: privateKey.trim(),
        agreedTerms: true,
      });
      setSigning(false);
      onSignedSuccess(res.contract);
    } catch (err: any) {
      setSigning(false);
      const msg = err.response?.data?.message || 'Ký hợp đồng thất bại. Vui lòng kiểm tra lại khóa bí mật cá nhân.';
      setErrorNotice(msg);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-modal-title"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: '#166534',
                  textTransform: 'uppercase',
                  marginBottom: '2px',
                }}
              >
                XÁC NHẬN KẾT NỐI VÀ HỢP ĐỒNG ĐIỆN TỬ
              </span>
              <h2
                id="contract-modal-title"
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                Thỏa thuận dịch vụ & Cấp quyền truy cập thông tin
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '22px',
                lineHeight: 1,
                cursor: 'pointer',
                color: '#64748b',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            Vui lòng đọc kỹ hợp đồng liên kết nền tảng SupplyMind. Hợp đồng đảm bảo minh bạch thông tin, quy định rõ quyền lợi, chế tài xử phạt và cơ chế luồng tiền ký quỹ Escrow 10% an toàn.
          </p>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#64748b', margin: '40px 0' }}>
              Đang khởi tạo tài liệu hợp đồng điện tử…
            </p>
          ) : (
            <>
              {/* Contract Metadata Badges */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  marginBottom: '14px',
                  fontSize: '12px',
                }}
              >
                <div style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', borderRadius: '6px', color: '#334155' }}>
                  Số hợp đồng: <strong>{contract?.contractNumber}</strong>
                </div>
                <div style={{ padding: '6px 12px', backgroundColor: '#ecfdf5', borderRadius: '6px', color: '#166534', fontWeight: 600 }}>
                  Trạng thái: {contract?.isSigned ? 'ĐÃ KÝ KẾT' : 'CHỜ KÝ SỐ'}
                </div>
                <div style={{ padding: '6px 12px', backgroundColor: '#eff6ff', borderRadius: '6px', color: '#1d4ed8' }}>
                  Tiêu chuẩn: <strong>Luật Giao dịch điện tử 2023</strong>
                </div>
              </div>

              {/* Scrollable Terms Content */}
              <div
                style={{
                  height: '240px',
                  overflowY: 'auto',
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  lineHeight: 1.6,
                  color: '#334155',
                  whiteSpace: 'pre-line',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {canonicalText}
              </div>

              {/* Checkbox agreement */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  backgroundColor: agreed ? '#f0fdf4' : '#ffffff',
                  border: `1px solid ${agreed ? '#86efac' : '#cbd5e1'}`,
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: agreed ? '#166534' : '#0f172a',
                    lineHeight: 1.45,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      if (!e.target.checked) setErrorNotice('');
                    }}
                    style={{
                      marginTop: '3px',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: '#16a34a',
                    }}
                  />
                  <span>
                    Tôi đã đọc, hiểu rõ và đồng ý với tất cả điều khoản, quyền lợi và nghĩa vụ trong Thỏa thuận kết nối và Hợp đồng dịch vụ nền tảng SupplyMind.
                  </span>
                </label>
              </div>

              {/* Expandable Private Key Input Section */}
              {agreed && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '16px',
                    backgroundColor: '#fafafa',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    animation: 'fadeIn 0.2s ease-in-out',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <label
                      htmlFor="contract-private-key"
                      style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}
                    >
                      Khóa bí mật cá nhân (Private Key) để ký tên: <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    {contract?.rawPrivateKey && (
                      <button
                        type="button"
                        onClick={() => {
                          setPrivateKey(contract.rawPrivateKey || '');
                          if (errorNotice) setErrorNotice('');
                        }}
                        style={{
                          fontSize: '12px',
                          fontWeight: 650,
                          color: '#166534',
                          backgroundColor: '#dcfce7',
                          border: '1px solid #86efac',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        Điền nhanh Private Key (Thử nghiệm)
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      marginBottom: '10px',
                      padding: '10px 12px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#166534',
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Thông báo nhận khóa:</strong> Khóa bí mật cá nhân (Private Key) đã được tạo và tự động gửi tới email đăng ký của bạn ({contract?.signerInfo?.email || user.email || 'đã đăng ký'}). Vui lòng kiểm tra hộp thư email (bao gồm cả thư mục Spam/Quảng cáo), sao chép chuỗi khóa và dán vào ô bên dưới để hoàn tất ký kết.
                  </div>

                  <textarea
                    id="contract-private-key"
                    rows={3}
                    value={privateKey}
                    onChange={(e) => {
                      setPrivateKey(e.target.value);
                      if (errorNotice) setErrorNotice('');
                    }}
                    placeholder="Dán chuỗi khóa bí mật cá nhân (Private Key) được gửi trong email tại đây..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '12.5px',
                      fontFamily: 'Consolas, monospace',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff',
                    }}
                  />

                  <small style={{ color: '#64748b', fontSize: '11.5px', display: 'block', marginTop: '6px' }}>
                    Lưu ý pháp lý: Khóa bí mật này tương đương với chữ ký số cá nhân của cơ sở theo Luật Giao dịch điện tử. Hệ thống sẽ kiểm tra tính toàn vẹn chữ ký với Khóa công khai (Public Key) của bạn mà không làm lộ nội dung bí mật.
                  </small>
                </div>
              )}

              {/* Error Alert */}
              {errorNotice && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '10px 14px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#b91c1c',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                  role="alert"
                >
                  {errorNotice}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with 2 Always-Visible Buttons */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Hợp đồng có hiệu lực ngay khi hoàn tất chữ ký số.
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Button 2: Hủy bỏ / Để sau (Always visible) */}
            <button
              type="button"
              onClick={onClose}
              disabled={signing}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy bỏ / Để sau
            </button>

            {/* Button 1: Xác nhận ký kết (Always visible) */}
            <button
              type="button"
              onClick={handleConfirmSign}
              disabled={signing || loading}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: signing ? 'not-allowed' : 'pointer',
                opacity: signing ? 0.75 : 1,
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
              }}
            >
              {signing ? 'Đang xác thực chữ ký…' : 'Xác nhận ký kết'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
