export type AdminTabProps = {
  onLogout: () => void;
};

export type Props = AdminTabProps;

export type List = {
  total: number;
  page: number;
  hasMore: boolean;
};

export type AccountSubscription = {
  id?: number;
  status: 'NOT_STARTED' | 'TRIAL' | 'ACTIVE' | 'EXPIRED';
  hasAccess: boolean;
  accessEndsAt: string | null;
  updatedAt: string | null;
};

export type Account = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  lockReason: string | null;
  suspendedUntil: string | null;
  deletedAt?: string | null;
  updatedAt: string;
  createdAt: string;
  subscription: AccountSubscription;
};

export type Verification = {
  id: number;
  userId?: number;
  role?: string;
  roleLabel?: string;
  phone?: string;
  businessName: string;
  warehouseAddress: string;
  region: string | null;
  taxCode: string | null;
  legalRepresentative: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankQrImageUrl?: string | null;
  verificationDocumentUrl: string | null;
  verificationStatus: string;
  verificationVersion: number;
  verificationNote: string | null;
  submittedAt: string | null;
  reviewedAt?: string | null;
  locationType?: string | null;
  alleyDetail?: string | null;
  isAddressVerified?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  user: Account;
};

export type Settlement = {
  id: number;
  supplierId: number;
  businessName: string;
  buyerName: string;
  subtotal: number;
  total: number;
  commissionRate: number | null;
  commissionAmount: number | null;
  deliveredAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  paymentStatus: string;
  region: string | null;
};

export type NavItem = {
  path: string;
  label: string;
  icon: 'store' | 'user' | 'shield' | 'box' | 'chart' | 'sparkle' | 'lock' | 'calendar';
};

export type NavGroup = {
  section: string;
  items: NavItem[];
};
