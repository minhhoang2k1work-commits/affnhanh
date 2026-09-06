# Ngành hàng & Prompt

Mở **Sản phẩm & Shop → Ngành Hàng & Prompt** (`/industries`).

1. Thêm ngành hàng hoặc chọn danh mục hiện có để tạo hồ sơ.
2. Lưu prompt cơ bản: đối tượng, thời lượng, phong cách, số cảnh và các yêu cầu cần giữ.
3. Dán link sản phẩm/tham khảo, mỗi dòng một link (tối đa 20).
4. Gắn link ChatGPT và link bên trong dự án Flow. Link Flow phải có `/project/…` hoặc `/projects/…`; trang chủ không được dùng làm link dự án.
5. Chọn sản phẩm trong thư viện. Có thể gán ngành hàng hàng loạt tối đa 250 sản phẩm; chọn tối đa 5 sản phẩm khi ghép một prompt.
6. Chọn **Lấy dữ liệu & xem prompt**, kiểm tra/chỉnh nội dung rồi **Gửi sang ChatGPT** hoặc sao chép để dùng thủ công.

Prompt ghép gồm yêu cầu người dùng, hồ sơ sản phẩm đã chọn và dữ liệu đọc từ link Shopee/TikTok. Link khác được giữ lại và ghi rõ chưa đọc nội dung. Gửi sang ChatGPT mở hoặc dùng lại tab đúng URL đã lưu, không ghi đè bản nháp đang có, không tự gửi lại khi chưa nhận được xác nhận. Nếu link dự án ChatGPT không hiện ô nhập, hãy lưu link cuộc trò chuyện bên trong dự án.

Trong Thư viện, nút Video tự lấy prompt, ChatGPT và Flow của ngành hàng sản phẩm. Ngành hàng đã tạo hồ sơ cần có link dự án Flow trước khi chạy. Khi dùng dự án đã gắn, các cảnh chạy tuần tự; hệ thống dừng nếu không mở đúng dự án hoặc không có quyền truy cập, không bấm tạo dự án mới. Bản gốc extension có pipeline đầy đủ; pipeline video của bản hợp nhất vẫn là phần khung có sẵn, nhưng quản lý ngành hàng và gửi prompt hoạt động với cả hai bản.

Prompt ngành hàng cũng được bổ sung vào ngữ cảnh kịch bản/storyboard của AI Video Studio. Đổi tên hồ sơ sẽ đổi ngành hàng trên các sản phẩm cùng tên của người dùng. Dữ liệu được lưu trong cơ sở dữ liệu, dùng lại sau khi tải lại trang.

## Cập nhật

- Bản gốc: 1.10.0, `public/downloads/aff-shopee-scanner.zip`.
- Bản hợp nhất: 2.2.0, `public/downloads/autoflow-hub.zip`.
- Giải nén, tải lại extension và tải lại các tab AFF HUB, ChatGPT, Flow để content script mới hoạt động.
- Môi trường khác cần chạy `npx prisma db execute --file prisma/industry-workspaces.sql --schema prisma/schema.prisma` rồi `npx prisma generate`. Bảng đã được thêm vào cơ sở dữ liệu cấu hình trong workspace này.

Kiểm thử gồm xác thực link, ghép prompt, quyền cập nhật/gán ngành hàng, không tạo dự án khi chế độ dùng lại đang bật và không ghi đè bản nháp ChatGPT. Việc gửi thật tới ChatGPT/Flow cần phiên đăng nhập và extension đang hoạt động; kiểm thử tự động không gửi prompt hoặc tạo video trên tài khoản thật.
