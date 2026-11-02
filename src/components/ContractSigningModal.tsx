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
  const [vneidVerified, setVneidVerified] = useState(false);
  const [vneidSimulating, setVneidSimulating] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setErrorNotice('');
    setAgreed(false);
    setVneidVerified(false);
    setVneidSimulating(false);

    getMyContract()
      .then((res) => {
        if (!active) return;
        setContract(res.contract);
        setCanonicalText(res.canonicalText);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setErrorNotice(
          err.response?.data?.message || 'Không thể tải thông tin hợp đồng. Vui lòng thử lại.',
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSimulateVNeId = () => {
    setVneidSimulating(true);
    setErrorNotice('');
    setTimeout(() => {
      setVneidSimulating(false);
      setVneidVerified(true);
    }, 800);
  };

  const handleConfirmSign = async () => {
    setErrorNotice('');

    if (!agreed) {
      setErrorNotice('Vui lòng tích chọn đồng ý với tất cả điều khoản hợp đồng trước khi xác nhận.');
      return;
    }

    if (!vneidVerified) {
      setErrorNotice(
        'Vui lòng hoàn tất quét mã và xác thực sinh trắc học trên ứng dụng VNeID trước khi ký kết.',
      );
      return;
    }

    try {
      setSigning(true);
      const res = await signContract({
        method: 'VNEID',
        agreedTerms: true,
        vneidData: {
          cccd: contract?.signerInfo?.taxCode || '079095012345',
          citizenName: contract?.signerInfo?.name || user.name || 'Chủ cơ sở kinh doanh',
          authMethod: 'BIOMETRIC_FACE_ID_LEVEL_2',
          level: 2,
          verifiedAt: new Date().toISOString(),
        },
      });
      setSigning(false);
      onSignedSuccess(res.contract);
    } catch (err: any) {
      setSigning(false);
      const msg = err.response?.data?.message || 'Ký hợp đồng thất bại. Vui lòng kiểm tra lại.';
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
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#dc2626',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              CHỮ KÝ SỐ ĐỊNH DANH ĐIỆN TỬ VNEID (MỨC ĐỘ 2)
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
              Ký kết Hợp đồng Dịch vụ Nền tảng SupplyMind
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              Đang tải nội dung hợp đồng và cấu hình chữ ký số VNeID…
            </div>
          ) : (
            <>
              {/* Partner Overview Banner */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                  backgroundColor: '#f1f5f9',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  color: '#334155',
                }}
              >
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>
                    Số hợp đồng điện tử:
                  </span>
                  <strong>{contract?.contractNumber}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>
                    Đơn vị ký kết (Bên B):
                  </span>
                  <strong>{contract?.signerInfo?.businessName || user.name || 'Cơ sở kinh doanh'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>
                    Người đại diện pháp luật:
                  </span>
                  <strong>{contract?.signerInfo?.name || user.name}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>
                    Mã số thuế / GPKD:
                  </span>
                  <strong>{contract?.signerInfo?.taxCode || 'Đã khai báo'}</strong>
                </div>
              </div>

              {/* Scrollable Canonical Contract Content */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginBottom: '6px',
                  }}
                >
                  Nội dung điều khoản hợp đồng & Thỏa thuận dịch vụ:
                </label>
                <div
                  style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    padding: '14px 16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    color: '#1e293b',
                    whiteSpace: 'pre-line',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  {canonicalText || 'Đang cập nhật nội dung hợp đồng…'}
                </div>
              </div>

              {/* Checkbox Acceptance */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#166534',
                    fontWeight: 600,
                    lineHeight: 1.5,
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
                    Tôi đã đọc, hiểu rõ và đồng ý với tất cả điều khoản, quyền lợi và nghĩa vụ trong
                    Thỏa thuận kết nối và Hợp đồng dịch vụ nền tảng SupplyMind.
                  </span>
                </label>
              </div>

              {/* VNeID Level 2 Authentication Section */}
              {agreed && (
                <div
                  style={{
                    marginTop: '4px',
                    padding: '16px',
                    backgroundColor: '#fffdf5',
                    border: '1px solid #fde68a',
                    borderRadius: '10px',
                    animation: 'fadeIn 0.2s ease-in-out',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          backgroundColor: '#dc2626',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '11px',
                          letterSpacing: '0.06em',
                          padding: '3px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        VNeID MỨC 2
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b' }}>
                        Định danh điện tử & Ký số từ xa (Bộ Công An - C06)
                      </span>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#854d0e', fontWeight: 600 }}>
                      Luật Giao dịch điện tử 2023
                    </span>
                  </div>

                  {!vneidVerified ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr',
                        gap: '16px',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          textAlign: 'center',
                          backgroundColor: '#ffffff',
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid #fed7aa',
                        }}
                      >
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(`VNEID://AUTH?contract=${contract?.contractNumber}&user=${user.id}&time=${Date.now()}`)}`}
                          alt="Mã QR ký số VNeID"
                          style={{
                            width: '130px',
                            height: '130px',
                            display: 'block',
                            margin: '0 auto',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#b45309',
                            fontWeight: 600,
                            display: 'block',
                            marginTop: '6px',
                          }}
                        >
                          Quét bằng app VNeID
                        </span>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: '12.5px',
                            color: '#1e293b',
                            lineHeight: 1.6,
                            marginBottom: '12px',
                          }}
                        >
                          <strong>Hướng dẫn 3 bước ký số qua VNeID:</strong>
                          <ol style={{ margin: '4px 0 0', paddingLeft: '18px', color: '#475569' }}>
                            <li>Mở ứng dụng <strong>VNeID</strong> trên điện thoại (đã kích hoạt Mức độ 2).</li>
                            <li>
                              Chọn tính năng <strong>Quét mã QR</strong> để nhận diện hợp đồng điện tử{' '}
                              <strong>{contract?.contractNumber}</strong>.
                            </li>
                            <li>
                              Xác thực sinh trắc học <strong>FaceID / Vân tay</strong> để phát hành chữ ký số an toàn.
                            </li>
                          </ol>
                        </div>

                        <button
                          type="button"
                          onClick={handleSimulateVNeId}
                          disabled={vneidSimulating}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                            fontWeight: 650,
                            cursor: vneidSimulating ? 'not-allowed' : 'pointer',
                            opacity: vneidSimulating ? 0.75 : 1,
                            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                          }}
                        >
                          {vneidSimulating
                            ? 'Đang kết nối cổng VNeID…'
                            : 'Mô phỏng quét mã & Xác thực VNeID thành công (Demo)'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '12px 16px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #86efac',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#166534',
                        lineHeight: 1.5,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '6px',
                        }}
                      >
                        <strong style={{ color: '#15803d', fontSize: '13.5px' }}>
                          ĐÃ XÁC THỰC DANH TÍNH CÔNG DÂN THÀNH CÔNG QUA VNEID
                        </strong>
                        <span
                          style={{
                            fontSize: '11px',
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          MỨC ĐỘ 2 HỢP LỆ
                        </span>
                      </div>
                      <div>
                        Người đại diện ký kết:{' '}
                        <strong>
                          {contract?.signerInfo?.name || user.name || 'Đại diện cơ sở'}
                        </strong>
                      </div>
                      <div>
                        Mã định danh / CCCD:{' '}
                        <strong>{contract?.signerInfo?.taxCode || '079095012345'}</strong>
                      </div>
                      <div>
                        Phương thức bảo mật:{' '}
                        <strong>Sinh trắc học FaceID / Chữ ký số từ xa (Remote Signing HSM)</strong>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#166534' }}>
                        Hệ thống đã sẵn sàng phát hành chữ ký số và con dấu chứng thực điện tử theo quy định.
                        Bấm nút <strong>“Xác nhận ký kết”</strong> bên dưới để hoàn tất.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error Alert */}
              {errorNotice && (
                <div
                  style={{
                    marginTop: '10px',
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

        {/* Footer with 2 Buttons */}
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
            Hợp đồng có hiệu lực ngay khi hoàn tất chữ ký số VNeID.
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
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

            <button
              type="button"
              onClick={handleConfirmSign}
              disabled={signing || loading}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: signing ? 'not-allowed' : 'pointer',
                opacity: signing ? 0.75 : 1,
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
              }}
            >
              {signing ? 'Đang cấp chữ ký số…' : 'Xác nhận ký kết (VNeID)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
