import { db } from '../db';

export const DEFAULT_FLOW_TEMPLATE_ID = 'a1b2c3d4-e5f6-4a5b-8c7d-e9f0a1b2c3d4';
export const LEGACY_BATCH_FACEBOOK_TEMPLATE_ID = 'de932561-50de-45ac-85da-480448745dec';
export const AUTOCUT_BATCH_TEMPLATE_ID = '2ba0b251-494d-4b74-bfb9-b7a9f425146c';
export const BATCH_FACEBOOK_TEMPLATE_ID = 'f120d766-18aa-46a0-a598-a8c22627361d';

export const templates = [
  {
    id: 'f9b3c4a2-8e1d-4f0b-9c3d-2e1a4b5c6d7e',
    name: 'Quick Product Video',
    description: 'Tạo video nhanh từ mô tả sản phẩm, không cần storyboard chi tiết.',
    category: 'video_generation',
    isSystem: true,
    steps: [
      { id: 'step-1', type: 'llm_script', name: 'Tạo script', config: {}, dependencies: [] },
      { id: 'step-2', type: 'llm_storyboard', name: 'Tạo storyboard', config: { maxScenes: 3 }, dependencies: ['step-1'] },
      { id: 'step-3', type: 'generate_video', name: 'Tạo video', config: { aspectRatio: '9:16' }, dependencies: ['step-2'] },
      { id: 'step-4', type: 'assemble', name: 'Ghép video', config: { aspectRatio: '9:16' }, dependencies: ['step-3'] },
      { id: 'step-5', type: 'upload_drive', name: 'Lưu Google Drive', config: {}, dependencies: ['step-4'] },
      { id: 'step-6', type: 'notify', name: 'Hoàn tất', config: {}, dependencies: ['step-5'] },
    ],
  },
  {
    id: DEFAULT_FLOW_TEMPLATE_ID,
    name: 'Professional Product Video',
    description: 'Video hoàn chỉnh với storyboard, nhiều cảnh, thuyết minh và ghép nối.',
    category: 'video_generation',
    isSystem: true,
    steps: [
      { id: 'step-1', type: 'llm_script', name: 'Tạo script', config: {}, dependencies: [] },
      { id: 'step-2', type: 'llm_storyboard', name: 'Tạo storyboard', config: {}, dependencies: ['step-1'] },
      { id: 'step-3', type: 'generate_image', name: 'Chuẩn bị ảnh', config: {}, dependencies: ['step-2'] },
      { id: 'step-4', type: 'generate_video', name: 'Tạo các clip', config: { aspectRatio: '9:16' }, dependencies: ['step-3'] },
      { id: 'step-5', type: 'generate_voice', name: 'Tạo thuyết minh', config: {}, dependencies: ['step-2'] },
      { id: 'step-6', type: 'assemble', name: 'Ghép video', config: { aspectRatio: '9:16' }, dependencies: ['step-4', 'step-5'] },
      { id: 'step-7', type: 'upload_drive', name: 'Lưu Google Drive', config: {}, dependencies: ['step-6'] },
      { id: 'step-8', type: 'notify', name: 'Hoàn tất', config: {}, dependencies: ['step-7'] },
    ],
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    name: 'Social Media Shorts',
    description: 'Video dọc 15 giây tối ưu cho TikTok, Reels và Shorts.',
    category: 'video_generation',
    isSystem: true,
    steps: [
      { id: 'step-1', type: 'llm_script', name: 'Tạo script', config: { duration: 15 }, dependencies: [] },
      { id: 'step-2', type: 'llm_storyboard', name: 'Tạo storyboard', config: { duration: 15, maxScenes: 3 }, dependencies: ['step-1'] },
      { id: 'step-3', type: 'generate_video', name: 'Tạo các clip', config: { aspectRatio: '9:16' }, dependencies: ['step-2'] },
      { id: 'step-4', type: 'generate_voice', name: 'Tạo thuyết minh', config: {}, dependencies: ['step-2'] },
      { id: 'step-5', type: 'assemble', name: 'Ghép video', config: { aspectRatio: '9:16' }, dependencies: ['step-3', 'step-4'] },
      { id: 'step-6', type: 'upload_drive', name: 'Lưu Google Drive', config: {}, dependencies: ['step-5'] },
      { id: 'step-7', type: 'notify', name: 'Hoàn tất', config: {}, dependencies: ['step-6'] },
    ],
  },
];

templates.push({
  id: LEGACY_BATCH_FACEBOOK_TEMPLATE_ID,
  name: 'Sản phẩm → Video → Facebook (cũ)',
  description: 'Giữ cấu trúc bước cho các đợt cũ; kết quả đưa về bản nháp chờ duyệt.',
  category: 'video_generation', isSystem: true,
  steps: [
    ...templates.find(template => template.id === DEFAULT_FLOW_TEMPLATE_ID)!.steps.filter(step => step.type !== 'notify'),
    { id: 'facebook-queue', type: 'queue_facebook', name: 'Lưu bản nháp chờ duyệt', config: {}, dependencies: ['step-7'] },
  ],
});

templates.push({
  id: BATCH_FACEBOOK_TEMPLATE_ID,
  name: 'Sản phẩm → Video → Facebook',
  description: 'Lấy link affiliate, tạo video và nội dung từ dữ liệu sản phẩm, lưu bản nháp chờ duyệt.',
  category: 'video_generation',
  isSystem: true,
  steps: [
    { id: 'affiliate-link', type: 'resolve_affiliate', name: 'Lấy link affiliate thật', config: {}, dependencies: [] },
    ...templates.find(template => template.id === DEFAULT_FLOW_TEMPLATE_ID)!.steps.filter(step => step.type !== 'notify').map(step => step.id === 'step-1' ? { ...step, dependencies: ['affiliate-link'] } : step),
    { id: 'publishing-copy', type: 'generate_publishing_copy', name: 'ChatGPT viết tiêu đề và mô tả', config: {}, dependencies: ['step-7'] },
    { id: 'facebook-queue', type: 'queue_facebook', name: 'Lưu danh sách chờ duyệt', config: {}, dependencies: ['publishing-copy'] },
    { id: 'telegram-review', type: 'notify_video_review', name: 'Gửi video qua Telegram để duyệt', config: {}, dependencies: ['facebook-queue'] },
  ],
});

templates.push({
  id: AUTOCUT_BATCH_TEMPLATE_ID, name: 'Sản phẩm → AutoCut → Duyệt đăng',
  description: 'Tạo video, áp template AutoCut và xác minh tệp thật trước khi gửi duyệt.',
  category: 'video_generation', isSystem: true,
  steps: templates.find(t => t.id === BATCH_FACEBOOK_TEMPLATE_ID)!.steps.flatMap(step =>
    step.id === 'step-6' ? [step, { id: 'autocut-render', type: 'autocut_render', name: 'AutoCut áp template và xuất thư mục chờ', config: {}, dependencies: ['step-6'] }] :
    step.id === 'step-7' ? [{ ...step, dependencies: ['autocut-render'] }] : [step]),
});

let seedPromise: Promise<void> | null = null;

export async function seedFlowTemplates(): Promise<void> {
  for (const template of templates) {
    await db.flowTemplate.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        description: template.description,
        category: template.category,
        isSystem: template.isSystem,
        steps: template.steps as any,
      },
      create: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        isSystem: template.isSystem,
        steps: template.steps as any,
      },
    });
  }
}

/** Seed once per server process. Upserts keep this safe across concurrent instances. */
export async function ensureFlowTemplates(): Promise<void> {
  seedPromise ||= seedFlowTemplates().catch((error) => {
    seedPromise = null;
    throw error;
  });
  await seedPromise;
}
