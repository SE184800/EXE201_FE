import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { vnd } from '../services/storeRevenue.api';

export type ExportSalesData = {
  from: string;
  to: string;
  storeName?: string;
  summary: {
    revenue: string | number;
    salesCount: number;
    productCount: number;
    unpricedSalesCount?: number;
  };
  topProducts: {
    productName: string;
    unit: string;
    quantity: string | number;
    revenue: string | number;
  }[];
  sales: {
    id: string;
    productName: string;
    unit: string;
    quantity: number;
    unitSalePrice: number | null;
    revenue: string | null;
    note: string;
    createdAt: string;
  }[];
};

const formatDay = (dateStr: string) => {
  if (!dateStr || dateStr.length < 10) return dateStr;
  return `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}/${dateStr.slice(0, 4)}`;
};

/**
 * Xuất dữ liệu bán hàng ra file Excel (.xlsx)
 */
export function exportSalesToExcel(data: ExportSalesData, filename?: string) {
  const exportTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const periodText =
    data.from === data.to
      ? formatDay(data.from)
      : `${formatDay(data.from)} - ${formatDay(data.to)}`;

  const rows: (string | number)[][] = [
    ['ĐƠN VỊ:', data.storeName || 'CỬA HÀNG TẠP HÓA'],
    ['BÁO CÁO DOANH THU & BÁN HÀNG THEO NGÀY'],
    ['Thời gian:', periodText],
    ['Thời điểm xuất báo cáo:', exportTime],
    [],
    ['I. TỔNG HỢP KẾT QUẢ KINH DOANH'],
    ['Tổng doanh thu (VNĐ):', Number(data.summary.revenue) || 0],
    ['Tổng lượt ghi bán:', data.summary.salesCount],
    ['Số mặt hàng đã bán:', data.summary.productCount],
    [],
    ['II. BẢNG TỔNG HỢP MẶT HÀNG ĐÃ BÁN'],
    ['STT', 'Tên mặt hàng', 'ĐVT', 'Tổng số lượng', 'Doanh thu (VNĐ)'],
  ];

  data.topProducts.forEach((item, index) => {
    rows.push([
      index + 1,
      item.productName,
      item.unit,
      Number(item.quantity) || 0,
      Number(item.revenue) || 0,
    ]);
  });

  rows.push([]);
  rows.push(['III. NHẬT KÝ CHI TIẾT CÁC LƯỢT BÁN']);
  rows.push([
    'STT',
    'Thời gian',
    'Tên mặt hàng',
    'Số lượng',
    'ĐVT',
    'Đơn giá (VNĐ)',
    'Thành tiền (VNĐ)',
    'Ghi chú',
  ]);

  data.sales.forEach((s, index) => {
    const timeStr = new Date(s.createdAt).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    rows.push([
      index + 1,
      timeStr,
      s.productName,
      s.quantity,
      s.unit,
      s.unitSalePrice ?? 0,
      s.revenue ? Number(s.revenue) : 0,
      s.note || '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 30 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 20 },
    { wch: 28 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BaoCaoBanHang');

  const defaultName = `BaoCaoBanHang_${data.from === data.to ? data.from : `${data.from}_${data.to}`}.xlsx`;
  XLSX.writeFile(wb, filename || defaultName);
}

/**
 * Tạo HTML element hiển thị báo cáo chuẩn mực, trang trọng để render PDF hoặc In
 */
function createReportHtml(data: ExportSalesData): HTMLElement {
  const exportTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const periodText =
    data.from === data.to
      ? formatDay(data.from)
      : `${formatDay(data.from)} đến ${formatDay(data.to)}`;

  const container = document.createElement('div');
  container.className = 'pdf-report-root';
  container.style.cssText = `
    width: 800px;
    padding: 40px 44px;
    background: #ffffff;
    color: #1e293b;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    box-sizing: border-box;
  `;

  let productsRows = '';
  data.topProducts.forEach((item, idx) => {
    productsRows += `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 8px 6px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 8px 8px; font-weight: 550; color: #0f172a;">${item.productName}</td>
        <td style="padding: 8px 6px; text-align: center; color: #475569;">${item.unit}</td>
        <td style="padding: 8px 8px; text-align: right; font-weight: 600;">${Number(item.quantity).toLocaleString('vi-VN')}</td>
        <td style="padding: 8px 8px; text-align: right; font-weight: 600; color: #1e293b;">${vnd(item.revenue)}</td>
      </tr>
    `;
  });

  let salesRows = '';
  data.sales.slice(0, 80).forEach((s, idx) => {
    const timeStr = new Date(s.createdAt).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    salesRows += `
      <tr style="border-bottom: 1px solid #f1f5f9; font-size: 12px;">
        <td style="padding: 7px 5px; text-align: center; color: #94a3b8;">${idx + 1}</td>
        <td style="padding: 7px 6px; color: #64748b; white-space: nowrap;">${timeStr}</td>
        <td style="padding: 7px 6px; font-weight: 500; color: #1e293b;">${s.productName}</td>
        <td style="padding: 7px 6px; text-align: right;">${s.quantity} ${s.unit}</td>
        <td style="padding: 7px 6px; text-align: right; color: #475569;">${s.unitSalePrice != null ? vnd(s.unitSalePrice) : '—'}</td>
        <td style="padding: 7px 6px; text-align: right; font-weight: 600; color: #0f172a;">${s.revenue != null ? vnd(s.revenue) : '—'}</td>
        <td style="padding: 7px 6px; color: #64748b; font-size: 11px;">${s.note || ''}</td>
      </tr>
    `;
  });

  container.innerHTML = `
    <!-- TIÊU ĐỀ TRANG TRỌNG -->
    <div style="border-bottom: 1.5px solid #cbd5e1; padding-bottom: 16px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: #64748b; text-transform: uppercase;">
          ${data.storeName || 'CỬA HÀNG TẠP HÓA'}
        </div>
        <h1 style="margin: 4px 0 2px; font-size: 21px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
          BÁO CÁO DOANH THU BÁN HÀNG
        </h1>
        <div style="font-size: 13px; color: #475569;">
          Thời gian: <strong>${periodText}</strong>
        </div>
      </div>
      <div style="text-align: right; font-size: 12px; color: #64748b; line-height: 1.5;">
        <div>Ngày xuất: <strong style="color: #334155;">${exportTime}</strong></div>
        <div style="font-size: 11px; color: #94a3b8;">Hệ thống SupplyMind</div>
      </div>
    </div>

    <!-- TỔNG HỢP 3 CHỈ SỐ CHÍNH -->
    <div style="display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
        <span style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase;">Tổng doanh thu</span>
        <div style="font-size: 20px; font-weight: 750; color: #0f172a; margin-top: 2px;">
          ${vnd(data.summary.revenue)}
        </div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
        <span style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase;">Lượt ghi bán</span>
        <div style="font-size: 20px; font-weight: 750; color: #0f172a; margin-top: 2px;">
          ${data.summary.salesCount.toLocaleString('vi-VN')} <span style="font-size: 12px; font-weight: normal; color: #64748b;">lượt</span>
        </div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
        <span style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase;">Mặt hàng đã bán</span>
        <div style="font-size: 20px; font-weight: 750; color: #0f172a; margin-top: 2px;">
          ${data.summary.productCount.toLocaleString('vi-VN')} <span style="font-size: 12px; font-weight: normal; color: #64748b;">món</span>
        </div>
      </div>
    </div>

    <!-- BẢNG TỔNG HỢP MẶT HÀNG -->
    <div style="margin-bottom: 24px;">
      <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em;">
        I. Danh sách mặt hàng đã bán
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1.5px solid #cbd5e1; color: #475569; font-size: 12px; text-align: left;">
            <th style="padding: 8px 6px; width: 40px; text-align: center;">STT</th>
            <th style="padding: 8px 8px;">Tên sản phẩm</th>
            <th style="padding: 8px 6px; width: 70px; text-align: center;">ĐVT</th>
            <th style="padding: 8px 8px; width: 100px; text-align: right;">Số lượng bán</th>
            <th style="padding: 8px 8px; width: 120px; text-align: right;">Doanh thu</th>
          </tr>
        </thead>
        <tbody>
          ${productsRows || '<tr><td colspan="5" style="padding: 14px; text-align: center; color: #94a3b8;">Không có mặt hàng nào.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- BẢNG CHI TIẾT GIAO DỊCH -->
    ${
      data.sales.length > 0
        ? `
      <div style="margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em;">
          II. Chi tiết từng lượt bán ${data.sales.length > 80 ? '<span style="font-size: 11px; font-weight: normal; color: #64748b;">(80 lượt đầu)</span>' : ''}
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1.5px solid #cbd5e1; color: #475569; font-size: 11px; text-align: left;">
              <th style="padding: 7px 5px; width: 35px; text-align: center;">STT</th>
              <th style="padding: 7px 6px; width: 115px;">Thời gian</th>
              <th style="padding: 7px 6px;">Sản phẩm</th>
              <th style="padding: 7px 6px; width: 70px; text-align: right;">SL</th>
              <th style="padding: 7px 6px; width: 90px; text-align: right;">Đơn giá</th>
              <th style="padding: 7px 6px; width: 100px; text-align: right;">Thành tiền</th>
              <th style="padding: 7px 6px; width: 120px;">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${salesRows}
          </tbody>
        </table>
      </div>
    `
        : ''
    }

    <!-- KHU VỰC CHỮ KÝ TRANG TRỌNG -->
    <div style="margin-top: 36px; padding-top: 14px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: flex-start; font-size: 13px; color: #475569;">
      <div style="width: 200px; text-align: center;">
        <div style="font-weight: 600; color: #1e293b;">Người lập biểu</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">(Ký và ghi rõ họ tên)</div>
        <div style="height: 55px;"></div>
      </div>
      <div style="width: 200px; text-align: center;">
        <div style="font-weight: 600; color: #1e293b;">Chủ cửa hàng</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">(Ký và xác nhận)</div>
        <div style="height: 55px;"></div>
      </div>
    </div>
  `;

  return container;
}

/**
 * Xuất dữ liệu bán hàng ra file PDF (.pdf)
 */
export async function exportSalesToPdf(data: ExportSalesData, filename?: string): Promise<void> {
  const container = createReportHtml(data);

  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = 297;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    const defaultName = `BaoCaoBanHang_${data.from === data.to ? data.from : `${data.from}_${data.to}`}.pdf`;
    pdf.save(filename || defaultName);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Mở hộp thoại In của trình duyệt
 */
export function printSalesReport(data: ExportSalesData) {
  const container = createReportHtml(data);
  const printWindow = window.open('', '_blank', 'width=880,height=900');
  if (!printWindow) {
    alert('Trình duyệt đã chặn cửa sổ pop-up. Vui lòng cho phép mở pop-up để in báo cáo.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Báo Cáo Bán Hàng - ${data.from}</title>
        <style>
          body { margin: 0; padding: 20px; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          @media print {
            body { padding: 0; }
            @page { margin: 12mm; }
          }
        </style>
      </head>
      <body>
        ${container.outerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
}
