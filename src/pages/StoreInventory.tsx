import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, getApiError, isUnauthenticated } from '../services/api';
import './store-inventory.css';
import StockActivity from './StockActivity';
import StoreRevenue from './StoreRevenue';
import ProfilePage, { type StoreProfile, type Profile } from './ProfilePage';
import StoreOnboarding from '../components/StoreOnboarding';
import ContractSigningModal from '../components/ContractSigningModal';
import PartnerProfileEditModal from '../components/PartnerProfileEditModal';
import { getContractStatus } from '../services/contract.api';
import RestockPage from './RestockPage';
import SalesCalendar from './SalesCalendar';
import VoiceQuickSale from './VoiceQuickSale';
import StoreCatalog from './StoreCatalog';
import OrderList from '../components/OrderList';
import StoreQuotes from './StoreQuotes';
import SubscriptionPage from './SubscriptionPage';
import WalletPage from './wallet/WalletPage';
import TopbarBalance from '../components/TopbarBalance';
import Brand from '../components/Brand';
import Icon from '../components/Icon';
import DatePicker from '../components/DatePicker';
import ExportSalesDialog from '../components/ExportSalesDialog';
import InventoryImportDialog, {
  type InventoryImportDialogHandle,
} from '../components/InventoryImportDialog';
import OverviewRestockSuggestions from '../components/OverviewRestockSuggestions';
import TodayDeliveryAlert from '../components/TodayDeliveryAlert';
import type { SupplierOrder } from '../services/supplier.api';
import type { AuthUser } from '../types/auth';

type Item = {
  purchasePrice: number | null;
  sellingPrice: number | null;
  id: number;
  name: string;
  unit: string;
  quantity: number;
  lowThreshold: number;
  updatedAt: string;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
  expiryLabel: string;
  supplierName?: string | null;
  isConsignment?: boolean;
  settlementPrice?: number;
  autoRestock?: boolean;
  autoExchangeExpiry?: boolean;
  termsNote?: string | null;
  lots?: {
    id: number;
    quantity: number;
    receivedAt: string;
    expiryDate: string | null;
    purchasePrice: number | null;
    sourceOrderId?: number | null;
  }[];
};
type Message = { from: 'bot' | 'user'; text: string; time?: string };
const empty = {
  name: '',
  unit: 'lon',
  quantity: '0',
  purchasePrice: '',
  sellingPrice: '',
  expiryDate: '',
  supplierName: '',
};
// Hạn sử dụng hợp lệ phải nằm ở tương lai (tính theo giờ Việt Nam, UTC+7).
const vietnamDayIso = (date: Date) =>
  new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10);
const vietnamTomorrowIso = () => {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + 1);
  return vietnamDayIso(now);
};
const examples = [
  'Coca còn bao nhiêu?',
  'Hàng nào sắp hết hạn?',
  'Ngày nào nên nhập hàng?',
  'Cuối tuần nên nhập gì?',
];
const tabs = [
  { id: 'overview', label: 'Tổng quan', icon: 'store' },
  { id: 'quick-sale', label: 'Bán nhanh', icon: 'sparkle' },
  { id: 'inventory', label: 'Kho hàng', icon: 'box' },
  { id: 'catalog', label: 'Tìm nguồn sỉ', icon: 'store' },
  { id: 'quotes', label: 'Báo giá nhận được', icon: 'sparkle' },
  { id: 'orders', label: 'Đơn mua hàng', icon: 'box' },
  { id: 'wallet', label: 'Ví tiền', icon: 'chart' },
  { id: 'history', label: 'Lịch sử giao dịch', icon: 'check' },
  { id: 'revenue', label: 'Doanh thu', icon: 'chart' },
  { id: 'calendar', label: 'Lịch nhập dự kiến', icon: 'sparkle' },
  { id: 'restock', label: 'Kế hoạch nhập', icon: 'sparkle' },
  { id: 'subscription', label: 'Gói sử dụng', icon: 'shield' },
  { id: 'profile', label: 'Thông tin tiệm & Cá nhân', icon: 'user' },
] as const;
type StoreTab = (typeof tabs)[number]['id'];

export default function StoreInventory({
  user,
  onLogout,
  onSignOut,
  signingOut,
}: {
  user: AuthUser;
  onLogout: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user.name);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [checkingStore, setCheckingStore] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const [form, setForm] = useState(empty);
  const [pack, setPack] = useState('');
  const [unitsPerPack, setUnitsPerPack] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [expiryError, setExpiryError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selling, setSelling] = useState<Item | null>(null);
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [saleSaving, setSaleSaving] = useState(false);
  const saleDialog = useRef<HTMLDialogElement>(null);
  const importDialog = useRef<InventoryImportDialogHandle>(null);

  const [storeOrders, setStoreOrders] = useState<SupplierOrder[]>([]);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showPartnerEditModal, setShowPartnerEditModal] = useState(false);
  const [contractSigned, setContractSigned] = useState<boolean | null>(null);
  const [contractRefreshKey, setContractRefreshKey] = useState(0);

  const [revision, setRevision] = useState(0);
  const { '*': page = '' } = useParams();
  const activeTab = tabs.find((tab) => tab.id === (page || 'overview'))?.id;
  function setActiveTab(tab: StoreTab) {
    navigate(tab === 'overview' ? '/store' : `/store/${tab}`);
  }
  useEffect(() => {
    getContractStatus()
      .then((res) => setContractSigned(res.isSigned))
      .catch(() => { });
  }, [revision, contractRefreshKey]);

  useEffect(() => {
    let active = true;
    api
      .get<{ orders: SupplierOrder[] }>('/orders')
      .then(({ data }) => {
        if (active && Array.isArray(data.orders)) {
          setStoreOrders(data.orders);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [revision, activeTab]);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenu = useRef<HTMLElement>(null);
  const accountMenu = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLDialogElement>(null);
  const editVersion = useRef<string | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [quickDate, setQuickDate] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
  );
  const [quickCounts, setQuickCounts] = useState<Record<number, number>>({});
  const [quickSaving, setQuickSaving] = useState(false);
  const [exportSalesOpen, setExportSalesOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      from: 'bot',
      text: 'Chào bạn! Mình giúp tra cứu số lượng trong kho. Hãy hỏi tên sản phẩm hoặc xem những hàng sắp hết nhé.',
    },
  ]);
  const chatEnd = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!accountOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenu.current?.contains(event.target))
        setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        accountTrigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    document.title = `${tabs.find((tab) => tab.id === activeTab)?.label ?? 'Cửa hàng'} · SupplyMind AI`;
    return () => {
      document.title = 'SupplyMind AI';
    };
  }, [activeTab]);

  useEffect(() => {
    let active = true;
    api
      .get<{ items: Item[] }>('/inventory')
      .then(({ data }) => {
        if (active) setItems(data.items);
      })
      .catch((issue: unknown) => {
        if (active) {
          if (isUnauthenticated(issue)) onLogout();
          else setError(getApiError(issue));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onLogout]);

  useEffect(() => {
    let active = true;
    api
      .get<{ profile: Profile }>('/profile')
      .then(({ data }) => {
        if (active) {
          setStoreProfile(data.profile.storeProfile || null);
          if (data.profile.name) setDisplayName(data.profile.name);
        }
      })
      .catch((issue: unknown) => {
        if (active && isUnauthenticated(issue)) onLogout();
      })
      .finally(() => {
        if (active) setCheckingStore(false);
      });
    return () => {
      active = false;
    };
  }, [onLogout]);
  useEffect(() => {
    if (chatOpen) chatEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages, asking, chatOpen]);
  async function refresh() {
    setError('');
    setLoading(true);
    try {
      setItems((await api.get<{ items: Item[] }>('/inventory')).data.items);
      setRevision((value) => value + 1);
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setError(getApiError(issue));
    } finally {
      setLoading(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError('');
    setNotice('');
    // Khi thêm sản phẩm mới: hạn sử dụng bắt buộc có và phải là ngày tương lai.
    if (editing === null) {
      if (!form.expiryDate) {
        setExpiryError('Vui lòng nhập hạn sử dụng của sản phẩm.');
        return;
      }
      if (form.expiryDate < vietnamTomorrowIso()) {
        setExpiryError('Hạn sử dụng phải là ngày tương lai (từ ngày mai trở đi).');
        return;
      }
    }
    setExpiryError('');
    setSaving(true);
    try {
      const existingItem =
        editing === null
          ? items.find(
            (item) =>
              item.name.trim().localeCompare(form.name.trim(), 'vi', { sensitivity: 'base' }) ===
              0,
          )
          : undefined;
      const payload = {
        purchasePrice: form.purchasePrice === '' ? null : Number(form.purchasePrice),
        sellingPrice: form.sellingPrice === '' ? null : Number(form.sellingPrice),
        name: form.name.trim(),
        unit: editing === null && pack ? `${Number(unitsPerPack)} ${form.unit.trim()}/${pack}` : form.unit.trim(),
        quantity: Number(form.quantity),
        expiryDate: form.expiryDate || null,
        supplierName: form.supplierName ? form.supplierName.trim() : null,
        expectedUpdatedAt: editing === null ? undefined : editVersion.current,
      };
      if (editing === null) await api.post('/inventory', payload);
      else await api.put(`/inventory/${editing}`, payload);
      setForm(empty);
      setEditing(null);
      editor.current?.close();
      setNotice(
        existingItem
          ? `Đã tạo lô mới và cộng hàng vào ${existingItem.name}.`
          : editing === null
            ? 'Đã thêm sản phẩm và tạo lô tồn ban đầu.'
            : 'Đã cập nhật sản phẩm.',
      );
      await refresh();
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setError(getApiError(issue));
    } finally {
      setSaving(false);
    }
  }
  async function ask(value: string) {
    if (!value.trim() || asking) return;
    setQuestion('');
    setAsking(true);
    setMessages((current) => [...current.slice(-39), { from: 'user', text: value }]);
    try {
      const { data } = await api.post<{ answer: string; checkedAt: string; mode: string }>(
        '/advisor/chat',
        {
          message: value,
          history: messages.slice(-6).map((m) => ({
            role: m.from === 'bot' ? 'assistant' : 'user',
            content: m.text.slice(0, 1500),
          })),
        },
        { timeout: 35000 },
      );
      setMessages((current) => [
        ...current,
        { from: 'bot', text: data.answer, time: data.checkedAt },
      ]);
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setMessages((current) => [...current, { from: 'bot', text: getApiError(issue) }]);
    } finally {
      setAsking(false);
    }
  }
  const quickItems = [...items].sort((a, b) => b.quantity - a.quantity).slice(0, 12);
  function changeQuick(id: number, amount: number) {
    setQuickCounts((current) => ({ ...current, [id]: Math.max(0, (current[id] || 0) + amount) }));
  }
  async function saveQuickSales() {
    const entries = Object.entries(quickCounts).filter(([, count]) => count > 0);
    if (!entries.length || quickSaving) return;
    setQuickSaving(true);
    setError('');
    setNotice('');
    try {
      for (const [id, count] of entries) {
        await api.post(`/inventory/${id}/movements`, {
          type: 'SALE',
          quantity: count,
          occurredOn: quickDate,
          unitSalePrice: items.find((item) => item.id === Number(id))?.sellingPrice ?? 0,
          note: 'Bán nhanh cuối ca',
          requestId: crypto.randomUUID(),
        });
      }
      setQuickCounts({});
      setNotice(`Đã lưu ${entries.length} mặt hàng bán nhanh cho ngày ${quickDate}.`);
      await refresh();
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setError(getApiError(issue));
    } finally {
      setQuickSaving(false);
    }
  }

  async function saveSale(event: FormEvent) {
    event.preventDefault();
    if (saleSaving || !selling) return;
    setSaleSaving(true);
    setError('');
    setNotice('');
    try {
      await api.post(`/inventory/${selling.id}/movements`, {
        type: 'SALE',
        quantity: Number(saleQuantity),
        unitSalePrice: selling.sellingPrice ?? 0,
        note: 'Bán hàng',
        requestId: crypto.randomUUID(),
      });
      setSelling(null);
      saleDialog.current?.close();
      setNotice('Xuất hàng thành công.');
      await refresh();
    } catch (issue) {
      if (isUnauthenticated(issue)) onLogout();
      else setError(getApiError(issue));
    } finally {
      setSaleSaving(false);
    }
  }

  function edit(item: Item) {
    editVersion.current = item.updatedAt;
    setEditing(item.id);
    setForm({
      purchasePrice: item.purchasePrice?.toString() ?? '',
      sellingPrice: item.sellingPrice?.toString() ?? '',
      name: item.name,
      unit: item.unit,
      quantity: String(item.quantity),
      expiryDate: item.expiryDate?.slice(0, 10) || '',
      supplierName: item.supplierName || '',
    });
    setNotice('');
    setError('');
    setExpiryError('');
    editor.current?.showModal();
    nameInput.current?.focus();
  }
  const soon = items.filter(
    (item) =>
      item.quantity > 0 &&
      item.daysUntilExpiry !== null &&
      item.daysUntilExpiry >= 0 &&
      item.daysUntilExpiry <= 15,
  );
  const expired = items.filter(
    (item) => item.quantity > 0 && item.daysUntilExpiry !== null && item.daysUntilExpiry < 0,
  );
  const out = items.filter((item) => item.quantity === 0);
  const fold = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
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
  const visible = items.filter(
    (item) =>
      fold(item.name).includes(fold(search)) &&
      (filter === 'all' ||
        (filter === 'out' && item.quantity === 0) ||
        (filter === 'soon' && soon.includes(item)) ||
        (filter === 'expired' && expired.includes(item))),
  );
  function addProduct() {
    setPack('');
    setUnitsPerPack('');
    setEditing(null);
    setForm(empty);
    setError('');
    setExpiryError('');
    editor.current?.showModal();
  }
  function openFilter(value: string) {
    setFilter(value);
    setSearch('');
    setActiveTab('inventory');
  }
  if (checkingStore) {
    return (
      <main
        className="store-dashboard"
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '60vh',
          color: '#64748B',
        }}
      >
        <p>Đang chuẩn bị không gian cửa hàng…</p>
      </main>
    );
  }

  const needsOnboarding = Boolean(!storeProfile || !storeProfile.isConfigured);

  if (needsOnboarding) {
    return (
      <>
        <StoreOnboarding
          user={user}
          initialPhone={storeProfile?.storePhone || user.phone || ''}
          onCompleted={(savedStoreProfile) => {
            setStoreProfile(savedStoreProfile);
            setShowContractModal(true);
          }}
          onSignOut={onSignOut}
          signingOut={signingOut}
        />
        <ContractSigningModal
          isOpen={showContractModal}
          onClose={() => {
            setShowContractModal(false);
            setNotice('Đã lưu thông tin cửa hàng. Bạn có thể ký hợp đồng kết nối trong mục Hồ sơ.');
            setActiveTab('overview');
          }}
          onSignedSuccess={() => {
            setShowContractModal(false);
            setContractSigned(true);
            setStoreProfile((prev) => (prev ? { ...prev, verificationStatus: 'PENDING' } : prev));
            api
              .get<{ profile: Profile }>('/profile')
              .then(({ data }) => {
                if (data.profile.storeProfile) setStoreProfile(data.profile.storeProfile);
              })
              .catch(() => {});
            setNotice('Đã ký kết hợp đồng điện tử thành công! Hồ sơ đang chờ Admin phê duyệt.');
            setContractRefreshKey((prev) => prev + 1);
            setActiveTab('profile');
          }}
          user={user}
        />
      </>
    );
  }

  if (!activeTab) return <Navigate to="/store" replace />;
  return (
    <main className="store-dashboard">
      <aside
        ref={mobileMenu}
        className={`store-sidebar${mobileMenuOpen ? ' mobile-menu-open' : ''}`}
      >
        <div className="sidebar-mobile-row">
          <button
            type="button"
            className="mobile-menu-toggle"
            aria-label={mobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-expanded={mobileMenuOpen}
            aria-controls="store-mobile-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="sidebar-brand">
            <Brand />
            <span>GROCERY WORKSPACE</span>
          </div>
        </div>
        <div className="sidebar-shop">
          <span className="shop-symbol">
            <Icon name="store" />
          </span>
          <div>
            <strong>{storeProfile?.storeName || 'Cửa hàng của bạn'}</strong>
            <small>Không gian chủ tạp hóa</small>
          </div>
          <span className="online-dot" />
        </div>
        <p className="nav-caption">QUẢN LÝ CỬA HÀNG</p>
        <nav id="store-mobile-navigation" aria-label="Điều hướng cửa hàng">
          {tabs
            .filter((tab) => tab.id !== 'profile')
            .map((tab) => (
              <button
                key={tab.id}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon name={tab.icon} />
                <span>{tab.label}</span>
                {tab.id === 'inventory' && <small>{items.length}</small>}
              </button>
            ))}
        </nav>
        <div className="sidebar-tip">
          <span className="tip-icon">
            <Icon name="sparkle" />
          </span>
          <strong>
            Một câu hỏi.
            <br />
            Nắm rõ cả kho.
          </strong>
          <p>Tra cứu số lượng và hạn dùng với trợ lý cửa hàng.</p>
          <button onClick={() => setChatOpen(true)}>
            Hỏi trợ lý <Icon name="arrow" />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{displayName}</strong>
            <small>Chủ tạp hóa</small>
          </div>
          <button
            aria-label="Đăng xuất"
            title="Đăng xuất"
            onClick={onSignOut}
            disabled={signingOut}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Đóng menu điều hướng"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div className="store-main">
        <header className="store-topbar">
          <div>
            <span className="breadcrumb">Không gian làm việc</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{tabs.find((tab) => tab.id === activeTab)?.label}</strong>
          </div>
          <div className="topbar-right">
            <TopbarBalance onNavigateWallet={() => setActiveTab('wallet')} />
            <span className="today-label">
              {new Date().toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
            <div
              className="account-dropdown"
              ref={accountMenu}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);
              }}
            >
              <button
                ref={accountTrigger}
                className="topbar-account account-trigger"
                aria-expanded={accountOpen}
                aria-controls="account-options"
                onClick={() => setAccountOpen(!accountOpen)}
              >
                <span className="account-name">@{user.username}</span>
                <svg
                  className={`chevron-icon ${accountOpen ? 'is-open' : ''}`}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {accountOpen && (
                <div id="account-options" className="account-options">
                  <div className="account-options-user-info" style={{ padding: '8px 12px 10px', borderBottom: '1px solid #f1f5f9', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{user.name || user.username}</div>
                    <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, background: '#dcfce7', padding: '2px 8px', borderRadius: '999px', display: 'inline-block' }}>Chủ tạp hóa</span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setAccountOpen(false);
                      accountTrigger.current?.focus();
                    }}
                  >
                    <Icon name="user" />
                    Thông tin cá nhân
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('subscription');
                      setAccountOpen(false);
                      accountTrigger.current?.focus();
                    }}
                  >
                    <Icon name="shield" />
                    Gói sử dụng
                  </button>
                  <button
                    className="account-signout"
                    onClick={() => {
                      setAccountOpen(false);
                      onSignOut();
                    }}
                    disabled={signingOut}
                  >
                    <Icon name="logout" />
                    {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="dashboard-content">
          {activeTab === 'catalog' ? (
            <StoreCatalog onLogout={onLogout} />
          ) : activeTab === 'quotes' ? (
            <StoreQuotes onLogout={onLogout} />
          ) : activeTab === 'orders' ? (
            <OrderList kind="store" onLogout={onLogout} onInventoryChanged={refresh} onViewHistory={() => setActiveTab('history')} />
          ) : activeTab === 'wallet' ? (
            <WalletPage onLogout={onLogout} role="STORE_OWNER" />
          ) : activeTab === 'revenue' ? (
            <StoreRevenue onLogout={onLogout} />
          ) : activeTab === 'subscription' ? (
            <SubscriptionPage role="STORE_OWNER" onLogout={onLogout} />
          ) : (
            <>
              <div className="dashboard-title">
                <div>
                  <p className="dashboard-eyebrow">SUPPLYMIND · CỬA HÀNG THÔNG MINH</p>
                  <h1>
                    {activeTab === 'overview'
                      ? `Chào bạn, ${displayName.split(' ').at(-1)}!`
                      : tabs.find((tab) => tab.id === activeTab)?.label}
                  </h1>
                  {activeTab !== 'overview' && (
                    <p>
                      {activeTab === 'inventory'
                          ? 'Mỗi mặt hàng đều trong tầm kiểm soát.'
                          : activeTab === 'restock'
                            ? 'Ước tính sức bán, chuẩn bị nguồn hàng và lưu kế hoạch của bạn.'
                            : activeTab === 'profile'
                              ? 'Thông tin của bạn, luôn được cập nhật.'
                              : 'Mọi thay đổi trong kho, được ghi lại rõ ràng.'}
                    </p>
                  )}
                </div>
                {(activeTab === 'overview' || activeTab === 'inventory') && (
                  <div className={activeTab === 'overview' ? 'dashboard-title-actions overview-actions' : 'dashboard-title-actions'}>
                    {activeTab === 'overview' && (
                      <button type="button" className="dash-primary" onClick={() => setActiveTab('quick-sale')}>
                        <span aria-hidden="true">🎙️</span> Bán nhanh
                      </button>
                    )}
                    {activeTab === 'inventory' && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => importDialog.current?.open()}
                      >
                        <Icon name="box" /> Nhập từ Excel
                      </button>
                    )}
                    {activeTab === 'inventory' && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setExportSalesOpen(true)}
                      >
                        <Icon name="download" /> Xuất báo cáo bán
                      </button>
                    )}
                    <button type="button" className="dash-primary" onClick={addProduct}>
                      <span>＋</span> Thêm sản phẩm
                    </button>
                  </div>
                )}
              </div>
              {error && !editor.current?.open && (
                <p className="error-notice" role="alert">
                  {error}{' '}
                  <button className="text-button" onClick={() => void refresh()}>
                    Thử lại
                  </button>
                </p>
              )}
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
              {(() => {
                          const rawVerificationStatus = storeProfile?.verificationStatus;
          const verificationStatus =
            rawVerificationStatus === 'APPROVED' ||
            rawVerificationStatus === 'REJECTED' ||
            rawVerificationStatus === 'PENDING'
              ? rawVerificationStatus
              : contractSigned
                ? 'PENDING'
                : 'DRAFT';
                if (verificationStatus === 'REJECTED') {
                  return (
                    <div
                      style={{
                        margin: '0 0 16px 0',
                        padding: '14px 18px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ fontSize: '13.5px', color: '#991b1b', lineHeight: 1.45 }}>
                        <strong style={{ marginRight: '6px' }}>CẦN ĐIỀU CHỈNH:</strong>
                        Vui lòng cập nhật lại thông tin đăng ký
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPartnerEditModal(true)}
                        style={{
                          padding: '8px 18px',
                          backgroundColor: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 650,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Cập nhật
                      </button>
                    </div>
                  );
                }
                if (verificationStatus === 'PENDING') {
                  return (
                    <div
                      style={{
                        margin: '0 0 16px 0',
                        padding: '12px 18px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#1e40af',
                        lineHeight: 1.45,
                      }}
                    >
                      <strong>Đang chờ duyệt:</strong> Hồ sơ và hợp đồng liên kết của bạn đã được gửi và đang chờ Admin phê duyệt.
                    </div>
                  );
                }
                if (verificationStatus === 'DRAFT') {
                  return (
                    <div
                      style={{
                        margin: '0 0 16px 0',
                        padding: '12px 18px',
                        backgroundColor: '#fff7ed',
                        border: '1px solid #fed7aa',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ fontSize: '13px', color: '#9a3412', lineHeight: 1.45 }}>
                        <strong>Chưa ký thỏa thuận:</strong> Bạn chưa hoàn tất ký số Hợp đồng điện tử và thỏa thuận cơ chế ký quỹ 10% với SupplyMind.
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContractModal(true)}
                        style={{
                          padding: '7px 16px',
                          backgroundColor: '#ea580c',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 1px 2px rgba(234, 88, 12, 0.25)',
                        }}
                      >
                        Ký hợp đồng ngay
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
              <section
                hidden={
                  activeTab === 'profile' || activeTab === 'restock' || activeTab === 'calendar' || activeTab === 'quick-sale'
                }
                className="metric-grid"
                aria-label="Tổng quan kho"
              >
                {[
                  {
                    label: 'Tổng mặt hàng',
                    value: items.length,
                    detail: 'Trong danh mục cửa hàng',
                    icon: 'box',
                    color: 'green',
                    target: 'all',
                  },
                  {
                    label: 'Đã hết hàng',
                    value: out.length,
                    detail: 'Cần bổ sung vào kho',
                    icon: 'store',
                    color: 'blue',
                    target: 'out',
                  },
                  {
                    label: 'Gần hết hạn',
                    value: soon.length,
                    detail: 'Hạn dùng trong 15 ngày tới',
                    icon: 'leaf',
                    color: 'amber',
                    target: 'soon',
                  },
                  {
                    label: 'Đã quá hạn',
                    value: expired.length,
                    detail: 'Hàng còn tồn cần kiểm tra',
                    icon: 'shield',
                    color: 'rose',
                    target: 'expired',
                  },
                ].map((metric) => (
                  <button
                    className={`metric-card ${metric.color}`}
                    key={metric.label}
                    onClick={() => openFilter(metric.target)}
                  >
                    <div>
                      <span className="metric-icon">
                        <Icon name={metric.icon as 'box' | 'store' | 'leaf' | 'shield'} />
                      </span>

                    </div>
                    <p>{metric.label}</p>
                    <strong>{loading ? '—' : metric.value.toString().padStart(2, '0')}</strong>
                    {activeTab !== 'overview' && <small>{metric.detail}</small>}
                  </button>
                ))}
              </section>
            </>
          )}
          {activeTab === 'quick-sale' && <VoiceQuickSale items={items} onSaved={refresh} />}
          {activeTab === 'overview' && (
            <>
              <TodayDeliveryAlert
                orders={storeOrders}
                role="STORE_OWNER"
                onViewOrders={() => setActiveTab('orders')}
              />
              <OverviewRestockSuggestions
                revision={revision}
                onLogout={onLogout}
                onOpen={() => setActiveTab('restock')}
              />
              <section className="dashboard-card quick-sale-card">
                <div className="card-heading">
                  <div>
                    <span className="section-kicker">NHẬP CUỐI CA</span>
                    <h2>Bán nhanh một lần</h2>
                  </div>
                  <label>
                    Ngày giao dịch
                    <DatePicker
                      value={quickDate}
                      max={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })}
                      onChange={(val) => setQuickDate(val)}
                    />
                  </label>
                </div>
                <p className="stock-help">
                  Chọn số lượng đã bán trong ca, sau đó lưu tất cả một lần.
                </p>
                <div className="quick-sale-grid">
                  {quickItems.map((item) => (
                    <div className="quick-sale-row" key={item.id}>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          Còn {item.quantity} {item.unit}
                        </small>
                      </span>
                      <button
                        onClick={() => changeQuick(item.id, -1)}
                        disabled={!quickCounts[item.id]}
                      >
                        −
                      </button>
                      <b>{quickCounts[item.id] || 0}</b>
                      <button onClick={() => changeQuick(item.id, 1)}>+</button>
                      <button onClick={() => changeQuick(item.id, 5)}>+5</button>
                    </div>
                  ))}
                </div>
                <button
                  className="dash-primary"
                  disabled={quickSaving || !Object.values(quickCounts).some(Boolean)}
                  onClick={() => void saveQuickSales()}
                >
                  {quickSaving ? 'Đang lưu…' : 'Lưu tất cả giao dịch'}
                </button>
              </section>
              <div className="overview-grid" style={{ gridTemplateColumns: '1fr' }}>
                <section className="dashboard-card attention-card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">ĐỪNG BỎ LỠ</span>
                      <h2>Hàng cần chú ý</h2>
                    </div>
                    <button className="dash-link" onClick={() => openFilter('soon')}>
                      Xem kho
                    </button>
                  </div>
                  {loading ? (
                    <p className="inventory-empty">Đang kiểm tra kho…</p>
                  ) : [...expired, ...soon].length ? (
                    [...expired, ...soon].slice(0, 4).map((item) => (
                      <button
                        className="attention-row"
                        key={item.id}
                        onClick={() => {
                          setActiveTab('inventory');
                          edit(item);
                        }}
                      >
                        <span
                          className={`product-avatar ${item.daysUntilExpiry! < 0 ? 'rose' : 'amber'}`}
                        >
                          <Icon name="box" />
                        </span>
                        <span>
                          <strong>{item.name}</strong>
                          <small>
                            Còn {item.quantity} {item.unit}
                          </small>
                        </span>
                        <span
                          className={`status-pill ${item.daysUntilExpiry! < 0 ? 'danger' : 'warning'}`}
                        >
                          {item.expiryLabel}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="calm-state">
                      <span>
                        <Icon name="check" />
                      </span>
                      <h3>Kho hôm nay khá ổn!</h3>
                      <p>Không có hàng còn tồn với hạn dùng đã nhập nằm trong diện cảnh báo.</p>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {activeTab === 'inventory' && (
            <section className="dashboard-card product-card">
              <div className="card-heading">
                <div>
                  <span className="section-kicker">DANH MỤC CỬA HÀNG</span>
                  <h2>
                    Hàng hóa của bạn <span className="count-chip">{items.length}</span>
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="inventory-refresh"
                    disabled={loading || saving}
                    onClick={() => void refresh()}
                  >
                    ↻ Tải lại kho
                  </button>
                </div>
              </div>
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
                <select
                  aria-label="Lọc trạng thái kho"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="out">Đã hết hàng</option>
                  <option value="soon">Sắp hết hạn</option>
                  <option value="expired">Đã quá hạn</option>
                </select>
              </div>
              {loading ? (
                <p role="status" className="inventory-empty">
                  Đang tải kho hàng…
                </p>
              ) : !visible.length ? (
                <div className="calm-state">
                  <span>
                    <Icon name="box" />
                  </span>
                  <h3>
                    {items.length ? 'Chưa tìm thấy sản phẩm' : 'Bắt đầu với mặt hàng đầu tiên'}
                  </h3>
                  <p>
                    {items.length
                      ? 'Thử đổi từ khóa hoặc bộ lọc để xem thêm hàng hóa.'
                      : 'Thêm tên hàng, số lượng và hạn dùng để quản lý kho của bạn.'}
                  </p>
                  <button
                    className="dash-primary"
                    onClick={
                      items.length
                        ? () => {
                          setSearch('');
                          setFilter('all');
                        }
                        : addProduct
                    }
                  >
                    {items.length ? 'Xóa bộ lọc' : '＋ Thêm sản phẩm'}
                  </button>
                </div>
              ) : (
                <div className="inventory-table-wrap">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>Sản phẩm</th>
                        <th>Tồn kho</th>
                        <th>Giá nhập / bán</th>
                        <th>Trạng thái</th>
                        <th>Hạn sử dụng</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((item) => (
                        <tr key={item.id}>
                          <td data-label="Sản phẩm">
                            <div className="product-name-cell">
                              <span className="product-avatar">
                                <Icon name="box" />
                              </span>
                              <div>
                                <strong>{item.name}</strong>
                                <small>Mã SP #{String(item.id).padStart(4, '0')}</small>
                                {item.supplierName && (
                                  <small style={{ color: '#0284c7', display: 'block', marginTop: '2px', fontWeight: 500 }}>
                                    NCC: <strong>{item.supplierName}</strong>
                                  </small>
                                )}
                                <details className="lot-details">
                                  <summary>{item.lots?.length || 0} lô hàng</summary>
                                  {item.lots?.length ? (
                                    item.lots.map((lot) => (
                                      <div className="lot-row" key={lot.id}>
                                        <span>Lô #{lot.id}{lot.sourceOrderId ? ` · Đơn sỉ #${lot.sourceOrderId}` : ' · Lô hiện có / nhập tay'}</span>
                                        <b>
                                          {lot.quantity} {item.unit}
                                        </b>
                                        <small>
                                          Nhập{' '}
                                          {new Date(lot.receivedAt).toLocaleDateString('vi-VN')}
                                          {lot.expiryDate
                                            ? ` · HSD ${lot.expiryDate.split('-').reverse().join('/')}`
                                            : ' · Chưa nhập HSD'}
                                          {lot.purchasePrice == null
                                            ? ''
                                            : ` · ${lot.purchasePrice.toLocaleString('vi-VN')} ₫`}
                                        </small>
                                      </div>
                                    ))
                                  ) : (
                                    <small>Chưa có dữ liệu lô.</small>
                                  )}
                                </details>
                              </div>
                            </div>
                          </td>
                          <td data-label="Tồn kho">
                            <strong className="quantity-number">{item.quantity}</strong>{' '}
                            <span className="unit-label">{item.unit}</span>
                          </td>
                          <td data-label="Giá nhập / bán">
                            <span className="price-pair">
                              <span
                                className="price-pair-item"
                                title={
                                  item.purchasePrice === null
                                    ? 'Chưa có giá nhập'
                                    : `Giá nhập: ${item.purchasePrice.toLocaleString('vi-VN')} ₫`
                                }
                              >
                                {item.purchasePrice === null ? '—' : `${item.purchasePrice}₫`}
                              </span>
                              <span className="price-pair-sep" aria-hidden="true">
                                /
                              </span>
                              <span
                                className="price-pair-item"
                                title={
                                  item.sellingPrice === null
                                    ? 'Chưa có giá bán'
                                    : `Giá bán: ${item.sellingPrice.toLocaleString('vi-VN')} ₫`
                                }
                              >
                                {item.sellingPrice === null ? '—' : `${item.sellingPrice}₫`}
                              </span>
                            </span>
                          </td>
                          <td data-label="Trạng thái">
                            <span
                              className={`status-pill ${item.quantity === 0 ? 'neutral' : 'available'}`}
                            >
                              <i />
                              {item.quantity === 0 ? 'Hết hàng' : 'Còn hàng'}
                            </span>
                          </td>
                          <td data-label="Hạn sử dụng">
                            <span
                              className={`expiry-text ${item.daysUntilExpiry !== null && item.daysUntilExpiry < 0 ? 'expired' : item.daysUntilExpiry !== null && item.daysUntilExpiry <= 15 ? 'expiring' : ''}`}
                            >
                              {item.expiryLabel}
                            </span>
                            {item.expiryDate && (
                              <small>
                                {item.expiryDate.slice(0, 10).split('-').reverse().join('/')}
                              </small>
                            )}
                          </td>
                          <td data-label="Thao tác">
                            <button
                              className="dash-primary"
                              style={{
                                padding: '4px 12px',
                                fontSize: '12px',
                                height: 'auto',
                                minHeight: '26px',
                                fontWeight: '600',
                              }}
                              disabled={saving || item.quantity === 0}
                              aria-label={`Bán ${item.name}`}
                              onClick={() => {
                                setSelling(item);
                                setSaleQuantity('1');
                                saleDialog.current?.showModal();
                              }}
                            >
                              Xuất bán
                            </button>
                            <button
                              className="edit-product"
                              style={{ marginLeft: '8px' }}
                              disabled={saving}
                              aria-label={`Sửa ${item.name}`}
                              onClick={() => edit(item)}
                            >
                              Sửa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="table-footer">
                {visible.length} / {items.length} mặt hàng
                <span>Dữ liệu riêng của cửa hàng bạn</span>
              </div>
            </section>
          )}
          <div hidden={activeTab !== 'history'} className="dashboard-card activity-card">
            {activeTab === 'history' && <StockActivity
              items={items}
              revision={revision}
              onChanged={refresh}
              onLogout={onLogout}
              mode="history"
            />}
          </div>
          <div hidden={activeTab !== 'calendar'}>
            <SalesCalendar
              revision={revision}
              onLogout={onLogout}
              onChat={() => setChatOpen(true)}
            />
          </div>
          <div hidden={activeTab !== 'restock'}>
            <RestockPage revision={revision} onLogout={onLogout} />
          </div>
          <div hidden={activeTab !== 'profile'}>
            <ProfilePage
              contractRefreshKey={contractRefreshKey}
              onContractSigned={() => {
                setContractSigned(true);
                setContractRefreshKey((k) => k + 1);
                setStoreProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        verificationStatus:
                          prev.verificationStatus === 'DRAFT' ? 'PENDING' : prev.verificationStatus,
                      }
                    : prev,
                );
              }}
              onSaved={(name) => {
                setDisplayName(name);
                api
                  .get<{ profile: Profile }>('/profile')
                  .then(({ data }) => {
                    if (data.profile.storeProfile) setStoreProfile(data.profile.storeProfile);
                  })
                  .catch(() => { });
              }}
              onLogout={onLogout}
            />
          </div>
          <footer className="dashboard-footer">
            <span>
              SupplyMind AI <i>·</i> Người bạn của nhà bán lẻ
            </span>
            <span>
              <Icon name="shield" /> Kho hàng của riêng bạn
            </span>
          </footer>
        </div>
      </div>
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
            <span className="section-kicker">KHO HÀNG</span>
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
              maxLength={100}
              value={form.name}
              disabled={saving}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ví dụ: Coca lon 330ml"
            />
            {productSuggestions.length > 0 && (
              <div className="product-suggestions" role="listbox" aria-label="Sản phẩm tương tự">
                {productSuggestions.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    disabled={saving}
                    onClick={() => {
                      setPack('');
                      setUnitsPerPack('');
                      const suggestedExpiry = item.expiryDate?.slice(0, 10) || '';
                      setForm({
                        name: item.name,
                        unit: item.unit,
                        quantity: '1',
                        purchasePrice: item.purchasePrice == null ? '' : String(item.purchasePrice),
                        sellingPrice: item.sellingPrice == null ? '' : String(item.sellingPrice),
                        // Chỉ giữ lại hạn sử dụng còn tương lai, tránh nhập sẵn HSD đã qua.
                        expiryDate: suggestedExpiry && suggestedExpiry >= vietnamTomorrowIso() ? suggestedExpiry : '',
                        supplierName: item.supplierName || '',
                      });
                      setExpiryError('');
                    }}
                  >
                    <strong>{item.name}</strong>
                    <small>
                      Còn {item.quantity} {item.unit} · bấm để nhập thêm
                    </small>
                  </button>
                ))}
              </div>
            )}
          </label>
          {editing === null && (
            <label className="inventory-name">
              Nhập theo
              <select value={pack} disabled={saving} onChange={(event) => {
                setPack(event.target.value);
                setUnitsPerPack('');
              }}>
                <option value="">Nhập lẻ</option>
                <option value="thùng">Thùng</option>
                <option value="két">Két</option>
                <option value="lốc">Lốc</option>
                <option value="kiện">Kiện</option>
              </select>
            </label>
          )}
          <label>
            {editing === null ? 'Đơn vị bán lẻ' : 'Đơn vị'}
            <input required maxLength={editing === null && pack ? 9 : 20}
              pattern={editing === null && pack ? '[\\p{L}]+' : undefined}
              title={editing === null && pack ? 'Ví dụ lon, chai hoặc bịch.' : undefined}
              value={form.unit} disabled={saving} placeholder="lon, chai, bịch…"
              onChange={(event) => setForm({ ...form, unit: event.target.value })} />
          </label>
          <label>
            {editing === null ? (pack ? `Số ${pack} nhập` : 'Số lượng nhập') : 'Số lượng tồn'}
            <input required type="number" min="0" step="1"
              max={editing === null && pack && Number(unitsPerPack) > 0
                ? Math.floor(2147483647 / Number(unitsPerPack)) : 2147483647}
              value={form.quantity} disabled={saving}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          </label>
          {editing === null && pack && (
            <>
              <label>
                Số {form.unit.trim() || 'món'} trong 1 {pack}
                <input required type="number" min="1" max="999999" step="1"
                  value={unitsPerPack} disabled={saving}
                  onChange={(event) => setUnitsPerPack(event.target.value)} />
              </label>
              <output className="inventory-pack-total" aria-live="polite">
                {Number(unitsPerPack) > 0 &&
                  `Nhập kho ${(Number(form.quantity) * Number(unitsPerPack)).toLocaleString('vi-VN')} ${form.unit.trim()}`}
              </output>
            </>
          )}
          <label>
            Giá nhập (₫ / {editing === null && pack ? pack : form.unit.trim() || 'đơn vị'})
            <input
              type="number"
              min="0"
              max="2147483647"
              step="1"
              placeholder="Chưa nhập"
              value={form.purchasePrice}
              disabled={saving}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
            />
          </label>
          <label>
            Giá bán (₫ / {editing === null && pack ? pack : form.unit.trim() || 'đơn vị'})
            <input
              type="number"
              min="0"
              max="2147483647"
              step="1"
              placeholder="Chưa nhập"
              value={form.sellingPrice}
              disabled={saving}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
            />
          </label>
          <label className="inventory-name">
            Hạn sử dụng
            <DatePicker
              value={form.expiryDate}
              disabled={saving}
              invalid={Boolean(expiryError)}
              min={editing === null ? vietnamTomorrowIso() : undefined}
              onChange={(val) => {
                setForm({ ...form, expiryDate: val });
                if (expiryError) setExpiryError('');
              }}
              placeholder="DD/MM/YYYY"
            />
            {expiryError ? (
              <small className="inventory-expiry-error" role="alert">
                {expiryError}
              </small>
            ) : (
              <small className="stock-help">
                Hạn sử dụng phải là ngày tương lai (từ ngày mai trở đi).
              </small>
            )}
          </label>
          <label className="inventory-name">
            Nhà cung cấp / Nguồn hàng
            <input
              maxLength={150}
              value={form.supplierName}
              disabled={saving}
              onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
            />
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
      <InventoryImportDialog
        ref={importDialog}
        onLogout={onLogout}
        onImported={async (message) => {
          setNotice(message);
          await refresh();
        }}
      />
      <section
        className="inventory-chat floating-chat"
        hidden={!chatOpen}
        aria-label="Trợ lý tồn kho"
      >
        <div className="inventory-chat-header">
          <span className="chat-logo">
            <Icon name="sparkle" />
          </span>
          <div>
            <h3>Trợ lý SupplyMind</h3>
          </div>
          <button
            className="chat-close"
            aria-label="Đóng chatbox"
            onClick={() => setChatOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="inventory-messages" role="log" aria-live="polite" aria-relevant="additions">
          {messages.map((message, index) => (
            <div key={index} className={`inventory-message ${message.from}`}>
              <strong>{message.from === 'bot' ? 'SupplyMind' : 'Bạn'}</strong>
              <p>{message.text}</p>
              {message.time && (
                <small>Tra cứu lúc {new Date(message.time).toLocaleTimeString('vi-VN')}</small>
              )}
            </div>
          ))}
          {asking && <p role="status">Đang kiểm tra kho…</p>}
          <div ref={chatEnd} />
        </div>
        <div className="inventory-examples">
          {examples.map((example) => (
            <button key={example} disabled={asking} onClick={() => void ask(example)}>
              {example}
            </button>
          ))}
        </div>
        <form
          className="inventory-chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <input
            aria-label="Câu hỏi về tồn kho"
            value={question}
            maxLength={1000}
            disabled={asking}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Hỏi về hàng trong kho…"
            required
          />
          <button
            className="dash-primary"
            aria-label="Gửi câu hỏi"
            disabled={asking || !question.trim()}
          >
            <Icon name="arrow" />
          </button>
        </form>
      </section>
      <button
        className="chat-launcher"
        aria-label={chatOpen ? 'Thu gọn trợ lý' : 'Hỏi SupplyMind'}
        aria-expanded={chatOpen}
        onClick={() => setChatOpen(!chatOpen)}
      >
        <Icon name="sparkle" />
        <span>{chatOpen ? 'Thu gọn trợ lý' : 'Hỏi SupplyMind'}</span>
        <span className="online-dot" />
      </button>

      <dialog
        ref={saleDialog}
        aria-label="Xuất bán hàng"
        className="inventory-dialog"
        onCancel={(event) => {
          if (saleSaving) event.preventDefault();
        }}
      >
        <div className="dialog-heading">
          <span className="product-avatar">
            <Icon name="box" />
          </span>
          <div>
            <span className="section-kicker">XUẤT HÀNG</span>
            <h2>{selling?.name}</h2>
          </div>
          <button
            disabled={saleSaving}
            className="dialog-close"
            aria-label="Đóng"
            onClick={() => saleDialog.current?.close()}
          >
            ×
          </button>
        </div>
        <form className="inventory-form" onSubmit={saveSale}>
          <p className="stock-help">
            Số {selling?.unit}: {selling?.quantity}
          </p>
          <label>
            Số lượng bán
            <input
              required
              type="number"
              min="1"
              max={selling?.quantity || 1}
              step="1"
              value={saleQuantity}
              disabled={saleSaving}
              onChange={(e) => setSaleQuantity(e.target.value)}
            />
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
              disabled={saleSaving}
              onClick={() => saleDialog.current?.close()}
            >
              Hủy
            </button>
            <button
              className="dash-primary"
              disabled={saleSaving || !selling || selling.quantity === 0}
            >
              {saleSaving ? 'Đang lưu...' : 'Xác nhận bán'}
            </button>
          </div>
        </form>
      </dialog>
      <ExportSalesDialog
        isOpen={exportSalesOpen}
        onClose={() => setExportSalesOpen(false)}
      />
      <ContractSigningModal
        isOpen={showContractModal}
        onClose={() => setShowContractModal(false)}
        onSignedSuccess={() => {
          setShowContractModal(false);
          setContractSigned(true);
          setStoreProfile((prev) => (prev ? { ...prev, verificationStatus: 'PENDING' } : prev));
          api
            .get<{ profile: Profile }>('/profile')
            .then(({ data }) => {
              if (data.profile.storeProfile) setStoreProfile(data.profile.storeProfile);
            })
            .catch(() => {});
          setNotice('Đã ký kết hợp đồng điện tử thành công! Hồ sơ đang chờ Admin phê duyệt.');
          setContractRefreshKey((prev) => prev + 1);
          setActiveTab('profile');
        }}
        user={user}
      />
      <PartnerProfileEditModal
        isOpen={showPartnerEditModal}
        onClose={() => setShowPartnerEditModal(false)}
        role="STORE_OWNER"
        storeProfile={storeProfile}
        onSaved={(updated) => {
          setStoreProfile(updated);
          setContractRefreshKey((prev) => prev + 1);
          setNotice('Cập nhật thông tin thành công, vui lòng đợi Admin phê duyệt');
        }}
      />
    </main>
  );
}

