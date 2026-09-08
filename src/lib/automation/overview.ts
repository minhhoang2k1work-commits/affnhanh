export type SetupState = 'connected' | 'configured' | 'missing' | 'unknown' | 'unavailable';
export type SetupItem = { id: string; name: string; state: SetupState; detail: string; href: string; action: string };
export type AutomationOverview = {
  checkedAt: string; database: boolean; error?: string;
  counts: { products: number; links: number; producing: number; drafts: number; scheduled: number; published: number; attention: number } | null;
  setup: SetupItem[];
};
export const setupLabels: Record<SetupState, string> = { connected: 'Đã kết nối', configured: 'Đã cấu hình', missing: 'Cần thiết lập', unknown: 'Chưa kiểm tra được', unavailable: 'Chưa hỗ trợ tự động' };
export function nextAutomationAction(data: AutomationOverview | null) {
  if (!data?.database || !data.counts) return { title: 'Kiểm tra kết nối trước', detail: 'Chưa đọc được dữ liệu để xác định công việc cần làm. Kiểm tra kết nối bên dưới rồi tải lại.', href: '#setup', action: 'Xem kết nối' };
  if (data.counts.attention > 0) return { title: `${data.counts.attention} bài đăng cần xử lý`, detail: 'Kiểm tra kết quả đăng chưa rõ trước khi chạy thêm một đợt.', href: '/publishing?filter=attention', action: 'Kiểm tra đăng bài' };
  if (data.counts.drafts > 0) return { title: `${data.counts.drafts} video đang chờ bạn duyệt`, detail: 'Xem video, kiểm tra nội dung, link sản phẩm và Page trước khi chọn lịch đăng.', href: '/publishing?filter=draft', action: 'Duyệt video' };
  if (data.counts.products === 0) return { title: 'Bắt đầu với sản phẩm đầu tiên', detail: 'Thêm sản phẩm từ shop để có thông tin và ảnh gốc cho video.', href: '/scanner', action: 'Thêm sản phẩm' };
  return { title: 'Tạo đợt video tiếp theo', detail: 'Chọn sản phẩm trong thư viện. Mỗi sản phẩm được gắn với video, link và Page của riêng nó.', href: '/library', action: 'Chọn sản phẩm' };
}
