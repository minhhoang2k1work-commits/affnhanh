import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { encryptText } from '@/lib/crypto';

const ALLOWED_NAMES = ['openai', 'chatgpt', 'google_veo', 'kling', 'runway', 'elevenlabs', 'google_aistudio'];
const ALLOWED_TYPES = ['llm', 'video', 'image', 'voiceover'];

function sanitizeConfig(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeConfig);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/(api.?key|token|secret|password|credential|session|authorization)/i.test(key))
      .map(([key, nestedValue]) => [key, sanitizeConfig(nestedValue)]),
  );
}

function safeProvider(provider: any) {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    mode: provider.mode,
    isActive: provider.isActive,
    config: sanitizeConfig(provider.config),
    hasApiKey: Boolean(provider.apiKeyEnc),
    browserSessionValid: provider.browserSessionValid,
    lastSessionCheck: provider.lastSessionCheck,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

export async function GET() {
  try {
    const user = await getOrCreateUser();
    const providers = await db.aIProvider.findMany({ where: { userId: user.id } });
    return NextResponse.json({ success: true, providers: providers.map(safeProvider) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getOrCreateUser();
    const { name, type, apiKey, config, mode = 'api' } = await request.json();
    if (!ALLOWED_NAMES.includes(name) || !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Unsupported provider name or type.' }, { status: 400 });
    }
    if (!['api', 'browser'].includes(mode)) return NextResponse.json({ error: 'Unsupported provider mode.' }, { status: 400 });

    const existing = await db.aIProvider.findUnique({ where: { userId_name: { userId: user.id, name } } });
    if (mode === 'api' && !apiKey && !existing?.apiKeyEnc) {
      return NextResponse.json({ error: 'API key is required for API mode.' }, { status: 400 });
    }

    const data: any = { type, mode, config: config || {} };
    if (apiKey) data.apiKeyEnc = encryptText(apiKey);
    const provider = await db.aIProvider.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: data,
      create: { userId: user.id, name, ...data },
    });
    return NextResponse.json({ success: true, provider: safeProvider(provider) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
