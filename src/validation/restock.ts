export function fillEmptySuggestions(current: Record<number, string>, items: { itemId: number; suggestedQuantity: number | null }[]): Record<number, string> {
  const next = { ...current };
  for (const item of items) {
    if ((next[item.itemId] ?? '').trim() === '' && item.suggestedQuantity !== null && item.suggestedQuantity > 0)
      next[item.itemId] = String(item.suggestedQuantity);
  }
  return next;
}
