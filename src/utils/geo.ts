export function stripVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export interface DeliveryCalculationParams {
  storeCoords?: { lat?: number | null; lon?: number | null } | null;
  storeAddress?: string;
  locationType?: 'STREET_FRONT' | 'ALLEY' | string;
  supplierCoords?: { lat?: number | null; lon?: number | null } | null;
  supplierWarehouseAddress?: string;
  supplierDeliveryFee?: number;
  supplierDeliveryRadiusKm?: number;
}

export interface DeliveryFeeResult {
  distanceKm: number;
  deliveryFee: number;
  baseFee: number;
  distanceExtraFee: number;
  alleySurcharge: number;
  isAlley: boolean;
  supplierRadiusKm: number;
  exceedsRadius: boolean;
  distanceLabel: string;
}

export function calculateDeliveryFee({
  storeCoords,
  locationType,
  supplierCoords,
  supplierDeliveryFee = 0,
  supplierDeliveryRadiusKm = 35,
}: DeliveryCalculationParams): DeliveryFeeResult {
  // 1. Use stored verified coordinates when available
  const storeLat = storeCoords?.lat ?? 10.7626;
  const storeLon = storeCoords?.lon ?? 106.6601;

  // 2. Supplier warehouse coordinates (or default central reference when unpinned)
  const supplierLat = supplierCoords?.lat ?? 10.7765;
  const supplierLon = supplierCoords?.lon ?? 106.6578;

  // 3. Compute distance
  const distanceKm = haversineDistanceKm(storeLat, storeLon, supplierLat, supplierLon);

  // 4. Calculate fee
  const baseFee = supplierDeliveryFee > 0 ? supplierDeliveryFee : 15000;
  const baseKm = 3.0;
  const extraKm = Math.max(0, distanceKm - baseKm);
  const distanceExtraFee = Math.round(extraKm * 5000);
  const isAlley = locationType === 'ALLEY';
  const alleySurcharge = 0;

  const total = baseFee + distanceExtraFee + alleySurcharge;
  const deliveryFee = Math.round(total / 1000) * 1000;
  const supplierRadiusKm = supplierDeliveryRadiusKm || 35;
  const exceedsRadius = distanceKm > supplierRadiusKm;

  const distanceLabel = `${distanceKm.toFixed(1)} km${isAlley ? ' (Trong hẻm)' : ' (Mặt tiền)'}`;

  return {
    distanceKm,
    deliveryFee,
    baseFee,
    distanceExtraFee,
    alleySurcharge,
    isAlley,
    supplierRadiusKm,
    exceedsRadius,
    distanceLabel,
  };
}
