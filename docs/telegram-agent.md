# Telegram Agent — điều khiển AFF HUB

Bản đầu là agent thực thi các lệnh xác định và mẫu câu tiếng Việt, không phải agent LLM tự suy luận tùy ý. Không chạy shell, không đọc/xóa tệp trên máy, không tự đăng nội dung. Quét shop, gửi ChatGPT và tạo video được xếp vào hàng đợi hiện có của extension.

## Kích hoạt trên máy cá nhân

1. Trong Telegram, mở BotFather chính thức và dùng `/newbot` để tạo bot. Lưu bot token vào `.env` tại máy chủ.
2. Sau khi điền bot token, nhắn `/start` cho bot rồi chạy `npm run telegram:identify` để xem các user ID đã nhắn riêng cho bot; chỉ chọn đúng ID của bạn. Lệnh này chỉ đọc, không thực thi tin nhắn. Agent chỉ chấp nhận tin nhắn riêng có `from.id` và `chat.id` trùng ID trong danh sách cho phép. Không nhận username thay ID, tin chuyển tiếp, tin bot, nhóm hoặc tin cũ hơn 15 phút.
3. Mở `/telegram`, đăng nhập quản trị để xem AFF User ID và kiểm tra trạng thái cấu hình.
4. Điền `.env`:

```dotenv
TELEGRAM_ENABLED="true"
TELEGRAM_BOT_TOKEN="TOKEN_TU_BOTFATHER"
TELEGRAM_WEBHOOK_SECRET="CHUOI_NGAU_NHIEN_32_DEN_256_KY_TU"
TELEGRAM_ALLOWED_USER_IDS="TELEGRAM_USER_ID_CUA_BAN"
TELEGRAM_AFF_USER_ID="AFF_USER_ID_TREN_TRANG_TELEGRAM"
TELEGRAM_LOCAL_APP_URL="http://127.0.0.1:3000"
```

Khóa kết nối chỉ chứa chữ, số, `_` hoặc `-`; có thể tạo bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Token và khóa kết nối không được gửi sang ChatGPT, đưa vào prompt hoặc đưa vào Git.

5. Khởi động lại web rồi chạy `npm run telegram`. Đây là tiến trình chạy liên tục trên máy, dùng polling nên không cần tên miền hay mở cổng internet. Giữ máy hoạt động; nếu ngủ/tắt máy, agent và extension sẽ ngừng nhận việc.
6. Mở Chrome với AFF HUB Extension đã cập nhật, kết nối đúng web, đăng nhập license và các dịch vụ cần dùng. Dùng extension gốc 1.11.0 cho pipeline video đầy đủ; bản hợp nhất 2.3.0 hỗ trợ gửi prompt nhưng pipeline video vẫn chưa hoàn thiện.
7. Nhắn `/start` và `/status` cho bot.

## Các lệnh

| Lệnh | Kết quả |
| --- | --- |
| `/status` | Số sản phẩm, việc chờ và trạng thái kết nối extension |
| `/industries` | Tên/mã ngành hàng và dự án Flow đã gắn |
| `/products từ khóa` | Tối đa 10 sản phẩm và mã để dùng cho lệnh video |
| `/scan https://shopee.vn/shop/...` | Xếp hàng quét một shop; hỗ trợ link Shopee/TikTok đầy đủ |
| `/prompt tên hoặc mã ngành` | Ghép prompt với tối đa 5 sản phẩm cập nhật gần nhất trong ngành; chưa gọi AI |
| `/chatgpt tên hoặc mã ngành` | Xếp hàng gửi prompt tới ChatGPT đã lưu của ngành; đọc phản hồi AI trong ChatGPT |
| `/video mã sản phẩm` | Chạy pipeline video extension, dùng credit Flow và dự án đã gắn |
| `/jobs` | 10 công việc gần nhất |
| `/cancel mã việc` | Hủy việc còn chờ; việc đã chạy cần dừng trên web/extension |

Các mẫu tiếng Việt: `trạng thái`, `ngành hàng`, `quét shop <link>`, `tìm sản phẩm <từ khóa>`, `viết prompt <ngành>`, `gửi ChatGPT <ngành>`, `tạo video <mã>`, `hủy <mã việc>`.

Prompt dài được trả bằng tệp `.txt`. Agent dùng hồ sơ đã lưu và đánh dấu các URL chưa đọc mới; không tự khẳng định nội dung link. Khi lệnh extension kết thúc, tiến trình Telegram gửi trạng thái và link video nếu có. Thông báo hoàn tất của lệnh gửi ChatGPT chỉ xác nhận đã gửi prompt, không xác nhận AI viết xong. Lệnh hiện chưa lấy phản hồi AI từ ChatGPT trở lại Telegram.

## Webhook cho máy chủ chạy liên tục

Đặt `APP_BASE_URL` thành địa chỉ HTTPS công khai và chạy `npm run telegram:webhook` một lần. Webhook xác thực header `X-Telegram-Bot-Api-Secret-Token`; chỉ đường dẫn `/api/telegram/webhook` dùng cơ chế này thay HTTP Basic Auth. Giữ HTTP Basic Auth cho phần web còn lại khi công khai máy chủ.

Chạy `npm run telegram:notify` trên máy chủ/worker để gửi thông báo hoàn tất và thử gửi lại phản hồi đang chờ. Polling và webhook không chạy đồng thời; script không tự gỡ webhook hoặc xóa tin nhắn đang chờ. Với serverless, cần một worker chạy liên tục hoặc lịch gọi POST `{ "flush": true }` tới webhook với khóa kết nối.

## Lịch sử và xử lý gửi lại

Bảng TelegramCommand lưu lệnh, trạng thái, mã công việc, phản hồi và thời điểm gửi. Update ID gắn với bot ID là khóa duy nhất; lưu lệnh và tạo việc nằm trong cùng transaction, tránh xếp trùng việc khi Telegram gửi lại update. Gửi phản hồi ra Telegram và đánh dấu đã gửi không phải một transaction phân tán: nếu mất kết nối đúng thời điểm, một thông báo có thể xuất hiện lại; công việc không được tạo lại. Agent giới hạn 20 lệnh/người/phút. Chỉ ID vẫn còn trong danh sách được phép mới nhận thông báo.

Tắt bằng `TELEGRAM_ENABLED=false`, khởi động lại web và dừng tiến trình polling/notify. Các công việc đã xếp hàng vẫn tồn tại; dùng `/cancel` trước khi tắt nếu cần hủy việc chờ.

Môi trường khác cần chạy `npx prisma db execute --file prisma/telegram-agent.sql --schema prisma/schema.prisma` và `npx prisma generate`. Cơ sở dữ liệu trong workspace này đã có bảng; bot vẫn tắt do chưa có thông tin kết nối.

Tham chiếu chính thức: [Telegram Bot API](https://core.telegram.org/bots/api), [polling và webhook](https://core.telegram.org/bots/faq#how-are-getupdates-and-webhooks-different).
