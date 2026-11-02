import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutRequestId } from '../src/utils/checkoutRequests.ts';
test('retrying a multi-supplier checkout reuses each order request after a lost response', () => {
  const cache = new Map(); let next = 0;
  const id = () => 'request-' + (++next);
  const first = { supplier: 1, lines: [{ productId: 10, quantity: 2 }] };
  const second = { supplier: 2, lines: [{ productId: 20, quantity: 1 }] };
  const firstRequest = checkoutRequestId(cache, first, id);
  const secondRequest = checkoutRequestId(cache, second, id);
  assert.notEqual(firstRequest, secondRequest);
  assert.equal(checkoutRequestId(cache, first, id), firstRequest);
  assert.equal(checkoutRequestId(cache, second, id), secondRequest);
  assert.notEqual(checkoutRequestId(cache, { ...first, lines: [{ productId: 10, quantity: 3 }] }, id), firstRequest);
});
