# Nâng cấp trình quản lý đăng bài — 07/09/2026

## Đối chiếu sản phẩm

| Sản phẩm | Điểm tham khảo từ tài liệu chính thức | Áp dụng vào AFF |
| --- | --- | --- |
| [Buffer](https://support.buffer.com/en-us/articles/scheduling-posts-4Qdld7giAZ) | Lên lịch theo thời điểm hoặc hàng đợi, lựa chọn kênh và xem trước nội dung | Bản nháp; duyệt ngày giờ; khung giờ trống tiếp theo; một nội dung cho nhiều Page |
| [Metricool](https://metricool.com/program-posts-on-facebook-with-metricool/) | Planner và lên lịch nội dung Facebook, gồm Reels | Lịch tuần, Page đích, nội dung chỉnh sửa trước khi duyệt |
| [SocialPilot](https://help.socialpilot.co/article/666-editing-and-rescheduling-your-posts) | Danh sách bài theo trạng thái; sửa/lên lịch lại; lịch ngày/tuần/tháng và thao tác nhiều tài khoản | Hàng đợi lọc Page/trạng thái, nhật ký bài, hủy lịch, sửa và duyệt lại |

Đây là nghiên cứu tài liệu công khai, chưa thử tài khoản trả phí của các đối thủ. Không suy luận cơ chế triển khai nội bộ từ tính năng tiếp thị. Giá và số lượng bài tối đa của các gói không dùng làm tiêu chí thiết kế.

## Quyết định theo yêu cầu người dùng

Ưu tiên tài khoản Facebook đang đăng nhập Chrome/extension, chưa yêu cầu Meta App hoặc Page Access Token. Vì vậy AFF cần phân biệt rõ lưu lịch trên máy chủ với thực thi trên Chrome. Không quảng cáo khả năng đăng khi máy tính tắt. [Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms) hỗ trợ đánh thức service worker định kỳ nhưng không đánh thức thiết bị đang ngủ.

## Phạm vi đã xây dựng

- `/publishing`: Hàng đợi, Lịch tuần, Kênh & hồ sơ. Lối vào từ sidebar và trang video.
- Kênh lưu trên PostgreSQL, ràng buộc Page ID với một thiết bị extension; tên hồ sơ do người dùng đặt để dễ nhận diện. Không tự đọc hay tạo hồ sơ Chrome Windows.
- Kiểm tra đúng Page qua extension trước khi bật tự đăng. Kênh mới/đổi danh tính mặc định tạm dừng.
- Soạn tiêu đề/caption từ mô tả sản phẩm bằng luồng ChatGPT hiện có; chỉnh sửa và lưu bản nháp. Có đường nhập JSON thủ công nếu ChatGPT thay đổi giao diện.
- Chọn 1–20 Page; một bản ghi độc lập cho mỗi Page. Mã yêu cầu ngăn thao tác lưu lặp tạo bài trùng.
- Lịch theo giờ Việt Nam, UTC+7. Chọn giờ cụ thể, đăng ngay khi extension nhận, hoặc xếp vào khung giờ tiếp theo của từng kênh. Tối đa 12 khung giờ/ngày, tìm chỗ trống trong 90 ngày và tránh hai bài cùng Page cách nhau dưới 5 phút.
- Alarm mỗi phút, không cần tab AFF mở. Thiết bị nhận bài qua license/device đã kết nối. Lease PostgreSQL và transaction Serializable ngăn hai worker nhận trùng; mỗi hồ sơ xử lý tuần tự.
- Giới hạn trễ 1–60 phút theo kênh. Quá hạn thì chuyển `missed` khi worker kiểm tra, cần chọn lịch mới; không tự đăng bù hàng loạt.
- Máy chủ đánh dấu `submitted_unknown` trước khi cho phép click cuối. Không tự thử lại thao tác đăng khi chưa rõ kết quả.
- Chỉ nhận tự động thành công nếu adapter thấy thông báo xuất bản và một link Reel/video mới trong thông báo đó. Nếu thiếu bằng chứng thì người dùng đối chiếu và xác nhận link hoặc xác nhận chưa đăng. Hồ sơ có bài chưa rõ kết quả/cần xử lý tạm chờ bài đó được giải quyết.
- Receipt lưu trong chrome.storage.local để gửi lại báo cáo khi mất mạng. Khởi động lại extension không tiếp tục click bài dở dang. Lỗi trước đăng chuyển sang cần xử lý; không tự lặp upload vào bản nháp cũ.

## Thiết lập vận hành

1. Chạy `npx prisma generate`. Áp dụng **một lần** `npx prisma db execute --file prisma/publishing-manager.sql --schema prisma/schema.prisma` trên cơ sở dữ liệu AFF hiện có. Migration chỉ thêm bảng/cột, có transaction; không dùng reset database.
2. Cài bản extension mới: AutoFlow Hub 2.6.0 hoặc AFF HUB 1.14.0, tải lại trang AFF. Cần quyền `alarms`, `downloads`, `debugger` và `business.facebook.com`.
3. Mở AFF trong hồ sơ Chrome chứa tài khoản Facebook mong muốn; kết nối server và license như luồng extension sẵn có.
4. Vào Kênh & hồ sơ → Dùng hồ sơ Chrome hiện tại → điền Page ID/tên → lưu → Mở Page → Kiểm tra Page → Bật tự đăng.
5. Tạo bài, chọn video MP4 hoàn tất, tạo/sửa nội dung, chọn Page và duyệt lịch. Việc duyệt lịch là cho phép extension đăng nội dung đó.
6. Giữ Chrome, máy tính và máy chủ AFF hoạt động. Xem dấu “Extension đang trực” dựa trên lần poll publishing gần nhất trong 3 phút. Cấu hình Basic Auth của AFF nếu có phải cho phép extension truy cập máy chủ.
7. Xử lý các bài Cần xác nhận/Cần xử lý trước khi để hồ sơ đăng tiếp. “Hủy lịch” chỉ hủy công việc trong AFF, không xóa bài Facebook.

## Giới hạn cần kiểm chứng thực tế

- Adapter Meta Business Suite dùng kiểm tra DOM nghiêm ngặt. Chưa được thử end-to-end trên tài khoản Facebook/ChatGPT của người dùng. Có thể cần hiệu chỉnh nhận diện bộ chọn Page, các bước wizard, file input hoặc thông báo xuất bản theo giao diện tài khoản.
- Video chỉ từ `/generated/*.mp4` trên cùng máy chủ AFF, không tải tùy ý từ URL bên ngoài. Tải xuống tối đa 90 giây; không có chuyển mã hoặc kiểm tra bản quyền âm nhạc.
- Lịch mang tính gần đúng theo chu kỳ poll và thời gian upload/xử lý video, không cam kết đúng từng giây.
- Một lần tải quản lý lấy tối đa 500 bài mới nhất; lịch tuần phản ánh tập dữ liệu đó. Chưa có phân trang lịch sử đầy đủ, analytics lượt xem, inbox, lịch tháng, kéo thả, hoặc phân quyền duyệt nhiều người.
- Chưa tự tạo nội dung vô hạn theo khung giờ; khung giờ chỉ phân bổ những bài người dùng đã tạo và duyệt.

## Kiểm chứng

Kiểm thử tự động tập trung vào chuyển đổi múi giờ/qua năm, chọn slot, idempotency, lease, kênh tạm dừng, giờ đã lỡ, quyền đăng, bảo toàn trạng thái không rõ kết quả, receipt và khởi động lại worker. UI thử bằng dữ liệu giả, không đăng bài lên Facebook thật.

## Nguồn video từ máy tính và Google Drive

Trong `/publishing`, khối **Nguồn video để đăng** có hai lựa chọn: **Thư mục trên máy** (hoặc chọn từng tệp) và **Link Google Drive**. Chọn thư mục sẽ liệt kê MP4 trong thư mục đã cấp quyền; tối đa 30 video/lượt, 250 MB/tệp, nhập tuần tự và giữ lại danh sách tệp lỗi để thử lại. Đây là lựa chọn thư mục qua trình duyệt, không phải theo dõi nền thư mục Windows.

Link Drive hiện nhận **một tệp** dạng `https://drive.google.com/file/d/ID/view`, đã chia sẻ cho bất kỳ ai có link và cho phép tải xuống. Chỉ theo chuyển hướng tới máy chủ tải của Google; trang đăng nhập/xác nhận và thông báo hết hạn mức sẽ trả lỗi có hướng dẫn. Chưa hỗ trợ nhập cả thư mục Drive; chưa thử link Drive thật của người dùng. [Hướng dẫn tải tệp của Google](https://support.google.com/drive/answer/2423534?hl=vi).

Video được stream vào ổ đĩa có giới hạn dung lượng, kiểm tra header MP4 và giải mã thử một khung hình bằng FFmpeg để lấy thời lượng. Chỉ sau khi kiểm tra thành công mới tạo bản ghi video hoàn tất trong thư viện. Nếu lưu DB lỗi, xóa tệp mới vừa nhập; không đụng đến tệp nguồn. Route `/generated/publishing/[filename]` hỗ trợ HTTP Range để phát/tải video tạo sau khi máy chủ khởi động. Có thể thêm mô tả sản phẩm chung cho video nhập cùng lượt; các video khác sản phẩm nên nhập riêng hoặc tự soạn nội dung từng bài.

Tính năng lưu video cục bộ cần máy chủ AFF có ổ đĩa bền vững (bản chạy trên máy tính phù hợp). Môi trường Vercel bị chặn nhập vì không có ổ lưu trữ bền vững cho video; không trả thông báo thành công giả. Nhập video chỉ tạo nguồn, không tự đăng: chọn video trong **Tạo bài đăng**, chọn Page và duyệt lịch.
