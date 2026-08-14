import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureFlowTemplates } from '@/lib/flow/templates';

export async function GET(request: Request) {
  try {
    await ensureFlowTemplates();
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    const where = category ? { category } : {};
    
    const templates = await db.flowTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    console.error('Error fetching flow templates:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, category, steps } = body;

    if (!name || !steps) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const template = await db.flowTemplate.create({
      data: {
        name,
        description: description || '',
        category: category || 'general',
        steps,
      },
    });

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating flow template:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
