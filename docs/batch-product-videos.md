# Tạo video sản phẩm và đăng Facebook hàng loạt

Mở **AI Video Studio → Hàng Loạt → FB**.

1. Chọn Page đã kiểm tra và bật tự đăng tại `/publishing`. Cấu hình khung giờ của Page; video hoàn tất sẽ chiếm khung giờ trống kế tiếp theo giờ Việt Nam.
2. Chọn phong cách, thời lượng và tối đa 50 sản phẩm. Có thể tìm kiếm, chuyển trang mà vẫn giữ lựa chọn, hoặc chọn cả trang. Sản phẩm cần có ảnh và link affiliate ACTIVE của tài khoản hiện tại; tạo link trong thư viện trước nếu thiếu.
3. Bấm **Tạo N video và tự đăng Facebook**. Mỗi sản phẩm có một dự án video và một pipeline riêng. Nút này cho phép tạo video bằng cấu hình AI hiện tại và tự đăng lên Page đã chọn.
4. Theo dõi tiến độ tại phần video hàng loạt gần đây. Khi một bước lỗi, sửa cấu hình liên quan rồi bấm **Thử lại bước bị lỗi**; những bước đã hoàn tất được giữ lại.
5. Xem lịch và kết quả tại `/publishing`. Trạng thái `submitted_unknown` chỉ có nghĩa đã gửi lệnh đăng; cần kiểm tra trên Facebook theo quy trình hiện có.

Nội dung bài đăng gồm tên sản phẩm, lời mời xem thông tin/giá hiện tại, đúng link affiliate của sản phẩm và thông báo tiếp thị liên kết. Link được chụp lại khi tạo đợt, được gắn vào mô tả bài đăng, không phải thẻ sản phẩm Facebook Shop. Không tự tạo link affiliate hoặc thay bằng link thường khi thiếu link.

Máy chủ AFF, nhà cung cấp AI đã cấu hình và hồ sơ Chrome có extension đăng Facebook cần hoạt động. Sau khi máy chủ khởi động lại, dùng cơ chế worker `/api/flows/worker` hiện có hoặc cấu hình `FLOW_AUTO_START=true` cùng `DATABASE_URL` để nạp lại hàng đợi. Google Drive chỉ được dùng theo cấu hình tự lưu hiện có.

Không cần thay đổi schema. Dự án, flow và cấu hình đăng được lưu trong một transaction; mỗi yêu cầu có khóa chống tạo trùng. Bước Facebook dùng khóa đăng ổn định khi retry và tái kiểm tra Page trước khi xếp lịch. Page bị tạm dừng hoặc mất xác minh sẽ làm bước xếp lịch báo lỗi.

Kiểm chứng: unit test cho giới hạn, quyền sở hữu sản phẩm/Page, thiếu link, ánh xạ sản phẩm/link, yêu cầu lặp và retry đăng bài; kiểm tra TypeScript và giao diện. Chưa kiểm chứng đăng thật trong môi trường thiếu kết nối database/extension.
