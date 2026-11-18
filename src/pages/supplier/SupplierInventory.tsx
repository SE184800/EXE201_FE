import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import '../store-inventory.css';
import Icon from '../../components/Icon';
import SupplierLayout from '../../components/SupplierLayout';
import type { AuthUser } from '../../types/auth';
import type { SupplierProduct } from '../../services/supplier.api';
import ExportDropdown from '../../components/ExportDropdown';
import { exportSupplierInventoryToExcel, exportSupplierInventoryToPdf } from '../../utils/exportSupplier';

const empty = {
  name: '',
  category: 'Khác',
  wholesalePrice: '',
  stockQty: '0',
  moq: '1',
  imageUrl: '',
};

const PACK_OPTIONS = ['thùng', 'két', 'lốc', 'kiện'] as const;
const CUSTOM_PACK = 'tùy chỉnh';

/** Gom các trường quy cách thành chuỗi packaging gửi lên API (vd: "thùng 24 lon"). */
function composePackaging(pack: string, unitsPerPack: string, unit: string): string {
  const count = unitsPerPack.trim();
  const single = unit.trim();
  if (pack === CUSTOM_PACK) return single;
  if (!pack) return single;
  return [pack, count, single].filter(Boolean).join(' ');
}

/** Tách chuỗi packaging sẵn có về lại pack / số lượng / đơn vị để sửa cho tiện. */
function parsePackaging(packaging: string): {
  pack: string;
  unitsPerPack: string;
  unit: string;
} {
  const text = (packaging || '').trim();
  const known = PACK_OPTIONS.find((option) => text.toLowerCase().startsWith(option));
  if (!known) return { pack: text ? CUSTOM_PACK : '', unitsPerPack: '', unit: text };
  const rest = text.slice(known.length).trim();
  const match = rest.match(/^(\d+)(?:\s+(.+))?$/);
  if (!match) return { pack: known, unitsPerPack: '', unit: rest };
  return { pack: known, unitsPerPack: match[1], unit: (match[2] || '').trim() };
}

/** Bỏ dấu để gợi ý sản phẩm tương tự, giống mục kho hàng của store. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

async function processAndStoreImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        const key =
          'https://local.supplymind.vn/img_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        try {
          localStorage.setItem(key, base64);
          resolve(key);
        } catch {
          resolve(base64);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function resolveImage(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('https://local.supplymind.vn/img_')) return localStorage.getItem(url) || url;
  return url;
}

export default function SupplierInventory({ user, onLogout }: { user?: AuthUser; onLogout: () => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<SupplierProduct | null>(null);
  const [form, setForm] = useState(empty);
  const [pack, setPack] = useState('');
  const [unitsPerPack, setUnitsPerPack] = useState('');
  const [unit, setUnit] = useState('');
  /** Quy cách gốc của sản phẩm đang sửa, dùng khi người dùng không đổi trường quy cách. */
  const [originalPackaging, setOriginalPackaging] = useState('');
  const [saving, setSaving] = useState(false);
  const editor = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Use the supplier products endpoint as requested by user's API docs
      const res = await api.get<{ products?: SupplierProduct[] }>('/supplier/products');
      // The backend /supplier/dashboard returns { products } array.
      if (res.data.products) setItems(res.data.products);
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else {
        const msg = getApiError(issue);
        if (msg.includes('gian hàng') || msg.includes('SUPPLIER_PROFILE_REQUIRED')) {
          navigate('/supplier', { replace: true });
          return;
        }
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [onLogout, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  function add() {
    setForm(empty);
    setPack('');
    setUnitsPerPack('');
    setUnit('');
    setOriginalPackaging('');
    setEditing(null);
    setError('');
    setNotice('');
    editor.current?.showModal();
    window.setTimeout(() => nameInput.current?.focus(), 0);
  }

  function edit(item: SupplierProduct) {
    const parsed = parsePackaging(item.packaging);
    setForm({
      name: item.name,
      category: item.category,
      wholesalePrice: String(item.wholesalePrice),
      stockQty: String(item.stockQty),
      moq: String(item.moq),
      imageUrl: item.imageUrl || '',
    });
    setPack(parsed.pack);
    setUnitsPerPack(parsed.unitsPerPack);
    setUnit(parsed.unit);
    setOriginalPackaging(item.packaging);
    setEditing(item);
    setError('');
    setNotice('');
    editor.current?.showModal();
    window.setTimeout(() => nameInput.current?.focus(), 0);
  }

  /** Gợi ý sản phẩm tương tự, giống mục kho hàng của store. */
  const productSuggestions =
    editing === null && form.name.trim().length > 0
      ? items
        .filter(
          (item) =>
            fold(item.name).includes(fold(form.name.trim())) ||
            fold(form.name.trim()).includes(fold(item.name)),
        )
        .slice(0, 6)
      : [];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const composed = composePackaging(pack, unitsPerPack, unit);
      // Khi sửa mà người dùng không điền số lượng trong 1 quy cách thì giữ nguyên quy cách gốc.
      const packaging =
        editing !== null && pack && pack !== CUSTOM_PACK && !unitsPerPack.trim()
          ? originalPackaging
          : composed;
      if (!packaging) {
        setError('Vui lòng nhập quy cách đóng gói của sản phẩm.');
        setSaving(false);
        return;
      }
      if (packaging.length > 50) {
        setError('Quy cách đóng gói tối đa 50 ký tự.');
        setSaving(false);
        return;
      }
      const stockQty = Number(form.stockQty);
      const moq = Number(form.moq);
      if (stockQty > 0 && moq > stockQty) {
        setError(
          `Số lượng tối thiểu (MOQ: ${moq}) không được lớn hơn tồn kho có sẵn (${stockQty}).`,
        );
        setSaving(false);
        return;
      }
      const payload = {
        name: form.name.trim(),
        packaging,
        category: form.category.trim(),
        wholesalePrice: Number(form.wholesalePrice),
        stockQty,
        moq,
        imageUrl: form.imageUrl || null,
        isActive: true, // Default to true when added from inventory
      };

      if (editing) {
        await api.put(`/supplier/products/${editing.id}`, {
          ...payload,
          expectedUpdatedAt: editing.updatedAt,
        });
      } else {
        await api.post('/supplier/products', payload);
      }
      setNotice(editing ? 'Đã cập nhật kho hàng.' : 'Đã thêm hàng vào kho.');
      editor.current?.close();
      await load();
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else {
        const msg = getApiError(issue);
        if (msg.includes('gian hàng') || msg.includes('SUPPLIER_PROFILE_REQUIRED')) {
          navigate('/supplier', { replace: true });
          return;
        }
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SupplierLayout
      user={user || ({ id: 0, username: 'chuvua', name: 'Chủ vựa', role: 'SUPPLIER' } as AuthUser)}
      activeNav="inventory"
      onLogout={onLogout}
    >
      <div>
        <div className="dashboard-title">
          <div>
            <p className="dashboard-eyebrow">QUẢN LÝ KHO HÀNG (NỘI BỘ)</p>
            <h1>Kho hàng của bạn</h1>
            <p>Kiểm soát số lượng hàng tồn kho thực tế tại vựa.</p>
          </div>
          <div className="dashboard-title-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExportDropdown
              label="Xuất file"
              disabled={!items.length}
              onExportExcel={() => exportSupplierInventoryToExcel(items, 'Kho hàng chủ vựa')}
              onExportPdf={() => exportSupplierInventoryToPdf(items, 'Kho hàng chủ vựa')}
            />
            <button className="dash-primary" onClick={add}>
              <span>＋</span> Thêm sản phẩm
            </button>
          </div>
        </div>

        {notice && (
          <div className="inventory-toast" role="status">
            <span className="toast-icon">OK</span>
            <div className="toast-body">
              <strong>Thông báo</strong>
              <p>{notice}</p>
            </div>
            <button
              className="toast-close"
              type="button"
              onClick={() => setNotice('')}
              aria-label="Đóng"
            >
              ×
            </button>
          </div>
        )}

        <section className="dashboard-card product-card">
          <div className="inventory-toolbar">
            <label className="product-search">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Tìm sản phẩm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm sản phẩm trong kho…"
              />
            </label>
          </div>

          {loading ? (
            <p className="inventory-empty">Đang tải kho hàng…</p>
          ) : !visible.length ? (
            <div className="calm-state">
              <span>
                <Icon name="box" />
              </span>
              <h3>Chưa có sản phẩm nào</h3>
              <p>Thêm sản phẩm để bắt đầu theo dõi tồn kho.</p>
              <button className="dash-primary" onClick={add}>
                ＋ Thêm sản phẩm
              </button>
            </div>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Tồn kho</th>
                    <th>Quy cách</th>
                    <th>Giá sỉ</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div
                          className="product-name-cell"
                          style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
                        >
                          {item.imageUrl ? (
                            <img
                              src={resolveImage(item.imageUrl)}
                              alt={item.name}
                              style={{
                                width: '40px',
                                height: '40px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                border: '1px solid #e1e8da',
                              }}
                            />
                          ) : (
                            <span className="product-avatar">
                              <Icon name="box" />
                            </span>
                          )}
                          <div>
                            <strong>{item.name}</strong>
                            <small>Mã SP #{String(item.id).padStart(4, '0')}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong className="quantity-number">{item.stockQty}</strong>
                      </td>
                      <td>
                        <span className="unit-label">{item.packaging}</span>
                      </td>
                      <td>{item.wholesalePrice.toLocaleString('vi-VN')} ₫</td>
                      <td>
                        <button
                          className="edit-product"
                          disabled={saving}
                          aria-label={`Sửa ${item.name}`}
                          onClick={() => edit(item)}
                        >
                          Chỉnh sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <dialog
          ref={editor}
          aria-label={editing === null ? 'Thêm sản phẩm mới' : 'Chỉnh sửa sản phẩm'}
          className="inventory-dialog"
          onCancel={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          <div className="dialog-heading">
            <span className="product-avatar">
              <Icon name="box" />
            </span>
            <div>
              <span className="section-kicker">KHO HÀNG VỰA</span>
              <h2>{editing === null ? 'Thêm sản phẩm mới' : 'Chỉnh sửa sản phẩm'}</h2>
            </div>
            <button
              disabled={saving}
              className="dialog-close"
              aria-label="Đóng form sản phẩm"
              onClick={() => editor.current?.close()}
            >
              ×
            </button>
          </div>
          <form className="inventory-form" onSubmit={save}>
            <label className="inventory-name">
              Tên sản phẩm
              <input
                ref={nameInput}
                required
                minLength={2}
                maxLength={150}
                value={form.name}
                disabled={saving}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Nước ngọt Coca Cola 330ml"
              />
              {productSuggestions.length > 0 && (
                <div className="product-suggestions" role="listbox" aria-label="Sản phẩm tương tự">
                  {productSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      disabled={saving}
                      onClick={() => {
                        const parsed = parsePackaging(item.packaging);
                        setForm({
                          name: item.name,
                          category: item.category,
                          wholesalePrice: String(item.wholesalePrice),
                          stockQty: String(item.stockQty),
                          moq: String(item.moq),
                          imageUrl: item.imageUrl || '',
                        });
                        setPack(parsed.pack);
                        setUnitsPerPack(parsed.unitsPerPack);
                        setUnit(parsed.unit);
                        setError('');
                      }}
                    >
                      <strong>{item.name}</strong>
                      <small>
                        Còn {item.stockQty} {item.packaging} · bấm để dùng lại thông tin
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </label>

            <label className="inventory-name">
              Nhập theo
              <select
                value={pack}
                disabled={saving}
                onChange={(event) => {
                  const next = event.target.value;
                  setPack(next);
                  if (next === CUSTOM_PACK) {
                    setUnitsPerPack('');
                  } else if (next !== CUSTOM_PACK && /\s/.test(unit.trim())) {
                    // Chuyển từ quy cách tùy chỉnh sang quy cách có sẵn: đơn vị cũ có thể chứa cả số lượng.
                    setUnit('');
                  }
                }}
              >
                <option value="">Nhập lẻ</option>
                {PACK_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
                <option value={CUSTOM_PACK}>Tùy chỉnh</option>
              </select>
            </label>

            <label>
              {pack === CUSTOM_PACK ? 'Quy cách' : 'Đơn vị bán lẻ'}
              <input
                required
                maxLength={50}
                value={unit}
                disabled={saving}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={pack === CUSTOM_PACK ? 'bao 25kg, thùng 24 lon…' : 'lon, chai, bịch…'}
              />
            </label>

            <label>
              Danh mục
              <select
                required
                value={form.category}
                disabled={saving}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="Đồ uống">Đồ uống</option>
                <option value="Thực phẩm">Thực phẩm</option>
                <option value="Gia vị">Gia vị</option>
                <option value="Hóa phẩm">Hóa phẩm</option>
                <option value="Chăm sóc cá nhân">Chăm sóc cá nhân</option>
                <option value="Khác">Khác</option>
              </select>
            </label>

            <label>
              {editing === null ? 'Số lượng nhập' : 'Số lượng tồn'}
              <input
                required
                type="number"
                min="0"
                max="50000"
                step="1"
                value={form.stockQty}
                disabled={saving}
                onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
              />
            </label>

            {pack && pack !== CUSTOM_PACK && (
              <>
                <label>
                  Số {unit.trim() || 'món'} trong 1 {pack}
                  <input
                    required={editing === null}
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={unitsPerPack}
                    disabled={saving}
                    onChange={(e) => setUnitsPerPack(e.target.value)}
                  />
                </label>
                <output className="inventory-pack-total" aria-live="polite">
                  {Number(unitsPerPack) > 0 &&
                    `Tổng kho ${(Number(form.stockQty || 0) * Number(unitsPerPack)).toLocaleString('vi-VN')} ${unit.trim() || 'món'}`}
                </output>
              </>
            )}

            <output className="inventory-pack-total" aria-live="polite">
              {(() => {
                const composed = composePackaging(pack, unitsPerPack, unit);
                const preview =
                  editing !== null && pack && pack !== CUSTOM_PACK && !unitsPerPack.trim()
                    ? originalPackaging
                    : composed;
                return preview ? `Quy cách gửi đến cửa hàng: ${preview}` : '';
              })()}
            </output>

            <label>
              Giá sỉ (₫ / {pack && pack !== CUSTOM_PACK ? pack : unit.trim() || 'đơn vị'})
              <input
                required
                type="number"
                min="0.01"
                max="1000000000"
                step="0.01"
                placeholder="Nhập giá"
                value={form.wholesalePrice}
                disabled={saving}
                onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })}
              />
            </label>

            <label>
              Mua tối thiểu (MOQ)
              <input
                required
                type="number"
                min="1"
                max="50000"
                step="1"
                placeholder="MOQ"
                value={form.moq}
                disabled={saving}
                onChange={(e) => setForm({ ...form, moq: e.target.value })}
              />
            </label>

            <label className="inventory-name">
              Ảnh sản phẩm trong kho
              <div style={{ display: 'flex', gap: '10px' }}>                <input
                  type="text"
                  value={form.imageUrl}
                  disabled={saving}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="Dán link ảnh hoặc tải ảnh từ máy..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '12px',
                    border: '1px solid #cddbd1',
                    borderRadius: '10px',
                  }}
                />
                <label
                  style={{
                    cursor: 'pointer',
                    background: '#eef4e9',
                    border: '1px solid #d6e3d8',
                    padding: '0 16px',
                    borderRadius: '10px',
                    whiteSpace: 'nowrap',
                    fontWeight: 'bold',
                    color: '#173e2d',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  + Tải ảnh lên
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        processAndStoreImage(file).then((key) =>
                          setForm({ ...form, imageUrl: key }),
                        );
                      }
                    }}
                    disabled={saving}
                  />
                </label>
              </div>
            </label>

            {error && (
              <p className="error-notice inventory-name" role="alert">
                {error}
              </p>
            )}
            <div className="inventory-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={() => editor.current?.close()}
              >
                Để sau
              </button>
              <button className="dash-primary" disabled={saving}>
                {saving ? 'Đang lưu…' : editing === null ? '＋ Thêm vào kho' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </dialog>
      </div>
    </SupplierLayout>
  );
}
