import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const user = await getOrCreateUser();
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    const where: any = { userId: user.id };
    if (status) {
      const statuses = status.split(',').map((item) => item.trim()).filter(Boolean);
      where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
    }
    if (search) where.title = { contains: search };

    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      db.aIVideoProject.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { scenes: true } },
          flowRun: { select: { status: true } }
        },
      }),
      db.aIVideoProject.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      projects,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching video projects:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();
    let { title, productId, productDescription, productImages, style, duration, language } = body;

    if (!title || !style || !duration || !language) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (productId) {
      const product = await db.product.findFirst({ where: { id: productId, userId: user.id } });
      if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      if (product) {
        productDescription = productDescription || product.name;
        if (!productImages && product.image) {
          const evidence = product.marketplaceData;
          const gallery = evidence && typeof evidence === "object" && !Array.isArray(evidence) && Array.isArray(evidence.images) ? evidence.images.filter((v): v is string => typeof v === "string") : [];
          productImages = [...new Set([product.image, ...gallery])];
        }
      }
    }

    const project = await db.aIVideoProject.create({
      data: {
        userId: user.id,
        title,
        productId,
        productDescription: productDescription || '',
        productImages: productImages || [],
        style,
        duration,
        language,
        status: 'draft',
      },
    });

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating video project:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
