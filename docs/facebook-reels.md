# Facebook Page video/Reels

**Cập nhật:** đã có trình quản lý riêng tại `/publishing` với lịch đăng và worker Chrome. Xem [hướng dẫn trình quản lý](publishing-manager-research.md). Phần dưới mô tả công cụ thao tác từng video ban đầu.

Trong trang chi tiết video đã hoàn tất (`/ai-video/<id>`), mở khối **Đăng video/Reels lên Facebook Page**.

1. Bấm **ChatGPT viết tiêu đề và caption**. Extension dùng phiên ChatGPT của hồ sơ Chrome hiện tại, lấy mô tả dự án và dữ liệu sản phẩm liên kết, chờ phản hồi JSON rồi điền vào biểu mẫu. Có thể nhập JSON thủ công nếu giao diện ChatGPT thay đổi.
2. Kiểm tra/sửa tiêu đề, caption, hashtag và link affiliate. Nội dung nháp được lưu trong localStorage của trình duyệt. Tiêu đề được đặt ở dòng đầu của caption Reel; không hứa hẹn thứ hạng SEO.
3. Lưu ID Page dạng số và tên Page chính xác. Bấm **Mở Page đích** để mở Meta Business Suite Reels composer với `asset_id` tương ứng. Chọn đúng Page, để bản nháp trống và mở phần thêm mô tả/video.
4. Bấm **Đưa video và nội dung sang Facebook**. Extension tải video MP4 từ `/generated/` của chính AFF vào Downloads/AFF-Reels, điền caption bằng Chrome Debugger và gắn tệp vào file input. Tệp tải xuống được giữ lại.
5. Kiểm tra video, Page và thiết lập hiển thị trong Meta. Bấm **Đăng Reel** trên AFF để extension kiểm tra lại và click nút đăng.

## Trạng thái và giới hạn

- Hai extension `extension` và `extension-unified` cùng hỗ trợ; cập nhật/tải lại extension và trang AFF. Quyền mới: `business.facebook.com`; bản AFF riêng cũng thêm `downloads`.
- Đây là adapter giao diện Meta Business Suite cần kiểm chứng trên tài khoản thật. Chỉ chạy khi nhận diện duy nhất nút chọn Page có tên khớp, đúng `asset_id`, một ô caption và file input video. Nếu giao diện khác, dừng kèm hướng dẫn; không đoán tọa độ hoặc chọn nút gần giống.
- Chưa tự chuyển danh tính bằng menu Facebook cá nhân, chưa đăng theo lịch/hàng loạt, chưa lấy permalink để xác nhận xuất bản. Có thể hoàn tất trực tiếp trên Meta nếu adapter không nhận diện giao diện.
- Sau click chỉ báo `submitted_unknown`, không báo “đã xuất bản”. Kiểm tra Reel trên Page. Token dùng một lần, buộc khớp origin/tab/nội dung/tệp, hết hạn sau 30 phút; được đánh dấu trước click để không tự đăng trùng khi mất phản hồi. Reload extension/trình duyệt làm mất phiên chuẩn bị; nháp trên Meta vẫn cần kiểm tra.
- Video phải là MP4 do AFF lưu trong `public/generated`; không tải tùy ý từ URL ngoài. Tải xuống có thời hạn 90 giây. Chưa có chuyển mã/kiểm tra tỉ lệ khung hình theo yêu cầu Meta.
- Giữ tab AFF mở khi chạy. Không mở DevTools trên tab đang được extension điều khiển. Chưa xác minh live với phiên đăng nhập ChatGPT/Facebook của người dùng.

## Nhiều kênh

Một tài khoản Facebook dùng một hồ sơ Chrome. Các Page được tài khoản đó quản lý dùng chung hồ sơ, đăng tuần tự. Tài khoản khác dùng hồ sơ khác và cài/kết nối extension riêng. Danh sách Page/nháp lưu cục bộ theo origin AFF trong hồ sơ; không có bộ điều phối giữa nhiều hồ sơ. Không tạo một hồ sơ cho từng Page trừ khi có nhu cầu cô lập vận hành riêng.

Tham khảo: [Chrome profiles](https://support.google.com/chrome/answer/2364824?hl=vi), [Chrome Debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger), [OpenAI prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering).
