import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import SupplierLayout from '../../components/SupplierLayout';
import type { AuthUser } from '../../types/auth';
import { PRODUCT_CATEGORIES } from '../../services/catalog.api';
import { getApiError, getApiFieldErrors, isUnauthenticated } from '../../services/api';
import {
  createSupplierProduct,
  createSupplierProductsBatch,
  getSupplierDashboard,
  quickVerifySupplier,
  updateSupplierProduct,
  uploadSupplierProductImage,
  type SupplierProduct,
  type SupplierProductInput,
  type SupplierProfile,
} from '../../services/supplier.api';
import '../../pages/catalog.css';

type PackagingType = 'Thùng' | 'Lốc' | 'Két' | 'Bao' | 'Hộp' | 'Đơn vị lẻ' | 'Khác';

interface PackagingOption {
  type: PackagingType;
  label: string;
  defaultQty: number;
  defaultUnit: string;
  units: string[];
}

const PACKAGING_OPTIONS: PackagingOption[] = [
  {
    type: 'Thùng',
    label: 'Thùng (mặc định 24)',
    defaultQty: 24,
    defaultUnit: 'lon',
    units: ['lon', 'gói', 'chai', 'hộp', 'bịch', 'ly'],
  },
  {
    type: 'Lốc',
    label: 'Lốc (mặc định 6 hoặc 12)',
    defaultQty: 6,
    defaultUnit: 'lon',
    units: ['lon', 'chai', 'hộp', 'ly', 'gói'],
  },
  {
    type: 'Két',
    label: 'Két (mặc định 24 chai)',
    defaultQty: 24,
    defaultUnit: 'chai',
    units: ['chai', 'lon'],
  },
  {
    type: 'Bao',
    label: 'Bao (mặc định 50kg)',
    defaultQty: 50,
    defaultUnit: 'kg',
    units: ['kg', 'gói', 'bao nhỏ', 'bịch'],
  },
  {
    type: 'Hộp',
    label: 'Hộp / Vỉ (mặc định 10)',
    defaultQty: 10,
    defaultUnit: 'gói',
    units: ['gói', 'vỉ', 'cái', 'túi', 'thanh'],
  },
  {
    type: 'Đơn vị lẻ',
    label: 'Bán lẻ (1 đơn vị)',
    defaultQty: 1,
    defaultUnit: 'chai',
    units: ['chai', 'lon', 'gói', 'hộp', 'cái', 'kg', 'bịch'],
  },
  {
    type: 'Khác',
    label: 'Tùy chỉnh khác…',
    defaultQty: 0,
    defaultUnit: '',
    units: [],
  },
];

function parsePackaging(text: string): {
  type: PackagingType;
  qtyInput: string;
  unit: string;
  customText: string;
} {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return { type: 'Thùng', qtyInput: '24', unit: 'lon', customText: '' };
  }
  const match = trimmed.match(/^(Thùng|Lốc|Két|Bao|Hộp)\s+(\d+)\s*(.*)$/i);
  if (match) {
    const rawType = match[1];
    const type = (rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase()) as PackagingType;
    const qtyInput = match[2] || '24';
    const unit = match[3]?.trim().toLowerCase() || 'lon';
    return { type, qtyInput, unit, customText: trimmed };
  }
  const singleUnits = ['chai', 'lon', 'gói', 'hộp', 'cái', 'kg', 'bịch'];
  const matchedUnit = singleUnits.find((u) => u === trimmed.toLowerCase());
  if (matchedUnit) {
    return { type: 'Đơn vị lẻ', qtyInput: '1', unit: matchedUnit, customText: trimmed };
  }
  return { type: 'Khác', qtyInput: '', unit: '', customText: trimmed };
}

function validatePackQty(val: string): string | null {
  const trimmed = (val ?? '').trim();
  if (!trimmed) {
    return 'Vui lòng nhập số lượng quy cách.';
  }
  if (trimmed.includes('.') || trimmed.includes(',')) {
    return 'Số lượng phải là số nguyên, không được là số thập phân.';
  }
  if (trimmed.startsWith('-') || Number(trimmed) < 0) {
    return 'Số lượng không được là số âm.';
  }
  if (!/^\d+$/.test(trimmed)) {
    return 'Số lượng chỉ được chứa chữ số nguyên, không chứa ký tự khác.';
  }
  const num = parseInt(trimmed, 10);
  if (num === 0) {
    return 'Số lượng quy cách phải lớn hơn 0.';
  }
  if (num > 100) {
    return 'Số lượng đóng gói trong quy cách không được vượt quá 100.';
  }
  return null;
}

const empty: SupplierProductInput = {
  category: 'Khác',
  imageUrl: null,
  name: '',
  packaging: 'Thùng 24 lon',
  wholesalePrice: 0,
  stockQty: 0,
  moq: 1,
  isActive: true,
  priceChangeReason: '',
};
const money = (value: number) => value.toLocaleString('vi-VN') + ' ₫';
const PAGE_SIZE = 10;

export default function SupplierProducts({ user, onLogout }: { user?: AuthUser; onLogout: () => void }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fields, setFields] = useState<Partial<Record<keyof SupplierProductInput, string>>>({});
  const [form, setForm] = useState(empty);
  const [packState, setPackState] = useState(() => parsePackaging('Thùng 24 lon'));
  const [packQtyError, setPackQtyError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedModeration, setSelectedModeration] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'DEFAULT' | 'NAME_ASC' | 'NAME_DESC'>('DEFAULT');

  // Filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempCategory, setTempCategory] = useState('ALL');
  const [tempModeration, setTempModeration] = useState('ALL');
  const [tempSort, setTempSort] = useState<'DEFAULT' | 'NAME_ASC' | 'NAME_DESC'>('DEFAULT');

  function openFilterModal() {
    setTempCategory(selectedCategory);
    setTempModeration(selectedModeration);
    setTempSort(sortOrder);
    setShowFilterModal(true);
  }
  const [editing, setEditing] = useState<SupplierProduct | null>(null);
  const [productEntryMode, setProductEntryMode] = useState<'SINGLE' | 'BATCH'>('SINGLE');
  const [batchRows, setBatchRows] = useState<Array<{
    key: string;
    name: string;
    category: string;
    packaging: string;
    wholesalePrice: string;
    stockQty: string;
    moq: string;
  }>>([
    {
      key: 'row_1',
      name: '',
      category: PRODUCT_CATEGORIES[0] || 'Đồ uống',
      packaging: 'Thùng 24 lon',
      wholesalePrice: '',
      stockQty: '100',
      moq: '1',
    },
    {
      key: 'row_2',
      name: '',
      category: PRODUCT_CATEGORIES[0] || 'Đồ uống',
      packaging: 'Thùng 24 chai',
      wholesalePrice: '',
      stockQty: '100',
      moq: '1',
    },
  ]);
  const [batchError, setBatchError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAddBatchRow() {
    setBatchRows((prev) => [
      ...prev,
      {
        key: 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: '',
        category: PRODUCT_CATEGORIES[0] || 'Đồ uống',
        packaging: 'Thùng 24 lon',
        wholesalePrice: '',
        stockQty: '100',
        moq: '1',
      },
    ]);
  }

  function handleAddBatchRowsQuick(count: number) {
    const newItems: Array<{
      key: string;
      name: string;
      category: string;
      packaging: string;
      wholesalePrice: string;
      stockQty: string;
      moq: string;
    }> = [];
    for (let i = 0; i < count; i++) {
      newItems.push({
        key: 'row_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 6),
        name: '',
        category: PRODUCT_CATEGORIES[0] || 'Đồ uống',
        packaging: 'Thùng 24 lon',
        wholesalePrice: '',
        stockQty: '100',
        moq: '1',
      });
    }
    setBatchRows((prev) => [...prev, ...newItems]);
  }

  function handleRemoveBatchRow(key: string) {
    setBatchRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  function handleBatchChange(key: string, field: 'name' | 'category' | 'packaging' | 'wholesalePrice' | 'stockQty' | 'moq', value: string) {
    setBatchRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  }

  async function handleSubmitBatch(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;

    const activeRows = batchRows.filter((r) => r.name.trim() !== '');
    if (activeRows.length === 0) {
      setBatchError('Vui lòng nhập tên cho ít nhất một mặt hàng.');
      return;
    }

    const validatedProducts: SupplierProductInput[] = [];
    for (let i = 0; i < activeRows.length; i++) {
      const r = activeRows[i];
      const name = r.name.trim();
      if (name.length < 2 || name.length > 150) {
        setBatchError(`Dòng ${i + 1} ("${name}"): Tên mặt hàng cần từ 2 đến 150 ký tự.`);
        return;
      }
      const packaging = r.packaging.trim();
      if (!packaging || packaging.length > 50) {
        setBatchError(`Dòng ${i + 1} ("${name}"): Quy cách đóng gói không được để trống (tối đa 50 ký tự).`);
        return;
      }
      const numbersInPackaging = packaging.match(/\d+/g);
      if (numbersInPackaging && numbersInPackaging.some((n) => Number(n) > 100)) {
        setBatchError(`Dòng ${i + 1} ("${name}"): Số lượng đơn vị trong quy cách đóng gói tối đa là 100.`);
        return;
      }
      const price = parseFloat(r.wholesalePrice);
      if (isNaN(price) || price <= 0 || price > 1000000000) {
        setBatchError(`Dòng ${i + 1} ("${name}"): Giá sỉ chưa hợp lệ (phải lớn hơn 0 và tối đa 1 tỷ đồng).`);
        return;
      }
      const stock = parseInt(r.stockQty, 10);
      if (isNaN(stock) || stock < 0 || stock > 50000) {
        setBatchError(`Dòng ${i + 1} ("${name}"): Tồn kho phải là số nguyên từ 0 đến 50.000.`);
        return;
      }
      const moq = parseInt(r.moq, 10);
      if (isNaN(moq) || moq < 1 || moq > 50000) {
        setBatchError(`Dòng ${i + 1} ("${name}"): Đặt tối thiểu (MOQ) phải từ 1 đến 50.000.`);
        return;
      }
      if (stock > 0 && moq > stock) {
        setBatchError(`Dòng ${i + 1} ("${name}"): MOQ (${moq}) không được lớn hơn tồn kho (${stock}).`);
        return;
      }
      validatedProducts.push({
        name,
        category: r.category,
        packaging,
        wholesalePrice: price,
        stockQty: stock,
        moq,
        imageUrl: null,
        isActive: true,
      });
    }

    lock.current = true;
    setBusy(true);
    setBatchError('');
    setError('');
    setNotice('');
    try {
      const createdProducts = await createSupplierProductsBatch(validatedProducts);
      setProducts((current) => [...createdProducts, ...current]);
      setNotice(`Đã đăng thành công ${createdProducts.length} mặt hàng lên gian hàng.`);
      setBatchRows([
        {
          key: 'row_' + Date.now(),
          name: '',
          category: PRODUCT_CATEGORIES[0] || 'Đồ uống',
          packaging: 'Thùng 24 lon',
          wholesalePrice: '',
          stockQty: '100',
          moq: '1',
        },
      ]);
    } catch (issue) {
      setBatchError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function handleQuickActivate() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const updatedProfile = await quickVerifySupplier();
      setProfile(updatedProfile);
      setNotice('Gian hàng đã được kích hoạt thành công! Tất cả sản phẩm đang mở bán hiện đã hiển thị trên Tìm nguồn sỉ.');
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function updatePackagingState(
    newType: PackagingType,
    newQtyInput?: string,
    newUnit?: string,
    custom?: string,
  ) {
    const opt = PACKAGING_OPTIONS.find((o) => o.type === newType);
    const qtyInput =
      newQtyInput !== undefined
        ? newQtyInput
        : opt?.defaultQty
          ? String(opt.defaultQty)
          : '24';
    const unit = newUnit !== undefined ? newUnit : (opt?.defaultUnit ?? 'lon');
    const customText = custom !== undefined ? custom : (packState.customText || '');

    let resultPackaging = '';
    if (newType === 'Khác') {
      resultPackaging = customText;
    } else if (newType === 'Đơn vị lẻ') {
      resultPackaging = unit.charAt(0).toUpperCase() + unit.slice(1);
    } else {
      const trimmedQty = qtyInput.trim();
      resultPackaging = trimmedQty
        ? `${newType} ${trimmedQty} ${unit}`.trim()
        : `${newType} ${unit}`.trim();
    }

    setPackState({
      type: newType,
      qtyInput,
      unit,
      customText,
    });
    setForm((prev) => ({ ...prev, packaging: resultPackaging }));

    if (newType !== 'Khác' && newType !== 'Đơn vị lẻ') {
      const err = validatePackQty(qtyInput);
      setPackQtyError(err);
    } else {
      setPackQtyError(null);
    }

    setFields((prev) => {
      const copy = { ...prev };
      delete copy.packaging;
      return copy;
    });
  }

  useEffect(() => {
    document.title = 'SupplyMind AI · Sản phẩm đăng bán';
    let active = true;
    getSupplierDashboard()
      .then((data) => {
        if (active) {
          if (!data.profile) {
            navigate('/supplier', { replace: true });
            return;
          }
          setProducts(data.products);
          setProfile(data.profile);
          setLoadError('');
        }
      })
      .catch((issue: unknown) => {
        if (active) {
          setLoadError(getApiError(issue));
          if (isUnauthenticated(issue)) onLogout();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onLogout, revision]);

  function remember(saved: SupplierProduct) {
    setProducts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setPage(1);
  }
  function edit(item: SupplierProduct) {
    setProductEntryMode('SINGLE');
    setEditing(item);
    setForm({
      category: item.category,
      imageUrl: item.imageUrl,
      name: item.name,
      packaging: item.packaging,
      wholesalePrice: item.wholesalePrice,
      stockQty: item.stockQty,
      moq: item.moq,
      isActive: item.isActive,
      priceChangeReason: '',
    });
    setPackState(parsePackaging(item.packaging));
    setPackQtyError(null);
    setFields({});
    setError('');
    setNotice('');
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    nameInput.current?.focus();
  }
  function cancel() {
    setEditing(null);
    setForm(empty);
    setPackState(parsePackaging('Thùng 24 lon'));
    setPackQtyError(null);
    setFields({});
    setError('');
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Chỉ hỗ trợ file ảnh (JPG, PNG, WEBP, GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Kích thước ảnh tối đa là 5MB.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const url = await uploadSupplierProductImage(file);
      setForm((current) => ({ ...current, imageUrl: url }));
      setFields((current) => {
        const copy = { ...current };
        delete copy.imageUrl;
        return copy;
      });
    } catch (issue) {
      setUploadError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleRemoveImage() {
    setForm((current) => ({ ...current, imageUrl: null }));
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setFields({});

    if (packState.type !== 'Khác' && packState.type !== 'Đơn vị lẻ') {
      const qtyErr = validatePackQty(packState.qtyInput);
      if (qtyErr) {
        setPackQtyError(qtyErr);
        setFields((f) => ({ ...f, packaging: qtyErr }));
        lock.current = false;
        setBusy(false);
        return;
      }
    }

    if (!form.packaging || !form.packaging.trim()) {
      setFields((f) => ({ ...f, packaging: 'Vui lòng chọn hoặc nhập quy cách đóng gói.' }));
      lock.current = false;
      setBusy(false);
      return;
    }
    if (form.stockQty < 0 || form.stockQty > 50000) {
      setFields((f) => ({ ...f, stockQty: 'Tồn kho phải là số nguyên từ 0 đến 50.000.' }));
      lock.current = false;
      setBusy(false);
      return;
    }
    if (form.moq < 1 || form.moq > 50000) {
      setFields((f) => ({ ...f, moq: 'MOQ phải là số nguyên từ 1 đến 50.000.' }));
      lock.current = false;
      setBusy(false);
      return;
    }
    if (form.stockQty > 0 && form.moq > form.stockQty) {
      setFields((f) => ({
        ...f,
        moq: `Số lượng tối thiểu (MOQ: ${form.moq}) không được lớn hơn tồn kho có sẵn (${form.stockQty}).`,
      }));
      lock.current = false;
      setBusy(false);
      return;
    }

    try {
      const saved = editing
        ? await updateSupplierProduct(editing.id, form, editing.updatedAt)
        : await createSupplierProduct(form);
      remember(saved);
      cancel();
      if (saved.moderation?.status === 'AUTO_REJECTED') {
        setNotice(
          'Bài đăng vi phạm nghiêm trọng (từ cấm hoặc nhiều lỗi) và đã bị AI cấm thẳng. Vui lòng bấm "Sửa sản phẩm" để chỉnh sửa hợp lệ.',
        );
      } else if (saved.moderation?.status === 'NEEDS_REVIEW') {
        setNotice(
          'Bài đăng có cảnh báo nhẹ (mặt hàng có điều kiện/giá lệch) và đang chờ Quản trị viên duyệt để mở bán.',
        );
      } else {
        setNotice(
          saved.isActive
            ? profile?.verificationStatus === 'APPROVED'
              ? 'Đã đăng bán trên Tìm nguồn sỉ.'
              : 'Đã lưu sản phẩm. Gian hàng cần được xác minh trước khi mở bán.'
            : 'Đã lưu sản phẩm ở trạng thái ẩn.',
        );
      }
    } catch (issue) {
      setError(getApiError(issue));
      setFields(
        getApiFieldErrors(issue, [
          'name',
          'packaging',
          'wholesalePrice',
          'stockQty',
          'moq',
          'isActive',
          'category',
          'imageUrl',
          'priceChangeReason',
        ]),
      );
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function toggle(item: SupplierProduct) {
    if (lock.current) return;
    const isViolated = item.moderation?.status === 'AUTO_REJECTED' || item.moderation?.status === 'NEEDS_REVIEW' || item.moderation?.status === 'FLAGGED';
    if (isViolated && !item.isActive) {
      const msg = item.moderation?.status === 'AUTO_REJECTED'
        ? 'Sản phẩm vi phạm nghiêm trọng và đã bị AI cấm thẳng. Vui lòng bấm "Sửa sản phẩm" để chỉnh sửa nội dung hợp lệ.'
        : 'Sản phẩm đang chờ Quản trị viên duyệt (' + (item.moderation?.reasons?.join(', ') || 'Cảnh báo nhẹ') + '). Vui lòng chờ duyệt hoặc sửa thông tin.';
      setError(msg);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await updateSupplierProduct(
        item.id,
        {
          category: item.category,
          imageUrl: item.imageUrl,
          name: item.name,
          packaging: item.packaging,
          wholesalePrice: item.wholesalePrice,
          stockQty: item.stockQty,
          moq: item.moq,
          isActive: !item.isActive,
        },
        item.updatedAt,
      );
      remember(saved);
      setNotice(
        saved.isActive
          ? profile?.verificationStatus === 'APPROVED'
            ? 'Đã đăng lại sản phẩm cho chủ tạp hóa xem.'
            : 'Đã lưu. Chờ gian hàng được xác minh để mở bán.'
          : 'Đã ẩn sản phẩm khỏi Tìm nguồn sỉ.',
      );
    } catch (issue) {
      setError(getApiError(issue));
      if (isUnauthenticated(issue)) onLogout();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const filteredProducts = useMemo(() => {
    let list = [...products];

    // 1. Filter by category
    if (selectedCategory !== 'ALL') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // 2. Filter by moderation status
    if (selectedModeration !== 'ALL') {
      if (selectedModeration === 'AUTO_APPROVED') {
        list = list.filter((p) => p.moderation?.status === 'AUTO_APPROVED' || !p.moderation);
      } else if (selectedModeration === 'NEEDS_REVIEW') {
        list = list.filter(
          (p) => p.moderation?.status === 'NEEDS_REVIEW' || p.moderation?.status === 'FLAGGED',
        );
      } else if (selectedModeration === 'AUTO_REJECTED') {
        list = list.filter((p) => p.moderation?.status === 'AUTO_REJECTED');
      }
    }

    // 3. Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.packaging.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }

    // 4. Sort
    if (sortOrder === 'NAME_ASC') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
    } else if (sortOrder === 'NAME_DESC') {
      list.sort((a, b) => b.name.localeCompare(a.name, 'vi', { sensitivity: 'base' }));
    }

    return list;
  }, [products, selectedCategory, selectedModeration, searchQuery, sortOrder]);

  const activeFilterCount =
    (selectedCategory !== 'ALL' ? 1 : 0) +
    (selectedModeration !== 'ALL' ? 1 : 0) +
    (sortOrder !== 'DEFAULT' ? 1 : 0);

  const successPublishedCount = useMemo(() => {
    return products.filter((item) => {
      const isViolated =
        item.moderation?.status === 'AUTO_REJECTED' ||
        item.moderation?.status === 'NEEDS_REVIEW' ||
        item.moderation?.status === 'FLAGGED';
      return item.isActive && !isViolated;
    }).length;
  }, [products]);

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE) || 1;
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + PAGE_SIZE);

  const [prevCurrentPage, setPrevCurrentPage] = useState(currentPage);
  if (currentPage !== prevCurrentPage) {
    setPrevCurrentPage(currentPage);
    setPageInput(String(currentPage));
  }

  return (
    <SupplierLayout
      user={user || ({ id: 0, username: 'chuvua', name: 'Chủ vựa', role: 'SUPPLIER' } as AuthUser)}
      activeNav="products"
      onLogout={onLogout}
      businessName={profile?.businessName}
    >
      <div>
        <div className="supplier-heading">
          <div>
            <p className="form-eyebrow">GIAN HÀNG CỦA BẠN</p>
            <h1>Sản phẩm đăng bán</h1>
            <p className="form-description">
              Đưa nguồn hàng sỉ của {profile?.businessName || 'gian hàng'} đến các tiệm tạp hóa.
            </p>
          </div>
          <button
            className="ghost-button"
            disabled={loading || busy}
            onClick={() => {
              setLoading(true);
              setRevision((value) => value + 1);
            }}
          >
            Tải lại sản phẩm
          </button>
        </div>
        {loadError && (
          <p className="error-notice" role="alert">
            {loadError}
          </p>
        )}
        {loading ? (
          <p role="status">Đang tải gian hàng…</p>
        ) : !loadError && !profile ? (
          <section className="supplier-panel catalog-empty">
            <Icon name="store" />
            <h2>Thiết lập gian hàng trước khi đăng bán</h2>
            <p>Thêm tên vựa, địa chỉ kho và bán kính giao hàng để tiệm tạp hóa biết nguồn cung.</p>
            <Link className="primary-button catalog-link" to="/supplier">
              Thiết lập gian hàng
            </Link>
          </section>
        ) : (
          !loadError && (
            <>
              {notice && (
                <p className="supplier-success" role="status">
                  {notice}
                </p>
              )}
              {error && (
                <p className="error-notice" role="alert">
                  {error}
                </p>
              )}
              {profile && profile.verificationStatus !== 'APPROVED' && (
                <div
                  style={{
                    margin: '0 0 16px 0',
                    padding: '14px 18px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: '13px', color: '#92400e', lineHeight: 1.5 }}>
                    <strong>Gian hàng chưa kích hoạt mở bán:</strong> Các sản phẩm bạn đăng hiện chỉ lưu nội bộ và đang ẩn với các chủ tiệm tạp hóa trên trang "Tìm nguồn sỉ".
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleQuickActivate()}
                    disabled={busy}
                    style={{
                      padding: '7px 16px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 2px rgba(22, 163, 74, 0.25)',
                    }}
                  >
                    Kích hoạt mở bán ngay
                  </button>
                </div>
              )}
              <div className="publish-layout">
                <div className="supplier-panel publish-form">
                  {!editing && (
                    <div className="supplier-mode-tabs" role="tablist">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={productEntryMode === 'SINGLE'}
                        className={`supplier-mode-tab ${productEntryMode === 'SINGLE' ? 'active' : ''}`}
                        onClick={() => {
                          setProductEntryMode('SINGLE');
                          setBatchError('');
                        }}
                      >
                        Đăng từng mặt hàng
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={productEntryMode === 'BATCH'}
                        className={`supplier-mode-tab ${productEntryMode === 'BATCH' ? 'active' : ''}`}
                        onClick={() => {
                          setProductEntryMode('BATCH');
                          setBatchError('');
                        }}
                      >
                        Đăng nhiều mặt hàng cùng lúc
                      </button>
                    </div>
                  )}

                  {productEntryMode === 'SINGLE' || editing ? (
                    <form onSubmit={save}>
                      <div className="supplier-panel-title">
                        <div>
                          <span className="supplier-panel-label">
                            {editing ? 'CẬP NHẬT' : 'THÊM MẶT HÀNG'}
                          </span>
                          <h2>{editing ? 'Sửa sản phẩm' : 'Đăng sản phẩm mới'}</h2>
                        </div>
                        <Icon name="box" />
                      </div>
                      <div className="supplier-form-grid">
                        <label className="supplier-field supplier-field-full">
                          Danh mục
                          <select
                            value={form.category}
                            disabled={busy}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                          >
                            {PRODUCT_CATEGORIES.map((category) => (
                              <option key={category}>{category}</option>
                            ))}
                          </select>
                        </label>
                        <div className="supplier-field supplier-field-full">
                          <span>Ảnh sản phẩm (không bắt buộc)</span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            disabled={busy || uploading}
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                          />
                          {form.imageUrl ? (
                            <div className="image-upload-preview">
                              <img src={form.imageUrl} alt="Ảnh sản phẩm" />
                              <div className="image-upload-info">
                                <span className="image-upload-status">Đã tải ảnh lên</span>
                                <div className="image-upload-actions">
                                  <button
                                    type="button"
                                    className="ghost-button"
                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                    disabled={busy || uploading}
                                    onClick={() => fileInputRef.current?.click()}
                                  >
                                    {uploading ? 'Đang tải…' : 'Đổi ảnh khác'}
                                  </button>
                                  <button
                                    type="button"
                                    className="danger-text"
                                    disabled={busy || uploading}
                                    onClick={handleRemoveImage}
                                  >
                                    Xóa ảnh
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`image-upload-zone ${uploading ? 'uploading' : ''}`}
                              onClick={() => !busy && !uploading && fileInputRef.current?.click()}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  fileInputRef.current?.click();
                                }
                              }}
                            >
                              <Icon name="box" />
                              <div>
                                <strong>
                                  {uploading ? 'Đang tải ảnh lên…' : 'Bấm để tải ảnh sản phẩm lên'}
                                </strong>
                                <p className="catalog-hint">Hỗ trợ JPG, PNG, WEBP, GIF tối đa 5MB</p>
                              </div>
                            </div>
                          )}
                          {uploadError && (
                            <small
                              className="error-notice"
                              style={{ marginTop: '6px', display: 'block' }}
                            >
                              {uploadError}
                            </small>
                          )}
                          {fields.imageUrl && <small>{fields.imageUrl}</small>}
                        </div>
                        <label className="supplier-field supplier-field-full">
                          Tên sản phẩm
                          <input
                            ref={nameInput}
                            required
                            minLength={2}
                            maxLength={150}
                            value={form.name}
                            disabled={busy}
                            onChange={(event) => setForm({ ...form, name: event.target.value })}
                            placeholder="Nước ngọt Coca Cola 330ml"
                          />
                          {fields.name && <small>{fields.name}</small>}
                        </label>
                        <div className="supplier-field supplier-field-full">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span>Quy cách / đơn vị bán</span>
                            <span style={{ fontSize: '11px', color: '#275235', background: '#eaf4e6', padding: '2px 8px', borderRadius: '10px' }}>
                              Áp dụng: <strong>{form.packaging || '(Chưa xác định)'}</strong>
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: packState.type === 'Khác' ? '1fr' : packState.type === 'Đơn vị lẻ' ? '1.2fr 1fr' : '1.3fr 0.9fr 1fr', gap: '8px' }}>
                            <div>
                              <select
                                value={packState.type}
                                disabled={busy}
                                onChange={(e) => updatePackagingState(e.target.value as PackagingType)}
                              >
                                {PACKAGING_OPTIONS.map((opt) => (
                                  <option key={opt.type} value={opt.type}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {packState.type !== 'Khác' && packState.type !== 'Đơn vị lẻ' && (
                              <div>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={packState.qtyInput}
                                  disabled={busy}
                                  placeholder="Nhập số lượng…"
                                  onChange={(e) => {
                                    updatePackagingState(packState.type, e.target.value, packState.unit);
                                  }}
                                  title="Số lượng trong 1 quy cách đóng gói (tối đa 100)"
                                />
                              </div>
                            )}
                            {packState.type !== 'Khác' && (
                              <div>
                                <select
                                  value={packState.unit}
                                  disabled={busy}
                                  onChange={(e) => updatePackagingState(packState.type, packState.qtyInput, e.target.value)}
                                >
                                  {(PACKAGING_OPTIONS.find((o) => o.type === packState.type)?.units || ['lon', 'gói', 'chai', 'hộp', 'kg']).map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {packState.type === 'Khác' && (
                              <div>
                                <input
                                  required
                                  maxLength={50}
                                  value={packState.customText}
                                  disabled={busy}
                                  placeholder="Nhập quy cách tự do (VD: Kiện 100 cái, Bịch 50 gói…)"
                                  onChange={(e) => updatePackagingState('Khác', '', '', e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                          <small style={{ color: '#687d5a', fontSize: '11px', marginTop: '1px' }}>
                            {packState.type === 'Khác'
                              ? 'Nhập quy cách tùy chỉnh (tối đa 50 ký tự, số lượng bên trong không vượt quá 100).'
                              : `Chọn kiểu đóng gói và tùy chỉnh số lượng / đơn vị bên trong (tối đa 100 ${packState.unit || 'đơn vị'}).`}
                          </small>
                          {(packQtyError || fields.packaging) && (
                            <small style={{ color: '#c65449', fontWeight: 600 }}>
                              {packQtyError || fields.packaging}
                            </small>
                          )}
                        </div>
                        <label className="supplier-field supplier-field-full">
                          Giá sỉ mỗi đơn vị (VNĐ)
                          <input
                            required
                            type="number"
                            min="0.01"
                            max="1000000000"
                            step="0.01"
                            value={form.wholesalePrice || ''}
                            disabled={busy}
                            onChange={(event) =>
                              setForm({ ...form, wholesalePrice: Number(event.target.value) })
                            }
                            placeholder="180000"
                          />
                          {fields.wholesalePrice && <small>{fields.wholesalePrice}</small>}
                        </label>
                        {editing && form.wholesalePrice !== editing.wholesalePrice && (
                          <label className="supplier-field supplier-field-full">
                            Lý do thay đổi giá
                            <textarea
                              required
                              minLength={3}
                              maxLength={500}
                              rows={3}
                              value={form.priceChangeReason || ''}
                              disabled={busy}
                              onChange={(event) =>
                                setForm({ ...form, priceChangeReason: event.target.value })
                              }
                              placeholder="Ví dụ: giá nhập tăng gần dịp lễ, chi phí vận chuyển tăng…"
                            />
                            <small>
                              Thông tin này sẽ hiển thị cho chủ tạp hóa để họ cân nhắc trước khi đặt.
                            </small>
                            {fields.priceChangeReason && <small>{fields.priceChangeReason}</small>}
                          </label>
                        )}
                        <label className="supplier-field">
                          Số lượng tồn kho
                          <input
                            required
                            type="number"
                            min="0"
                            max="50000"
                            step="1"
                            value={form.stockQty}
                            disabled={busy}
                            onChange={(event) =>
                              setForm({ ...form, stockQty: Number(event.target.value) })
                            }
                          />
                          <small style={{ color: '#7a8e7e' }}>Tối đa 50.000 (theo quy cách bán).</small>
                          {fields.stockQty && <small style={{ color: '#c65449', fontWeight: 600 }}>{fields.stockQty}</small>}
                        </label>
                        <label className="supplier-field">
                          Đặt tối thiểu (MOQ)
                          <input
                            required
                            type="number"
                            min="1"
                            max={form.stockQty > 0 ? form.stockQty : 50000}
                            step="1"
                            value={form.moq}
                            disabled={busy}
                            onChange={(event) => setForm({ ...form, moq: Number(event.target.value) })}
                          />
                          <small style={{ color: '#7a8e7e' }}>
                            Mặc định 1 (người mua có thể mua lẻ từ 1 đơn vị, tối đa theo tồn kho).
                          </small>
                          {fields.moq && <small style={{ color: '#c65449', fontWeight: 600 }}>{fields.moq}</small>}
                        </label>
                        <label className="publish-checkbox">
                          <input
                            type="checkbox"
                            checked={form.isActive}
                            disabled={busy}
                            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                          />
                          <span>Mở bán sau khi gian hàng được xác minh</span>
                        </label>
                      </div>
                      <p className="catalog-hint">
                        Giá, tồn kho và MOQ tính theo quy cách bán đã nhập. Bỏ chọn hiển thị để lưu sản
                        phẩm ở trạng thái ẩn.
                      </p>
                      <div className="product-form-actions">
                        <button className="primary-button" disabled={busy || uploading}>
                          {busy
                            ? 'Đang lưu…'
                            : editing
                              ? 'Lưu thay đổi'
                              : form.isActive
                                ? 'Đăng bán sản phẩm'
                                : 'Lưu sản phẩm ẩn'}
                        </button>
                        {editing && (
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={busy || uploading}
                            onClick={cancel}
                          >
                            Hủy sửa
                          </button>
                        )}
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleSubmitBatch}>
                      <div className="supplier-panel-title">
                        <div>
                          <span className="supplier-panel-label">ĐĂNG HÀNG LOẠT</span>
                          <h2>Đăng nhiều mặt hàng cùng lúc</h2>
                        </div>
                        <Icon name="box" />
                      </div>
                      <p className="form-description" style={{ fontSize: '12px', margin: '4px 0 14px' }}>
                        Nhập nhanh danh sách các mặt hàng bạn muốn đăng bán. Hệ thống sẽ tự động tạo và kiểm duyệt toàn bộ cùng lúc.
                      </p>

                      {batchError && (
                        <p className="error-notice" role="alert" style={{ marginBottom: '14px' }}>
                          {batchError}
                        </p>
                      )}

                      <div className="batch-items-container">
                        {batchRows.map((row, idx) => (
                          <div key={row.key} className="batch-item-card">
                            <div className="batch-item-header">
                              <strong>Mặt hàng #{idx + 1}</strong>
                              {batchRows.length > 1 && (
                                <button
                                  type="button"
                                  className="batch-item-remove"
                                  onClick={() => handleRemoveBatchRow(row.key)}
                                >
                                  Xóa dòng
                                </button>
                              )}
                            </div>
                            <div className="supplier-form-grid">
                              <label className="supplier-field supplier-field-full">
                                Tên sản phẩm *
                                <input
                                  required
                                  type="text"
                                  maxLength={150}
                                  value={row.name}
                                  disabled={busy}
                                  onChange={(e) => handleBatchChange(row.key, 'name', e.target.value)}
                                  placeholder="Ví dụ: Nước ngọt Sprite 330ml, Mì Hảo Hảo tôm chua cay…"
                                />
                              </label>
                              <label className="supplier-field">
                                Danh mục
                                <select
                                  value={row.category}
                                  disabled={busy}
                                  onChange={(e) => handleBatchChange(row.key, 'category', e.target.value)}
                                >
                                  {PRODUCT_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="supplier-field">
                                Quy cách đóng gói *
                                <input
                                  required
                                  type="text"
                                  maxLength={50}
                                  value={row.packaging}
                                  disabled={busy}
                                  onChange={(e) => handleBatchChange(row.key, 'packaging', e.target.value)}
                                  placeholder="Thùng 24 lon, Két 24 chai, Bao 50kg…"
                                />
                              </label>
                              <div className="supplier-field supplier-field-full batch-quick-grid">
                                <label className="supplier-field">
                                  Giá sỉ (₫) *
                                  <input
                                    required
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={row.wholesalePrice}
                                    disabled={busy}
                                    onChange={(e) => handleBatchChange(row.key, 'wholesalePrice', e.target.value)}
                                    placeholder="Ví dụ: 250000"
                                  />
                                </label>
                                <label className="supplier-field">
                                  Tồn kho *
                                  <input
                                    required
                                    type="number"
                                    min="0"
                                    max="50000"
                                    step="1"
                                    value={row.stockQty}
                                    disabled={busy}
                                    onChange={(e) => handleBatchChange(row.key, 'stockQty', e.target.value)}
                                    placeholder="100"
                                  />
                                </label>
                                <label className="supplier-field">
                                  Đặt tối thiểu (MOQ) *
                                  <input
                                    required
                                    type="number"
                                    min="1"
                                    max="50000"
                                    step="1"
                                    value={row.moq}
                                    disabled={busy}
                                    onChange={(e) => handleBatchChange(row.key, 'moq', e.target.value)}
                                    placeholder="1"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', margin: '12px 0 16px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="ghost-button"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                          disabled={busy}
                          onClick={handleAddBatchRow}
                        >
                          + Thêm dòng mặt hàng
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                          disabled={busy}
                          onClick={() => handleAddBatchRowsQuick(3)}
                        >
                          + Thêm nhanh 3 dòng
                        </button>
                      </div>

                      <div className="product-form-actions">
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={busy}
                        >
                          {busy
                            ? 'Đang tạo danh sách…'
                            : `Đăng ${batchRows.filter((r) => r.name.trim()).length || batchRows.length} mặt hàng lên gian hàng`}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
                <section aria-label="Sản phẩm của gian hàng" className="publish-list">
                  <div className="supplier-panel-title" style={{ alignItems: 'center' }}>
                    <div>
                      <span className="supplier-panel-label">DANH MỤC CỦA BẠN</span>
                      <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '4px 0 2px', color: '#1a3d2b' }}>
                        {products.length} sản phẩm
                      </h2>
                    </div>
                    <span
                      className="supplier-count"
                      style={{
                        fontSize: '13px',
                        padding: '6px 14px',
                        background: '#eef6eb',
                        color: '#2b6538',
                        borderRadius: '20px',
                        fontWeight: 600,
                      }}
                    >
                      {successPublishedCount} đang hiển thị
                    </span>
                  </div>

                  {products.length > 0 && (
                    <div style={{ marginBottom: '18px' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: '10px',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setPage(1);
                            }}
                            placeholder="Tìm theo tên, quy cách…"
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              fontSize: '13px',
                              border: '1px solid #dce5da',
                              borderRadius: '10px',
                              background: '#fff',
                            }}
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                setPage(1);
                              }}
                              style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: '#8b9a8e',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '2px 6px',
                              }}
                              title="Xóa tìm kiếm"
                            >
                              ×
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          className="ghost-button"
                          onClick={openFilterModal}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            padding: '9px 15px',
                            fontSize: '13px',
                            fontWeight: 600,
                            borderRadius: '10px',
                            background: activeFilterCount > 0 ? '#eaf5e7' : '#fff',
                            borderColor: activeFilterCount > 0 ? '#3f784a' : '#dce5da',
                            color: activeFilterCount > 0 ? '#20512c' : '#45594b',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          title="Lọc theo danh mục, mức độ kiểm duyệt, sắp xếp"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                          </svg>
                          <span>Bộ lọc</span>
                          {activeFilterCount > 0 && (
                            <span
                              style={{
                                background: '#2b6538',
                                color: '#fff',
                                fontSize: '11px',
                                borderRadius: '12px',
                                padding: '1px 6px',
                                fontWeight: 700,
                              }}
                            >
                              {activeFilterCount}
                            </span>
                          )}
                        </button>
                      </div>

                      {activeFilterCount > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                            marginTop: '10px',
                            fontSize: '12px',
                          }}
                        >
                          <span style={{ color: '#768779', fontSize: '11px' }}>Đang lọc:</span>
                          {selectedCategory !== 'ALL' && (
                            <span
                              style={{
                                background: '#eaf3e8',
                                color: '#275734',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              Danh mục: {selectedCategory}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCategory('ALL');
                                  setPage(1);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#275734',
                                  padding: 0,
                                }}
                                title="Bỏ lọc danh mục này"
                              >
                                ×
                              </button>
                            </span>
                          )}
                          {selectedModeration !== 'ALL' && (
                            <span
                              style={{
                                background: '#eaf3e8',
                                color: '#275734',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              Mức độ:{' '}
                              {selectedModeration === 'AUTO_APPROVED'
                                ? 'Đã duyệt'
                                : selectedModeration === 'NEEDS_REVIEW'
                                  ? 'Cần kiểm tra'
                                  : 'Vi phạm'}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedModeration('ALL');
                                  setPage(1);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#275734',
                                  padding: 0,
                                }}
                                title="Bỏ lọc mức độ này"
                              >
                                ×
                              </button>
                            </span>
                          )}
                          {sortOrder !== 'DEFAULT' && (
                            <span
                              style={{
                                background: '#eaf3e8',
                                color: '#275734',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              Sắp xếp: {sortOrder === 'NAME_ASC' ? 'A → Z' : 'Z → A'}
                              <button
                                type="button"
                                onClick={() => {
                                  setSortOrder('DEFAULT');
                                  setPage(1);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#275734',
                                  padding: 0,
                                }}
                                title="Bỏ sắp xếp"
                              >
                                ×
                              </button>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategory('ALL');
                              setSelectedModeration('ALL');
                              setSortOrder('DEFAULT');
                              setPage(1);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#c53030',
                              fontSize: '11px',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: 0,
                              marginLeft: '4px',
                            }}
                          >
                            Xóa tất cả
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!products.length && (
                    <div className="supplier-panel catalog-empty">
                      <Icon name="box" />
                      <h3>Bắt đầu với mặt hàng đầu tiên</h3>
                      <p>
                        Điền thông tin và bấm Đăng bán sản phẩm. Hàng sẽ xuất hiện bên chủ tạp hóa
                        khi gian hàng đã được xác minh.
                      </p>
                    </div>
                  )}

                  {products.length > 0 && filteredProducts.length === 0 && (
                    <div className="supplier-panel catalog-empty" style={{ padding: '32px 16px' }}>
                      <Icon name="box" />
                      <h3>Không tìm thấy sản phẩm phù hợp</h3>
                      <p>Không có sản phẩm nào khớp với từ khóa tìm kiếm hoặc danh mục đã chọn.</p>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory('ALL');
                          setSortOrder('DEFAULT');
                          setPage(1);
                        }}
                      >
                        Đặt lại bộ lọc
                      </button>
                    </div>
                  )}
                  {paginatedProducts.map((item) => (
                    <article
                      className="supplier-panel publish-item"
                      key={item.id}
                      aria-label={item.name}
                    >
                      <div className="publish-item-layout">
                        {item.imageUrl && (
                          <div className="publish-item-thumb">
                            <img src={item.imageUrl} alt={item.name} loading="lazy" />
                          </div>
                        )}
                        <div className="publish-item-body">
                          <div className="publish-item-heading">
                            <div>
                              <span className="supplier-panel-label">{item.packaging}</span>
                              <h3>{item.name}</h3>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {item.moderation?.status === 'AUTO_REJECTED' ? (
                                <span
                                  className="catalog-badge danger"
                                  style={{
                                    background: '#fce8e6',
                                    color: '#c5221f',
                                    border: '1px solid #fad2cf',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                  }}
                                >
                                  Vi phạm nghiêm trọng
                                </span>
                              ) : item.moderation?.status === 'NEEDS_REVIEW' ? (
                                <>
                                  <span
                                    className="catalog-badge muted"
                                    style={{
                                      background: '#f1f3f4',
                                      color: '#5f6368',
                                      fontSize: '11px',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                    }}
                                  >
                                    Tạm ẩn
                                  </span>
                                  <span
                                    className="catalog-badge warning"
                                    style={{
                                      background: '#fef7e0',
                                      color: '#b06000',
                                      border: '1px solid #feefc3',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                    }}
                                  >
                                    Chờ Admin duyệt
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className={`catalog-badge ${item.isActive ? '' : 'muted'}`}>
                                    {item.isActive
                                      ? profile?.verificationStatus === 'APPROVED'
                                        ? 'Đang hiển thị'
                                        : 'Chờ xác minh'
                                      : 'Đang ẩn'}
                                  </span>
                                  {item.moderation?.status === 'AUTO_APPROVED' && (
                                    <span
                                      className="catalog-badge success"
                                      style={{
                                        background: '#e6f4ea',
                                        color: '#137333',
                                        border: '1px solid #ceead6',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                      }}
                                    >
                                      AI Tự Động Duyệt
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <strong className="catalog-price">
                            {money(item.wholesalePrice)} <small>/ {item.packaging}</small>
                          </strong>
                          {item.previousPrice !== null && item.priceChangePercent !== null && (
                            <div
                              className={`price-history-note ${item.priceWarning ? 'warning' : ''}`}
                            >
                              <span>
                                {item.priceChangePercent > 0
                                  ? `Tăng ${item.priceChangePercent.toLocaleString('vi-VN')}%`
                                  : item.priceChangePercent < 0
                                    ? `Giảm ${Math.abs(item.priceChangePercent).toLocaleString('vi-VN')}%`
                                    : 'Không đổi'}{' '}
                                từ {money(item.previousPrice)}
                              </span>
                              {item.priceChangeReason && (
                                <small>Lý do: {item.priceChangeReason}</small>
                              )}
                            </div>
                          )}
                          {item.moderation?.reasons && item.moderation.reasons.length > 0 && (
                            <div style={{ fontSize: '12px', color: '#d93025', background: '#fce8e6', padding: '6px 10px', borderRadius: '6px', margin: '6px 0' }}>
                              <strong>Lý do AI cảnh báo:</strong> {item.moderation.reasons.join(' · ')}
                            </div>
                          )}
                          <p className="catalog-hint">
                            Tồn: {item.stockQty} · MOQ: {item.moq}{' '}
                            {item.stockQty === 0 ? '· Hết hàng' : ''}
                          </p>
                          <div className="publish-item-actions">
                            <button
                              className="ghost-button"
                              disabled={busy}
                              onClick={() => edit(item)}
                            >
                              Sửa sản phẩm
                            </button>
                            <button
                              className="ghost-button"
                              disabled={
                                busy ||
                                editing !== null ||
                                ((item.moderation?.status === 'AUTO_REJECTED' ||
                                  item.moderation?.status === 'NEEDS_REVIEW' ||
                                  item.moderation?.status === 'FLAGGED') &&
                                  !item.isActive)
                              }
                              onClick={() => void toggle(item)}
                              title={
                                item.moderation?.status === 'AUTO_REJECTED'
                                  ? 'Sản phẩm vi phạm nghiêm trọng và bị AI cấm thẳng. Bấm "Sửa sản phẩm" để chỉnh sửa.'
                                  : item.moderation?.status === 'NEEDS_REVIEW'
                                    ? 'Sản phẩm đang chờ Quản trị viên duyệt trước khi mở bán.'
                                    : undefined
                              }
                            >
                              {item.isActive ? 'Ẩn sản phẩm' : 'Đăng lại'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                  {filteredProducts.length > 0 && (
                    <div
                      className="catalog-pagination"
                      style={{
                        marginTop: '20px',
                        padding: '14px 18px',
                        background: '#fff',
                        borderRadius: '12px',
                        border: '1px solid #e5ebe2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <button
                        type="button"
                        className="ghost-button"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          fontSize: '13px',
                        }}
                        disabled={currentPage <= 1}
                        onClick={() => {
                          const target = Math.max(1, currentPage - 1);
                          setPage(target);
                          setPageInput(String(target));
                        }}
                        title="Trang trước"
                      >
                        <span style={{ fontSize: '15px', lineHeight: 1 }}>←</span> Trang trước
                      </button>

                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          color: '#55695b',
                        }}
                      >
                        <span>Trang</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={pageInput}
                          onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = parseInt(pageInput, 10);
                              if (!isNaN(val)) {
                                const clamped = Math.max(1, Math.min(totalPages, val));
                                setPage(clamped);
                                setPageInput(String(clamped));
                              } else {
                                setPageInput(String(currentPage));
                              }
                            }
                          }}
                          onBlur={() => {
                            const val = parseInt(pageInput, 10);
                            if (!isNaN(val)) {
                              const clamped = Math.max(1, Math.min(totalPages, val));
                              setPage(clamped);
                              setPageInput(String(clamped));
                            } else {
                              setPageInput(String(currentPage));
                            }
                          }}
                          style={{
                            width: '46px',
                            textAlign: 'center',
                            padding: '5px 4px',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#234739',
                            border: '1px solid #c8d7c4',
                            borderRadius: '7px',
                            background: '#f9fcf8',
                          }}
                          title="Nhập số trang và nhấn Enter để chuyển trang"
                        />
                        <span>/ {totalPages}</span>
                      </div>

                      <button
                        type="button"
                        className="ghost-button"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          fontSize: '13px',
                        }}
                        disabled={currentPage >= totalPages}
                        onClick={() => {
                          const target = Math.min(totalPages, currentPage + 1);
                          setPage(target);
                          setPageInput(String(target));
                        }}
                        title="Trang tiếp theo"
                      >
                        Trang sau <span style={{ fontSize: '15px', lineHeight: 1 }}>→</span>
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </>
          )
        )}
      </div>

      {showFilterModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 30, 20, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => setShowFilterModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 16px 40px rgba(20, 45, 30, 0.2)',
              overflow: 'hidden',
              border: '1px solid #e1e9dc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid #edf2e8',
                background: '#f9fbf8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2b6538"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <h3 style={{ margin: 0, fontSize: '17px', color: '#1a3d2b', fontWeight: 700 }}>
                  Bộ lọc & Sắp xếp sản phẩm
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  color: '#718376',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                }}
                title="Đóng"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'grid', gap: '18px' }}>
              {/* 1. Category */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '13px',
                    fontWeight: 650,
                    color: '#274b37',
                  }}
                >
                  Danh mục sản phẩm
                </label>
                <select
                  value={tempCategory}
                  onChange={(e) => setTempCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '9px',
                    border: '1px solid #dce5da',
                    fontSize: '13px',
                    background: '#fff',
                  }}
                >
                  <option value="ALL">Tất cả danh mục</option>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Moderation status */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '13px',
                    fontWeight: 650,
                    color: '#274b37',
                  }}
                >
                  Mức độ kiểm duyệt (AI & Pháp lý)
                </label>
                <select
                  value={tempModeration}
                  onChange={(e) => setTempModeration(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '9px',
                    border: '1px solid #dce5da',
                    fontSize: '13px',
                    background: '#fff',
                  }}
                >
                  <option value="ALL">Tất cả mức độ</option>
                  <option value="AUTO_APPROVED">Đã duyệt (AI Tự Động Duyệt - Hợp lệ)</option>
                  <option value="NEEDS_REVIEW">Cần kiểm tra (Chờ Admin duyệt - Cảnh báo nhẹ)</option>
                  <option value="AUTO_REJECTED">Vi phạm (Vi phạm nghiêm trọng - Đã cấm)</option>
                </select>
              </div>

              {/* 3. Sort Order */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '13px',
                    fontWeight: 650,
                    color: '#274b37',
                  }}
                >
                  Sắp xếp theo tên
                </label>
                <select
                  value={tempSort}
                  onChange={(e) => setTempSort(e.target.value as 'DEFAULT' | 'NAME_ASC' | 'NAME_DESC')}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '9px',
                    border: '1px solid #dce5da',
                    fontSize: '13px',
                    background: '#fff',
                  }}
                >
                  <option value="DEFAULT">Mới nhất (mặc định)</option>
                  <option value="NAME_ASC">Tên: A → Z (tăng dần)</option>
                  <option value="NAME_DESC">Tên: Z → A (giảm dần)</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                background: '#f9fbf8',
                borderTop: '1px solid #edf2e8',
              }}
            >
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setTempCategory('ALL');
                  setTempModeration('ALL');
                  setTempSort('DEFAULT');
                  setSelectedCategory('ALL');
                  setSelectedModeration('ALL');
                  setSortOrder('DEFAULT');
                  setPage(1);
                  setShowFilterModal(false);
                }}
                style={{ padding: '8px 14px', fontSize: '13px' }}
              >
                Đặt lại mặc định
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowFilterModal(false)}
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setSelectedCategory(tempCategory);
                    setSelectedModeration(tempModeration);
                    setSortOrder(tempSort);
                    setPage(1);
                    setShowFilterModal(false);
                  }}
                  style={{ padding: '8px 18px', fontSize: '13px' }}
                >
                  Áp dụng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SupplierLayout>
  );
}
