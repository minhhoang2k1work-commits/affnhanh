# Ngành hàng và dự án ChatGPT

Mở Sản phẩm & Shop → Ngành hàng & Prompt (`/industries`). Mỗi ngành lưu hồ sơ riêng: đặc điểm, khách hàng, vấn đề, kiến thức có nguồn, chủ đề social, phong cách và điều cần tránh. Sản phẩm tiếp tục được gán theo ngành hàng hiện có.

Tạo một Project trong ChatGPT web, đặt tên theo ngành, mở trang dự án và sao chép link dạng `https://chatgpt.com/g/g-p-…/project` vào hồ sơ. Không dùng link chat `/c/…` hay custom GPT. App kiểm tra dự án đã được gắn cho ngành khác trước khi lưu. Bản này không tự tạo Project.

Chọn nhiệm vụ: Gửi hồ sơ, Lên ý tưởng social, Viết kịch bản hoặc Viết prompt video. Nhập yêu cầu, chọn tối đa 5 sản phẩm, bấm Lấy dữ liệu & xem prompt. Kiểm tra và sửa prompt trước khi bấm Gửi sang ChatGPT. Mỗi yêu cầu gồm hồ sơ ngành hiện tại, sản phẩm đã chọn và thông tin nguồn; URL chưa đọc được ghi rõ.

Extension 1.12.0 hoặc bản hợp nhất 2.4.0 mở lại địa chỉ dự án đã lưu, kiểm tra đúng dự án ngay trước khi gửi, và không ghi đè bản nháp đang có. Nếu trang dự án không có ô nhập hoặc giao diện thay đổi, thao tác sẽ báo lỗi; không gửi sang chat khác. Chỉ thử lại sau khi kiểm tra tab để tránh gửi trùng khi mất phản hồi.

Đây là gửi một tin nhắn vào dự án, không phải đồng bộ Project Instructions hay tải tệp tự động. Nút Sao chép hồ sơ cho Project giúp người dùng tự thêm vào Instructions hoặc Sources. Phản hồi AI hiện xem trong ChatGPT; app chưa tự thu phản hồi về và chưa lưu lịch sử các lần gửi của trang ngành hàng.

Tài liệu chính thức: https://learn.chatgpt.com/docs/projects

Máy triển khai khác: chạy `npx prisma db execute --file prisma/industry-profiles.sql --schema prisma/schema.prisma`, sau đó `npx prisma generate` khi máy chủ đã dừng và khởi động lại web. Đây là thay đổi thêm cột, không xóa dữ liệu cũ.
