import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright'
);
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const root = fileURLToPath(new URL('../', import.meta.url));
const backendRoot = process.env.MOBILE_TEST_BE || path.resolve(root, '../EXE201_BE');
const requireBE = createRequire(path.join(backendRoot, 'package.json'));
requireBE('dotenv').config({ path: path.join(backendRoot, '.env'), quiet: true });
if (!/^sqlserver:\/\/(localhost|127\.0\.0\.1)(:|;)/i.test(process.env.DATABASE_URL || ''))
  throw Error('Local SQL only');
process.env.SQL_DOCUMENT_STORAGE = 'true';
process.env.VITE_MOBILE_APP = 'true';
process.env.VITE_API_URL = '/api';
const p = requireBE('./config/db');
const { createApp } = requireBE('./app');
const { readConfig } = requireBE('./config/env');
const bcrypt = requireBE('bcryptjs');
let user, supplier, backend, frontend, browser;
const checks = [];
try {
  const password = randomBytes(20).toString('base64url');
  user = await p.user.create({
    data: {
      username: 'mobileqa_' + randomUUID().slice(0, 8),
      name: 'Tạp hóa Minh An',
      passwordHash: await bcrypt.hash(password, 10),
      role: { connect: { code: 'STORE_OWNER' } },
    },
  });
  const products = [];
  for (const [name, unit, quantity, sellingPrice] of [
    ['Coca Cola 330ml', 'lon', 20, 12000],
    ['Mì Hảo Hảo', 'gói', 30, 4000],
    ['Chưa đặt giá', 'chai', 4, null],
    ['Hết hàng', 'chai', 0, 8000],
  ]) {
    products.push(
      await p.inventoryItem.create({
        data: {
          ownerId: user.id,
          name,
          unit,
          quantity,
          sellingPrice,
          lowThreshold: 5,
          lots: { create: { quantity } },
        },
      }),
    );
  }
  const [coca, noodles] = products;
  supplier = await p.user.create({
    data: {
      username: 'mobilevendor_' + randomUUID().slice(0, 8),
      name: 'Nhà cung cấp kiểm thử',
      passwordHash: await bcrypt.hash(password, 10),
      role: { connect: { code: 'SUPPLIER' } },
      supplierProfile: {
        create: {
          businessName: 'Vựa kiểm thử giao hàng',
          warehouseAddress: 'Địa chỉ fixture local',
          deliveryRadiusKm: 10,
        },
      },
    },
    include: { supplierProfile: true },
  });
  const product = await p.supplierProduct.create({
    data: {
      supplierId: supplier.supplierProfile.id,
      name: 'Coca Cola 330ml',
      packaging: 'Thùng 24 lon',
      wholesalePrice: 240000,
      stockQty: 50,
      moq: 1,
    },
  });
  for (const status of ['PENDING', 'SHIPPING', 'DELIVERED']) {
    await p.wholesaleOrder.create({
      data: {
        supplierId: supplier.supplierProfile.id,
        buyerId: user.id,
        status,
        subtotal: 480000,
        deliveryFee: 20000,
        total: 500000,
        recipientName: user.name,
        recipientPhone: '0900000000',
        deliveryAddress: 'Địa chỉ kiểm thử local',
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            packaging: product.packaging,
            quantity: 2,
            unitPrice: 240000,
            lineTotal: 480000,
          },
        },
      },
    });
  }
  backend = await new Promise((resolve) => {
    const s = createApp(
      p,
      readConfig({ ...process.env, FRONTEND_URL: 'http://127.0.0.1:5174' }),
    ).listen(18768, '127.0.0.1', () => resolve(s));
  });
  frontend = await createServer({
    root,
    configFile: root + '/vite.config.ts',
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      open: false,
      proxy: { '/api': { target: 'http://127.0.0.1:18768', changeOrigin: true } },
    },
    logLevel: 'error',
  });
  await frontend.listen();
  browser = await chromium.launch({
    executablePath:
      process.env.MOBILE_TEST_BROWSER ||
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const csrf = { Origin: 'http://127.0.0.1:5174', 'X-CSRF-Protection': 'sg-restock-web' };
  const login = await context.request.post('http://127.0.0.1:5174/api/auth/login', {
    headers: csrf,
    data: { username: user.username, password },
  });
  assert.equal(login.status(), 200, await login.text());
  await context.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {
        setTimeout(
          () =>
            this.onresult?.({
              results: [[{ transcript: window.testSpeech || 'Coca 2 và mì Hảo Hảo 3' }]],
            }),
          20,
        );
      }
      abort() {}
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5174');
  await page.getByRole('heading', { name: 'Bán nhanh', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Thêm Coca Cola 330ml', exact: true }).waitFor();
  assert.equal(await page.locator('.mobile-app-nav a').count(), 4);
  assert.equal(
    await page.getByRole('button', { name: 'Thêm Chưa đặt giá', exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await page.getByRole('button', { name: 'Thêm Hết hàng', exact: true }).isDisabled(),
    true,
  );
  checks.push('4 tabs, default quick sale, invalid price/out-of-stock disabled');
  await page.getByRole('button', { name: /Nói để thêm hàng/ }).click();
  await page.getByRole('spinbutton', { name: 'Số lượng Coca Cola 330ml' }).waitFor();
  assert.equal(
    await page.getByRole('spinbutton', { name: 'Số lượng Coca Cola 330ml' }).inputValue(),
    '2',
  );
  assert.equal(
    await page.getByRole('spinbutton', { name: 'Số lượng Mì Hảo Hảo' }).inputValue(),
    '3',
  );
  await page.screenshot({
    path: path.join(process.env.MOBILE_TEST_OUTPUT || process.cwd(), 'mobile-sale.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Ghi nhận bán', exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });
  await page.locator('.mobile-sale-receipt').waitFor();
  assert.equal((await p.inventoryItem.findUnique({ where: { id: coca.id } })).quantity, 18);
  assert.equal((await p.inventoryItem.findUnique({ where: { id: noodles.id } })).quantity, 27);
  assert.equal(
    await p.stockMovement.count({ where: { item: { ownerId: user.id }, type: 'SALE' } }),
    2,
  );
  const firstMovements = await p.stockMovement.findMany({
    where: { item: { ownerId: user.id }, type: 'SALE' },
  });
  assert.equal(
    firstMovements.reduce((sum, row) => sum - row.quantityChange * row.unitSalePrice, 0),
    36000,
  );
  checks.push('voice preview + double-click: one atomic sale, exact stock and 36,000 revenue');

  await page.getByRole('button', { name: 'Thêm Coca Cola 330ml', exact: true }).click();
  let lostRows;
  await page.route(
    '**/api/inventory/sales/batch',
    async (route) => {
      lostRows = route.request().postDataJSON().rows;
      const result = await route.fetch();
      assert.equal(result.status(), 200);
      await route.abort('failed');
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Ghi nhận bán', exact: true }).click();
  await page.getByRole('button', { name: 'Kiểm tra lại lượt bán', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Kiểm tra lại lượt bán', exact: true }).waitFor();
  assert.equal(
    await page.getByRole('spinbutton', { name: 'Số lượng Coca Cola 330ml' }).isDisabled(),
    true,
  );
  await page.getByRole('button', { name: 'Kiểm tra lại lượt bán', exact: true }).click();
  await page.locator('.mobile-sale-receipt').waitFor();
  assert.equal((await p.inventoryItem.findUnique({ where: { id: coca.id } })).quantity, 17);
  assert.equal(await p.stockMovement.count({ where: { id: lostRows[0].requestId } }), 1);
  checks.push('lost success response + reload + retry: persisted IDs, no duplicate decrement');

  await page.getByRole('button', { name: 'Thêm Coca Cola 330ml', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm Mì Hảo Hảo', exact: true }).click();
  await p.inventoryItem.update({ where: { id: noodles.id }, data: { quantity: 0 } });
  await page.getByRole('button', { name: 'Ghi nhận bán', exact: true }).click();
  await page.getByText(/Kho chỉ còn 0/).waitFor();
  assert.equal((await p.inventoryItem.findUnique({ where: { id: coca.id } })).quantity, 17);
  assert.equal(
    await p.stockMovement.count({ where: { item: { ownerId: user.id }, type: 'SALE' } }),
    3,
  );
  await page.getByRole('button', { name: 'Bỏ tất cả', exact: true }).click();
  checks.push('one insufficient item rolls back the entire sale; draft can be corrected');

  await page.getByRole('button', { name: 'Thêm Coca Cola 330ml', exact: true }).click();
  await page.route('**/api/inventory/sales/batch', (route) => route.abort('failed'), { times: 1 });
  await page.getByRole('button', { name: 'Ghi nhận bán', exact: true }).click();
  await page.getByRole('button', { name: 'Kiểm tra lại lượt bán', exact: true }).waitFor();
  const beforeLogout = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem('supplymind:sales:' + id)),
    user.id,
  );
  await page.getByRole('button', { name: 'Tài khoản', exact: true }).click();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.getByRole('heading', { name: 'Đăng nhập', exact: true }).waitFor();
  const loginAgain = await context.request.post('http://127.0.0.1:5174/api/auth/login', {
    headers: csrf,
    data: { username: user.username, password },
  });
  assert.equal(loginAgain.status(), 200);
  await page.goto('http://127.0.0.1:5174/store/quick-sale');
  await page.getByRole('button', { name: 'Kiểm tra lại lượt bán', exact: true }).waitFor();
  assert.deepEqual(
    await page.evaluate(
      (id) => JSON.parse(localStorage.getItem('supplymind:sales:' + id)).rows,
      user.id,
    ),
    beforeLogout.rows,
  );
  await page.getByRole('button', { name: 'Kiểm tra lại lượt bán', exact: true }).click();
  await page.locator('.mobile-sale-receipt').waitFor();
  assert.equal((await p.inventoryItem.findUnique({ where: { id: coca.id } })).quantity, 16);
  checks.push('offline before send + logout/re-login: same pending sale recovered and saved once');

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const tab of ['quick-sale', 'inventory', 'orders', 'wallet']) {
      await page.goto(`http://127.0.0.1:5174/store/${tab}`);
      await page.locator('.mobile-app-nav').waitFor();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '.mobile-app-content button, .mobile-app-content input, .mobile-app-content h1, .mobile-app-content h2',
          ),
        ]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
          })
          .map((el) => ({ cls: el.className, text: el.textContent?.slice(0, 55) })),
      );
      assert.deepEqual(overflow, [], `${tab} at ${width}px`);
      if (tab === 'orders') assert.equal(await page.locator('.order-card').count(), 3);
      if (tab === 'wallet') {
        for (const action of ['+ Nạp tiền (VietQR)', 'Rút tiền về ngân hàng']) {
          await page.getByRole('button', { name: action, exact: true }).click();
          const overflow = await page.evaluate(() =>
            [...document.querySelectorAll('.wallet-page input, .wallet-page button')]
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
              })
              .map((el) => el.textContent?.slice(0, 40)),
          );
          assert.deepEqual(overflow, [], `${action} at ${width}px`);
          await page.getByTitle('Đóng', { exact: true }).click();
        }
      }
      if (width === 390)
        await page.screenshot({
          path: path.join(process.env.MOBILE_TEST_OUTPUT || process.cwd(), `mobile-${tab}.png`),
          fullPage: true,
        });
    }
  }
  checks.push('all 4 screens at 320/390/768 px: no control overflow');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: checks }, null, 2));
} finally {
  await browser?.close();
  await frontend?.close();
  if (backend) await new Promise((resolve) => backend.close(resolve));
  if (user) {
    await p.auditLog.deleteMany({ where: { actorId: user.id } });
    await p.walletTransaction.deleteMany({ where: { userId: user.id } });
    await p.wholesaleOrder.deleteMany({ where: { buyerId: user.id } });
    await p.inventoryItem.deleteMany({ where: { ownerId: user.id } });
    await p.user.delete({ where: { id: user.id } });
  }
  if (supplier) await p.user.delete({ where: { id: supplier.id } });
  await p.$disconnect();
  console.log('Cleaned local mobile UI fixture.');
}
