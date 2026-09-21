# SG Restock Frontend

React + TypeScript + Vite. Đăng nhập username/password, tự chuyển trang theo role từ backend.

## Chạy local

1. Chạy backend theo README của EXE201_BE, mặc định cổng 5000.
2. Chạy `npm ci`, rồi `npm run dev` trong thư mục FE.
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
- `src/pages/WorkspacePage.tsx`: trang chào sau đăng nhập theo role.
- `src/services`: Axios và hàm gọi API.
- `src/types/auth.ts`: kiểu dữ liệu và ánh xạ role.
- `src/components`: logo, icon dùng chung.
- `src/index.css`: bố cục responsive, màu sắc, các trạng thái UI.

Các module nghiệp vụ trên trang chào được ghi rõ sắp có, chưa phải chức năng đã triển khai. Chưa có đăng ký công khai, quên mật khẩu hay Google OAuth. Nút hỗ trợ hướng dẫn liên hệ quản trị viên.

## Kiểm tra và triển khai

- `npm run build`: kiểm tra TypeScript và build production.
- `npm run lint`: ESLint.

Production cần SPA fallback về index.html và proxy `/api` sang backend, hoặc cấu hình VITE_API_URL trước khi build. Dùng HTTPS và FE/API cùng site. API phải cấu hình FRONTEND_URL khớp origin frontend.
