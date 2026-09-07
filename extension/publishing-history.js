const labels = { draft: 'Bản nháp', scheduled: 'Đã lên lịch', preparing: 'Đang đăng', published: 'Đăng thành công', needs_attention: 'Thất bại / cần xử lý', submitted_unknown: 'Cần xác nhận', missed: 'Quá giờ đăng', cancelled: 'Đã hủy' };
const $ = id => document.getElementById(id);
let page = 0;
let loading = false;
function node(tag, text, className) { const element = document.createElement(tag); element.textContent = text; if (className) element.className = className; return element; }
function date(value) { return value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'; }
function render(data) {
  $('counts').replaceChildren(...[['published', 'Thành công'], ['needs_attention', 'Lỗi'], ['submitted_unknown', 'Cần xác nhận']].map(([key, label]) => node('span', `${label}: ${data.counts[key] || 0}`)));
  $('posts').replaceChildren();
  for (const post of data.posts) {
    const card = node('article', '');
    card.append(node('span', labels[post.status] || post.status, `badge ${post.status}`), node('h2', post.title || 'Video chưa có tiêu đề'), node('p', `Page: ${post.channel.name} · Hồ sơ: ${post.channel.profileName || 'Hiện tại'}`), node('p', `Tạo: ${date(post.createdAt)} · Hẹn đăng: ${date(post.scheduledAt)} · Đã đăng: ${date(post.publishedAt)} (giờ Việt Nam)`));
    if (post.error) card.append(node('p', post.error, 'error'));
    if (post.status === 'submitted_unknown') card.append(node('p', 'Facebook có thể đã nhận bài. Kiểm tra Page và xác nhận trong trình quản lý trước khi đăng lại.'));
    try { const url = new URL(post.permalink); if (url.protocol === 'https:' && ['facebook.com', 'www.facebook.com'].includes(url.hostname) && !url.username && !url.password) { const link = node('a', 'Xem bài trên Facebook'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link); } } catch { /* No confirmed link yet. */ }
    const details = node('details', ''); details.append(node('summary', 'Chi tiết xử lý'));
    for (const event of post.events || []) details.append(node('p', `${date(event.createdAt)} · ${labels[event.status] || event.status}: ${event.message}`));
    card.append(details); $('posts').append(card);
  }
  if (!data.posts.length) $('posts').append(node('p', 'Chưa có video ở trạng thái này trong hồ sơ Chrome hiện tại.'));
  $('pagination').textContent = `Trang ${data.page + 1} · ${data.total} bài`;
  $('previous').disabled = data.page === 0; $('next').disabled = !data.hasMore;
}
async function refresh() {
  if (loading) return;
  loading = true; $('refresh').disabled = true; $('filter').disabled = true; $('previous').disabled = true; $('next').disabled = true;
  $('notice').textContent = 'Đang tải lịch sử…'; $('posts').replaceChildren(); $('counts').replaceChildren(); $('pagination').textContent = ''; $('manager').hidden = true;
  try {
    const config = await chrome.storage.local.get(['serverUrl', 'deviceToken', 'licenseKey']);
    if (!config.serverUrl || !config.deviceToken || !config.licenseKey) throw new Error('Kết nối máy chủ AFF và kích hoạt extension để xem lịch sử.');
    const origin = new URL(config.serverUrl).origin;
    if (!/^https?:$/.test(new URL(origin).protocol)) throw new Error('Địa chỉ máy chủ không hợp lệ.');
    $('manager').href = `${origin}/publishing`; $('manager').hidden = false;
    const response = await fetch(`${origin}/api/publishing/worker`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'history', deviceToken: config.deviceToken, licenseKey: config.licenseKey, filter: $('filter').value, page }), signal: AbortSignal.timeout(20000) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 404) throw new Error(`Máy chủ ${origin} chưa có API lịch sử đăng bài (/api/publishing/worker). Cần cập nhật bản web hoặc chọn Server Đích “AFF Local · Đăng bài” trong popup extension`);
    if (!response.ok) throw new Error(data.error || `Không tải được lịch sử (HTTP ${response.status}).`);
    render(data); $('notice').textContent = `Cập nhật: ${date(data.syncedAt)} · Tự làm mới mỗi 30 giây khi mở trang.`;
  } catch (error) { $('notice').textContent = `Không tải được lịch sử: ${error.message}. Kiểm tra kết nối máy chủ AFF.`; $('previous').disabled = page === 0; }
  finally { loading = false; $('refresh').disabled = false; $('filter').disabled = false; }
}
$('refresh').addEventListener('click', refresh);
$('filter').addEventListener('change', () => { page = 0; refresh(); });
$('previous').addEventListener('click', () => { if (!loading) { page = Math.max(0, page - 1); refresh(); } });
$('next').addEventListener('click', () => { if (!loading) { page++; refresh(); } });
setInterval(() => { if (!document.hidden) refresh(); }, 30000);
refresh();
