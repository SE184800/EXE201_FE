import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import type { SupplierProduct, SupplierOrder } from '../services/supplier.api';

const money = (n: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(n);

/**
 * ====================================================================
 * 1. XUẤT KHO HÀNG CHỦ VỰA (SUPPLIER INVENTORY)
 * ====================================================================
 */

export function exportSupplierInventoryToExcel(
  products: SupplierProduct[],
  supplierName = 'Kho Hàng Chủ Vựa',
  filename?: string,
) {
  const exportTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const totalStock = products.reduce((sum, p) => sum + (Number(p.stockQty) || 0), 0);
  const totalValue = products.reduce(
    (sum, p) => sum + (Number(p.stockQty) || 0) * (Number(p.wholesalePrice) || 0),
    0,
  );

  const rows: (string | number)[][] = [
    ['ĐƠN VỊ:', supplierName],
    ['BÁO CÁO KIỂM KÊ TỒN KHO HÀNG SỈ'],
    ['Thời điểm xuất báo cáo:', exportTime],
    [],
    ['I. TỔNG HỢP KHO HÀNG'],
    ['Tổng số mặt hàng:', products.length],
    ['Tổng số lượng tồn kho:', totalStock],
    ['Tổng giá trị hàng tồn ước tính (VNĐ):', totalValue],
    [],
    ['II. CHI TIẾT TỪNG MẶT HÀNG TRONG KHO'],
    [
      'STT',
      'Mã hàng',
      'Tên sản phẩm',
      'Quy cách',
      'Danh mục',
      'Tồn kho thực tế',
      'Giá sỉ đề xuất (VNĐ)',
      'MOQ (Tối thiểu)',
      'Thành tiền tồn kho (VNĐ)',
      'Trạng thái',
    ],
  ];

  products.forEach((p, idx) => {
    const lineTotal = (Number(p.stockQty) || 0) * (Number(p.wholesalePrice) || 0);
    rows.push([
      idx + 1,
      `#${p.id}`,
      p.name,
      p.packaging,
      p.category || 'Khác',
      Number(p.stockQty) || 0,
      Number(p.wholesalePrice) || 0,
      Number(p.moq) || 1,
      lineTotal,
      p.isActive ? 'Đang bán' : 'Tạm ẩn',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 32 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TonKho');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, filename || `BaoCaoTonKho_${dateStr}.xlsx`);
}

export async function exportSupplierInventoryToPdf(
  products: SupplierProduct[],
  supplierName = 'Kho Hàng Chủ Vựa',
  filename?: string,
): Promise<void> {
  const exportTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const totalStock = products.reduce((sum, p) => sum + (Number(p.stockQty) || 0), 0);
  const totalValue = products.reduce(
    (sum, p) => sum + (Number(p.stockQty) || 0) * (Number(p.wholesalePrice) || 0),
    0,
  );

  const container = document.createElement('div');
  container.style.cssText = `
    width: 800px;
    padding: 40px 44px;
    background: #ffffff;
    color: #1e293b;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    box-sizing: border-box;
  `;

  let rowsHtml = '';
  products.forEach((p, idx) => {
    const lineTotal = (Number(p.stockQty) || 0) * (Number(p.wholesalePrice) || 0);
    rowsHtml += `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 8px 6px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 8px 8px; font-weight: 550; color: #0f172a;">
          ${p.name}
          <div style="font-size: 11px; color: #64748b; font-weight: normal;">#${p.id} · ${p.category || 'Khác'}</div>
        </td>
        <td style="padding: 8px 6px; text-align: center; color: #475569;">${p.packaging}</td>
        <td style="padding: 8px 8px; text-align: right; font-weight: 650;">${Number(p.stockQty).toLocaleString('vi-VN')}</td>
        <td style="padding: 8px 8px; text-align: right; color: #475569;">${money(p.wholesalePrice)}</td>
        <td style="padding: 8px 8px; text-align: right; font-weight: 600; color: #0f172a;">${money(lineTotal)}</td>
        <td style="padding: 8px 6px; text-align: center; font-size: 12px; color: ${p.isActive ? '#15803d' : '#64748b'};">
          ${p.isActive ? 'Đang bán' : 'Tạm ẩn'}
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <!-- HEADER -->
    <div style="border-bottom: 1.5px solid #cbd5e1; padding-bottom: 16px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: #64748b; text-transform: uppercase;">
          ${supplierName}
        </div>
        <h1 style="margin: 4px 0 2px; font-size: 21px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
          BÁO CÁO KIỂM KÊ TỒN KHO HÀNG SỈ
        </h1>
        <div style="font-size: 13px; color: #475569;">
          Số liệu kiểm kê kho thực tế tại cơ sở
        </div>
      </div>
      <div style="text-align: right; font-size: 12px; color: #64748b; line-height: 1.5;">
        <div>Ngày xuất: <strong style="color: #334155;">${exportTime}</strong></div>
        <div style="font-size: 11px; color: #94a3b8;">Hệ thống SupplyMind</div>
      </div>
    </div>

    <!-- KPI SUMMARY -->
    <div style="display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 12px; margin-bottom: 24px;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
        <span style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase;">Số lượng mặt hàng</span>
        <div style="font-size: 20px; font-weight: 750; color: #0f172a; margin-top: 2px;">
          ${products.length.toLocaleString('vi-VN')} <span style="font-size: 12px; font-weight: normal; color: #64748b;">món</span>
        </div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
        <span style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase;">Tổng tồn kho</span>
        <div style="font-size: 20px; font-weight: 750; color: #0f172a; margin-top: 2px;">
          ${totalStock.toLocaleString('vi-VN')} <span style="font-size: 12px; font-weight: normal; color: #64748b;">đơn vị</span>
        </div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
        <span style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase;">Giá trị kho ước tính</span>
        <div style="font-size: 20px; font-weight: 750; color: #0f172a; margin-top: 2px;">
          ${money(totalValue)}
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <div style="margin-bottom: 28px;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1.5px solid #cbd5e1; color: #475569; font-size: 12px; text-align: left;">
            <th style="padding: 8px 6px; width: 40px; text-align: center;">STT</th>
            <th style="padding: 8px 8px;">Tên sản phẩm</th>
            <th style="padding: 8px 6px; width: 75px; text-align: center;">Quy cách</th>
            <th style="padding: 8px 8px; width: 85px; text-align: right;">Tồn kho</th>
            <th style="padding: 8px 8px; width: 100px; text-align: right;">Giá sỉ</th>
            <th style="padding: 8px 8px; width: 120px; text-align: right;">Giá trị tồn</th>
            <th style="padding: 8px 6px; width: 80px; text-align: center;">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="7" style="padding: 16px; text-align: center; color: #94a3b8;">Không có mặt hàng nào.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- SIGNATURES -->
    <div style="margin-top: 36px; padding-top: 14px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: flex-start; font-size: 13px; color: #475569;">
      <div style="width: 200px; text-align: center;">
        <div style="font-weight: 600; color: #1e293b;">Thủ kho</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">(Ký và ghi rõ họ tên)</div>
        <div style="height: 55px;"></div>
      </div>
      <div style="width: 200px; text-align: center;">
        <div style="font-weight: 600; color: #1e293b;">Chủ vựa / Đại diện</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">(Ký và xác nhận)</div>
        <div style="height: 55px;"></div>
      </div>
    </div>
  `;

  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false });
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

    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save(filename || `BaoCaoTonKho_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * ====================================================================
 * 2. XUẤT DANH SÁCH ĐƠN HÀNG SỈ (SUPPLIER ORDERS)
 * ====================================================================
 */

export function exportSupplierOrdersToExcel(
  orders: SupplierOrder[],
  supplierName = 'Chủ Vựa / Đại Lý Bỏ Mối',
  filename?: string,
) {
  const exportTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalDeposit = orders.reduce((sum, o) => sum + (Number(o.depositAmount) || 0), 0);

  const rows: (string | number)[][] = [
    ['ĐƠN VỊ:', supplierName],
    ['BÁO CÁO DANH SÁCH ĐƠN HÀNG'],
    ['Thời điểm xuất báo cáo:', exportTime],
    [],
    ['I. TỔNG HỢP ĐƠN HÀNG'],
    ['Tổng số đơn:', orders.length],
    ['Tổng doanh thu tiền hàng (VNĐ):', totalRevenue],
    ['Tổng tiền cọc (VNĐ):', totalDeposit],
    [],
    ['II. CHI TIẾT CÁC ĐƠN HÀNG'],
    [
      'STT',
      'Mã đơn',
      'Ngày đặt',
      'Khách hàng',
      'Người nhận',
      'SĐT liên hệ',
      'Địa chỉ giao hàng',
      'Số món',
      'Tổng tiền (VNĐ)',
      'Tiền cọc (VNĐ)',
      'Trạng thái đơn',
    ],
  ];

  orders.forEach((o, idx) => {
    const dateStr = o.createdAt
      ? new Date(o.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
      : '';
    rows.push([
      idx + 1,
      `#${o.id}`,
      dateStr,
      o.buyer?.name || o.buyer?.username || 'Khách hàng',
      o.recipientName || '',
      o.recipientPhone || '',
      o.deliveryAddress || '',
      o.items ? o.items.length : 0,
      Number(o.total) || 0,
      Number(o.depositAmount) || 0,
      o.statusLabel || o.status,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 20 },
    { wch: 26 },
    { wch: 18 },
    { wch: 14 },
    { wch: 35 },
    { wch: 10 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DonHang');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, filename || `DanhSachDonHang_${dateStr}.xlsx`);
}

export async function exportSupplierOrdersToPdf(
  orders: SupplierOrder[],
  supplierName = 'Chủ Vựa / Đại Lý Bỏ Mối',
  filename?: string,
): Promise<void> {
  const exportTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalDeposit = orders.reduce((sum, o) => sum + (Number(o.depositAmount) || 0), 0);

  const container = document.createElement('div');
  container.style.cssText = `
    width: 800px;
    padding: 40px 44px;
    background: #ffffff;
    color: #1e293b;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    box-sizing: border-box;
  `;

  let rowsHtml = '';
  orders.forEach((o, idx) => {
    const dateStr = o.createdAt
      ? new Date(o.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
      : '';
    rowsHtml += `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 8px 6px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 8px 8px; font-weight: 650; color: #0f172a;">#${o.id}</td>
        <td style="padding: 8px 6px; font-size: 12px; color: #64748b; white-space: nowrap;">${dateStr}</td>
        <td style="padding: 8px 8px;">
          <strong style="color: #0f172a;">${o.buyer?.name || o.buyer?.username || 'Khách hàng'}</strong>
          <div style="font-size: 11px; color: #64748b;">${o.recipientPhone || ''} · ${o.deliveryAddress ? o.deliveryAddress.slice(0, 35) + '…' : ''}</div>
        </td>
        <td style="padding: 8px 8px; text-align: right; font-weight: 650; color: #0f172a;">${money(o.total)}</td>
        <td style="padding: 8px 8px; text-align: right; color: #64748b;">${money(o.depositAmount)}</td>
        <td style="padding: 8px 6px; text-align: center; font-size: 12px; color: #334155;">
          ${o.statusLabel || o.status}
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <!-- HEADER -->
    <div style="border-bottom: 1.5px solid #cbd5e1; padding-bottom: 16px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: #64748b; text-transform: uppercase;">
          ${supplierName}
        </div>
        <h1 style="margin: 4px 0 2px; font-size: 21px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
          BÁO CÁO DANH SÁCH ĐƠN HÀNG
        </h1>
        <div style="font-size: 13px; color: #475569;">
          Chi tiết danh sách đơn hàng đã phát sinh
        </div>
      </div>
      <div style="text-align: right; font-size: 12px; color: #64748b; line-height: 1.5;">
        <div>Ngày xuất: <strong style="color: #334155;">${exportTime}</strong></div>
        <div style="font-size: 11px; color: #94a3b8;">Hệ thống SupplyMind</div>
      </div>
    </div>

    <!-- SUMMARY -->
    <div style="display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: 12px; margin-bottom: 24px;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
        <span style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase;">Tổng số đơn</span>
        <div style="font-size: 20px; font-weight: 750; color: #0f172a; margin-top: 2px;">
          ${orders.length.toLocaleString('vi-VN')} <span style="font-size: 12px; font-weight: normal; color: #64748b;">đơn</span>
        </div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
        <span style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase;">Tổng tiền hàng</span>
        <div style="font-size: 20px; font-weight: 750; color: #0f172a; margin-top: 2px;">
          ${money(totalRevenue)}
        </div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
        <span style="font-size: 11px; color: #64748b; font-weight: 500; text-transform: uppercase;">Tổng tiền cọc</span>
        <div style="font-size: 20px; font-weight: 750; color: #0f172a; margin-top: 2px;">
          ${money(totalDeposit)}
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <div style="margin-bottom: 28px;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1.5px solid #cbd5e1; color: #475569; font-size: 12px; text-align: left;">
            <th style="padding: 8px 6px; width: 40px; text-align: center;">STT</th>
            <th style="padding: 8px 8px; width: 65px;">Mã đơn</th>
            <th style="padding: 8px 6px; width: 110px;">Ngày đặt</th>
            <th style="padding: 8px 8px;">Khách hàng / Nhận hàng</th>
            <th style="padding: 8px 8px; width: 115px; text-align: right;">Tổng tiền</th>
            <th style="padding: 8px 8px; width: 95px; text-align: right;">Tiền cọc</th>
            <th style="padding: 8px 6px; width: 105px; text-align: center;">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="7" style="padding: 16px; text-align: center; color: #94a3b8;">Không có đơn hàng nào.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- SIGNATURES -->
    <div style="margin-top: 36px; padding-top: 14px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: flex-start; font-size: 13px; color: #475569;">
      <div style="width: 200px; text-align: center;">
        <div style="font-weight: 600; color: #1e293b;">Người phụ trách</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">(Ký và ghi rõ họ tên)</div>
        <div style="height: 55px;"></div>
      </div>
      <div style="width: 200px; text-align: center;">
        <div style="font-weight: 600; color: #1e293b;">Đại diện cơ sở</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">(Ký và xác nhận)</div>
        <div style="height: 55px;"></div>
      </div>
    </div>
  `;

  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false });
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

    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save(filename || `DanhSachDonHang_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
