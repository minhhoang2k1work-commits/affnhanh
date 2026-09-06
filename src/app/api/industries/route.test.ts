import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  workspace: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  product: { updateMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({
  getOrCreateUser: async () => ({ id: 'owner' }),
  db: {
    industryWorkspace: mock.workspace,
    product: mock.product,
    $transaction: async (callback: any) => callback({ industryWorkspace: mock.workspace, product: mock.product }),
  },
}));
// Resolve the application alias without depending on a Next.js server.
vi.mock('@/lib/products/industry', async () => import('../../../lib/products/industry'));
import { PATCH, POST } from './route';
const request = (body: unknown) => new Request('http://localhost/api/industries', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => { vi.clearAllMocks(); });
describe('industry persistence and assignment', () => {
  it('rejects updates to an industry not owned by the caller', async () => {
    mock.workspace.findFirst.mockResolvedValue(null);
    const response = await POST(request({ id: 'someone-elses', name: 'Changed' }));
    expect(response.status).toBe(404);
    expect(mock.workspace.update).not.toHaveBeenCalled();
    expect(mock.workspace.findFirst).toHaveBeenCalledWith({ where: { id: 'someone-elses', userId: 'owner' } });
  });
  it('renames the category on owned products with the saved industry', async () => {
    mock.workspace.findFirst.mockResolvedValue({ id: 'industry', name: 'Old' });
    mock.workspace.update.mockResolvedValue({ id: 'industry', name: 'New' });
    const response = await POST(request({ id: 'industry', name: 'New' }));
    expect(response.status).toBe(200);
    expect(mock.product.updateMany).toHaveBeenCalledWith({ where: { userId: 'owner', category: 'Old' }, data: { category: 'New' } });
  });
  it('only assigns products belonging to the caller', async () => {
    mock.workspace.findFirst.mockResolvedValue({ id: 'industry', name: 'Fashion' });
    mock.product.updateMany.mockResolvedValue({ count: 2 });
    const response = await PATCH(request({ id: 'industry', productIds: ['a', 'b'] }));
    expect(await response.json()).toEqual({ count: 2 });
    expect(mock.product.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] }, userId: 'owner' }, data: { category: 'Fashion' } });
  });
});
