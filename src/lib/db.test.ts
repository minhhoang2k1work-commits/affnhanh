import { afterEach, describe, expect, it, vi } from 'vitest';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  vi.resetModules();
});

describe('lazy database initialization', () => {
  it('allows route modules to import during build without DATABASE_URL', async () => {
    process.env.DATABASE_URL = '';
    const database = await import('./db');

    expect(database.isDatabaseConfigured()).toBe(false);
    expect(() => database.db.user).toThrow(/DATABASE_URL is required at runtime/);
  });
});
