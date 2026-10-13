import axios from 'axios';
import { forwardRef, useImperativeHandle, useRef, useState, type ChangeEvent } from 'react';
import { api, getApiError, isUnauthenticated } from '../services/api';
import Icon from './Icon';

type ImportError = {
  rowNumber: number;
  message: string;
};

type ImportRow = {
  rowNumber: number;
  name: string;
  unit: string;
  quantity: number;
  purchasePrice?: number;
  sellingPrice?: number;
  receivedAt: string;
  expiryDate: string | null;
  note: string;
  warnings: string[];
  action: 'CREATE' | 'ADD';
};

type ImportPreview = {
  fileName: string;
  rows: ImportRow[];
  errors: ImportError[];
  summary: {
    rowCount: number;
    validCount: number;
    createdCount: number;
    updatedCount: number;
    totalQuantity: number;
  };
};

type ImportResult = {
  message: string;
  result: {
    rowCount: number;
    createdCount: number;
    updatedCount: number;
    importedQuantity: number;
  };
};

export type InventoryImportDialogHandle = {
  open: () => void;
};

function formatMoney(value?: number) {
  return value === undefined ? '—' : `${value.toLocaleString('vi-VN')} đ`;
}

function responseErrors(error: unknown): ImportError[] {
  if (!axios.isAxiosError<{ errors?: ImportError[] }>(error)) return [];
  return Array.isArray(error.response?.data?.errors) ? error.response.data.errors : [];
}

const InventoryImportDialog = forwardRef<
  InventoryImportDialogHandle,
  {
    onImported: (message: string) => Promise<void> | void;
    onLogout: () => void;
  }
>(function InventoryImportDialog({ onImported, onLogout }, ref) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [commitErrors, setCommitErrors] = useState<ImportError[]>([]);

  function reset() {
    setFile(null);
    setPreview(null);
    setError('');
    setCommitErrors([]);
    if (fileInput.current) fileInput.current.value = '';
  }

  useImperativeHandle(ref, () => ({
    open() {
      reset();
      dialog.current?.showModal();
    },
  }));

  function close() {
    if (busy) return;
    dialog.current?.close();
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setError('');
    setCommitErrors([]);
  }

  function filePayload() {
    const form = new FormData();
    if (file) form.append('file', file);
    return form;
  }

  async function checkFile() {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    setCommitErrors([]);
    try {
      const { data } = await api.post<ImportPreview>('/inventory/import/preview', filePayload(), {
        timeout: 30_000,
      });
      setPreview(data);
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setError(getApiError(issue));
    } finally {
      setBusy(false);
    }
  }

  async function importFile() {
    if (!file || !preview || preview.errors.length || busy) return;
    setBusy(true);
    setError('');
    setCommitErrors([]);
    try {
      const { data } = await api.post<ImportResult>('/inventory/import/commit', filePayload(), {
        timeout: 45_000,
      });
      dialog.current?.close();
      await onImported(
        `${data.message} Tạo mới ${data.result.createdCount}, cộng thêm ${data.result.updatedCount} mặt hàng.`,
      );
      reset();
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else {
        setError(getApiError(issue));
        setCommitErrors(responseErrors(issue));
      }
    } finally {
      setBusy(false);
    }
  }

  const visibleErrors = preview?.errors.length ? preview.errors : commitErrors;

  return (
    <dialog
      ref={dialog}
      className="inventory-dialog inventory-import-dialog"
      aria-label="Nhập kho từ Excel"
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={() => {
        if (!busy) reset();
      }}
    >
      <div className="dialog-heading">
        <span className="product-avatar">
          <Icon name="box" />
        </span>
        <div>
          <span className="section-kicker">NHẬP NHANH</span>
          <h2>Nhập kho từ Excel</h2>
        </div>
        <button
          type="button"
          disabled={busy}
          className="dialog-close"
          aria-label="Đóng nhập Excel"
          onClick={close}
        >
          ×
        </button>
      </div>

      <p className="import-description">
        Mỗi dòng là một lô nhập. Sản phẩm đã có sẽ được cộng thêm, sản phẩm mới sẽ được tạo tự động.
      </p>

      <div className="import-template-box">
        <div>
          <strong>Chưa có file đúng mẫu?</strong>
          <small>Tải mẫu, điền dữ liệu tại tab “Nhập kho” rồi tải lên đây.</small>
        </div>
        <a className="ghost-button" href="/mau-nhap-kho.xlsx" download>
          Tải file mẫu
        </a>
      </div>

      <label className="inventory-file-picker">
        <span>Chọn file Excel (.xlsx, tối đa 3 MB)</span>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={chooseFile}
          disabled={busy}
        />
        <strong>{file ? file.name : 'Chưa chọn file'}</strong>
        {file && <small>{(file.size / 1024).toLocaleString('vi-VN')} KB</small>}
      </label>

      <div className="import-check-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={!file || busy}
          onClick={() => void checkFile()}
        >
          {busy && !preview ? 'Đang đọc file…' : 'Kiểm tra và xem trước'}
        </button>
      </div>

      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}

      {preview && (
        <>
          <div className="import-summary" aria-label="Tóm tắt file Excel">
            <div>
              <small>Tổng dòng</small>
              <strong>{preview.summary.rowCount}</strong>
            </div>
            <div>
              <small>Tạo mới</small>
              <strong>{preview.summary.createdCount}</strong>
            </div>
            <div>
              <small>Cộng thêm</small>
              <strong>{preview.summary.updatedCount}</strong>
            </div>
            <div>
              <small>Tổng số lượng</small>
              <strong>{preview.summary.totalQuantity.toLocaleString('vi-VN')}</strong>
            </div>
          </div>

          {visibleErrors.length > 0 && (
            <div className="import-error-list" role="alert">
              <strong>File còn {visibleErrors.length} lỗi cần sửa</strong>
              <ul>
                {visibleErrors.slice(0, 12).map((item, index) => (
                  <li key={`${item.rowNumber}-${index}`}>
                    Dòng {item.rowNumber}: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="import-preview-table-wrap">
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Dòng</th>
                  <th>Sản phẩm</th>
                  <th>Thao tác</th>
                  <th>Số lượng</th>
                  <th>Giá nhập / bán</th>
                  <th>Ngày nhập / HSD</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 15).map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>
                      <strong>{row.name}</strong>
                      <small>{row.unit}</small>
                      {row.warnings.map((warning) => (
                        <em key={warning}>{warning}</em>
                      ))}
                    </td>
                    <td>
                      <span className={`import-action import-action-${row.action.toLowerCase()}`}>
                        {row.action === 'CREATE' ? 'Tạo mới' : 'Cộng thêm'}
                      </span>
                    </td>
                    <td>{row.quantity?.toLocaleString('vi-VN') ?? '—'}</td>
                    <td>
                      {formatMoney(row.purchasePrice)}
                      <small>{formatMoney(row.sellingPrice)}</small>
                    </td>
                    <td>
                      {row.receivedAt || 'Hôm nay'}
                      <small>{row.expiryDate || 'Không có HSD'}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 15 && (
              <p className="import-more-rows">
                Còn {preview.rows.length - 15} dòng khác. Tất cả sẽ được nhập khi xác nhận.
              </p>
            )}
          </div>
        </>
      )}

      <div className="inventory-actions import-dialog-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={close}>
          Hủy
        </button>
        <button
          type="button"
          className="dash-primary"
          disabled={!preview || preview.errors.length > 0 || commitErrors.length > 0 || busy}
          onClick={() => void importFile()}
        >
          {busy && preview ? 'Đang nhập kho…' : 'Xác nhận nhập kho'}
        </button>
      </div>
    </dialog>
  );
});

export default InventoryImportDialog;
