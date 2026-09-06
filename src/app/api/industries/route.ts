import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { validateIndustry } from '@/lib/products/industry';

export async function GET() {
  try {
    const user = await getOrCreateUser();
    const [industries, categories] = await Promise.all([
      db.industryWorkspace.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } }),
      db.product.groupBy({ by: ['category'], where: { userId: user.id }, _count: { _all: true } }),
    ]);
    return NextResponse.json({ industries, categories });
  } catch { return NextResponse.json({ error: 'Không tải được ngành hàng.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();
    let data;
    try { data = validateIndustry(body); }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
    if (body.id != null && typeof body.id !== 'string') return NextResponse.json({ error: 'ID không hợp lệ.' }, { status: 400 });
    const existing = body.id ? await db.industryWorkspace.findFirst({ where: { id: body.id, userId: user.id } }) : null;
    if (body.id && !existing) return NextResponse.json({ error: 'Không tìm thấy ngành hàng.' }, { status: 404 });
    const industry = await db.$transaction(async tx => {
      if (existing) {
        const saved = await tx.industryWorkspace.update({ where: { id: existing.id }, data });
        if (existing.name !== data.name) await tx.product.updateMany({ where: { userId: user.id, category: existing.name }, data: { category: data.name } });
        return saved;
      }
      return tx.industryWorkspace.create({ data: { ...data, userId: user.id } });
    });
    return NextResponse.json({ industry });
  } catch (error) {
    const duplicate = (error as { code?: string }).code === 'P2002';
    return NextResponse.json({ error: duplicate ? 'Ngành hàng này đã có hồ sơ. Hãy chọn hồ sơ hiện có để sửa.' : 'Không lưu được ngành hàng.' }, { status: duplicate ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getOrCreateUser();
    const { id, productIds } = await request.json();
    if (typeof id !== 'string' || !Array.isArray(productIds) || !productIds.length || productIds.length > 250 || productIds.some(p => typeof p !== 'string')) {
      return NextResponse.json({ error: 'Chọn ngành hàng và 1–250 sản phẩm.' }, { status: 400 });
    }
    const industry = await db.industryWorkspace.findFirst({ where: { id, userId: user.id } });
    if (!industry) return NextResponse.json({ error: 'Không tìm thấy ngành hàng.' }, { status: 404 });
    const result = await db.product.updateMany({ where: { id: { in: productIds }, userId: user.id }, data: { category: industry.name } });
    return NextResponse.json({ count: result.count });
  } catch { return NextResponse.json({ error: 'Không gán được ngành hàng.' }, { status: 500 }); }
}
