import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  parseSpokenSale,
  readJournal,
  unavailableReason,
  validateSale,
  saleTotal,
} from '../src/mobile/quickSale.ts';
const item = { id: 1, name: 'Coca Cola 330ml', unit: 'lon', quantity: 20, sellingPrice: 12000 };
const noodles = { ...item, id: 2, name: 'Mì Hảo Hảo', unit: 'gói', sellingPrice: 4000 };
const line = {
  itemId: 1,
  name: item.name,
  unit: item.unit,
  quantity: 2,
  unitSalePrice: 12000,
  requestId: randomUUID(),
};
test('sale total and valid integer quantities', () => {
  assert.equal(validateSale([line], [item]), '');
  assert.equal(saleTotal([line]), 24000);
  for (const quantity of [0, -1, 1.5, NaN, Infinity, 21])
    assert.notEqual(validateSale([{ ...line, quantity }], [item]), '');
});
test('missing and zero prices never silently become a free sale', () => {
  for (const sellingPrice of [null, 0, -1, 1.5])
    assert.notEqual(unavailableReason({ ...item, sellingPrice }), '');
});
test('expired goods and bulk stock cannot be sold by the quick screen', () => {
  assert.equal(
    unavailableReason({ ...item, expiryDate: '2026-11-17' }, new Date('2026-11-17T10:00:00Z')),
    '',
  );
  assert.equal(
    unavailableReason({ ...item, expiryDate: '2026-11-17' }, new Date('2026-11-17T18:00:00Z')),
    'Đã hết hạn',
  );
  assert.match(unavailableReason({ ...item, unit: '24 lon/thùng' }), /quy đổi/);
});
test('changed price, unit, deleted item and duplicate lines are rejected', () => {
  assert.notEqual(validateSale([line], [{ ...item, sellingPrice: 14000 }]), '');
  assert.notEqual(validateSale([line], [{ ...item, unit: 'chai' }]), '');
  assert.notEqual(validateSale([line], []), '');
  assert.notEqual(validateSale([line, line], [item]), '');
});
test('multiple spoken products are matched and repeated products are combined', () => {
  const parsed = parseSpokenSale('Coca 2 và mì Hảo Hảo 3, Coca 1', [item, noodles]);
  assert.equal(parsed.error, '');
  assert.deepEqual(
    parsed.lines.map((row) => [row.item.id, row.quantity]),
    [
      [1, 3],
      [2, 3],
    ],
  );
});
test('spoken numbers and leading retail units work', () => {
  assert.equal(parseSpokenSale('hai lon Coca', [item]).lines[0].quantity, 2);
  assert.equal(parseSpokenSale('Coca hai', [item]).lines[0].quantity, 2);
});
test('ambiguous variants and unknown products do not partially add a sale', () => {
  const variants = [item, { ...item, id: 3, name: 'Coca Cola 500ml' }];
  assert.deepEqual(parseSpokenSale('Coca 2', variants).lines, []);
  assert.deepEqual(parseSpokenSale('Coca 2 và Pepsi 3', [item]).lines, []);
  assert.equal(parseSpokenSale('Coca Cola 330ml 2', variants).lines[0].item.id, 1);
});
test('decimal quantities must never turn into an integer after speech cleanup', () => {
  for (const text of ['Coca 1.5', 'Coca 1,5', 'Coca -2', 'Coca 0', '2 thùng Coca', 'Coca'])
    assert.deepEqual(parseSpokenSale(text, [item]).lines, [], text);
});
test('pending journal survives reload with the exact request ID and owner', () => {
  const journal = { version: 1, ownerId: 11, phase: 'pending', rows: [line] };
  assert.deepEqual(readJournal(JSON.stringify(journal), 11), journal);
  assert.equal(readJournal(JSON.stringify(journal), 12), null);
});
test('corrupt journals and duplicate request IDs are rejected', () => {
  assert.equal(readJournal('{', 11), null);
  for (const rows of [
    [{ ...line, requestId: 'broken' }],
    [line, line],
    [{ ...line, unitSalePrice: 0 }],
  ]) {
    assert.equal(
      readJournal(JSON.stringify({ version: 1, ownerId: 11, phase: 'pending', rows }), 11),
      null,
    );
  }
});
