import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://postgres.ugwpcxhowvtxhinizlgz:c9yUKCHv6fWGuEHG@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true';
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = 'postgres://postgres.ugwpcxhowvtxhinizlgz:c9yUKCHv6fWGuEHG@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require';
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

export async function getOrCreateUser() {
  let user = await db.user.findFirst();
  if (!user) {
    user = await db.user.create({
      data: {
        email: 'creator@affhub.com',
        name: 'Affiliate Creator Pro',
      },
    });
  }
  return user;
}
