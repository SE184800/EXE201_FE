import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError } from 'axios';
import { api, ApiCompatibilityError, isMissingApiRoute } from '../src/services/api.ts';
import { recordQuickSale } from '../src/services/quickSale.api.ts';
import { getQrDepositTicket } from '../src/services/wallet.api.ts';

const row = { itemId: 7, name: 'Coca', unit: 'lon', quantity: 2, unitSalePrice: 12000, requestId: 'c6703c0d-c447-4f48-933c-c24edcb8bd30' };
const failure = (status = 404, data = { message: 'Không tìm thấy API.' }) =>
  new AxiosError('request failed', undefined, undefined, undefined, { status, data });

test('only an explicit route 404 is a missing API, not a business error or HTML', () => {
  assert.equal(isMissingApiRoute(failure()), true);
  assert.equal(isMissingApiRoute(failure(404, { code: 'API_ROUTE_NOT_FOUND' })), true);
  for (const err of [failure(500), failure(403), failure(404, { message: 'Không tìm thấy sản phẩm.' }), failure(404, '<html>404</html>'), new Error('offline')])
    assert.equal(isMissingApiRoute(err), false);
});

test('current backend receives one atomic batch and only the submitted sale fields', async t => {
  const calls = [];
  t.mock.method(api, 'post', async (...args) => { calls.push(args); return { data: { movements: [{ id: row.requestId }] } }; });
  assert.deepEqual(await recordQuickSale([row]), { movements: [{ id: row.requestId }] });
  const { name, ...payload } = row;
  assert.deepEqual(calls, [['/inventory/sales/batch', { rows: [payload] }, { timeout: 30000 }]]);
});

test('legacy single sale keeps exact key, price, quantity and note across retries', async t => {
  const calls = [];
  t.mock.method(api, 'post', async (...args) => {
    calls.push(args);
    if (args[0].endsWith('/batch')) throw failure();
    return { data: { movement: { id: row.requestId } } };
  });
  for (let i = 0; i < 2; i++)
    assert.deepEqual(await recordQuickSale([row]), { movements: [{ id: row.requestId }] });
  assert.deepEqual(calls[1], ['/inventory/7/movements', {
    type: 'SALE', quantity: 2, unitSalePrice: 12000, requestId: row.requestId, note: 'Bán nhanh bằng giọng nói',
  }, { timeout: 30000 }]);
  assert.deepEqual(calls[1], calls[3]);
});

test('legacy multi-item sale never splits into partial transactions', async t => {
  const calls = [];
  t.mock.method(api, 'post', async path => { calls.push(path); throw failure(); });
  await assert.rejects(recordQuickSale([row, { ...row, itemId: 8, requestId: 'different' }]), ApiCompatibilityError);
  assert.deepEqual(calls, ['/inventory/sales/batch']);
});

test('uncertain commits and business rejections never try the legacy mutation', async t => {
  for (const err of [new AxiosError('offline', 'ERR_NETWORK'), failure(500), failure(403), failure(409), failure(404, { message: 'Không tìm thấy sản phẩm.' })]) {
    const calls = [];
    const mocked = t.mock.method(api, 'post', async path => { calls.push(path); throw err; });
    await assert.rejects(recordQuickSale([row]), value => value === err);
    assert.deepEqual(calls, ['/inventory/sales/batch']);
    mocked.mock.restore();
  }
});

test('legacy QR polling searches owner pages and never confirms or credits money', async t => {
  const calls = [];
  t.mock.method(api, 'post', async () => { assert.fail('polling must not write'); });
  t.mock.method(api, 'get', async (path, options) => {
    calls.push([path, options?.params?.page]);
    if (path.endsWith('/qr/42')) throw failure();
    const page = options.params.page;
    return { data: { page, hasMore: page === 1, requests: [{ id: page === 1 ? 99 : 42, status: 'APPROVED' }] } };
  });
  assert.equal((await getQrDepositTicket(42)).status, 'APPROVED');
  assert.deepEqual(calls, [['/wallet/deposits/qr/42', undefined], ['/wallet/deposits', 1], ['/wallet/deposits', 2]]);
});

test('QR business 404 and server failures are not masked by a list fallback', async t => {
  for (const error of [failure(404, { message: 'Không tìm thấy phiếu.' }), failure(500)]) {
    const calls = [];
    const mocked = t.mock.method(api, 'get', async path => { calls.push(path); throw error; });
    await assert.rejects(getQrDepositTicket(42), value => value === error);
    assert.deepEqual(calls, ['/wallet/deposits/qr/42']);
    mocked.mock.restore();
  }
});

test('a missing QR ticket or broken pagination never reports success', async t => {
  for (const result of [{ page: 1, hasMore: false, requests: [] }, { page: 1, hasMore: true, requests: [{ id: 99 }] }]) {
    let calls = 0;
    const mocked = t.mock.method(api, 'get', async path => {
      calls++;
      if (path.includes('/qr/')) throw failure();
      return { data: result };
    });
    await assert.rejects(getQrDepositTicket(42), ApiCompatibilityError);
    assert.ok(calls <= 3);
    mocked.mock.restore();
  }
});
