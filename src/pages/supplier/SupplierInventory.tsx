import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, getApiError, isUnauthenticated } from '../../services/api';
import '../store-inventory.css';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import type { SupplierProduct } from '../../services/supplier.api';

const empty = { name: '', packaging: 'thùng', category: 'Khác', wholesalePrice: '', stockQty: '0', moq: '1', imageUrl: '' };

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
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        const key = 'https://local.supplymind.vn/img_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        try { localStorage.setItem(key, base64); resolve(key); }
        catch (err) { resolve(base64); }
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

export default function SupplierInventory({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  
  const [editing, setEditing] = useState<SupplierProduct | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const editor = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function load() {
    setLoading(true); setError('');
    try {
      // Use the supplier products endpoint as requested by user's API docs
      const res = await api.get<{ products?: SupplierProduct[] }>('/supplier/products');
      // The backend /supplier/dashboard returns { products } array.
      if (res.data.products) setItems(res.data.products);
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout(); else setError(getApiError(issue));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = items.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));

  function add() {
    setForm(empty); setEditing(null); setError(''); setNotice('');
    editor.current?.showModal();
  }

  function edit(item: SupplierProduct) {
    setForm({
      name: item.name,
      packaging: item.packaging,
      category: item.category,
      wholesalePrice: String(item.wholesalePrice),
      stockQty: String(item.stockQty),
      moq: String(item.moq),
      imageUrl: item.imageUrl || ''
    });
    setEditing(item); setError(''); setNotice('');
    editor.current?.showModal();
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name.trim(),
        packaging: form.packaging.trim(),
        category: form.category.trim(),
        wholesalePrice: Number(form.wholesalePrice),
        stockQty: Number(form.stockQty),
        moq: Number(form.moq),
        imageUrl: form.imageUrl || null,
        isActive: true // Default to true when added from inventory
      };
      
      if (editing) {
        await api.put(`/supplier/products/${editing.id}`, payload);
      } else {
        await api.post('/supplier/products', payload);
      }
      setNotice(editing ? 'Đã cập nhật kho hàng.' : 'Đã thêm hàng vào kho.');
      editor.current?.close();
      await load();
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout(); else setError(getApiError(issue));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="supplier-page store-dashboard">
      <header className="supplier-header"><Brand /><Link className="ghost-button catalog-link" to="/supplier">← Tổng quan chủ vựa</Link></header>
      <section className="supplier-main dashboard-content">
        <nav className="catalog-nav" aria-label="Chủ vựa">
          <Link to="/supplier">Tổng quan</Link>
          <Link to="/supplier/products">Sản phẩm đăng bán</Link>
          <Link to="/supplier/orders">Đơn hàng</Link>
          <Link to="/supplier/inventory" aria-current="page">Kho hàng</Link>
        </nav>
        
        <div className="dashboard-title">
          <div>
            <p className="dashboard-eyebrow">QUẢN LÝ KHO HÀNG (NỘI BỘ)</p>
            <h1>Kho hàng của bạn</h1>
            <p>Kiểm soát số lượng hàng tồn kho thực tế tại vựa.</p>
          </div>
          <button className="dash-primary" onClick={add}><span>＋</span> Thêm sản phẩm</button>
        </div>

        {notice && (
          <div className="inventory-toast" role="status">
            <span className="toast-icon">✓</span>
            <div className="toast-body">
              <strong>Thông báo</strong>
              <p>{notice}</p>
            </div>
            <button className="toast-close" type="button" onClick={() => setNotice('')} aria-label="Đóng">×</button>
          </div>
        )}

        <section className="dashboard-card product-card">
          <div className="inventory-toolbar">
            <label className="product-search">
              <span aria-hidden="true">⌕</span>
              <input aria-label="Tìm sản phẩm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm sản phẩm trong kho…" />
            </label>
          </div>
          
          {loading ? <p className="inventory-empty">Đang tải kho hàng…</p> : !visible.length ? <div className="calm-state"><span><Icon name="box" /></span><h3>Chưa có sản phẩm nào</h3><p>Thêm sản phẩm để bắt đầu theo dõi tồn kho.</p><button className="dash-primary" onClick={add}>＋ Thêm sản phẩm</button></div> : 
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
                {visible.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="product-name-cell" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {item.imageUrl ? (
                          <img src={resolveImage(item.imageUrl)} alt={item.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e1e8da' }} />
                        ) : (
                          <span className="product-avatar"><Icon name="box" /></span>
                        )}
                        <div>
                          <strong>{item.name}</strong>
                          <small>Mã SP #{String(item.id).padStart(4, '0')}</small>
                        </div>
                      </div>
                    </td>
                    <td><strong className="quantity-number">{item.stockQty}</strong></td>
                    <td><span className="unit-label">{item.packaging}</span></td>
                    <td>{item.wholesalePrice.toLocaleString('vi-VN')} ₫</td>
                    <td>
                      <button className="edit-product" disabled={saving} aria-label={`Sửa ${item.name}`} onClick={() => edit(item)}>Chỉnh sửa ↗</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </section>

        <dialog ref={editor} aria-label={editing === null ? 'Thêm sản phẩm mới' : 'Chỉnh sửa sản phẩm'} className="inventory-dialog" onCancel={(event) => { if (saving) event.preventDefault(); }}>
          <div className="dialog-heading">
            <span className="product-avatar"><Icon name="box" /></span>
            <div>
              <span className="section-kicker">KHO HÀNG VỰA</span>
              <h2>{editing === null ? 'Thêm sản phẩm mới' : 'Chỉnh sửa sản phẩm'}</h2>
            </div>
            <button disabled={saving} className="dialog-close" aria-label="Đóng form sản phẩm" onClick={() => editor.current?.close()}>×</button>
          </div>
          <form className="inventory-form" onSubmit={save}>
            <label className="supplier-field supplier-field-full" style={{ marginBottom: '16px' }}>Danh mục
    <select required value={form.category} disabled={saving} onChange={(e) => setForm({ ...form, category: e.target.value })}>
      <option value="Đồ uống">Đồ uống</option>
      <option value="Thực phẩm">Thực phẩm</option>
      <option value="Gia vị">Gia vị</option>
      <option value="Hóa phẩm">Hóa phẩm</option>
      <option value="Chăm sóc cá nhân">Chăm sóc cá nhân</option>
      <option value="Khác">Khác</option>
    </select>
  </label>
  <label className="inventory-name">Tên sản phẩm
              <input required minLength={2} maxLength={150} value={form.name} disabled={saving} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Nước ngọt Coca Cola 330ml" />
            </label>
            
            <label className="supplier-field supplier-field-full" style={{ marginBottom: '16px' }}>Ảnh sản phẩm trong kho
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" value={form.imageUrl} disabled={saving} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="Dán link ảnh hoặc tải ảnh từ máy..." style={{ flex: 1, minWidth: 0, padding: '12px', border: '1px solid #cddbd1', borderRadius: '10px' }} />
                <label style={{ cursor: 'pointer', background: '#eef4e9', border: '1px solid #d6e3d8', padding: '0 16px', borderRadius: '10px', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#173e2d', display: 'flex', alignItems: 'center' }}>
                  + Tải ảnh lên
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      processAndStoreImage(file).then(key => setForm({ ...form, imageUrl: key }));
                    }
                  }} disabled={saving} />
                </label>
              </div>
            </label>

            <label>Quy cách bán
              <input required maxLength={50} value={form.packaging} disabled={saving} onChange={(e) => setForm({ ...form, packaging: e.target.value })} placeholder="Thùng 24 lon, bao 25kg…" />
            </label>
            <label>Số lượng tồn
              <input required type="number" min="0" max="2147483647" step="1" value={form.stockQty} disabled={saving} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} />
            </label>
            <label>Giá sỉ (₫)
              <input required type="number" min="0.01" max="1000000000" step="0.01" placeholder="Nhập giá" value={form.wholesalePrice} disabled={saving} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} />
            </label>
            <label>Mua tối thiểu (MOQ)
              <input required type="number" min="1" step="1" placeholder="MOQ" value={form.moq} disabled={saving} onChange={(e) => setForm({ ...form, moq: e.target.value })} />
            </label>
            {error && <p className="error-notice inventory-name" role="alert">{error}</p>}
            <div className="inventory-actions">
              <button className="secondary-button" type="button" disabled={saving} onClick={() => editor.current?.close()}>Hủy</button>
              <button className="dash-primary" disabled={saving}>{saving ? 'Đang lưu…' : editing === null ? '＋ Thêm vào kho' : 'Lưu thay đổi'}</button>
            </div>
          </form>
        </dialog>
      </section>
    </main>
  );
}
