import { db } from '@/lib/db';

export const DEFAULT_FLOW_TEMPLATE_ID = 'a1b2c3d4-e5f6-4a5b-8c7d-e9f0a1b2c3d4';

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
