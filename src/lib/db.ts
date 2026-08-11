import { PrismaClient } from '@prisma/client';
import path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  if (envUrl.startsWith('file:')) {
    let filePath = envUrl.replace('file:', '');
    // Fix: Prisma CLI resolves file:./dev.db to prisma/dev.db, so runtime must match it
    if (filePath === './dev.db') {
      filePath = './prisma/dev.db';
    }
    if (!path.isAbsolute(filePath)) {
      const absPath = path.resolve(process.cwd(), filePath);
      return `file:${absPath.replace(/\\/g, '/')}`;
    }
    return envUrl;
  }
  return envUrl;
}

const dbUrl = getDatabaseUrl();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
