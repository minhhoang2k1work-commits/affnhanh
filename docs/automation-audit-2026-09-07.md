# Kiểm tra luồng tự động hóa — 07/09/2026

## Luồng đích
Chọn sản phẩm → lấy link hoa hồng thật → lưu danh sách sản phẩm/link → ChatGPT phân tích và viết prompt → Google Flow tạo và tải video → AutoCut áp template → xuất thư mục chờ → tạo nội dung đăng từ thông tin sản phẩm → gắn video, link và Page vào danh sách chờ → Telegram gửi video để người dùng duyệt → xếp lịch → xác minh kết quả đăng.

## Bằng chứng chạy thật
- AFF tại http://127.0.0.1:3000 phản hồi HTTP; /api/health báo database disconnected, không kết nối được PostgreSQL đã cấu hình.
- AutoCut REST tại 127.0.0.1:8766 không phản hồi.
- D:/AutoCut/.venv/Scripts/python.exe không khởi động được: trình chạy trỏ tới một bản Python đã mất.
- Không quét/tạo sản phẩm mẫu vào database, không dùng link/video giả để diễn tập, không gửi Telegram hay đăng bài thật trong lượt kiểm tra này.
- Chưa đọc được dữ liệu tài khoản, sản phẩm, Page hoặc provider từ database; chưa chứng minh tài khoản nào đang đăng nhập/sẵn sàng.

## Đã sửa trong mã
- Loại bỏ nhánh tự ghép link Shopee với affiliate ID cố định và TikTok với mã AFF tự đặt; chặn các mẫu link cũ đó khỏi nội dung đăng. TikTok chưa có API tạo link thật nên báo chưa hỗ trợ. Dữ liệu cũ trong database chưa thể kiểm tra/làm sạch do mất kết nối.
- Bỏ ảnh Unsplash thay ảnh sản phẩm/shop, không tự gán tồn kho 100; metadata của shop chỉ suy từ URL không còn nhận là dữ liệu đã xác minh.
- Batch tạo bản nháp chờ duyệt thay vì cho phép tự đăng ngay.
- Bước lấy link thật trước AI, giữ nguyên quan hệ sản phẩm/link/Page, chờ extension mà không giả báo hoàn tất.
- Kết quả queued/pending affiliate không bị tính là link đã tạo thành công; giới hạn truy cập theo chủ sản phẩm.
- ChatGPT/OpenAI tạo nội dung đăng từ hồ sơ sản phẩm; máy chủ gắn link affiliate.
- Gửi tệp video + Page + nội dung qua Telegram, bổ sung /reviews và /approve; không xếp lịch trước khi người dùng duyệt.
- Không đánh dấu video render thất bại chỉ vì bước nội dung/Telegram lỗi.
- Extension hợp nhất báo lỗi rõ ràng khi gặp pipeline video chưa triển khai, thay vì treo ở running.
- Bước notify chỉ ghi log không còn trả notified=true.
- Bridge từ chối submit_render giả; callback completed cần tệp MP4 đọc được bằng FFmpeg. Sửa độ phân giải dọc mặc định và bỏ ghi trường renderSettings không có trong schema.
- Thư viện không thay link affiliate thiếu bằng link gốc rồi báo đó là link hoa hồng.
- Xóa fallback chứa tài khoản PostgreSQL cố định khỏi AutoCut; chỉ dùng cấu hình thực. Thông tin đăng nhập từng nằm trong lịch sử mã cần được chủ tài khoản thay khi khôi phục database.
- Readiness phân biệt kiểm tra cấu hình với chạy thật, không tuyên bố toàn luồng sẵn sàng khi Google Flow và worker AutoCut chưa được nối.

## Còn thiếu, chưa hoàn tất
1. Nối batch server vào pipeline ChatGPT/Google Flow của extension gốc. Extension hợp nhất vẫn chưa có triển khai pipeline; bản sửa chỉ loại bỏ trạng thái thành công giả.
2. Tạo worker AutoCut nhận job có templateId, khóa nhận việc, nhập clip, áp đúng template, render vào thư mục chờ, xác minh tệp và trả kết quả. Hàm áp template và xuất AFF hiện có là thao tác riêng, chưa tạo thành worker tự động.
3. Cấu hình template theo sản phẩm/ngành/Page và thư mục chờ AutoCut; hỗ trợ đổi kênh trong bước duyệt. Luồng mới hiện chọn một Facebook Page trước khi tạo video; chưa hỗ trợ đủ mọi nền tảng.
4. Khôi phục database, Python/AutoCut, kiểm tra phiên extension/ChatGPT/Flow và Telegram bằng tài khoản thật.
5. Chạy canary một sản phẩm thật tới bản nháp, xem tệp thành phẩm và duyệt đúng Page. Chỉ sau đó mở batch nhiều sản phẩm; kiểm tra mất mạng, khởi động lại, gửi trùng và retry.

Không thể gọi yêu cầu đã hoàn tất hoặc sẵn sàng chạy thực tế chỉ vì unit test đạt. Xem docs/batch-product-videos.md cho phần luồng hiện đã nối trong mã.

## Kiểm chứng bản sửa
- TypeScript: npx tsc --noEmit đạt.
- Unit test: 27 tệp, 119 test đạt, gồm chờ link thật, không tạo trùng công việc và duyệt Telegram.
- ESLint riêng các phần mới cùng giao diện/bridge đã sửa không có lỗi; lint toàn repo còn 12 lỗi và 244 cảnh báo, cần xử lý riêng.
- node --check extension-unified/background.js đạt.
- HTTP /library và /ai-video?batch=1 trả 200 sau bản sửa; chưa kiểm tra tương tác với dữ liệu thật do database lỗi.
- /api/automation/readiness trả 500 khi không kết nối được database. Không đánh dấu hệ thống ready.
