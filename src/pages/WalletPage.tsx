import WalletPage from './wallet/WalletPage';

export default function LegacyWalletPage({
  onLogout,
  role = 'STORE_OWNER',
}: {
  onLogout: () => void;
  role?: 'STORE_OWNER' | 'SUPPLIER';
}) {
  return <WalletPage onLogout={onLogout} role={role} />;
}
