import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionController } from '../features/auth/session';
import { sessionTransport } from './auth';
import { createApiClient, requestTimeoutMs } from './client';

const user = {
  id: 'native-customer',
  name: '注文者',
  email: 'customer@example.test',
  emailVerified: true,
  phoneNumber: '09012345678',
  role: 'customer',
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('Native API client', () => {
  it('ログイン時はCookieを使わず署名付きヘッダーを受け取る', async () => {
    const nativeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ user }), { headers: { 'set-auth-token': 'signed-token' } }),
      );
    vi.stubGlobal('fetch', nativeFetch);
    const result = await sessionTransport.signIn({ email: user.email, password: 'password' });
    expect(result.token).toBe('signed-token');
    const init = nativeFetch.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
  });
  it('復元時はBearerを送り、更新された署名付きヘッダーを返す', async () => {
    const nativeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ user }), { headers: { 'set-auth-token': 'renewed' } }),
      );
    vi.stubGlobal('fetch', nativeFetch);
    const result = await sessionTransport.me('signed-token');
    const init = nativeFetch.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer signed-token');
    expect(result.token).toBe('renewed');
  });
  it('401はプロフィールとして扱わず失効を呼出元に返す', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 })),
    );
    await expect(sessionTransport.me('expired')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });
  it('署名付きヘッダーが欠けたログインを保持しない', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ user }))),
    );
    await expect(
      sessionTransport.signIn({ email: user.email, password: 'password' }),
    ).rejects.toThrow('認証情報を受け取れませんでした');
  });
  it('10秒で通信を中断し、復元を再試行できる', async () => {
    vi.useFakeTimers();
    const nativeFetch = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    vi.stubGlobal('fetch', nativeFetch);
    const storage = {
      read: () => Promise.resolve('signed-token'),
      write: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };
    const controller = new SessionController(storage, sessionTransport);
    const restoring = controller.restore();
    await vi.advanceTimersByTimeAsync(requestTimeoutMs);
    await restoring;
    expect(nativeFetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', retry: 'restore' });
    nativeFetch.mockResolvedValueOnce(new Response(JSON.stringify({ user })));
    await controller.restore();
    expect(controller.getSnapshot().status).toBe('authenticated');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('公開APIも同じ通信の期限を使う', async () => {
    const nativeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ status: true })));
    vi.stubGlobal('fetch', nativeFetch);
    await createApiClient().auth['send-verification-email'].$post({ json: { email: user.email } });
    expect(nativeFetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
