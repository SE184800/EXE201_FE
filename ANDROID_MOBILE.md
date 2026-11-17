# APK chủ cửa hàng — 1.2.0-store (versionCode 9)

Đăng nhập vai trò `STORE_OWNER` mở thẳng **Bán nhanh**. Thanh dưới có bốn mục: Bán nhanh, Kho hàng, Đơn hàng, Ví. Hồ sơ, gói sử dụng và đăng xuất ở nút tài khoản; chuông mở cài đặt thông báo Android. Các vai trò khác giữ giao diện hiện có.

## Bán nhanh

- Tìm/chọn hàng hoặc nói “Coca 2 và mì Hảo Hảo 3”, kiểm tra tên, số lượng và tổng tiền rồi bấm **Ghi nhận bán**. Giọng nói chỉ thêm vào lượt bán, không tự xác nhận giao dịch. Không chọn ngầm khi tên khớp nhiều mặt hàng.
- Chặn thiếu giá, hết hàng, hết hạn, số lượng không nguyên, vượt tồn kho và đơn vị chưa quy đổi bán lẻ. Nhập hàng, sửa giá và quy đổi đơn vị thực hiện trên web.
- Dùng API hiện có `POST /api/inventory/sales/batch`: toàn bộ lượt bán trong một transaction, ghi doanh thu và trừ kho. Đây là ghi nhận bán tại quầy; không thu tiền qua Ví.
- Lưu lượt bán và từng `requestId` trên thiết bị trước khi gửi. Bấm lặp, mất phản hồi, mở lại app hoặc đăng nhập lại đều gửi đúng mã cũ. Lượt chưa rõ kết quả bị khóa chỉnh sửa và có nút **Kiểm tra lại lượt bán**. Không coi mất mạng là bán thành công.
- Chỉ trả về bản nháp khi lần gửi đầu bị máy chủ từ chối rõ ràng. Với lượt đã mất kết quả, giữ nguyên để tránh ghi trùng; nếu lỗi kéo dài cần đối chiếu lịch sử kho trên web. Không xóa dữ liệu ứng dụng khi còn lượt chờ xác nhận.
- Bản nháp tách theo ID tài khoản. Đăng xuất xóa trạng thái đăng nhập nhưng giữ mã lượt bán để khôi phục an toàn.

## Giao diện trong APK và API

APK chứa bundle React trong `dist`; không cần deploy FE để thấy giao diện mới. `capacitor.config.ts` dùng HTTPS hostname `supplymind-demo.vercel.app`, không có `server.url`.

`MobileWebViewClient` để WebView gửi `/api/*` và `/uploads/*` qua HTTPS thật; các tài nguyên giao diện còn lại được Capacitor phục vụ từ APK. POST body và HttpOnly cookie vẫn do WebView quản lý. API và dữ liệu online vẫn cần máy chủ hoạt động; đây không phải chế độ bán offline. Bản web thông thường không bật giao diện mobile này.

`VITE_MOBILE_APP=true` chỉ dùng để kiểm tra giao diện trong trình duyệt. Bản APK nhận diện bằng Capacitor. Cơ chế thông báo và thời hạn phiên giữ như [ANDROID_NOTIFICATIONS.md](ANDROID_NOTIFICATIONS.md). Nhận dạng giọng nói phụ thuộc dịch vụ nhận dạng trên điện thoại và quyền micro; luôn có cách chọn hàng bằng tay.

## Build và kiểm tra

Trên Windows dùng `npm.cmd` để tránh lỗi ExecutionPolicy của `npm.ps1`. Dùng JDK 21 và Android SDK đã cấu hình.

```powershell
npm.cmd test
npx.cmd eslint src/mobile src/services/auth.api.ts src/services/api.ts
npm.cmd run mobile:apk
```

Kiểm tra tích hợp giao diện với BE và SQL local:

```powershell
# Playwright chỉ là công cụ QA; có thể cài riêng ngoài repo và chỉ đường dẫn tới index.mjs.
$env:PLAYWRIGHT_MODULE = 'C:\qa\node_modules\playwright\index.mjs'
$env:MOBILE_TEST_OUTPUT = 'C:\qa'
node scripts/test-mobile-store.mjs
```

Mặc định script dùng repo `../EXE201_BE` và Edge trên Windows. Có thể cấu hình `MOBILE_TEST_BE`, `MOBILE_TEST_BROWSER`. Script chỉ cho phép SQL localhost/127.0.0.1; tạo tài khoản và hàng hóa riêng, dọn dữ liệu trong `finally`. Kiểm tra bán nhiều món, bấm lặp, mất phản hồi sau commit, mất mạng trước gửi, khôi phục sau đăng xuất, rollback khi thiếu hàng, ba trạng thái đơn, bốn màn hình và hộp thoại ví ở 320/390/768 px. Giọng nói trong script là kết quả giả lập để kiểm tra xử lý câu; không thay thế kiểm tra âm thanh thật.

Android instrumentation: build `:app:assembleDebugAndroidTest`, cài cả APK app và test, chạy `MobileAppTest` cùng các test thông báo. `MobileAppTest` kiểm tra routing, bundle native, GET health và POST đăng nhập với username không tồn tại. Phép thử mạng này cần server online ổn định; lỗi 5xx cần phân biệt với lỗi APK.

Các phép thử chỉ kiểm chứng những tình huống đã chạy, không đảm bảo hệ thống không thể phát sinh lỗi. Cần thử nhận dạng tiếng Việt bằng micro trên điện thoại thật trước khi phát hành rộng.
