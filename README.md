# SupplyMind AI Frontend

React + TypeScript + Vite, Node.js 24. Đăng ký và đăng nhập username/password, tự chuyển trang theo role từ backend.

## Chạy local

1. Chạy backend theo README của EXE201_BE, mặc định cổng 5000.
2. Chạy `npm ci`, sao chép `.env.example` thành `.env`, rồi `npm run dev` trong thư mục FE.
3. Mở http://localhost:5173/login.

Vite chuyển `/api` đến `http://localhost:5000`. Dùng hostname `localhost` để khớp FRONTEND_URL phía backend. Giữ cổng 5173; nếu cần thay đổi, sửa cả vite.config.ts và FRONTEND_URL.

## Luồng đăng nhập

`LoginPage` gọi `services/auth.api.ts` qua Axios. Backend xác thực, gửi JWT bằng HttpOnly cookie và trả user có role. Không lưu token trong localStorage.

- STORE_OWNER vào `/store`.
- SUPPLIER vào `/supplier`.
- ADMIN vào `/admin`.

App gọi `/auth/me` khi tải lại để khôi phục phiên. Backend kiểm tra quyền độc lập; sửa URL hay dữ liệu phía frontend không cấp thêm quyền. Đăng xuất thu hồi session trên server và đưa về trang đăng nhập.

## Tổ chức

- `src/pages/login/LoginPage.tsx`: giao diện và kiểm tra form.
- `src/pages/register/RegisterPage.tsx`: đăng ký, hiển thị lỗi dưới đúng ô và chuyển về login với username đã điền.
- `src/validation/registration.ts`: chuẩn hóa dữ liệu, kiểm tra form; giữ đồng bộ với BE `services/registrationValidation.js`.
- `src/pages/WorkspacePage.tsx`: trang chào sau đăng nhập cho các role chưa có module nghiệp vụ.
- `src/pages/supplier/SupplierDashboard.tsx`: core flow Chủ vựa: thiết lập kho, danh mục và tồn kho, điều phối trạng thái đơn, KPI doanh thu.
- `src/services/supplier.api.ts`: API client cho dashboard Chủ vựa.
- `src/pages/supplier/SupplierProducts.tsx`: `/supplier/products`, đăng/sửa/ẩn/đăng lại sản phẩm bán sỉ.
- `src/pages/StoreCatalog.tsx`: `/store/catalog`, tạp hóa xem sản phẩm và thông tin chủ vựa, tìm kiếm/lọc/phân trang.
- `src/pages/StoreInventory.tsx`, `StockActivity.tsx`: kho riêng, nhập/bán hàng, lịch sử và chat tra cứu của tiệm.
- `src/services`: Axios và hàm gọi API.
- `src/types/auth.ts`: kiểu dữ liệu và ánh xạ role.
- `src/components`: logo, icon dùng chung.
- `src/index.css`: bố cục responsive, màu sắc, các trạng thái UI.

Đăng ký công khai hỗ trợ Chủ tạp hóa và Chủ vựa. Backend kiểm tra lại toàn bộ dữ liệu và lưu tài khoản vào SQL Server. Mật khẩu không được chuyển qua URL hoặc lưu vào browser storage sau đăng ký. Username được chuyển bằng router state; người dùng nhập lại mật khẩu trên trang login.

AI Retail Assistant, khuyến mãi/chiết khấu và AI Trend Alert trên dashboard Chủ vựa được đánh dấu sắp có; chưa phải chức năng đã triển khai. Chưa có quên mật khẩu, xác minh email hay Google OAuth.

Luồng kiểm tra: đăng nhập Chủ vựa → thiết lập gian hàng → Sản phẩm đăng bán → nhập tên, quy cách, giá, tồn, MOQ và bật hiển thị → Đăng bán sản phẩm. Đăng nhập Chủ tạp hóa → Tìm nguồn sỉ: thấy hàng cùng tên vựa, địa chỉ và bán kính giao. Hàng ẩn không xuất hiện; hàng hết tồn vẫn có nhãn hết hàng. Bấm tải lại nguồn hàng để lấy thay đổi mới. Chưa có nút đặt hàng; xem hàng không thay đổi kho của tiệm.

Pull cả hai repo và chạy migration/generate BE trước khi thử các trang mới. Các form dùng API thật và báo lỗi khi BE hoặc SQL chưa sẵn sàng.

## Kiểm tra và triển khai

- `npm run build`: kiểm tra TypeScript và build production.
- `npm run lint`: ESLint.
- `npm test`: kiểm tra chuẩn hóa và các trường hợp dữ liệu đăng ký không hợp lệ (Node.js 24).

Production cần SPA fallback về index.html và proxy `/api` sang backend, hoặc cấu hình VITE_API_URL trước khi build. Dùng HTTPS và FE/API cùng site. API phải cấu hình FRONTEND_URL khớp origin frontend.
