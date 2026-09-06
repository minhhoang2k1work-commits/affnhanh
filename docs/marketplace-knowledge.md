# Hồ sơ sản phẩm cho prompt

Trong Thư viện, chọn **Lấy dữ liệu viết prompt**. Extension mở trang sản phẩm ở tab nền, đọc dữ liệu, đóng tab và lưu vào sản phẩm. Chọn **Xem hồ sơ** hoặc **Sao chép dữ liệu cho prompt** để kiểm tra và sử dụng lại. Nút này có ở cả chế độ thẻ và bảng.

Quét shop cũng đọc trang chi tiết của từng sản phẩm trước khi đưa vào danh sách chờ đẩy lên web. Quét chi tiết mất nhiều thời gian hơn quét thẻ sản phẩm. Dữ liệu cũ được giữ lại nếu lần đọc mới thiếu thông tin.

Hồ sơ gồm mô tả, phần chi tiết, thương hiệu/SKU, thông số, phân loại, ảnh, video, đánh giá mẫu, giá và tình trạng hàng nếu đọc được, vận chuyển, đổi trả, bảo hành, ưu đãi, nguồn và thời điểm thu thập. Kịch bản và storyboard trên web sử dụng hồ sơ đã lưu. Luồng video của extension gốc cũng lưu lại dữ liệu đọc mới.

Phạm vi hiện tại là Shopee Việt Nam và TikTok Shop. Chỉ thu thập dữ liệu trang sản phẩm đã tải được trong phiên trình duyệt; không bảo đảm toàn bộ dữ liệu nội bộ của sàn, tất cả đánh giá, tất cả SKU hoặc các nội dung bị ẩn. Mỗi shop giữ giới hạn quét hiện tại: 250 sản phẩm/25 lượt cuộn. Hồ sơ giới hạn mô tả 30.000 ký tự, phần chi tiết 15.000 ký tự, tối đa 100 ảnh/video/thông số và 30 đánh giá mẫu. Bộ đọc cuộn thêm 5 màn hình để tải nội dung. Không vượt đăng nhập hoặc CAPTCHA; lỗi đọc được lưu để biết cần đọc lại.

Nội dung sàn được coi là dữ liệu, không phải chỉ dẫn cho AI. Đánh giá là ý kiến khách hàng, giá và ưu đãi có thể thay đổi. Không dùng trường chưa đọc được để suy đoán công dụng hay chứng nhận.

## Cài đặt

- Bản gốc: `public/downloads/aff-shopee-scanner.zip` (1.10.0).
- Bản hợp nhất: `public/downloads/autoflow-hub.zip` (2.2.0).
- Bản hợp nhất đã cập nhật phần thu thập dữ liệu; pipeline video của bản này vẫn là phần khung có sẵn, chưa hoàn thiện. Dùng bản gốc nếu cần chạy pipeline video extension.
- Giải nén, tải lại extension trong `chrome://extensions`, sau đó tải lại tab AFF HUB và tab sàn.
- Môi trường triển khai khác cần chạy `npx prisma db execute --file prisma/marketplace-knowledge.sql --schema prisma/schema.prisma` và `npx prisma generate`. SQL chỉ thêm cột JSONB, có thể chạy lại.

## Kiểm thử

`npx vitest run` kiểm tra xử lý dữ liệu và các luồng hiện có. `node scripts/test-marketplace-collector.cjs` kiểm tra cả hai content script trên trang mẫu bằng Edge headless (đặt `TEST_BROWSER_CHANNEL=chrome` nếu dùng Chrome). Trang mẫu được phục vụ qua Playwright route, không truy cập sàn thật.
