import { NextResponse } from 'next/server';
import { workerStatus } from '@/lib/autocut/queue';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json(await workerStatus(), { headers: { 'Cache-Control': 'no-store' } }); }
