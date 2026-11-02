import type { AuthUser } from '@repo/contract';
import { describe, expect, it, vi } from 'vitest';

import { AuthRequestError } from './request';
import { SessionController, type SessionTransport } from './session';

const user: AuthUser = {
  id: 'customer-1',
  name: '注文 太郎',
  email: 'customer@example.test',
  emailVerified: true,
  phoneNumber: '09012345678',
  role: 'customer',
};
const credentials = { email: user.email, password: 'test-password' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup(initial: string | null = null) {
  let saved = initial;
  const storage = {
    read: vi.fn(() => Promise.resolve(saved)),
    write: vi.fn((token: string) => {
      saved = token;
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      saved = null;
      return Promise.resolve();
    }),
  };
  const transport = {
    signIn: vi.fn<SessionTransport['signIn']>().mockResolvedValue({ user, token: 'signed-token' }),
    me: vi.fn<SessionTransport['me']>().mockResolvedValue({ user }),
    signOut: vi.fn<SessionTransport['signOut']>().mockResolvedValue(undefined),
  };
  return {
    storage,
    transport,
    controller: new SessionController(storage, transport),
    saved: () => saved,
  };
}
describe('注文者アプリのセッション', () => {
  it('再起動後は保存されたBearerをAPIで確認してからプロフィールを表示する', async () => {
    const app = setup();
    await app.controller.login(credentials);
    const response = deferred<{ user: AuthUser }>();
    app.transport.me.mockReturnValueOnce(response.promise);
    const restarted = new SessionController(app.storage, app.transport);
    const restoring = restarted.restore();
    await vi.waitFor(() => expect(app.transport.me).toHaveBeenCalledWith('signed-token'));
    expect(restarted.getSnapshot()).toEqual({ status: 'loading' });
    response.resolve({ user });
    await restoring;
    expect(restarted.getSnapshot()).toEqual({ status: 'authenticated', user });
  });
  it('保存がなければAPIを呼ばず未認証になる', async () => {
    const app = setup();
    await app.controller.restore();
    expect(app.controller.getSnapshot().status).toBe('anonymous');
    expect(app.transport.me).not.toHaveBeenCalled();
  });
  it.each(['UNAUTHORIZED', 'TOKEN_EXPIRED', 'SESSION_REVOKED'])(
    '%s の401は端末のtokenを消す',
    async (code) => {
      const app = setup('expired');
      app.transport.me.mockRejectedValueOnce(new AuthRequestError('再ログイン', code, 401));
      await app.controller.restore();
      expect(app.saved()).toBeNull();
      expect(app.controller.getSnapshot()).toMatchObject({
        status: 'anonymous',
        message: 'ログインの有効期限が切れました。もう一度ログインしてください。',
      });
    },
  );
  it('停止済み403の復元は端末のtokenを消す', async () => {
    const app = setup('disabled');
    app.transport.me.mockRejectedValueOnce(
      new AuthRequestError('このアカウントは利用できません。', 'ACCOUNT_DISABLED', 403),
    );
    await app.controller.restore();
    expect(app.saved()).toBeNull();
    expect(app.controller.getSnapshot()).toMatchObject({
      status: 'anonymous',
      message: 'このアカウントは利用できません。',
    });
  });
  it.each(['store', 'courier', 'admin'] as const)('%sは復元もログインも拒否する', async (role) => {
    const app = setup('wrong-role');
    app.transport.me.mockResolvedValueOnce({ user: { ...user, role } });
    await app.controller.restore();
    expect(app.saved()).toBeNull();
    app.transport.signIn.mockResolvedValueOnce({ user: { ...user, role }, token: 'wrong' });
    await expect(app.controller.login(credentials)).rejects.toMatchObject({ code: 'WRONG_ROLE' });
    expect(app.transport.signOut).toHaveBeenCalledWith('wrong');
    expect(app.saved()).toBeNull();
    expect(app.controller.getSnapshot().status).toBe('anonymous');
  });
  it('R-14 メール未確認のプロフィールではログインを保持しない', async () => {
    const app = setup('unverified');
    app.transport.me.mockResolvedValueOnce({ user: { ...user, emailVerified: false } });
    await app.controller.restore();
    expect(app.saved()).toBeNull();
    expect(app.controller.getSnapshot().status).toBe('anonymous');
  });
  it('通信失敗はログイン画面を出さず再試行でき、tokenを保持する', async () => {
    const app = setup('saved');
    app.transport.me.mockRejectedValueOnce(new TypeError('offline'));
    await app.controller.restore();
    expect(app.controller.getSnapshot()).toMatchObject({ status: 'error', retry: 'restore' });
    expect(app.saved()).toBe('saved');
    await app.controller.restore();
    expect(app.controller.getSnapshot().status).toBe('authenticated');
  });
  it('SecureStore読出しの失敗は未認証と区別して再試行する', async () => {
    const app = setup('saved');
    app.storage.read.mockRejectedValueOnce(new Error('locked'));
    await app.controller.restore();
    expect(app.controller.getSnapshot()).toMatchObject({ status: 'error', retry: 'restore' });
    expect(app.transport.me).not.toHaveBeenCalled();
    await app.controller.restore();
    expect(app.controller.getSnapshot().status).toBe('authenticated');
  });
  it('保存失敗では認証済みにせず発行済みのセッションも取り消す', async () => {
    const app = setup();
    app.storage.write.mockRejectedValueOnce(new Error('disk full'));
    await expect(app.controller.login(credentials)).rejects.toMatchObject({ code: 'STORAGE' });
    expect(app.controller.getSnapshot().status).toBe('anonymous');
    expect(app.saved()).toBeNull();
    expect(app.transport.signOut).toHaveBeenCalledWith('signed-token');
  });
  it('削除失敗はログアウト完了扱いにせず再試行する', async () => {
    const app = setup('saved');
    await app.controller.restore();
    app.storage.clear.mockRejectedValueOnce(new Error('locked'));
    await app.controller.logout();
    expect(app.controller.getSnapshot()).toMatchObject({ status: 'error', retry: 'logout' });
    await app.controller.logout();
    expect(app.saved()).toBeNull();
    expect(app.controller.getSnapshot().status).toBe('anonymous');
  });
  it('サーバーに接続できなくても端末からはログアウトできる', async () => {
    const app = setup('saved');
    await app.controller.restore();
    app.transport.signOut.mockRejectedValueOnce(new Error('offline'));
    await app.controller.logout();
    expect(app.saved()).toBeNull();
    expect(app.controller.getSnapshot().status).toBe('anonymous');
  });
  it('復元中にログアウトしても遅れて返るプロフィールを復活させない', async () => {
    const app = setup('saved');
    const response = deferred<{ user: AuthUser }>();
    app.transport.me.mockReturnValueOnce(response.promise);
    const restore = app.controller.restore();
    await vi.waitFor(() => expect(app.transport.me).toHaveBeenCalled());
    await app.controller.logout();
    response.resolve({ user });
    await restore;
    expect(app.saved()).toBeNull();
    expect(app.controller.getSnapshot().status).toBe('anonymous');
  });
  it('ログインのHTTP待機中のlogoutで遅いtokenを保存せず取り消す', async () => {
    const app = setup();
    const response = deferred<{ user: AuthUser; token: string }>();
    app.transport.signIn.mockReturnValueOnce(response.promise);
    const login = app.controller.login(credentials);
    await vi.waitFor(() => expect(app.transport.signIn).toHaveBeenCalled());
    await app.controller.logout();
    response.resolve({ user, token: 'late' });
    await login;
    expect(app.saved()).toBeNull();
    expect(app.storage.write).not.toHaveBeenCalled();
    expect(app.transport.signOut).toHaveBeenCalledWith('late');
    expect(app.controller.getSnapshot().status).toBe('anonymous');
  });
  it('進行中のSecureStore書込み後にlogoutの削除を実行する', async () => {
    const app = setup();
    const gate = deferred<void>();
    const originalWrite = app.storage.write.getMockImplementation()!;
    app.storage.write.mockImplementationOnce(async (token) => {
      await gate.promise;
      await originalWrite(token);
    });
    const login = app.controller.login(credentials);
    await vi.waitFor(() => expect(app.storage.write).toHaveBeenCalled());
    const logout = app.controller.logout();
    gate.resolve();
    await Promise.all([login, logout]);
    expect(app.saved()).toBeNull();
    expect(app.controller.getSnapshot().status).toBe('anonymous');
  });
  it('新しいログインが完了した後に古いログイン応答が来ても上書きしない', async () => {
    const app = setup();
    const first = deferred<{ user: AuthUser; token: string }>();
    app.transport.signIn.mockReturnValueOnce(first.promise);
    const old = app.controller.login(credentials);
    await vi.waitFor(() => expect(app.transport.signIn).toHaveBeenCalledTimes(1));
    app.transport.signIn.mockResolvedValueOnce({ user: { ...user, id: 'second' }, token: 'new' });
    await app.controller.login(credentials);
    first.resolve({ user, token: 'old' });
    await old;
    expect(app.saved()).toBe('new');
    expect(app.controller.getSnapshot()).toMatchObject({
      status: 'authenticated',
      user: { id: 'second' },
    });
    expect(app.transport.signOut).toHaveBeenCalledWith('old');
  });
  it('foregroundや画面遷移での再確認で失効を反映する', async () => {
    const app = setup('saved');
    await app.controller.restore();
    app.transport.me.mockRejectedValueOnce(new AuthRequestError('expired', 'UNAUTHORIZED', 401));
    await app.controller.refresh();
    expect(app.saved()).toBeNull();
    expect(app.controller.getSnapshot().status).toBe('anonymous');
  });
  it('APIが更新した署名付きtokenを復元時に保存する', async () => {
    const app = setup('old');
    app.transport.me.mockResolvedValueOnce({ user, token: 'renewed' });
    await app.controller.restore();
    expect(app.saved()).toBe('renewed');
    await app.controller.logout();
    expect(app.transport.signOut).toHaveBeenCalledWith('renewed');
  });
});
