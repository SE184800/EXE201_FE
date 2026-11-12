import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Brand from '../components/Brand';
import { getApiError } from '../services/api';
import { revealContractKey, type RevealContractKeyResponse } from '../services/contract.api';

export default function ContractKeyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';

  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState(token ? '' : 'Liên kết không chứa mã xác thực hợp lệ.');
  const [data, setData] = useState<RevealContractKeyResponse | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    setError('');
    revealContractKey(token)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(getApiError(err));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function handleCopy() {
    if (!data?.rawPrivateKey) return;
    try {
      await navigator.clipboard.writeText(data.rawPrivateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Trình duyệt không hỗ trợ sao chép tự động. Vui lòng chọn "Hiện đầy đủ" và sao chép thủ công.');
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <Brand />
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Khóa bí mật ký hợp đồng điện tử SupplyMind AI
            </p>
          </div>
          {/* Trạng thái ký không hiển thị tại trang xem khóa */}
        </div>

        <div style={{ padding: '24px' }}>
          {loading ? (
            <p role="status" style={{ textAlign: 'center', color: '#475569', margin: '24px 0' }}>
              Đang xác thực liên kết bảo mật...
            </p>
          ) : error ? (
            <div
              role="alert"
              style={{
                padding: '14px 16px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '14px',
                lineHeight: 1.5,
              }}
            >
              <strong>Không thể mở khóa bí mật</strong>
              <p style={{ margin: '6px 0 0 0' }}>{error}</p>
            </div>
          ) : data ? (
            <>
              <div style={{ marginBottom: '14px', fontSize: '13.5px', color: '#334155' }}>
                Số hợp đồng áp dụng: <strong>{data.contractNumber}</strong>
              </div>

              <div
                style={{
                  backgroundColor: '#0b1329',
                  border: '1px solid #1e293b',
                  borderRadius: '10px',
                  padding: '16px',
                  color: '#f8fafc',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '12px',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.04em' }}>
                    KHÓA BÍ MẬT CÁ NHÂN (PRIVATE KEY)
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowFull((prev) => !prev)}
                      style={{
                        padding: '5px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#e2e8f0',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      {showFull ? 'Ẩn bớt' : 'Hiện đầy đủ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#ffffff',
                        backgroundColor: copied ? '#16a34a' : '#0284c7',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      {copied ? 'Đã sao chép!' : 'Sao chép khóa'}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: '#7dd3fc',
                    backgroundColor: '#020617',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #1e293b',
                    wordBreak: 'break-all',
                  }}
                >
                  {showFull ? data.rawPrivateKey : data.maskedPrivateKey}
                </div>
              </div>

              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#92400e',
                  lineHeight: 1.55,
                }}
              >
                Sao chép khóa bí mật trên và dán vào ô <strong>Khóa bí mật cá nhân (Private Key)</strong> khi ký
                thỏa thuận trên SupplyMind AI. Tuyệt đối không chia sẻ khóa này hoặc liên kết trang này cho người khác.
              </div>
            </>
          ) : null}

          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <Link to="/" style={{ fontSize: '13.5px', color: '#475569', textDecoration: 'none', fontWeight: 600 }}>
              Trang chủ
            </Link>
            <Link
              to="/login"
              style={{
                padding: '9px 16px',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '13.5px',
                fontWeight: 700,
              }}
            >
              Đến trang đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
