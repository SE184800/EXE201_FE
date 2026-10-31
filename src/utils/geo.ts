export function stripVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

// Known landmark / market coordinates for warehouses and districts in Ho Chi Minh City and major regions
const KNOWN_COORDINATES: Array<{ match: RegExp; lat: number; lon: number; label: string }> = [
  // HCMC - Districts and Major Roads
  {
    match: /(tan phu|trinh dinh trong|luy ban bich|thoai ngoc hau|hoa binh|tan huong|son ky|tan son nhi|phu tho hoa|hiep tan|tay thanh)/i,
    lat: 10.7925,
    lon: 106.628,
    label: 'Quận Tân Phú, TP. Hồ Chí Minh',
  },
  {
    match: /(tan binh|ly thuong kiet|cong hoa|hoang hoa tham|truong chinh|le van sy|au co|phong khong|bach dang)/i,
    lat: 10.7938,
    lon: 106.6525,
    label: 'Quận Tân Bình, TP. Hồ Chí Minh',
  },
  {
    match: /(binh tan|binh tri dong|ten lua|an lac|binh hung hoa|kinh duong vuong|ho hoc lam|le van quoi)/i,
    lat: 10.7626,
    lon: 106.6025,
    label: 'Quận Bình Tân, TP. Hồ Chí Minh',
  },
  {
    match: /(quan 1\b|q\.?1\b|ben nghe|ben thanh|nguyen hue|le loi|dong khoi|ham nghi|tran hung dao)/i,
    lat: 10.7756,
    lon: 106.7004,
    label: 'Quận 1, TP. Hồ Chí Minh',
  },
  {
    match: /(quan 3\b|q\.?3\b|vo van tan|nguyen thi minh khai|nam ky khoi nghia)/i,
    lat: 10.7844,
    lon: 106.6844,
    label: 'Quận 3, TP. Hồ Chí Minh',
  },
  {
    match: /(quan 4\b|q\.?4\b|hoang dieu|khanh hoi|ben van don|ton dan)/i,
    lat: 10.7578,
    lon: 106.7013,
    label: 'Quận 4, TP. Hồ Chí Minh',
  },
  {
    match: /(quan 5\b|q\.?5\b|cho lon|kim bien|nguyen trai|tran hung dao b|an dong)/i,
    lat: 10.754,
    lon: 106.6634,
    label: 'Quận 5, TP. Hồ Chí Minh',
  },
  {
    match: /(quan 6\b|q\.?6\b|hau giang|binh tay|minh phung|ba hom)/i,
    lat: 10.7481,
    lon: 106.6352,
    label: 'Quận 6, TP. Hồ Chí Minh',
  },
  {
    match: /(quan 7\b|q\.?7\b|phu my hung|nguyen thi thap|huynh tan phat|nguyen van linh)/i,
    lat: 10.734,
    lon: 106.7218,
    label: 'Quận 7, TP. Hồ Chí Minh',
  },
  {
    match: /(quan 8\b|q\.?8\b|pham the hien|ta quang buu|binh dien)/i,
    lat: 10.7241,
    lon: 106.6286,
    label: 'Quận 8, TP. Hồ Chí Minh',
  },
  {
    match: /(quan 10\b|q\.?10\b|ba thang hai|3\/2|to hien thanh|su van hanh|thanh thai)/i,
    lat: 10.7679,
    lon: 106.6669,
    label: 'Quận 10, TP. Hồ Chí Minh',
  },
  {
    match: /(quan 11\b|q\.?11\b|dam sen|lac long quan|le dai hanh|lanh binh thang)/i,
    lat: 10.7629,
    lon: 106.6504,
    label: 'Quận 11, TP. Hồ Chí Minh',
  },
  {
    match: /(quan 12\b|q\.?12\b|an phu dong|tan chanh hiep|thanh loc|ha huy giap)/i,
    lat: 10.8672,
    lon: 106.6413,
    label: 'Quận 12, TP. Hồ Chí Minh',
  },
  {
    match: /(binh thanh|bach dang|dien bien phu|phan van tri|xo viet nghe tinh)/i,
    lat: 10.8106,
    lon: 106.7091,
    label: 'Quận Bình Thạnh, TP. Hồ Chí Minh',
  },
  {
    match: /(go vap|quang trung|phan van tri|le duc tho|nguyen oanh|cay tram)/i,
    lat: 10.8385,
    lon: 106.6653,
    label: 'Quận Gò Vấp, TP. Hồ Chí Minh',
  },
  {
    match: /(phu nhuan|phan xich long|nguyen van troi|hoang van thu)/i,
    lat: 10.7992,
    lon: 106.6803,
    label: 'Quận Phú Nhuận, TP. Hồ Chí Minh',
  },
  {
    match: /(thu duc|quan 2|q\.?2\b|quan 9|q\.?9\b|thao dien|an phu|linh trung|linh xuan|hiep binh|vo van ngan|cho dau moi thu duc)/i,
    lat: 10.85,
    lon: 106.758,
    label: 'TP. Thủ Đức, TP. Hồ Chí Minh',
  },
  {
    match: /(hoc mon|ba diem|cho dau moi hoc mon)/i,
    lat: 10.8878,
    lon: 106.5925,
    label: 'Huyện Hóc Môn, TP. Hồ Chí Minh',
  },
  {
    match: /(cu chi|an nhon tay|tan quy)/i,
    lat: 10.9731,
    lon: 106.4939,
    label: 'Huyện Củ Chi, TP. Hồ Chí Minh',
  },
  {
    match: /(binh chanh|vinh loc|an phu tay|tan kien)/i,
    lat: 10.6874,
    lon: 106.5939,
    label: 'Huyện Bình Chánh, TP. Hồ Chí Minh',
  },
  {
    match: /(nha be|hiep phuoc|phu xuan)/i,
    lat: 10.6953,
    lon: 106.7277,
    label: 'Huyện Nhà Bè, TP. Hồ Chí Minh',
  },
  {
    match: /(can gio|can thanh)/i,
    lat: 10.4114,
    lon: 106.9546,
    label: 'Huyện Cần Giờ, TP. Hồ Chí Minh',
  },
  // Surrounding and Major Provinces
  {
    match: /(binh duong|thuan an|di an|thu dau mot|ben cat|tan uyen)/i,
    lat: 10.9804,
    lon: 106.6519,
    label: 'Tỉnh Bình Dương',
  },
  {
    match: /(dong nai|bien hoa|long thanh|nhon trach)/i,
    lat: 10.9574,
    lon: 106.8427,
    label: 'Tỉnh Đồng Nai',
  },
  {
    match: /(long an|tan an|ben luc|duc hoa)/i,
    lat: 10.5362,
    lon: 106.4131,
    label: 'Tỉnh Long An',
  },
  {
    match: /(tien giang|my tho)/i,
    lat: 10.3544,
    lon: 106.3653,
    label: 'Tỉnh Tiền Giang',
  },
  {
    match: /(can tho|ninh kieu|cai rang)/i,
    lat: 10.0452,
    lon: 105.7469,
    label: 'TP. Cần Thơ',
  },
  {
    match: /(vung tau|ba ria)/i,
    lat: 10.346,
    lon: 107.0843,
    label: 'Tỉnh Bà Rịa - Vũng Tàu',
  },
  {
    match: /(ha noi|hoan kiem|ba dinh|dong da|cau giay|hai ba trung|thanh xuan|hoang mai|ha dong|long bien)/i,
    lat: 21.0285,
    lon: 105.8542,
    label: 'Thủ đô Hà Nội',
  },
  {
    match: /(da nang|hai chau|thanh khe|son tra|ngu hanh son|lien chieu)/i,
    lat: 16.0544,
    lon: 108.2022,
    label: 'TP. Đà Nẵng',
  },
  {
    match: /(hai phong|hong bang|ngo quyen|le chan)/i,
    lat: 20.8449,
    lon: 106.6881,
    label: 'TP. Hải Phòng',
  },
  // Default general HCMC
  {
    match: /(ho chi minh|tp\.?hcm|tp hcm|tphcm|sai gon)/i,
    lat: 10.7769,
    lon: 106.7009,
    label: 'TP. Hồ Chí Minh',
  },
];

export interface ResolvedCoordinates {
  lat: number;
  lon: number;
  displayName: string;
}

export function resolveAddressCoordinates(
  addressText?: string | null
): ResolvedCoordinates | null {
  if (!addressText || typeof addressText !== 'string') return null;
  const raw = addressText.trim();
  if (raw.length < 3) return null;

  const normalized = stripVietnameseAccents(raw);
  const match = KNOWN_COORDINATES.find((item) => item.match.test(normalized));
  if (match) {
    return { lat: match.lat, lon: match.lon, displayName: raw };
  }

  // If text has valid address length (>= 6 chars), provide standard center coordinates
  if (normalized.length >= 6) {
    return { lat: 10.7769, lon: 106.7009, displayName: raw };
  }

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
