import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ me: vi.fn() }));
vi.mock('@/api/server', () => ({
  createServerApiClient: () => ({ admin: { me: { $get: mocks.me } } }),
}));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
import { requireAdminContext } from './session';

beforeEach(() => vi.resetAllMocks());
it.each([
  [401, '/admin/login'],
  [403, '/admin/login?reason=denied'],
])('redirects access failure %s to %s', async (status, path) => {
  mocks.me.mockResolvedValue(new Response(null, { status: Number(status) }));
  await expect(requireAdminContext()).rejects.toThrow(`redirect:${path}`);
});
it('keeps network and server failure distinct from missing authentication', async () => {
  mocks.me.mockRejectedValueOnce(new Error('offline'));
  await expect(requireAdminContext()).rejects.toThrow('offline');
  mocks.me.mockResolvedValue(new Response(null, { status: 503 }));
  await expect(requireAdminContext()).rejects.toThrow('確認できません');
});
it('rejects malformed and non-admin API responses', async () => {
  for (const role of ['customer', 'store', 'courier', 'admin']) {
    mocks.me.mockResolvedValue(Response.json({ user: { role } }));
    await expect(requireAdminContext()).rejects.toThrow();
  }
});
it('accepts the verified admin context', async () => {
  const context = {
    user: {
      id: 'admin',
      name: '架空運営',
      email: 'admin@example.test',
      phoneNumber: '09000000000',
      emailVerified: true,
      role: 'admin',
    },
  };
  mocks.me.mockResolvedValue(Response.json(context));
  await expect(requireAdminContext()).resolves.toEqual(context);
});
