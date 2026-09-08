# Phần bổ sung automation — 08/09/2026

## Đã triển khai

Luồng mới: sản phẩm/link thật → ChatGPT và storyboard → nguồn clip đã chọn (Google Flow hoặc AI hiện có) → giọng đọc và ghép → AutoCut theo template (tùy chọn) → kiểm tra MP4 → Drive tùy chọn → nội dung đăng → bản nháp → Telegram duyệt.

- Batch có lựa chọn nguồn clip Google Flow và template AutoCut đọc từ worker, không tạo danh sách template giả trên web. Chọn template đồng bộ thời lượng. Lựa chọn sản phẩm/cấu hình/mã gửi được giữ trong sessionStorage để phục hồi khi tải lại.
- Template batch AutoCut có ID riêng, không sửa thứ tự bước của các đợt cũ. Thông tin template kèm SHA-256 được lưu vào flow run để phát hiện template đã thay đổi.
- Google Flow gửi từng cảnh bằng mã cố định tới `/aff_flow` trên bridge 8766. Bridge lưu yêu cầu trước khi gửi extension; mất phản hồi không tự tạo lại. Mỗi cảnh có thư mục tải riêng và chỉ chấp nhận đúng một MP4.
- AFF xác minh đường dẫn, header MP4 và FFmpeg trước khi nhận clip/kết quả render. Không nhận trang HTML đổi đuôi hoặc đường dẫn bên ngoài thư mục được chỉ định.
- AutoCut có hàng đợi bền vững `.autocut/requests`, kết quả `.autocut/results`, trạng thái `.autocut/worker.json`. Yêu cầu được ghi nguyên tử và không ghi đè khi gửi lặp. Một khóa hệ điều hành ngăn hai worker cùng nhận việc.
- Worker dùng timeline riêng và bộ render thật trong `preview.py` (các lớp cũ mang tên Mock nhưng có mã decode/composite/encode thực tế). Không mở cửa sổ hoặc đụng timeline người dùng đang sửa.
- Video nguồn được chia đúng thứ tự slot, giữ track tiếng; template có thời lượng lệch quá một giây bị từ chối. Storyboard của đợt AutoCut được phân bổ đúng tổng thời lượng; clip ngắn được giữ khung hình cuối để không hụt thời gian.
- Thành phẩm lưu tại `public/generated/publishing/<job-id>.mp4`, vẫn là chờ duyệt. Worker không tự viết database hoặc đăng bài. AFF kiểm tra tệp rồi mới chuyển bước tiếp theo.
- Khi worker chết giữa chừng, việc đang xử lý được đánh dấu lỗi khi khởi động lại. Chỉ thao tác Thử lại trên flow đã thất bại tạo mã lần chạy mới; cảnh đã hoàn tất được giữ. Google Flow không tự gửi prompt trả phí lần hai khi kết quả chưa rõ.
- Endpoint Flow chỉ nhận gọi nội bộ máy, từ chối Origin của trang web ngoài.

## Khởi động

Worker và bridge đã được khởi động thử bằng Python khả dụng cùng thư viện hiện có trong `D:/AutoCut/.venv/Lib/site-packages`. Không sửa/xóa môi trường Python cũ.

```powershell
& D:/AutoCut/start_aff_worker.ps1 -PythonPath '<đường dẫn Python tương thích>' -AffRoot 'C:/Users/PCW/Desktop/AFF' -StartBridge
```

Tham số `-PackagesPath` có thể trỏ tới thư mục site-packages khác. Launcher bỏ qua dịch vụ đã có heartbeat/phản hồi. Sau khi sửa mã worker/bridge, khởi động lại đúng các tiến trình của launcher khi không có việc đang chạy. Log nằm trong `.autocut/worker.*.log` và `.autocut/bridge.*.log`.

Extension Google Flow sử dụng `D:/AutoCut/google_flow_sidepanel_extension`. Cần nạp extension vào hồ sơ Chrome thật, đăng nhập Google Flow và để hồ sơ hoạt động. Extension AFF dùng lấy link/đăng Facebook là một kết nối riêng; không suy ra sẵn sàng Google Flow chỉ từ việc AFF extension đang online.

Phiên web đọc được database thật đang chạy tại http://127.0.0.1:3001, dùng `AFF_LIVE_PREVIEW=1` và thư mục build `.next-live`. `FLOW_AUTO_START=false` trong phiên kiểm tra này để không tự chạy những việc cũ. Muốn khởi động lại phiên tương tự:

```powershell
$env:AFF_LIVE_PREVIEW='1'
$env:FLOW_AUTO_START='false'
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Khi vận hành lâu dài, cấu hình `FLOW_AUTO_START=true` hoặc worker endpoint có xác thực để tiếp tục flow sau khi khởi động lại. Không nên dựa vào tab trình duyệt để giữ tiến trình server.

## Bằng chứng đã kiểm tra

- PostgreSQL thật truy cập được ngoài sandbox; lỗi truy cập ở phiên 3000 là hạn chế mạng của môi trường chạy. Không thay URL database hay tạo dữ liệu thay thế.
- Tài khoản AFF hiện có 456 sản phẩm tổng cộng; chưa có PublishingChannel và AIProvider đang hoạt động; chưa có video project completed.
- `/api/health` trên cổng 3001 báo database connected.
- `/api/automation/autocut` báo online, idle, 4 template từ AutoCut. Các template thật đã xuất hiện trong giao diện batch.
- `/ws_status` cổng 8766 trả HTTP 200, extension connected=false tại lần kiểm tra.
- Trình duyệt hiển thị sản phẩm thật, lựa chọn template và trạng thái chờ cấu hình Page; không tạo Page/sản phẩm/video giả.
- AFF: 133 tests đạt; Python: 6 tests đạt (đường dẫn, thời lượng, ghi nguyên tử, gửi lặp, mất phản hồi/khởi động lại, từ chối Origin ngoài). TypeScript và ESLint các phần mới sửa đạt.

## Chưa nghiệm thu đầu-cuối

Cần người dùng chọn Page và hồ sơ Chrome, cấu hình AI/giọng đọc, đăng nhập extension và Telegram. Chưa chạy tạo video trả phí hoặc gửi Telegram/đăng bài thật vì các cấu hình này chưa có. Heartbeat/kiểm thử đơn vị không chứng minh chất lượng thành phẩm hoặc tài khoản Google Flow đã sẵn sàng.

Hiện nhánh publishing của batch vẫn là Facebook Page. Chọn kênh ngoài Facebook và quy tắc template theo ngành là phần mở rộng tiếp theo; không giả báo đã có đủ tất cả nền tảng.

Hủy flow AFF ngăn các bước tiếp theo, nhưng không thu hồi thao tác đã gửi sang Google Flow/AutoCut. Nếu đã gửi prompt, kiểm tra tác vụ trong dịch vụ tương ứng trước khi tạo lại. Việc render xảy ra khi AFF bị tắt sẽ để tệp chờ server xác minh khi chạy lại, không tự đăng.

## Nghiệm thu tiếp theo bằng dữ liệu thật

1. Cấu hình Page/hồ sơ và AI/Telegram, xác minh đúng danh tính.
2. Chọn một sản phẩm có ảnh/link thật, Google Flow, template cùng thời lượng.
3. Đối chiếu product ID → cảnh → tệp render → Page → tiêu đề/mô tả → link trong bản nháp.
4. Xem video/âm thanh thật và nhận Telegram trước khi duyệt lịch.
5. Thử mất mạng, khởi động lại và gửi lặp với một đợt nhỏ rồi mới mở tối đa 50 sản phẩm.
