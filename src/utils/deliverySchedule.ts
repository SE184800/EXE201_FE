export function isOrderScheduledToday(order: {
  status: string;
  driverInfo?: { estimatedDeliveryTime?: string | null } | null;
}): boolean {
  if (!['PREPARING', 'SHIPPING'].includes(order.status)) return false;

  const eta = order.driverInfo?.estimatedDeliveryTime || '';
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());

  const d1 = `${day}/${month}/${year}`; // 05/11/2026
  const d2 = `${year}-${month}-${day}`; // 2026-11-05
  const d3 = `${day}/${month}`; // 05/11

  if (eta) {
    if (eta.includes(d1) || eta.includes(d2) || eta.includes(d3)) {
      return true;
    }
    // If ETA mentions a different date (e.g. tomorrow or next week), then it's not today
    if (/\d{1,2}\/\d{1,2}/.test(eta) || /\d{4}-\d{2}-\d{2}/.test(eta)) {
      return false;
    }
  }

  // If currently SHIPPING without specific future date, it is out for delivery today
  return order.status === 'SHIPPING';
}

export function extractTimeFromEta(eta?: string | null): string {
  if (!eta) return 'Trong ngày';
  const match = eta.match(/(\d{1,2}:\d{2})/);
  if (match) return match[1];
  return eta;
}
