const fs = require('fs');

const f1 = 'src/pages/supplier/SupplierDashboard.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = c1.replace(
  '<nav className="catalog-nav" aria-label="Chủ vựa"><Link to="/supplier" aria-current="page">Tổng quan & đơn hàng</Link><Link to="/supplier/products">Sản phẩm đăng bán</Link></nav>',
  '<nav className="catalog-nav" aria-label="Chủ vựa"><Link to="/supplier" aria-current="page">Tổng quan & đơn hàng</Link><Link to="/supplier/products">Sản phẩm đăng bán</Link><Link to="/supplier/inventory">Kho hàng</Link></nav>'
);
fs.writeFileSync(f1, c1);

const f2 = 'src/pages/supplier/SupplierProducts.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(
  '<nav className="catalog-nav" aria-label="Chủ vựa"><Link to="/supplier">Tổng quan & đơn hàng</Link><Link to="/supplier/products" aria-current="page">Sản phẩm đăng bán</Link></nav>',
  '<nav className="catalog-nav" aria-label="Chủ vựa"><Link to="/supplier">Tổng quan & đơn hàng</Link><Link to="/supplier/products" aria-current="page">Sản phẩm đăng bán</Link><Link to="/supplier/inventory">Kho hàng</Link></nav>'
);
fs.writeFileSync(f2, c2);

const f3 = 'src/App.tsx';
let c3 = fs.readFileSync(f3, 'utf8');
if (!c3.includes('/supplier/inventory')) {
  c3 = c3.replace(
    '<Route path="/supplier/products"',
    '<Route path="/supplier/inventory" element={user?.role === \'SUPPLIER\' ? <SupplierInventory onLogout={clearUser} /> : checkingSession && !user ? restoreSession : <Navigate to={destination} replace />} />\n        <Route path="/supplier/products"'
  );
  c3 = c3.replace(
    'import SupplierProducts from \'./pages/supplier/SupplierProducts\';',
    'import SupplierProducts from \'./pages/supplier/SupplierProducts\';\nimport SupplierInventory from \'./pages/supplier/SupplierInventory\';'
  );
  fs.writeFileSync(f3, c3);
}
console.log('Routes and navs updated.');
