import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError } from 'axios';
import { api } from '../src/services/api.ts';
import { depositOrderWithWallet, addMockFunds, resetMockBalance } from '../src/services/wallet.api.ts';

test('a deposit calls only the deposit API, never full-order payment', async () => {
  const previous = api.post;
  const calls = [];
  api.post = async path => { calls.push(path); return { data: {} }; };
  try {
    await depositOrderWithWallet(123);
    assert.deepEqual(calls, ['/orders/123/deposit/wallet']);
  } finally { api.post = previous; }
});

test('a failed deposit does not fall through to another money operation', async () => {
  const previous = api.post;
  const calls = [];
  api.post = async path => { calls.push(path); throw Error('response lost'); };
  try {
    await assert.rejects(depositOrderWithWallet(123), /response lost/);
    assert.deepEqual(calls, ['/orders/123/deposit/wallet']);
  } finally { api.post = previous; }
});

test('sandbox top-up retries reuse one request ID and never call legacy fallback routes', async () => {
  const post = api.post, get = api.get;
  const calls = [];
  api.post = async (path, body) => {
    calls.push({ path, requestId: body.requestId });
    if (calls.length === 1) throw new AxiosError('response lost', 'ERR_NETWORK');
    return { data: { request: {} } };
  };
  api.get = async () => ({ data: { wallet: { balance: 5000000, heldBalance: 0, total: 5000000 } } });
  try {
    const result = await addMockFunds(5000000);
    assert.equal(result.wallet.availableBalance, 5000000);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].path, '/wallet/deposits/sandbox');
    assert.deepEqual(calls[0], calls[1]);
    assert.match(calls[0].requestId, /^[0-9a-f-]{36}$/);
  } finally { api.post = post; api.get = get; }
});

test('a failed reset must not report a successful balance reset', async () => {
  const previous = api.post;
  api.post = async () => { throw Error('reset unavailable'); };
  try { await assert.rejects(resetMockBalance(), /reset unavailable/); }
  finally { api.post = previous; }
});
