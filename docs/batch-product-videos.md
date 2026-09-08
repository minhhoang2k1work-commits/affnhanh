# Video sản phẩm hàng loạt và duyệt đăng

Trong Thư viện sản phẩm, chọn tối đa 50 sản phẩm rồi bấm **Tạo video chờ duyệt từ sản phẩm đã chọn**. Hoặc mở AI Video Studio → Hàng loạt.

1. Chọn Page dự kiến. Page có thể còn tạm dừng khi tạo bản nháp; phải được xác minh và bật trước lúc duyệt đăng.
2. AFF lưu mỗi sản phẩm thành một dự án và một flow, cùng Page và link affiliate tương ứng. Nếu thiếu link, bước đầu tiên gọi dịch vụ affiliate hoặc xếp công việc cho extension rồi chờ link ACTIVE. Không dùng link sản phẩm thường để thay thế.
3. Tạo kịch bản, storyboard, clip, thuyết minh và ghép MP4 bằng nhà cung cấp AI cùng FFmpeg hiện có. **Đây chưa phải luồng Google Flow → template AutoCut.**
4. ChatGPT/OpenAI viết tiêu đề, mô tả và hashtag từ hồ sơ sản phẩm đã lưu. AFF gắn link affiliate ở phía máy chủ. Đây là nội dung tạo từ dữ liệu đã lưu, không phải xác nhận đã đọc lại trang sản phẩm hay đã xem video thành phẩm.
5. Lưu PublishingPost ở trạng thái draft, chưa có lịch đăng. Tệp video nằm trong public/generated theo dự án; chưa có thư mục chờ riêng của AutoCut.
6. Bước Telegram gửi tệp MP4 (tối đa 49 MB), nội dung và Page tới các người dùng được phép trong cấu hình Telegram. Gửi /reviews để xem bản nháp; /approve mã-bài để duyệt và xếp lịch. Có thể duyệt trong Quản lý đăng bài trên web.
7. Extension chỉ nhận bài đã lên lịch. submitted_unknown chưa phải bằng chứng đã đăng thành công; cần permalink/kết quả kiểm tra theo luồng publishing hiện có.

Thiếu Telegram hoặc gửi thất bại sẽ báo lỗi bước thông báo, giữ video đã render và bản nháp để xử lý lại. Trường hợp mất phản hồi Telegram sau khi nhận tệp có thể gửi lại tệp khi retry; không dùng kết quả gửi tin nhắn làm bằng chứng xuất bản.

Flow mới dùng ID riêng để không thay đổi quan hệ phụ thuộc của các flow cũ. Các flow cũ khi tới bước xếp bài cũng tạo bản nháp; bài đã được lên lịch trước bản sửa này không tự bị thu hồi.

Sau khi máy chủ khởi động lại, cần worker /api/flows/worker hoặc cấu hình FLOW_AUTO_START theo cơ chế hiện có để tiếp tục hàng đợi. Không chạy npm run build chỉ để kiểm tra TypeScript: script build hiện còn gọi prisma db push.

## Cập nhật 08/09/2026

Đã bổ sung lựa chọn Google Flow, worker AutoCut theo template và thư mục chờ; đã đọc được database thật ngoài sandbox. Xem `automation-handoff-2026-09-08.md` để biết cách khởi động, bằng chứng hiện tại và phần cần cấu hình tài khoản. Các kết luận mất kết nối/chưa có worker ở báo cáo 07/09 là trạng thái lịch sử.
