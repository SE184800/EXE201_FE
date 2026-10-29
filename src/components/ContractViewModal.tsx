import { useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { UserContract } from '../services/contract.api';

interface ContractViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: UserContract | null;
  canonicalText?: string;
}

function splitPartnerName(name: string): [string, string] {
  const trimmed = (name || '').trim();
  if (trimmed.length <= 20) return [trimmed, ''];
  const words = trimmed.split(/\s+/);
  let line1 = '';
  let line2 = '';
  for (const w of words) {
    if ((line1 + ' ' + w).trim().length <= 18) {
      line1 = (line1 + ' ' + w).trim();
    } else {
      line2 = (line2 + ' ' + w).trim();
    }
  }
  return [line1 || trimmed.slice(0, 18), line2 || trimmed.slice(18, 36)];
}

function PlatformStampSvg() {
  return (
    <svg
      width="142"
      height="142"
      viewBox="0 0 160 160"
      style={{ display: 'block', margin: '0 auto' }}
      aria-label="Con dấu điện tử Nền tảng SupplyMind AI"
    >
      <circle cx="80" cy="80" r="76" fill="#fff5f5" />
      <circle cx="80" cy="80" r="76" fill="none" stroke="#dc2626" strokeWidth="3" />
      <circle cx="80" cy="80" r="70" fill="none" stroke="#dc2626" strokeWidth="1.2" />

      <text
        x="80"
        y="42"
        textAnchor="middle"
        fill="#dc2626"
        fontSize="10"
        fontWeight="800"
        fontFamily="sans-serif"
        letterSpacing="0.4"
      >
        NỀN TẢNG SUPPLYMIND AI
      </text>

      <line x1="18" y1="62" x2="142" y2="62" stroke="#dc2626" strokeWidth="1.8" />
      <line x1="18" y1="92" x2="142" y2="92" stroke="#dc2626" strokeWidth="1.8" />

      <circle cx="26" cy="77" r="2.5" fill="#dc2626" />
      <circle cx="134" cy="77" r="2.5" fill="#dc2626" />

      <text
        x="80"
        y="81"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#dc2626"
        fontSize="13"
        fontWeight="900"
        fontFamily="sans-serif"
        letterSpacing="2"
      >
        ĐÃ KÝ SỐ
      </text>

      <text
        x="80"
        y="112"
        textAnchor="middle"
        fill="#dc2626"
        fontSize="8"
        fontWeight="700"
        fontFamily="sans-serif"
      >
        CHỨNG THỰC TOÀN VẸN
      </text>
      <text
        x="80"
        y="126"
        textAnchor="middle"
        fill="#b91c1c"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="sans-serif"
        letterSpacing="0.5"
      >
        ESCROW PLATFORM CA
      </text>
    </svg>
  );
}

function PartnerStampSvg({ partnerName }: { partnerName: string }) {
  const [line1, line2] = splitPartnerName(partnerName);

  return (
    <svg
      width="142"
      height="142"
      viewBox="0 0 160 160"
      style={{ display: 'block', margin: '0 auto' }}
      aria-label="Con dấu điện tử Đối tác"
    >
      <circle cx="80" cy="80" r="76" fill="#fff5f5" />
      <circle cx="80" cy="80" r="76" fill="none" stroke="#dc2626" strokeWidth="3" />
      <circle cx="80" cy="80" r="70" fill="none" stroke="#dc2626" strokeWidth="1.2" />

      {line2 ? (
        <>
          <text
            x="80"
            y="36"
            textAnchor="middle"
            fill="#dc2626"
            fontSize="8.5"
            fontWeight="800"
            fontFamily="sans-serif"
            letterSpacing="0.3"
          >
            {line1.toUpperCase()}
          </text>
          <text
            x="80"
            y="49"
            textAnchor="middle"
            fill="#dc2626"
            fontSize="7.5"
            fontWeight="700"
            fontFamily="sans-serif"
            letterSpacing="0.2"
          >
            {line2.toUpperCase()}
          </text>
        </>
      ) : (
        <text
          x="80"
          y="42"
          textAnchor="middle"
          fill="#dc2626"
          fontSize="9.5"
          fontWeight="800"
          fontFamily="sans-serif"
          letterSpacing="0.3"
        >
          {line1.toUpperCase()}
        </text>
      )}

      <line x1="18" y1="62" x2="142" y2="62" stroke="#dc2626" strokeWidth="1.8" />
      <line x1="18" y1="92" x2="142" y2="92" stroke="#dc2626" strokeWidth="1.8" />

      <circle cx="26" cy="77" r="2.5" fill="#dc2626" />
      <circle cx="134" cy="77" r="2.5" fill="#dc2626" />

      <text
        x="80"
        y="81"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#dc2626"
        fontSize="13"
        fontWeight="900"
        fontFamily="sans-serif"
        letterSpacing="2"
      >
        ĐÃ KÝ SỐ
      </text>

      <text
        x="80"
        y="112"
        textAnchor="middle"
        fill="#dc2626"
        fontSize="8"
        fontWeight="700"
        fontFamily="sans-serif"
      >
        CHỨNG THỰC ĐIỆN TỬ
      </text>
      <text
        x="80"
        y="126"
        textAnchor="middle"
        fill="#b91c1c"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="sans-serif"
        letterSpacing="0.5"
      >
        XÁC THỰC ED25519
      </text>
    </svg>
  );
}

export default function ContractViewModal({
  isOpen,
  onClose,
  contract,
  canonicalText: _canonicalText,
}: ContractViewModalProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen || !contract) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const page1 = document.getElementById('contract-page-1');
    const page2 = document.getElementById('contract-page-2');
    if (!page1 || !page2) {
      window.print();
      return;
    }

    try {
      setIsGeneratingPdf(true);
      const canvas1 = await html2canvas(page1, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const canvas2 = await html2canvas(page2, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = 210;
      const pdfHeight = 297;

      const img1 = canvas1.toDataURL('image/png');
      pdf.addImage(img1, 'PNG', 0, 0, pdfWidth, pdfHeight);

      pdf.addPage();
      const img2 = canvas2.toDataURL('image/png');
      pdf.addImage(img2, 'PNG', 0, 0, pdfWidth, pdfHeight);

      const safeNumber = contract.contractNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
      pdf.save(`HopDong_SupplyMind_${safeNumber}.pdf`);
    } catch (err) {
      console.error('Lỗi khi xuất PDF:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Chưa ghi nhận';
    const d = new Date(isoString);
    return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN')}`;
  };

  const certNumber = contract.stamp?.certificateId || `SM-CERT-${contract.contractNumber}`;

  const partnerName =
    contract.signerInfo?.businessName ||
    (contract.role === 'SUPPLIER' ? 'Vựa Sỉ Đối Tác' : 'Tiệm Tạp Hóa Đối Tác');

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .contract-modal-backdrop {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            backdrop-filter: none !important;
            overflow: visible !important;
            inset: auto !important;
            z-index: auto !important;
          }

          .contract-printable-container {
            position: static !important;
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          .contract-printable-container * {
            visibility: visible !important;
          }

          .no-print {
            display: none !important;
          }

          .contract-scroll-area {
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }

          .contract-page {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            width: 100% !important;
            min-height: 275mm !important;
            max-height: 285mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 10mm 14mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
          }

          .contract-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .contract-page-separator {
            display: none !important;
          }

          .contract-signatures-wrapper {
            display: table !important;
            width: 100% !important;
            table-layout: fixed !important;
            margin-top: 24px !important;
            padding-top: 16px !important;
            border-top: 2px solid #0f172a !important;
            clear: both !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .contract-signature-col {
            display: table-cell !important;
            width: 50% !important;
            vertical-align: top !important;
            text-align: center !important;
            padding: 0 12px !important;
          }

          @page {
            size: A4 portrait;
            margin: 10mm 10mm 10mm 10mm;
          }
        }
      `}</style>

      <div
        className="contract-modal-backdrop"
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
        aria-labelledby="contract-view-title"
      >
        <div
          className="contract-printable-container"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '860px',
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            border: '1px solid #cbd5e1',
          }}
        >
          {/* Header Bar - Hidden on print */}
          <div
            className="no-print"
            style={{
              padding: '14px 24px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: '#166534',
                  textTransform: 'uppercase',
                }}
              >
                HỒ SƠ HỢP ĐỒNG ĐIỆN TỬ XÁC THỰC
              </span>
              <h2
                id="contract-view-title"
                style={{
                  margin: '2px 0 0',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                Hợp đồng điện tử: {contract.contractNumber}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Button 1: Tải file PDF */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                style={{
                  padding: '7px 15px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
                  opacity: isGeneratingPdf ? 0.75 : 1,
                  boxShadow: '0 1px 2px rgba(22, 163, 74, 0.25)',
                }}
              >
                {isGeneratingPdf ? 'Đang tạo PDF…' : 'Tải file PDF'}
              </button>

              {/* Button 2: In hợp đồng */}
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  padding: '7px 15px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                In hợp đồng
              </button>

              {/* Button 3: Đóng */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '18px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '5px 10px',
                  backgroundColor: '#ffffff',
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Scrollable Document Area */}
          <div
            className="contract-scroll-area"
            style={{
              padding: '24px 28px',
              overflowY: 'auto',
              flex: 1,
              backgroundColor: '#e2e8f0',
            }}
          >
            {/* TRANG 1 / 2 */}
            <div
              id="contract-page-1"
              className="contract-page"
              style={{
                backgroundColor: '#ffffff',
                width: '100%',
                maxWidth: '800px',
                minHeight: '1130px',
                boxSizing: 'border-box',
                padding: '38px 46px',
                margin: '0 auto',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                color: '#0f172a',
                fontFamily: "'Times New Roman', Times, serif",
                fontSize: '13.5px',
                lineHeight: 1.65,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                {/* Official Vietnam National Header */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, letterSpacing: '0.04em' }}>
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, marginTop: '2px' }}>
                    Độc lập - Tự do - Hạnh phúc
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    -------------------o0o-------------------
                  </div>
                  <h1
                    style={{
                      fontSize: '16.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      marginTop: '18px',
                      marginBottom: '4px',
                      color: '#0f172a',
                    }}
                  >
                    THỎA THUẬN KẾT NỐI VÀ HỢP ĐỒNG ĐIỆN TỬ
                  </h1>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    DỊCH VỤ NỀN TẢNG SUPPLYMIND AI
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', fontStyle: 'italic' }}>
                    Số: {contract.contractNumber}
                  </div>
                </div>

                {/* Legal Bases */}
                <div
                  style={{
                    fontStyle: 'italic',
                    fontSize: '12px',
                    color: '#475569',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '12px',
                    marginBottom: '16px',
                    lineHeight: 1.55,
                  }}
                >
                  <div>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;</div>
                  <div>- Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14/06/2005;</div>
                  <div>- Căn cứ Luật Giao dịch điện tử số 20/2023/QH15 ngày 22/06/2023;</div>
                  <div>- Căn cứ Nghị định số 130/2018/NĐ-CP quy định chi tiết thi hành Luật Giao dịch điện tử về chữ ký số và dịch vụ chứng thực chữ ký số;</div>
                  <div>- Căn cứ nhu cầu và sự tự nguyện thỏa thuận giữa Nền tảng SupplyMind AI và Bên sử dụng dịch vụ.</div>
                </div>

                {/* Two Parties Information */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', color: '#0f172a' }}>
                      BÊN A: ĐƠN VỊ CUNG CẤP DỊCH VỤ NỀN TẢNG (SUPPLYMIND AI)
                    </div>
                    <table style={{ width: '100%', fontSize: '12.5px', marginTop: '4px', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr>
                          <td style={{ width: '190px', padding: '2px 0', color: '#475569' }}>Tên đơn vị:</td>
                          <td style={{ padding: '2px 0', fontWeight: 600 }}>Nền tảng SupplyMind AI</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '2px 0', color: '#475569' }}>Đại diện pháp luật:</td>
                          <td style={{ padding: '2px 0' }}>Ban Điều hành Nền tảng SupplyMind AI</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '2px 0', color: '#475569' }}>Địa chỉ trụ sở:</td>
                          <td style={{ padding: '2px 0' }}>Khu Công nghệ cao, Phường Tân Phú, TP. Thủ Đức, TP. Hồ Chí Minh</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '2px 0', color: '#475569' }}>Email liên hệ:</td>
                          <td style={{ padding: '2px 0' }}>contact@supplymind.vn · Hotline hỗ trợ: 1900 6868</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', color: '#0f172a' }}>
                      BÊN B: ĐỐI TÁC THAM GIA KẾT NỐI VÀ SỬ DỤNG DỊCH VỤ
                    </div>
                    <table style={{ width: '100%', fontSize: '12.5px', marginTop: '4px', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr>
                          <td style={{ width: '190px', padding: '2px 0', color: '#475569' }}>Tên cơ sở / Hộ kinh doanh:</td>
                          <td style={{ padding: '2px 0', fontWeight: 600 }}>{partnerName}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '2px 0', color: '#475569' }}>Người đại diện hợp pháp:</td>
                          <td style={{ padding: '2px 0', fontWeight: 600 }}>
                            {contract.signerInfo?.name || contract.username}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '2px 0', color: '#475569' }}>Số điện thoại liên hệ:</td>
                          <td style={{ padding: '2px 0' }}>{contract.signerInfo?.phone || 'Theo hồ sơ điện tử'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '2px 0', color: '#475569' }}>Mã số thuế / Số CCCD:</td>
                          <td style={{ padding: '2px 0' }}>{contract.signerInfo?.taxCode || 'Đã xác thực định danh điện tử'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '2px 0', color: '#475569' }}>Địa chỉ cơ sở kinh doanh:</td>
                          <td style={{ padding: '2px 0' }}>{contract.signerInfo?.address || 'Theo hồ sơ định vị của cửa hàng'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '2px 0', color: '#475569' }}>Vai trò tài khoản:</td>
                          <td style={{ padding: '2px 0', fontWeight: 600 }}>
                            {contract.role === 'SUPPLIER' ? 'Chủ Vựa / Nhà Cung Cấp Sỉ' : 'Chủ Cửa Hàng Tạp Hóa'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Contract Terms Content: Articles 1, 2, 3 */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
                    NỘI DUNG VÀ ĐIỀU KHOẢN THỎA THUẬN CHI TIẾT
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      ĐIỀU 1: MỤC ĐÍCH KẾT NỐI VÀ CẤP QUYỀN TRUY CẬP THÔNG TIN VẬN HÀNH
                    </div>
                    <div>1.1. Bên B đồng ý tham gia kết nối hoạt động kinh doanh vào mạng lưới nền tảng số SupplyMind AI nhằm tối ưu hóa chuỗi cung ứng B2B giữa tiệm tạp hóa và chủ vựa sỉ.</div>
                    <div>1.2. Bên B cho phép hệ thống SupplyMind AI truy cập các dữ liệu vận hành gồm: danh mục mặt hàng, tình trạng tồn kho, lịch sử bán hàng và vị trí cơ sở kinh doanh để phục vụ thuật toán AI dự báo nhu cầu restock và định tuyến giao hàng tự động.</div>
                    <div>1.3. Nền tảng SupplyMind AI cam kết bảo mật tuyệt đối dữ liệu nội bộ của Bên B, không chuyển giao hoặc cung cấp cho bất kỳ bên thứ ba nào ngoài phạm vi vận hành đơn hàng.</div>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      ĐIỀU 2: QUYỀN LỢI ĐỐI TÁC VÀ CƠ CHẾ CHÀO HÀNG TIẾP THỊ 0Đ
                    </div>
                    <div>2.1. Bên B được quyền sử dụng các công nghệ dự báo nhu cầu restock, trợ lý giọng nói kiểm kho, và báo cáo phân tích xu hướng bán hàng của hệ thống.</div>
                    <div>2.2. Đối tác tạp hóa được tham gia cơ chế chào hàng tiếp thị / bán thử vốn 0đ: nhận hàng bày bán trực tiếp và chỉ thanh toán tiền hàng sỉ sau khi đã bán được cho người tiêu dùng cuối.</div>
                    <div>2.3. Chủ vựa cam kết định kỳ xuất xe điều phối bổ sung số lượng đối với các mặt hàng cạn kiệt và thực hiện đổi mới 100% đối với sản phẩm cận hạn sử dụng (dưới 14 ngày).</div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      ĐIỀU 3: MINH BẠCH DÒNG TIỀN VÀ CƠ CHẾ KÝ QUỸ ĐẢM BẢO (ESCROW 10%)
                    </div>
                    <div>3.1. Khi đặt hàng sỉ qua hệ thống, Tiệm tạp hóa thực hiện ký quỹ đảm bảo 10% giá trị đơn hàng vào Ví bảo chứng hệ thống (Escrow).</div>
                    <div>3.2. Khoản ký quỹ 10% được giữ an toàn độc lập, chỉ được giải ngân cho Chủ vựa khi Tiệm tạp hóa bấm xác nhận đã nhận đủ hàng đạt chuẩn tại cơ sở.</div>
                    <div>3.3. 90% giá trị còn lại của đơn hàng được thanh toán trực tiếp bằng tiền mặt hoặc chuyển khoản tại thời điểm giao nhận thực tế.</div>
                    <div>3.4. Trong trường hợp giao thiếu, hủy đơn do lỗi bên giao hoặc hàng hóa hư hỏng, 100% khoản ký quỹ 10% sẽ được hoàn trả tự động vào Ví của Tiệm tạp hóa.</div>
                  </div>
                </div>
              </div>

              {/* Page 1 Footer */}
              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '8px',
                  marginTop: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#64748b',
                  fontStyle: 'italic',
                }}
              >
                <span>Hợp đồng số: {contract.contractNumber}</span>
                <span>Trang 1 / 2</span>
              </div>
            </div>

            {/* Visual Page Separator on Screen */}
            <div
              className="no-print contract-page-separator"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                maxWidth: '800px',
                margin: '20px auto',
                color: '#64748b',
                fontSize: '11.5px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span style={{ height: '1px', flex: 1, backgroundColor: '#cbd5e1', marginRight: '16px' }} />
              <span>Trang 2 / 2</span>
              <span style={{ height: '1px', flex: 1, backgroundColor: '#cbd5e1', marginLeft: '16px' }} />
            </div>

            {/* TRANG 2 / 2 */}
            <div
              id="contract-page-2"
              className="contract-page"
              style={{
                backgroundColor: '#ffffff',
                width: '100%',
                maxWidth: '800px',
                minHeight: '1130px',
                boxSizing: 'border-box',
                padding: '38px 46px',
                margin: '0 auto',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                color: '#0f172a',
                fontFamily: "'Times New Roman', Times, serif",
                fontSize: '13.5px',
                lineHeight: 1.65,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                {/* Header Mini for Page 2 */}
                <div
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '8px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11.5px',
                    color: '#64748b',
                  }}
                >
                  <span>THỎA THUẬN KẾT NỐI VÀ HỢP ĐỒNG ĐIỆN TỬ SUPPLYMIND AI</span>
                  <span>Số: {contract.contractNumber} (Tiếp theo)</span>
                </div>

                {/* Contract Terms Content: Articles 4, 5, 6, 7 */}
                <div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      ĐIỀU 4: MINH BẠCH GIÁ CẢ VÀ ĐIỀU CHỈNH GIÁ DỊP LỄ TẾT
                    </div>
                    <div>4.1. Chủ vựa cam kết không tự ý găm hàng, ép giá hoặc tăng giá đột ngột trái với báo giá sỉ niêm yết trên hệ thống.</div>
                    <div>4.2. Mọi biến động giá trong các dịp cao điểm lễ tết phải được công bố công khai, minh bạch trước ít nhất 48 giờ để hệ thống tính toán cảnh báo.</div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      ĐIỀU 5: TIÊU CHUẨN HÀNG HÓA VÀ BỘ LỌC TỪ CẤM KIỂM DUYỆT
                    </div>
                    <div>5.1. Chủ vựa cam kết hàng hóa đầy đủ hóa đơn chứng từ, rõ nguồn gốc xuất xứ và còn nguyên vẹn tem nhãn theo quy định của pháp luật.</div>
                    <div>5.2. Mọi sản phẩm đăng tải phải tuân thủ bộ lọc AI kiểm duyệt tự động; nghiêm cấm các mặt hàng chứa từ khóa cấm, hàng giả, hàng kém chất lượng.</div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      ĐIỀU 6: QUY TRÌNH XỬ LÝ SỰ CỐ GIAO NHẬN VÀ XỬ PHẠT VI PHẠM
                    </div>
                    <div>6.1. Trường hợp hàng vỡ hỏng hoặc sai quy cách, bên nhận hàng có trách nhiệm gửi báo cáo sự cố kèm hình ảnh trong vòng 02 giờ kể từ khi xe hoàn tất giao.</div>
                    <div>6.2. Hành vi gian lận thông tin, bùng đơn hàng hoặc vi phạm nghĩa vụ ký quỹ sẽ bị xử lý khóa tài khoản vĩnh viễn và khấu trừ chế tài vi phạm theo điều lệ.</div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      ĐIỀU 7: HIỆU LỰC PHÁP LÝ VÀ CHỨNG THỰC CHỮ KÝ SỐ
                    </div>
                    <div>7.1. Hợp đồng điện tử này có giá trị pháp lý tương đương văn bản giấy theo quy định tại Luật Giao dịch điện tử số 20/2023/QH15.</div>
                    <div>7.2. Hợp đồng có hiệu lực kể từ thời điểm Bên B hoàn tất ký số bằng khóa bảo mật cá nhân và được hệ thống SupplyMind AI chứng thực bằng con dấu điện tử hợp lệ.</div>
                  </div>
                </div>

                {/* Symmetrical Two-Column Signature & Official Red SVG Stamps Block */}
                <div
                  className="contract-signatures-wrapper"
                  style={{
                    borderTop: '2px solid #0f172a',
                    paddingTop: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '24px',
                    clear: 'both',
                  }}
                >
                  {/* Bên A: Circular Red SVG Stamp */}
                  <div
                    className="contract-signature-col"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a' }}>
                      ĐẠI DIỆN BÊN A
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
                      NỀN TẢNG SUPPLYMIND AI
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '8px' }}>
                      (Đã xác thực và đóng dấu điện tử)
                    </div>

                    {/* Pure Vector SVG Stamp for Bên A */}
                    <div style={{ margin: '4px 0 8px' }}>
                      <PlatformStampSvg />
                    </div>

                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                      Ban Điều hành Nền tảng SupplyMind AI
                    </div>

                    {/* Bên A Verification Box */}
                    <div
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        maxWidth: '280px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        backgroundColor: '#f8fafc',
                        fontSize: '10px',
                        textAlign: 'left',
                        color: '#334155',
                        lineHeight: 1.45,
                      }}
                    >
                      <div><strong>Tổ chức:</strong> Nền tảng SupplyMind AI</div>
                      <div><strong>Cấp chứng thư:</strong> SupplyMind Platform CA</div>
                      <div><strong>Thuật toán:</strong> Ed25519 with SHA-256</div>
                      <div style={{ color: '#15803d', fontWeight: 700, marginTop: '2px' }}>
                        Trạng thái: ĐÃ XÁC THỰC TOÀN VẸN
                      </div>
                    </div>
                  </div>

                  {/* Bên B: Matching Circular Red SVG Stamp */}
                  <div
                    className="contract-signature-col"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a' }}>
                      ĐẠI DIỆN BÊN B
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginTop: '2px' }}>
                      {partnerName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '8px' }}>
                      (Ký điện tử bằng Khóa bí mật đối tác)
                    </div>

                    {/* Pure Vector SVG Stamp for Bên B */}
                    <div style={{ margin: '4px 0 8px' }}>
                      <PartnerStampSvg partnerName={partnerName} />
                    </div>

                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                      {contract.signerInfo?.name || contract.username}
                    </div>

                    {/* Bên B Verification Box */}
                    <div
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        maxWidth: '280px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        backgroundColor: '#f8fafc',
                        fontSize: '10px',
                        textAlign: 'left',
                        color: '#334155',
                        lineHeight: 1.45,
                      }}
                    >
                      <div><strong>Đơn vị ký:</strong> {partnerName}</div>
                      <div><strong>Người ký:</strong> {contract.signerInfo?.name || contract.username}</div>
                      <div><strong>Thời gian:</strong> {formatDate(contract.signedAt)}</div>
                      <div>
                        <strong>Số chứng chỉ:</strong>{' '}
                        <span style={{ fontFamily: 'Consolas, monospace', fontSize: '9px', color: '#0f172a', fontWeight: 600 }}>
                          {certNumber}
                        </span>
                      </div>
                      <div style={{ color: '#15803d', fontWeight: 700, marginTop: '2px' }}>
                        Trạng thái: CHỨNG CHỈ HỢP LỆ VÀ TOÀN VẸN
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Page 2 Footer */}
              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '8px',
                  marginTop: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#64748b',
                  fontStyle: 'italic',
                }}
              >
                <span>Hợp đồng có hiệu lực kể từ thời điểm hoàn tất ký số</span>
                <span>Trang 2 / 2</span>
              </div>
            </div>
          </div>

          {/* Footer Bar - Hidden on print */}
          <div
            className="no-print"
            style={{
              padding: '12px 24px',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Bản sao hợp đồng điện tử được lưu trữ an toàn trong mục Thông tin cá nhân của bạn.
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 18px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
