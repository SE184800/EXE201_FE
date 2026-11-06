# Thông báo Android — 1.1.0

APK mở app chính, có nút **Thông báo** nổi phía dưới bên phải. Màn VIP demo cũ nằm trong phần Thông báo.

## Hành vi

- Giao hàng: báo chuyển sang đang giao, nhắc trước 60 phút (đổi được 15/30/60/120 phút) và lúc đến giờ hẹn. Đọc ngày giờ đã xác nhận trong `driverInfo.estimatedDeliveryTime`, không tự đoán chuỗi “30–45 phút tới” và không áp dụng đề xuất dời lịch chưa được duyệt.
- Thanh toán: báo giao dịch ví mới, tiền cọc được xác nhận/hoàn, thanh toán được xác nhận và yêu cầu đối chiếu của chủ vựa. Lần đăng nhập đầu lấy mốc lịch sử ví, không phát lại toàn bộ giao dịch cũ. Có nhắc đơn đang chờ đặt cọc.
- Ngày lễ: nhắc 08:00 giờ Việt Nam trước 7 ngày và 1 ngày. Có lịch dương cố định; tạp hóa nhận thêm lịch cấu hình qua `/api/advisor/calendar`, admin qua `/api/admin/holidays`. Ngày âm lịch cần có trong dữ liệu máy chủ; không suy đoán ngày âm. Chủ vựa hiện dùng lịch dương có sẵn do API lịch hiện tại không cấp quyền cho vai trò này.
- Đăng xuất/chuyển tài khoản: hủy lịch và thông báo riêng của tài khoản cũ. Khi đơn đã giao/bị từ chối/đang xử lý sự cố, lần đồng bộ tiếp theo hủy lịch nhắc giao cũ.
- Có quyền thông báo Android 13+, ba kênh âm thanh độc lập, nút thử cho từng loại, lịch sắp nhắc và lịch sử 100 thông báo gần nhất. Thông báo thử được ghi rõ, không tạo đơn/giao dịch.

## Cách cập nhật

Đây là **thông báo hệ thống Android, đồng bộ định kỳ + nhắc cục bộ**, chưa phải Firebase Cloud Messaging. Không cần thay đổi BE hoặc deploy Vercel để bản APK dùng được các API hiện tại.

Khi app mở, đồng bộ sau đăng nhập/thao tác ghi và khoảng mỗi phút. Khi đóng app, `JobScheduler` kiểm tra định kỳ tối thiểu khoảng 15 phút, có thể trễ hơn do Doze/tiết kiệm pin. Cần mạng và cookie phiên đăng nhập còn hiệu lực; backend hiện có thời hạn phiên 8 giờ. Không gia hạn hoặc vượt qua chính sách đăng nhập của server.

Lịch đã lưu dùng `AlarmManager`, khôi phục sau reboot/cập nhật APK. Muốn nhắc sát giờ, bật **Cho phép nhắc đúng giờ giao**. Nếu không cấp quyền này, dùng lịch không chính xác của Android. Force stop trong Cài đặt sẽ dừng việc nhắc cho tới khi mở lại app. Nếu đơn đổi lịch khi máy mất mạng, lịch cũ còn hiệu lực tới lần đồng bộ tiếp theo.

Để có thông báo thanh toán tức thì từ server khi app đã đóng cần bổ sung dự án Firebase, token thiết bị theo tài khoản, cơ chế gửi sự kiện từ BE và triển khai backend. Không có khóa Firebase hoặc tài khoản dịch vụ nhúng trong APK này.

## Build và kiểm tra

`npm run mobile:apk` kiểm tra đường dẫn SDK/JDK và dừng nếu build lỗi, không xuất nhầm APK cũ. File nguồn thông báo nằm trong `android/app/src/main/java/com/supplymind/mobile/Notification*.java` và `SupplyMindNotificationsPlugin.java`. Adapter web `public/supplymind-notifications.js` được nhúng bởi Capacitor để chạy với web đang host.

`npm test` gồm các test adapter đăng nhập/đăng xuất, request khác origin và bản web không có native plugin. Android instrumentation gồm `NotificationRulesTest` và `NotificationDeviceTest`: múi giờ, hai định dạng giờ giao, lịch chưa được duyệt, hủy lịch, xác nhận thanh toán, quyền, chống trùng và thông báo thật từ AlarmManager. `NotificationPermissionDeniedTest` chạy riêng sau khi thu hồi quyền trên emulator. `NotificationPreviewTest` chỉ chạy fixture khi truyền `-e preview true`, không nằm trong APK ứng dụng.

API chỉ được đọc với cookie từ Android CookieManager, không gửi cookie/mật khẩu vào JavaScript và không ghi ra log. Request chỉ tới host SupplyMind đã cấu hình, không đi theo HTTP redirect. Lỗi mạng hoặc phân trang chưa tải đủ giữ nguyên lịch cũ, không coi trang đầu là toàn bộ danh sách.
