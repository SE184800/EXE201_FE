// Known landmark / market coordinates for warehouses and districts in Ho Chi Minh City
const KNOWN_COORDINATES: Array<{ match: RegExp; lat: number; lon: number }> = [
  { match: /tan binh|ly thuong kiet/i, lat: 10.7765, lon: 106.6578 },
  { match: /binh tan|binh tri dong/i, lat: 10.7626, lon: 106.6025 },
  { match: /thu duc|cho dau moi thu duc/i, lat: 10.8712, lon: 106.749 },
  { match: /hoc mon|cho dau moi hoc mon/i, lat: 10.8878, lon: 106.5925 },
  { match: /binh dien|quan 8/i, lat: 10.6975, lon: 106.6342 },
  { match: /quan 5|cho lon|kim bien/i, lat: 10.7538, lon: 106.656 },
  { match: /quan 12|an phu dong/i, lat: 10.8672, lon: 106.6413 },
  { match: /quan 1|ben thanh/i, lat: 10.7725, lon: 106.698 },
  { match: /go vap/i, lat: 10.8385, lon: 106.6653 },
  { match: /tan phu/i, lat: 10.7925, lon: 106.628 },
  { match: /binh thanh/i, lat: 10.8106, lon: 106.7091 },
];

export function resolveAddressCoordinates(
  addressText?: string | null
): { lat: number; lon: number } | null {
  if (!addressText || typeof addressText !== 'string') return null;
  const match = KNOWN_COORDINATES.find((item) => item.match.test(addressText));
  if (match) return { lat: match.lat, lon: match.lon };
  return null;
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
  storeAddress,
  locationType,
  supplierWarehouseAddress,
  supplierDeliveryFee = 0,
  supplierDeliveryRadiusKm = 35,
}: DeliveryCalculationParams): DeliveryFeeResult {
  // 1. Determine store coordinates
  let storeLat = storeCoords?.lat;
  let storeLon = storeCoords?.lon;
  if (!storeLat || !storeLon) {
    const resolved = resolveAddressCoordinates(storeAddress);
    if (resolved) {
      storeLat = resolved.lat;
      storeLon = resolved.lon;
    } else {
      storeLat = 10.7626;
      storeLon = 106.6601;
    }
  }

  // 2. Determine supplier warehouse coordinates
  const resolvedWarehouse = resolveAddressCoordinates(supplierWarehouseAddress);
  const supplierLat = resolvedWarehouse ? resolvedWarehouse.lat : 10.7765;
  const supplierLon = resolvedWarehouse ? resolvedWarehouse.lon : 106.6578;

  // 3. Compute distance
  const distanceKm = haversineDistanceKm(storeLat, storeLon, supplierLat, supplierLon);

  // 4. Calculate fee
  const baseFee = supplierDeliveryFee > 0 ? supplierDeliveryFee : 15000;
  const baseKm = 3.0;
  const extraKm = Math.max(0, distanceKm - baseKm);
  const distanceExtraFee = Math.round(extraKm * 5000);
  const isAlley = locationType === 'ALLEY';
  const alleySurcharge = isAlley ? 5000 : 0;

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
