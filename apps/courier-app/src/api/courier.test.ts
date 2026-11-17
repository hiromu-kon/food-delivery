import { afterEach, expect, it, vi } from 'vitest';

import { sessionTransport } from './auth';
import { getCourier, setAvailability } from './courier';
import { SessionController } from '../features/auth/session';

const user = {
  id: 'courier-a',
  name: '架空配達員',
  email: 'courier@example.test',
  emailVerified: true,
  phoneNumber: '09000000000',
  role: 'courier',
};
const profile = { user, courier: { isAvailable: false } };
afterEach(() => vi.unstubAllGlobals());
it('ログイン後に配達員登録を確認し、更新された署名Bearerだけを保存する', async () => {
  const nativeFetch = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ user }), { headers: { 'set-auth-token': 'signed' } }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify(profile), { headers: { 'set-auth-token': 'renewed' } }),
    );
  vi.stubGlobal('fetch', nativeFetch);
  expect(
    await sessionTransport.signIn({ email: user.email, password: 'fictional-password' }),
  ).toEqual({ user, token: 'renewed' });
  expect(nativeFetch.mock.calls[1]?.[0]).toBe('http://api.example.test/courier/me');
  expect(new Headers(nativeFetch.mock.calls[1]?.[1]?.headers).get('authorization')).toBe(
    'Bearer signed',
  );
  expect(nativeFetch.mock.calls[0]?.[1]?.credentials).toBe('omit');
});
it('配達員登録を確認できないログインでは発行されたセッションを失効させる', async () => {
  const nativeFetch = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ user }), { headers: { 'set-auth-token': 'signed' } }),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: 403 }))
    .mockResolvedValueOnce(new Response('{"status":true}'));
  vi.stubGlobal('fetch', nativeFetch);
  await expect(
    sessionTransport.signIn({ email: user.email, password: 'fictional-password' }),
  ).rejects.toMatchObject({ status: 403 });
  expect(nativeFetch.mock.calls[2]?.[0]).toBe('http://api.example.test/auth/sign-out');
});
it('本人の取得と稼働値の指定を型付きクライアントで送り、失効時は端末保存を破棄する', async () => {
  const clear = vi.fn().mockResolvedValue(undefined);
  const controller = new SessionController(
    { read: () => Promise.resolve('signed'), write: async () => {}, clear },
    sessionTransport,
  );
  const nativeFetch = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(profile)));
  vi.stubGlobal('fetch', nativeFetch);
  await controller.restore();
  nativeFetch.mockResolvedValueOnce(new Response(JSON.stringify(profile)));
  expect(await getCourier(controller)).toEqual(profile);
  nativeFetch.mockResolvedValueOnce(new Response('{"isAvailable":true}'));
  expect(await setAvailability(controller, true)).toEqual({ isAvailable: true });
  const init = nativeFetch.mock.calls.at(-1)?.[1];
  expect(init?.method).toBe('PATCH');
  expect(init?.body).toBe(JSON.stringify({ isAvailable: true }));
  nativeFetch.mockResolvedValueOnce(new Response('{"code":"ACCOUNT_DISABLED"}', { status: 403 }));
  await expect(setAvailability(controller, false)).rejects.toMatchObject({ status: 403 });
  expect(clear).toHaveBeenCalledOnce();
  expect(controller.getSnapshot().status).toBe('anonymous');
});
