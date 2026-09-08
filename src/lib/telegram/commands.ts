export type AgentCommand = { action: 'help' | 'status' | 'industries' | 'products' | 'jobs' | 'scan' | 'prompt' | 'chatgpt' | 'video' | 'cancel' | 'reviews' | 'approve'; argument: string };
export const HELP = `AFF HUB Agent
/status — trạng thái hệ thống
/industries — ngành hàng và mã
/products từ khóa — tìm sản phẩm và mã
/scan https://shopee.vn/shop/... — xếp hàng quét shop
/prompt tên hoặc mã ngành — ghép prompt từ hồ sơ đã lưu
/chatgpt tên hoặc mã ngành — gửi prompt qua extension
/video mã sản phẩm — tạo video (sử dụng credit Flow)
/jobs — 10 công việc gần nhất
/reviews — video và nội dung chờ duyệt
/approve mã bài — duyệt nội dung và xếp lịch Page đã chọn
/cancel mã công việc — hủy việc còn chờ

Cũng hiểu: “trạng thái”, “ngành hàng”, “quét shop <link>”, “tìm sản phẩm <từ khóa>”, “viết prompt <ngành>”, “tạo video <mã>”.
Chrome và extension phải đang chạy để quét/ChatGPT/video. /prompt chỉ ghép dữ liệu, chưa gọi AI. Không thực hiện lệnh máy tính hoặc lệnh shell.`;

export function parseCommand(text: string): AgentCommand | null {
  const value = text.trim();
  const slash = value.match(/^\/(start|help|status|industries|products|jobs|scan|prompt|chatgpt|video|cancel|reviews|approve)(?:@[a-zA-Z0-9_]+)?(?:\s+([\s\S]*))?$/i);
  if (slash) return { action: (slash[1].toLowerCase() === 'start' ? 'help' : slash[1].toLowerCase()) as AgentCommand['action'], argument: slash[2]?.trim() || '' };
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const patterns: [RegExp, AgentCommand['action']][] = [
    [/^(?:trang thai|kiem tra trang thai)$/, 'status'], [/^(?:nganh hang|danh sach nganh hang)$/, 'industries'],
    [/^(?:cong viec|danh sach cong viec)$/, 'jobs'], [/^(?:quet shop|quet)\s+/, 'scan'],
    [/^(?:tim san pham|tim)\s+/, 'products'], [/^(?:viet prompt|tao prompt)\s+/, 'prompt'],
    [/^(?:gui chatgpt|gui sang chatgpt)\s+/, 'chatgpt'], [/^(?:tao video)\s+/, 'video'], [/^(?:huy)\s+/, 'cancel'],
  ];
  for (const [pattern, action] of patterns) {
    const matched = normalized.match(pattern);
    if (matched) return { action, argument: value.slice(matched[0].length).trim() };
  }
  return null;
}

export function marketplaceUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !/^(?:[\w-]+\.)*(?:shopee\.vn|tiktok\.com)$/.test(url.hostname)) throw new Error();
    return url.href;
  } catch { throw new Error('Dùng link HTTPS shop Shopee hoặc TikTok đầy đủ.'); }
}
