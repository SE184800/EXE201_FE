import { useEffect, useState } from 'react';
import Icon from './Icon';
import { getStoreRevenue, vietnamDay, vnd, type StoreRevenueReport } from '../services/storeRevenue.api';
import { exportSalesToExcel, exportSalesToPdf, printSalesReport } from '../utils/exportSales';
import './export-sales-dialog.css';

type ExportSalesDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
  storeName?: string;
};

export default function ExportSalesDialog({
  isOpen,
  onClose,
  defaultDate,
  storeName = 'Cửa hàng tạp hóa',
}: ExportSalesDialogProps) {
  const today = defaultDate || vietnamDay();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | 'print' | null>(null);
  const [preview, setPreview] = useState<StoreRevenueReport | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      const initialDay = defaultDate || vietnamDay();
      setFrom(initialDay);
      setTo(initialDay);
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen, defaultDate]);

  useEffect(() => {
    if (!isOpen || !from || !to) return;
    let active = true;
    setLoading(true);
    setError('');

    getStoreRevenue(from, to, 1)
      .then((data) => {
        if (active) setPreview(data);
      })
      .catch((err) => {
        if (active) {
          setError('Không tải được số liệu bán hàng của khoảng thời gian này.');
          console.error(err);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, from, to]);

  if (!isOpen) return null;

  async function loadFullReport(): Promise<StoreRevenueReport | null> {
    try {
      let page = 1;
      const initial = await getStoreRevenue(from, to, page);
      const allSales = [...initial.sales];
      let current = initial;

      while (current.hasMore && page < 20) {
        page += 1;
        current = await getStoreRevenue(from, to, page);
        allSales.push(...current.sales);
      }

      return {
        ...initial,
        sales: allSales,
      };
    } catch (err) {
      console.error(err);
      setError('Đã có lỗi khi tải danh sách giao dịch để xuất file.');
      return null;
    }
  }

  async function handleExportExcel() {
    setError('');
    setSuccessMsg('');
    setExporting('excel');
    try {
      const full = await loadFullReport();
      if (!full) return;

      exportSalesToExcel({
        from,
        to,
        storeName,
        summary: full.summary,
        topProducts: full.topProducts,
        sales: full.sales,
      });
      setSuccessMsg('Đã tải xuống file Excel thành công.');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi xuất file Excel. Vui lòng thử lại.');
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    setError('');
    setSuccessMsg('');
    setExporting('pdf');
    try {
      const full = await loadFullReport();
      if (!full) return;

      await exportSalesToPdf({
        from,
        to,
        storeName,
        summary: full.summary,
        topProducts: full.topProducts,
        sales: full.sales,
      });
      setSuccessMsg('Đã tải xuống file PDF thành công.');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi xuất file PDF. Vui lòng thử lại.');
    } finally {
      setExporting(null);
    }
  }

  async function handlePrint() {
    setError('');
    setSuccessMsg('');
    setExporting('print');
    try {
      const full = await loadFullReport();
      if (!full) return;

      printSalesReport({
        from,
        to,
        storeName,
        summary: full.summary,
        topProducts: full.topProducts,
        sales: full.sales,
      });
    } catch (err) {
      console.error(err);
      setError('Không thể mở giao diện in. Vui lòng kiểm tra quyền pop-up.');
    } finally {
      setExporting(null);
    }
  }

  function setSingleDay(dayStr: string) {
    setFrom(dayStr);
    setTo(dayStr);
  }

  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  const firstDayOfMonth = today.slice(0, 8) + '01';

  return (
    <div className="export-dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="export-dialog-card" onClick={(e) => e.stopPropagation()}>
        <div className="export-dialog-header">
          <div>
            <div className="export-dialog-eyebrow">BÁO CÁO BÁN HÀNG</div>
            <h2>Xuất dữ liệu bán hàng</h2>
          </div>
          <button className="export-dialog-close" onClick={onClose} aria-label="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="export-dialog-body">
          {/* Quick presets */}
          <div className="export-filter-section">
            <div className="export-filter-label">Khoảng thời gian:</div>
            <div className="export-quick-presets">
              <button
                type="button"
                aria-pressed={from === today && to === today}
                onClick={() => setSingleDay(today)}
              >
                Hôm nay
              </button>
              <button
                type="button"
                aria-pressed={from === yesterday && to === yesterday}
                onClick={() => setSingleDay(yesterday)}
              >
                Hôm qua
              </button>
              <button
                type="button"
                aria-pressed={from === sevenDaysAgo && to === today}
                onClick={() => {
                  setFrom(sevenDaysAgo);
                  setTo(today);
                }}
              >
                7 ngày qua
              </button>
              <button
                type="button"
                aria-pressed={from === firstDayOfMonth && to === today}
                onClick={() => {
                  setFrom(firstDayOfMonth);
                  setTo(today);
                }}
              >
                Tháng này
              </button>
            </div>
          </div>

          {/* Date range pickers */}
          <div className="export-date-row">
            <label>
              Từ ngày
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Đến ngày
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>

          {/* Preview statistics */}
          <div className="export-preview-card">
            <div className="export-preview-header">
              <span className="export-preview-title">
                {from === to ? `Số liệu ngày ${from}` : `Số liệu từ ${from} đến ${to}`}
              </span>
              {loading && <span className="export-preview-status">Đang tải số liệu…</span>}
            </div>
            {preview ? (
              <div className="export-preview-stats">
                <div className="export-stat-item">
                  <span className="export-stat-label">Doanh thu</span>
                  <span className="export-stat-value">{vnd(preview.summary.revenue)}</span>
                </div>
                <div className="export-stat-item">
                  <span className="export-stat-label">Lượt bán</span>
                  <span className="export-stat-value">{preview.summary.salesCount}</span>
                </div>
                <div className="export-stat-item">
                  <span className="export-stat-label">Mặt hàng</span>
                  <span className="export-stat-value">{preview.summary.productCount}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#647a6b' }}>Chưa có dữ liệu.</div>
            )}
          </div>

          {error && <div className="export-feedback error">{error}</div>}
          {successMsg && (
            <div className="export-feedback success">
              <Icon name="check" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="export-actions">
            <button
              className="btn-primary-export"
              type="button"
              disabled={loading || exporting !== null}
              onClick={handleExportExcel}
            >
              {exporting === 'excel' ? (
                <>
                  <span className="export-spinner" />
                  <span>Đang khởi tạo file Excel…</span>
                </>
              ) : (
                <>
                  <Icon name="download" />
                  <span>Tải file Excel (.xlsx)</span>
                </>
              )}
            </button>

            <button
              className="btn-secondary-export"
              type="button"
              disabled={loading || exporting !== null}
              onClick={handleExportPdf}
            >
              {exporting === 'pdf' ? (
                <>
                  <span className="export-spinner" />
                  <span>Đang khởi tạo file PDF…</span>
                </>
              ) : (
                <>
                  <Icon name="fileText" />
                  <span>Tải file PDF (.pdf)</span>
                </>
              )}
            </button>

            <button
              className="btn-tertiary-export"
              type="button"
              disabled={loading || exporting !== null}
              onClick={handlePrint}
            >
              <Icon name="printer" />
              <span>In phiếu báo cáo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
