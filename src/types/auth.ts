export type Role = 'STORE_OWNER' | 'SUPPLIER' | 'ADMIN';

export type AuthUser = {
  id: number;
  username: string;
  name: string;
  role: Role;
};

export const ROLE_DETAILS = {
  STORE_OWNER: {
    label: 'Chủ tạp hóa',
    path: '/store',
    workspace: 'store',
    description: 'Quản lý cửa hàng và kế hoạch nhập hàng của bạn.',
  },
  SUPPLIER: {
    label: 'Chủ vựa',
    path: '/supplier',
    workspace: 'supplier',
    description: 'Kết nối cửa hàng và quản lý hoạt động bán sỉ.',
  },
  ADMIN: {
    label: 'Quản trị viên',
    path: '/admin',
    workspace: 'admin',
    description: 'Quản lý tài khoản và vận hành nền tảng.',
  },
} as const;
