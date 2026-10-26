import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import './export-dropdown.css';

type ExportDropdownProps = {
  label?: string;
  onExportExcel?: () => void | Promise<void>;
  onExportPdf?: () => void | Promise<void>;
  onOpenModal?: () => void;
  align?: 'left' | 'right';
  disabled?: boolean;
  className?: string;
};

export default function ExportDropdown({
  label = 'Xuất file',
  onExportExcel,
  onExportPdf,
  onOpenModal,
  align = 'right',
  disabled = false,
  className = '',
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  async function handleExcel() {
    if (!onExportExcel || busy) return;
    setOpen(false);
    setBusy(true);
    try {
      await onExportExcel();
    } finally {
      setBusy(false);
    }
  }

  async function handlePdf() {
    if (!onExportPdf || busy) return;
    setOpen(false);
    setBusy(true);
    try {
      await onExportPdf();
    } finally {
      setBusy(false);
    }
  }

  function handleModal() {
    setOpen(false);
    if (onOpenModal) onOpenModal();
  }

  return (
    <div className={`export-dropdown ${className}`} ref={rootRef}>
      <button
        type="button"
        className="export-dropdown-trigger"
        disabled={disabled || busy}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {busy ? (
          <span className="export-spinner" aria-hidden="true" />
        ) : (
          <Icon name="download" />
        )}
        <span>{busy ? 'Đang xuất…' : label}</span>
        <svg
          className={`export-dropdown-caret ${open ? 'open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={`export-dropdown-menu align-${align}`} role="menu">
          {onExportExcel && (
            <button
              type="button"
              className="export-menu-item"
              onClick={handleExcel}
              role="menuitem"
            >
              <span className="export-menu-item-icon">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
              </span>
              <div className="export-menu-item-text">
                <span className="export-menu-item-label">Tải file Excel (.xlsx)</span>
                <span className="export-menu-item-desc">Dữ liệu bảng tính chi tiết</span>
              </div>
            </button>
          )}

          {onExportPdf && (
            <button type="button" className="export-menu-item" onClick={handlePdf} role="menuitem">
              <span className="export-menu-item-icon">
                <Icon name="fileText" />
              </span>
              <div className="export-menu-item-text">
                <span className="export-menu-item-label">Tải file PDF (.pdf)</span>
                <span className="export-menu-item-desc">Mẫu tài liệu in ấn khổ A4</span>
              </div>
            </button>
          )}

          {onOpenModal && (
            <>
              {(onExportExcel || onExportPdf) && <div className="export-menu-divider" />}
              <button
                type="button"
                className="export-menu-item"
                onClick={handleModal}
                role="menuitem"
              >
                <span className="export-menu-item-icon">
                  <Icon name="calendar" />
                </span>
                <div className="export-menu-item-text">
                  <span className="export-menu-item-label">Tùy chọn ngày & xem trước…</span>
                  <span className="export-menu-item-desc">Lọc thời gian và xem số liệu</span>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
