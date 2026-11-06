import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/supplymind-notifications.js', import.meta.url), 'utf8');
function setup(native = true) {
  const calls = [], timers = [];
  class Xhr extends EventTarget { open(method, url) { this.url = url; } }
  const document = new EventTarget(); document.readyState = 'loading';
  const window = new EventTarget(); window.location = { href: 'https://supplymind-demo.vercel.app/store', origin: 'https://supplymind-demo.vercel.app' };
  window.Capacitor = native ? { Plugins: { SupplyMindNotifications: Object.fromEntries(['session','sync','open','target'].map(name => [name, async data => { calls.push([name, data]); }])) } } : {};
  vm.runInNewContext(source, { window, document, XMLHttpRequest: Xhr, URL, Promise, setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval() {}, sessionStorage: { getItem: () => null } });
  async function response(method, url, status) { const req = new Xhr(); req.open(method, url); req.status=status;req.dispatchEvent(new Event('loadend'));await new Promise(resolve=>setImmediate(resolve)); }
  return { calls, timers, response };
}
test('notification bridge observes successful login and logout without passing credentials', async () => {
  const s=setup();await s.response('POST','/api/auth/login',200);
  assert.equal(s.calls[0][0],'session');assert.equal(s.calls[0][1].action,'login');assert.deepEqual(Object.keys(s.calls[0][1]),['action']);
  await s.response('POST','/api/auth/logout',200);assert.equal(s.calls.at(-1)[1].action,'logout');
});
test('foreign requests and rejected login never change the native account', async () => {
  const s=setup();await s.response('POST','https://other.example/api/auth/login',200);await s.response('POST','/api/auth/login',401);assert.equal(s.calls.length,0);
});
test('ordinary website remains usable when the APK plugin is absent', async () => {
  const s=setup(false);await s.response('POST','/api/auth/login',200);assert.equal(s.calls.length,0);
});
test('authenticated API expiry clears native account schedules', async () => {
  const s=setup();await s.response('GET','/api/orders',401);assert.equal(s.calls.at(-1)[1].action,'logout');
});
