// Local-only Android integration fixture. Uses actual BE routes + SQL, and removes
// only the records created by this run. Never points at the hosted deployment.
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const { randomUUID, randomBytes } = require('node:crypto');
const backend = path.resolve(process.env.NOTIFICATION_TEST_BACKEND || path.join(__dirname, '../../EXE201_BE'));
const fromBackend = createRequire(path.join(backend, 'package.json'));
fromBackend('dotenv').config({ path: path.join(backend, '.env') });
if (!/^sqlserver:\/\/(localhost|127\.0\.0\.1)(:|;)/i.test(process.env.DATABASE_URL || '')) {
  throw Error('Notification integration tests require a local SQL Server.');
}
process.env.SQL_DOCUMENT_STORAGE = 'true';
const prisma = fromBackend('./config/db');
const { createApp } = fromBackend('./app');
const { readConfig } = fromBackend('./config/env');
const bcrypt = fromBackend('bcryptjs');
const suffix = randomUUID().slice(0, 8);
const password = randomBytes(24).toString('base64url');
const users = [];
let apiServer, gateway, order, profile, holiday, cleaned = false;
const sessions = {};
const base = 'http://127.0.0.1:18766';
const headers = { 'Content-Type': 'application/json', 'X-CSRF-Protection': 'sg-restock-web', Origin: 'http://localhost:5173' };
async function api(who, method, route, body) {
  const response = await fetch(base + route, { method, headers: { ...headers, ...(sessions[who] ? { Cookie: sessions[who] } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw Error(`${method} ${route}: ${response.status} ${JSON.stringify(data)}`);
  return { data, response };
}
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  const ids = users.map(user => user.id);
  if (apiServer) await new Promise(resolve => apiServer.close(resolve));
  // Remove our order's delivery metadata, preserving every other document entry.
  if (order) {
    await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw`SELECT [key], [payload] FROM [dbo].[application_documents] WITH (UPDLOCK, HOLDLOCK) WHERE [key] = 'orders_delivery'`;
      for (const row of rows) {
        const payload = JSON.parse(row.payload);
        if (payload && !Array.isArray(payload) && Object.hasOwn(payload, String(order.id))) {
          delete payload[String(order.id)];
          await tx.applicationDocument.update({ where: { key: row.key }, data: { payload: JSON.stringify(payload) } });
        }
      }
    });
    await prisma.wholesaleOrder.delete({ where: { id: order.id } });
  }
  if (holiday) await prisma.holidayConfig.delete({ where: { id: holiday.id } });
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.depositRequest.deleteMany({ where: { userId: { in: ids } } });
    await prisma.walletTransaction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
  console.log('Removed this run\'s fixture accounts, order, holiday and sandbox ledger.');
}
async function main() {
  apiServer = await new Promise(resolve => { const server = createApp(prisma, readConfig()).listen(18766, '127.0.0.1', () => resolve(server)); });
  const passwordHash = await bcrypt.hash(password, 12);
  for (const [name, role] of [['store', 'STORE_OWNER'], ['supplier', 'SUPPLIER']]) {
    const user = await prisma.user.create({ data: { username: `notify_${name}_${suffix}`, name: `Kiểm thử thông báo ${name}`, passwordHash, role: { connect: { code: role } } } });
    users.push(user);
    const { response } = await api(name, 'POST', '/api/auth/login', { username: user.username, password });
    sessions[name] = response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
  }
  profile = await prisma.supplierProfile.create({ data: { userId: users[1].id, businessName: 'Vựa kiểm thử thông báo', warehouseAddress: 'Địa chỉ kiểm thử', deliveryRadiusKm: 10, verificationStatus: 'APPROVED' } });
  order = await prisma.wholesaleOrder.create({ data: { buyerId: users[0].id, supplierId: profile.id, status: 'PREPARING', subtotal: 100000, total: 100000, deliveryFee: 0, note: 'Dữ liệu kiểm thử thông báo, không phải đơn thật.' } });
  const vnDate = new Date(Date.now() + 7 * 3600000 + 7 * 86400000).toISOString().slice(0, 10);
  holiday = await prisma.holidayConfig.create({ data: { name: `Ngày lễ kiểm thử ${suffix}`, startDate: new Date(vnDate), endDate: new Date(vnDate), preparationDays: 14, demandMultiplier: 1, categoryKeywords: 'kiểm thử' } });
  gateway = http.createServer(async (req, res) => {
    let data, status = 200;
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/fixture/info') data = { orderId: order.id, holidayDate: vnDate, holidayName: holiday.name };
      else if (url.pathname === '/fixture/shipping') {
        const driverInfo = { driverName: 'Tài xế kiểm thử', driverPhone: '0900000000', vehicleType: 'Xe thử', licensePlate: 'TEST-001', estimatedDeliveryTime: new Date(Date.now() + 2 * 3600000).toISOString() };
        data = (await api('supplier', 'PATCH', `/api/supplier/orders/${order.id}/status`, { status: 'SHIPPING', driverInfo })).data;
      } else if (url.pathname === '/fixture/topup') {
        await api('store', 'POST', '/api/wallet/deposits/sandbox', { amount: 19000, requestId: randomUUID(), note: 'Kiểm thử thông báo Android.' });
        const ledger = (await api('store', 'GET', '/api/wallet/transactions')).data;
        data = { transactionId: ledger.transactions[0].id };
      } else if (url.pathname === '/fixture/received') data = (await api('store', 'POST', `/api/orders/${order.id}/confirm-arrival`, {})).data;
      else if (url.pathname === '/fixture/logout') data = (await api('store', 'POST', '/api/auth/logout', {})).data;
      else if (url.pathname === '/fixture/cleanup') { await cleanup(); data = { cleaned: true }; }
      else if (req.method === 'GET' && ['/api/auth/me', '/api/orders', '/api/wallet/transactions', '/api/advisor/calendar'].includes(url.pathname)) {
        const response = await fetch(base + req.url, { headers: { Cookie: sessions.store } });
        status = response.status; data = await response.json();
      } else { status = 404; data = { error: 'Unknown test route' }; }
    } catch (error) { status = 500; data = { error: error.message }; }
    const body = Buffer.from(JSON.stringify(data));
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': body.length, Connection: 'close' });res.end(body);
    if (cleaned) gateway.close();
  });
  await new Promise(resolve => gateway.listen(18765, '127.0.0.1', resolve));
  console.log('Local notification fixture ready on 127.0.0.1:18765 (real BE API + SQL; synthetic test data only).');
}
main().catch(async error => { console.error(error.message); await cleanup(); process.exitCode = 1; });
process.on('SIGINT', async () => { if (gateway) gateway.close(); await cleanup(); });
