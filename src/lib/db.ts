import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      'POSTGRES_PRISMA_URL or DATABASE_URL is required at runtime. Configure it in the deployment environment.',
    );
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient();
  return globalForPrisma.prisma;
}

// Prisma is resolved lazily. Next.js can import API route modules while
// collecting build metadata without requiring a live runtime database.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL);
}

export async function getOrCreateUser() {
  const user = await db.user.findFirst();
  if (user) return user;
  return db.user.create({
    data: {
      email: 'creator@affhub.com',
      name: 'Affiliate Creator Pro',
    },
  });
}
