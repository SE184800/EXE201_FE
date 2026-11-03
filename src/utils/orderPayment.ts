type PaymentOrder = {
  status?: string;
  subtotal: number;
  deliveryFee: number;
  depositAmount: number;
  depositStatus: string;
  walletPayment?: { status: string; amount?: number; refunded?: boolean } | null;
  driverInfo?: { paymentInfo?: { status: string } | null } | null;
};

export function orderPaymentSummary(order: PaymentOrder, damageAmount = 0) {
  const loss = Math.min(Math.max(0, damageAmount), order.subtotal);
  const total = Math.max(0, order.subtotal - loss) + order.deliveryFee;
  const deposit = order.depositStatus === 'PAID' ? order.depositAmount : 0;
  const walletPaid = Boolean(order.walletPayment && !order.walletPayment.refunded &&
    ['PAID', 'SETTLED'].includes(order.walletPayment.status) && Number(order.walletPayment.amount) >= Math.max(0, total - deposit));
  const paid = walletPaid || order.driverInfo?.paymentInfo?.status === 'CONFIRMED';
  return { total, deposit, walletPaid, paid, remaining: paid || order.status === 'REJECTED' ? 0 : Math.max(0, total - deposit) };
}

export function supplierPaymentBank(supplier?: {
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
} | null) {
  const name = supplier?.bankName?.trim();
  const account = supplier?.bankAccountNumber?.trim();
  const holder = supplier?.bankAccountHolder?.trim();
  return name && account && holder && /^\d{6,30}$/.test(account)
    ? { name, account, holder } : null;
}
