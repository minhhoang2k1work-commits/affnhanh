export const PUBLISH_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const POST_LABELS: Record<string, string> = { draft: 'Bản nháp', scheduled: 'Đã lên lịch', preparing: 'Đang chuẩn bị', submitted_unknown: 'Cần xác nhận', published: 'Đã xác nhận đăng', needs_attention: 'Cần xử lý', missed: 'Quá giờ đăng', cancelled: 'Đã hủy' };
export const GENERATED_VIDEO = /^\/generated\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.mp4$/;

export function parseSlots(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12 || value.some(s => typeof s !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s))) throw new Error('Chọn từ 1–12 khung giờ theo HH:mm.');
  return [...new Set(value as string[])].sort();
}

export function fromVietnamTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Ngày giờ không hợp lệ.');
  const date = new Date(`${value}:00+07:00`);
  if (!Number.isFinite(date.getTime()) || toVietnamTime(date) !== value) throw new Error('Ngày giờ không hợp lệ.');
  return date;
}

export function toVietnamTime(date: Date) { return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16); }

export function nextQueueSlot(slots: string[], occupied: Date[], now = new Date()) {
  const times = parseSlots(slots);
  const day = toVietnamTime(now).slice(0, 10);
  for (let offset = 0; offset < 90; offset++) {
    const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset);
    for (const time of times) {
      const candidate = fromVietnamTime(`${date.toISOString().slice(0, 10)}T${time}`);
      if (candidate.getTime() > now.getTime() + 60000 && !occupied.some(d => Math.abs(d.getTime() - candidate.getTime()) < 5 * 60000)) return candidate;
    }
  }
  throw new Error('Các khung giờ trong 90 ngày đã đầy. Thêm khung giờ hoặc chọn lịch khác.');
}

export function validateSchedule(value: unknown, now = new Date()) {
  if (typeof value !== 'string' || !/Z$|[+-]\d\d:\d\d$/.test(value)) throw new Error('Lịch đăng cần có múi giờ.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() < now.getTime() + 30000 || date.getTime() > now.getTime() + 90 * 86400000) throw new Error('Chọn giờ đăng sau ít nhất 30 giây và trong 90 ngày tới.');
  return date;
}

export function facebookPermalink(value: unknown) {
  if (typeof value !== 'string') throw new Error('Nhập link Reel đã kiểm tra trên Page.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['www.facebook.com', 'facebook.com'].includes(url.hostname) || url.username || url.password || !/^\/(?:reel\/\d+|[^/]+\/videos\/\d+)\/?$/.test(url.pathname)) throw new Error('Cần link Facebook Reel/video cụ thể, không phải link trang chủ.');
  return url.href;
}
