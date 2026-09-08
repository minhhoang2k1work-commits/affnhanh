# Đánh giá PM và UI/UX — AFF — 07/09/2026

## Kết luận

Hệ thống có các khối chức năng cần thiết nhưng chưa đủ điều kiện xác nhận trải nghiệm automation hoàn chỉnh. Vấn đề chính là hành trình bị phân tán, trạng thái kết nối dễ gây hiểu nhầm, thông tin duyệt chưa tập trung và các phụ thuộc vận hành chưa sẵn sàng. Đợt sửa này đưa luồng sản phẩm → tạo video → duyệt → lịch đăng thành trọng tâm. Không chấm điểm hài lòng hoặc tuyên bố hoàn tất kiểm thử người dùng khi chưa có dữ liệu nghiên cứu.

## Phạm vi rà soát

- Kiểm tra mã nguồn điều hướng, tổng quan, thư viện sản phẩm, batch video, video riêng, chi tiết video, thư viện thành phẩm, tiến độ, publishing, AI settings, Shopee, tài khoản, Telegram, scanner, shops, collections và industries.
- Kiểm tra nhanh cấu trúc/điểm tương tác của quick lookup, link generator, video bổ sung, AccessTrade và quản trị. Các màn hình phụ này chưa được nghiệm thu toàn bộ thao tác trên tài khoản thật.
- Kiểm tra trực tiếp trên trình duyệt: tổng quan, thư viện sản phẩm, batch và tab tiến độ video, publishing, flows, thư viện video, cài đặt Shopee. Kiểm tra điện thoại 390×844, mở menu, Escape và trả focus về nút mở. Khôi phục kích thước trình duyệt sau thử nghiệm.
- Không tạo bản ghi sản phẩm, Page hoặc video giả để minh họa. Lỗi cơ sở dữ liệu quan sát được là lỗi thật của môi trường.

## Các thay đổi đã thực hiện

| Vấn đề | Khắc phục |
|---|---|
| Trang chủ ưu tiên quét/link, khó biết việc tiếp theo | Tổng quan 5 bước, số liệu từ API đọc dữ liệu thật, gợi ý việc tiếp theo và danh sách kết nối |
| Người mới khó tìm chức năng cốt lõi | Nhóm công việc hằng ngày, nguồn sản phẩm, kết nối và công cụ bổ sung; thanh điện thoại có tạo video và duyệt đăng |
| Hiển thị Connected cố định hoặc đồng nhất lưu khóa với kết nối thành công | Bỏ nhãn cố định ở tổng quan/Shopee; phân biệt đã cấu hình, đã kiểm tra và chưa xác minh; không khẳng định tài khoản trả phí giả trên header |
| API lỗi nhưng hiển thị thư viện trống | Thêm lỗi có Thử lại và Kiểm tra kết nối cho sản phẩm, video, batch, publishing, flows, shops, tài khoản và collections |
| Khó hiểu thứ tự chạy batch | Chọn sản phẩm → chọn Page/cách làm → kiểm tra số video/thời lượng/link; chỉ rõ lý do chưa chạy được và chặn bấm lặp khi đang lưu |
| Thông tin duyệt bị tách rời | Thêm phát video trực tiếp trong màn hình sửa/chi tiết, Page/hồ sơ, tiêu đề, caption, link và lịch; hỗ trợ mở tệp nguồn nếu phát thất bại |
| Nhập video/Drive chiếm nhiều không gian trước tác vụ chính | Thu gọn khu vực nhập và lưu trữ tùy chọn |
| Dễ nhầm danh sách trống do bộ lọc | Nội dung riêng cho bộ lọc không có kết quả, cho xóa bộ lọc; deep link tới chờ duyệt/lịch/đã đăng |
| Điện thoại bị tràn header, chức năng chính khó tìm | Giảm nút phụ trên header, thanh điều hướng 5 mục, khoảng đệm đáy và toolbar chọn hàng loạt |
| Khó dùng bàn phím | Skip link, focus rõ, giữ focus trong hộp duyệt/menu, Escape và trả focus, tôn trọng giảm chuyển động |
| Xóa video hiển thị thành công dù API lỗi | Chỉ bỏ video khỏi danh sách sau phản hồi thành công; giữ mục và báo lỗi nếu thất bại |

## Giới hạn còn tồn tại

1. **P0 — Chạy thật đầu-cuối:** cơ sở dữ liệu hiện không kết nối; chưa thể kiểm tra chọn sản phẩm thật, phát thành phẩm, lưu Page/lịch và duyệt đăng. Cần khôi phục dịch vụ hiện có, không seed dữ liệu để thay thế.
2. **P0 — Google Flow → template AutoCut:** luồng batch hiện tại dùng nhà cung cấp AI và FFmpeg trong AFF. Chưa có chuỗi tự động đúng yêu cầu Flow → AutoCut → thư mục chờ. UI đã nêu rõ giới hạn này. AutoCut REST và Python ở lần kiểm tra vận hành trước chưa sẵn sàng.
3. **P1 — Nghiệm thu có dữ liệu:** cần thử một sản phẩm thật trước, sau đó nhiều sản phẩm; đối chiếu từng product ID, link affiliate, video, Page, nội dung và quyết định duyệt. Kiểm thử thất bại giữa chừng/khôi phục không tạo trùng và Telegram bằng tài khoản thực tế.
4. **P2 — Hoàn thiện trải nghiệm rộng:** một số trang phụ còn thông báo native alert/confirm, nhãn kỹ thuật/tiếng Anh và biểu mẫu dài. Chưa có lưu nháp liên tục cho tất cả biểu mẫu, đo thời gian hoàn thành tác vụ hay kiểm thử trình đọc màn hình toàn hệ thống.
5. Số đếm tiến độ tổng quan lấy từ flow runs; chưa phải một chỉ số hợp nhất tất cả tác vụ nhập thủ công/AutoCut bên ngoài. Cấu hình AI/Telegram lưu trong hệ thống không chứng minh dịch vụ ngoài đang chạy thành công.

## Kiểm chứng

- `npm test`: 28 tệp, 123 kiểm thử đạt; bổ sung kiểm thử phân biệt dữ liệu chưa biết với thư viện trống, ưu tiên kiểm tra kết quả đăng chưa rõ và duyệt nháp.
- `npx tsc --noEmit`: đạt sau sửa.
- ESLint các tệp UI/core mới sửa: không có lỗi; vẫn có cảnh báo trong mã hiện hữu (ảnh, import chưa dùng, dependency hook). Lint toàn repo ở đợt trước còn 12 lỗi nền, không tuyên bố toàn repo sạch.
- Trình duyệt xác nhận lỗi tải dữ liệu không biến thành trạng thái không có video/bài; nhãn Shopee không còn Connected cố định. Mobile không tràn ngang trên tổng quan, sản phẩm và batch sau sửa header.
- Chưa thực hiện tạo video, gửi Telegram hoặc đăng bài thật trong đợt UI/UX này. Chưa nghiệm thu phát video/hộp duyệt với bản ghi thật do DB chưa kết nối.

## Tiêu chí nghiệm thu vận hành

Một đợt nhiều sản phẩm phải đối chiếu được từ nguồn đến bài đăng. Người dùng xem video, Page, nội dung và link trước khi duyệt; trạng thái đăng chỉ thành công khi có bằng chứng từ nền tảng. Lỗi phải có bước xử lý lại rõ ràng, không làm mất lựa chọn hoặc tạo bản đăng trùng. Chỉ sau khi các điều kiện này chạy qua với dữ liệu thật mới có thể gọi hệ thống sẵn sàng vận hành.
