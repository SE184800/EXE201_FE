# Thông báo Android — 1.1.2

> Bản APK 1.2.0-store đóng gói giao diện trong APK và đưa chuông lên đầu màn hình chủ cửa hàng. Xem [ANDROID_MOBILE.md](ANDROID_MOBILE.md). Các quy tắc thông báo dưới đây vẫn áp dụng.

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

Web hiện còn có tự đăng xuất sau 15 phút không thao tác. Khi web thực hiện đăng xuất, APK cũng dừng và xóa nhắc riêng của tài khoản; lịch lễ công khai vẫn hoạt động. Đây không phải cơ chế giữ đăng nhập vĩnh viễn.

Lịch đã lưu dùng `AlarmManager`, khôi phục sau reboot/cập nhật APK. Muốn nhắc sát giờ, bật **Cho phép nhắc đúng giờ giao**. Nếu không cấp quyền này, dùng lịch không chính xác của Android. Force stop trong Cài đặt sẽ dừng việc nhắc cho tới khi mở lại app. Nếu đơn đổi lịch khi máy mất mạng, lịch cũ còn hiệu lực tới lần đồng bộ tiếp theo.

Để có thông báo thanh toán tức thì từ server khi app đã đóng cần bổ sung dự án Firebase, token thiết bị theo tài khoản, cơ chế gửi sự kiện từ BE và triển khai backend. Không có khóa Firebase hoặc tài khoản dịch vụ nhúng trong APK này.

## Build và kiểm tra

`npm run mobile:apk` kiểm tra đường dẫn SDK/JDK và dừng nếu build lỗi, không xuất nhầm APK cũ. File nguồn thông báo nằm trong `android/app/src/main/java/com/supplymind/mobile/Notification*.java` và `SupplyMindNotificationsPlugin.java`. Adapter web `public/supplymind-notifications.js` được nhúng bởi Capacitor để chạy với web đang host.

`npm test` gồm các test adapter đăng nhập/đăng xuất, request khác origin và bản web không có native plugin. Android instrumentation gồm `NotificationRulesTest` và `NotificationDeviceTest`: múi giờ, hai định dạng giờ giao, lịch chưa được duyệt, hủy lịch, xác nhận thanh toán, quyền, chống trùng và thông báo thật từ AlarmManager. `NotificationPermissionDeniedTest` chạy riêng sau khi thu hồi quyền trên emulator. `NotificationPreviewTest` chỉ chạy fixture khi truyền `-e preview true`, không nằm trong APK ứng dụng.

API chỉ được đọc với cookie từ Android CookieManager, không gửi cookie/mật khẩu vào JavaScript và không ghi ra log. Request chỉ tới host SupplyMind đã cấu hình, không đi theo HTTP redirect. Lỗi mạng hoặc phân trang chưa tải đủ giữ nguyên lịch cũ, không coi trang đầu là toàn bộ danh sách.

## Sửa lỗi trong 1.1.2

- Giữ nhắc đến giờ giao trong khoảng bù trễ 2 giờ khi lần đồng bộ chạy sau giờ hẹn; không phát lại nhắc trước giờ đã qua.
- Giữ sự kiện đang giao chưa hiện qua các lần đồng bộ khi người dùng chưa bật kênh/quyền. Hủy khi đơn không còn đang giao.
- Phân biệt thay đổi tiền cọc với yêu cầu đối chiếu khoản còn lại; hoàn tiền không còn bị ghi nhầm là xác nhận thanh toán. Không phát lại xác nhận khi ví chuyển từ PAID sang SETTLED.
- Loại bỏ yêu cầu đối chiếu cũ đã được giải quyết khỏi hàng đợi. Gộp thông báo tồn đọng theo đúng kênh đang bật; không đánh dấu đã hiện nếu Android từ chối đăng thông báo.
- Nhận lịch lễ dạng ngày ISO, gộp tên các ngày lễ cùng ngày; giữ lịch cũ nếu dữ liệu lịch admin không đúng định dạng.
- Cầu nối chỉ xử lý đăng xuất đúng origin/đường dẫn; hỗ trợ fetch với URL object và xóa nhắc riêng cả khi yêu cầu đăng xuất bị mất mạng.

## Kiểm thử hồi quy

Dùng JDK 21 cho Android lint của AGP 8.7 (JDK 25 trên máy vẫn build được nhưng bộ lint này lỗi khi phân tích phiên bản Java). Các test fixture chỉ nằm trong APK instrumentation, không nằm trong APK giao cho người dùng.

```powershell
npm test
npm run mobile:sync
cd android
.\gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug
.\gradlew.bat :app:connectedDebugAndroidTest '-Pandroid.testInstrumentationRunnerArguments.class=com.supplymind.mobile.NotificationRulesTest,com.supplymind.mobile.NotificationDeviceTest,com.supplymind.mobile.NotificationSyncTest'
```

Kiểm tra tích hợp BE + SQL local: chạy `node scripts/test-notifications-backend.cjs` từ FE, cài APK app và APK androidTest vừa build lên emulator, chạy `adb reverse tcp:18765 tcp:18765`, rồi:

```powershell
adb shell am instrument -w -e localBackend true -e class com.supplymind.mobile.NotificationBackendTest com.supplymind.mobile.test/androidx.test.runner.AndroidJUnitRunner
```

Script chỉ chấp nhận SQL Server localhost/127.0.0.1, tạo tài khoản/đơn/lễ/giao dịch sandbox riêng và dọn đúng dữ liệu của lượt kiểm tra trong `finally`. Không gửi email, gọi AI hoặc tạo giao dịch trên server đang host. Nếu cần dừng thủ công, Ctrl+C vào script để dọn fixture. Dùng `-e hosted true` với `NotificationHostedBridgeTest` để kiểm tra nút chuông trên web đang host (chỉ đọc/mở màn hình, không đăng nhập hay thay đổi dữ liệu).
