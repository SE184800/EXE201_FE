export type SaleItem = {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  sellingPrice: number | null;
  expiryDate?: string | null;
  lowThreshold?: number;
  daysUntilExpiry?: number | null;
};
export type SaleLine = {
  itemId: number;
  name: string;
  unit: string;
  quantity: number;
  unitSalePrice: number;
};
export type SaleRequest = SaleLine & { requestId: string };
export type SaleJournal = {
  version: 1;
  ownerId: number;
  phase: 'draft' | 'pending' | 'done';
  rows: SaleRequest[];
  savedAt?: string;
};
export const SALE_STORAGE_PREFIX = 'supplymind:sales:';
export const normalizeSaleText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
const int = (n: number) => Number.isInteger(n) && n > 0 && n <= 2147483647;
export const saleTotal = (rows: SaleLine[]) =>
  rows.reduce((sum, row) => sum + row.quantity * row.unitSalePrice, 0);
export function unavailableReason(item: SaleItem, now = new Date()): string {
  if (item.quantity <= 0) return 'Hết hàng';
  const today = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  if (item.expiryDate && item.expiryDate.slice(0, 10) < today) return 'Đã hết hạn';
  if (
    normalizeSaleText(item.unit)
      .split(/[^a-z]+/)
      .some((word) => ['thung', 'ket', 'loc', 'khay', 'kien', 'lo', 'bao'].includes(word))
  )
    return 'Cần quy đổi đơn vị bán lẻ trên web';
  if (!int(item.sellingPrice ?? 0)) return 'Chưa có giá bán hợp lệ';
  return '';
}
export function validateSale(rows: SaleLine[], items: SaleItem[]): string {
  if (!rows.length) return 'Chọn ít nhất một mặt hàng.';
  if (rows.length > 50) return 'Mỗi lượt bán tối đa 50 mặt hàng.';
  if (new Set(rows.map((row) => row.itemId)).size !== rows.length)
    return 'Một mặt hàng đang bị lặp trong lượt bán.';
  for (const row of rows) {
    const item = items.find((item) => item.id === row.itemId);
    if (!item) return `“${row.name}” không còn trong kho. Hãy bỏ khỏi lượt bán.`;
    const reason = unavailableReason(item);
    if (reason) return `${item.name}: ${reason}.`;
    if (row.unit !== item.unit) return `${item.name}: đơn vị đã thay đổi. Hãy chọn lại mặt hàng.`;
    if (!int(row.quantity)) return `${item.name}: nhập số lượng nguyên lớn hơn 0.`;
    if (row.quantity > item.quantity)
      return `${item.name}: kho chỉ còn ${item.quantity} ${item.unit}.`;
    if (!int(row.unitSalePrice)) return `${item.name}: giá bán phải là số nguyên lớn hơn 0.`;
    if (row.unitSalePrice !== item.sellingPrice)
      return `${item.name}: giá bán đã đổi. Hãy chọn lại mặt hàng.`;
  }
  return Number.isSafeInteger(saleTotal(rows)) ? '' : 'Tổng tiền vượt giới hạn xử lý.';
}
export function readJournal(raw: string | null, ownerId: number): SaleJournal | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as SaleJournal;
    if (
      value.version !== 1 ||
      value.ownerId !== ownerId ||
      !['draft', 'pending', 'done'].includes(value.phase) ||
      !Array.isArray(value.rows) ||
      value.rows.length > 50
    )
      return null;
    if (
      value.rows.some(
        (row) =>
          !int(row.itemId) ||
          !Number.isInteger(row.quantity) ||
          row.quantity < 0 ||
          row.quantity > 2147483647 ||
          !int(row.unitSalePrice) ||
          typeof row.name !== 'string' ||
          typeof row.unit !== 'string' ||
          typeof row.requestId !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            row.requestId,
          ),
      )
    )
      return null;
    if (
      new Set(value.rows.map((row) => row.itemId)).size !== value.rows.length ||
      new Set(value.rows.map((row) => row.requestId)).size !== value.rows.length ||
      !Number.isSafeInteger(saleTotal(value.rows))
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

// Ambiguous or unrecognised speech never silently drops a product or chooses a variant.
export function parseSpokenSale(
  text: string,
  items: SaleItem[],
): { lines: { item: SaleItem; quantity: number }[]; error: string } {
  const words: Record<string, string> = {
    mot: '1',
    hai: '2',
    ba: '3',
    bon: '4',
    tu: '4',
    nam: '5',
    sau: '6',
    bay: '7',
    tam: '8',
    chin: '9',
    muoi: '10',
  };
  let normalized = normalizeSaleText(text)
    .replace(/[.!?]+$/, '')
    .replace(/\b(?:ban|lay|cho toi)\b/g, '')
    .trim();
  normalized = normalized
    .split(/[,;]|\s+va\s+/)
    .map((part) =>
      part
        .trim()
        .replace(
          /^(mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)\s/,
          (_, n: string) => words[n] + ' ',
        )
        .replace(
          /\s(mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)$/,
          (_, n: string) => ' ' + words[n],
        ),
    )
    .join(',');
  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const lines = new Map<number, { item: SaleItem; quantity: number }>();
  for (const part of parts) {
    const match = part.match(/^(.*?)\s+(\d+)$/) || part.match(/^(\d+)\s+(.+)$/);
    if (!match)
      return {
        lines: [],
        error: `Chưa rõ số lượng trong “${part}”. Nói “Coca 2”, ngăn cách các món bằng “và”.`,
      };
    const leading = /^\d+$/.test(match[1]);
    const quantity = Number(leading ? match[1] : match[2]);
    let phrase = leading ? match[2] : match[1];
    if (/\b(thung|ket|loc|khay|kien|bao)\b/.test(phrase))
      return {
        lines: [],
        error: 'Hãy nói số lượng theo đơn vị bán lẻ trong kho, không tự quy đổi thùng hoặc lốc.',
      };
    phrase = phrase.replace(/^(chai|lon|goi|hop|cai|bich|tui)\s+/, '').trim();
    if (!phrase || !int(quantity))
      return { lines: [], error: 'Chưa nhận rõ tên hàng hoặc số lượng.' };
    const exact = items.filter((item) => normalizeSaleText(item.name) === phrase);
    const candidates = exact.length
      ? exact
      : items.filter((item) => normalizeSaleText(item.name).includes(phrase));
    if (candidates.length !== 1)
      return {
        lines: [],
        error: candidates.length
          ? `“${phrase}” khớp nhiều mặt hàng. Nói đầy đủ tên hoặc chọn bằng tay.`
          : `Không tìm thấy “${phrase}” trong kho. Bạn có thể tìm và chọn bên dưới.`,
      };
    const item = candidates[0];
    lines.set(item.id, { item, quantity: quantity + (lines.get(item.id)?.quantity || 0) });
  }
  if (!lines.size)
    return { lines: [], error: 'Chưa nghe được mặt hàng. Hãy thử lại hoặc chọn bằng tay.' };
  return { lines: [...lines.values()], error: '' };
}
