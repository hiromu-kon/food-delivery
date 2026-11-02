import type { AuthUser } from '@repo/contract';

import { AuthRequestError } from './request';

type Credentials = { email: string; password: string };
export type SessionTransport = {
  signIn: (credentials: Credentials) => Promise<{ user: AuthUser; token: string }>;
  me: (token: string) => Promise<{ user: AuthUser; token?: string }>;
  signOut: (token: string) => Promise<void>;
};
export type TokenStorage = {
  read: () => Promise<string | null>;
  write: (token: string) => Promise<void>;
  clear: () => Promise<void>;
};
export type SessionState =
  | { status: 'loading'; authenticated?: boolean }
  | { status: 'anonymous'; message?: string }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'error'; message: string; retry: 'restore' | 'logout' };

const storageMessage =
  '端末の安全な保存領域を利用できません。端末のロックや空き容量を確認して再試行してください。';

// 世代番号は HTTP と保存完了の双方で検査する。保存は直列化し、進行中の write より後に clear を実行する。
export class SessionController {
  private state: SessionState = { status: 'loading' };
  private token: string | null = null;
  private generation = 0;
  private storageQueue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  constructor(
    private storage: TokenStorage,
    private transport: SessionTransport,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: SessionState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private store<T>(operation: () => Promise<T>) {
    const result = this.storageQueue.then(operation);
    this.storageQueue = result.catch(() => undefined);
    return result;
  }
  private async discard(generation: number, message?: string) {
    this.token = null;
    try {
      await this.store(() => this.storage.clear());
      if (generation === this.generation)
        this.publish({ status: 'anonymous', ...(message && { message }) });
    } catch {
      if (generation === this.generation)
        this.publish({ status: 'error', message: storageMessage, retry: 'logout' });
    }
  }
  private checkCustomer(user: AuthUser) {
    if (user.role !== 'customer')
      throw new AuthRequestError('注文者のアカウントでログインしてください。', 'WRONG_ROLE', 403);
    if (!user.emailVerified)
      throw new AuthRequestError(
        'メールアドレスを確認してからログインしてください。',
        'EMAIL_NOT_VERIFIED',
        403,
      );
  }
  restore = async () => {
    const generation = ++this.generation;
    this.publish({ status: 'loading' });
    let token: string | null;
    try {
      token = await this.store(() => this.storage.read());
    } catch {
      if (generation === this.generation)
        this.publish({ status: 'error', message: storageMessage, retry: 'restore' });
      return;
    }
    if (generation !== this.generation) return;
    if (!token) {
      this.token = null;
      this.publish({ status: 'anonymous' });
      return;
    }
    await this.validate(token, generation);
  };
  private async validate(token: string, generation: number) {
    try {
      const result = await this.transport.me(token);
      if (generation !== this.generation) return;
      this.checkCustomer(result.user);
      const nextToken = result.token ?? token;
      if (nextToken !== token)
        await this.store(async () => {
          if (generation === this.generation) await this.storage.write(nextToken);
        }).catch(() => {
          throw new AuthRequestError(storageMessage, 'STORAGE');
        });
      if (generation !== this.generation) return;
      this.token = nextToken;
      this.publish({ status: 'authenticated', user: result.user });
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof AuthRequestError && [401, 403].includes(error.status)) {
        await this.discard(
          generation,
          error.status === 401
            ? 'ログインの有効期限が切れました。もう一度ログインしてください。'
            : error.message,
        );
      } else {
        this.token = null;
        this.publish({
          status: 'error',
          message:
            error instanceof AuthRequestError
              ? error.message
              : '認証を確認できませんでした。接続を確認して再試行してください。',
          retry: 'restore',
        });
      }
    }
  }
  refresh = async () => {
    if (this.state.status !== 'authenticated' || !this.token) return;
    const token = this.token;
    const generation = ++this.generation;
    // 再確認中はプロフィールを隠し、認証済みのルート履歴は保持する。
    this.publish({ status: 'loading', authenticated: true });
    await this.validate(token, generation);
  };
  login = async (credentials: Credentials) => {
    const generation = ++this.generation;
    this.token = null;
    let issuedToken: string | undefined;
    try {
      // 前のセッションを残したまま次のログインの保存に失敗させない。
      await this.store(() => this.storage.clear()).catch(() => {
        throw new AuthRequestError(storageMessage, 'STORAGE');
      });
      if (generation !== this.generation) return;
      const result = await this.transport.signIn(credentials);
      issuedToken = result.token;
      if (generation !== this.generation) {
        await this.revoke(result.token);
        return;
      }
      this.checkCustomer(result.user);
      if (!result.token)
        throw new AuthRequestError('認証情報を受け取れませんでした。再度ログインしてください。');
      await this.store(async () => {
        if (generation === this.generation) await this.storage.write(result.token);
      }).catch(() => {
        throw new AuthRequestError(storageMessage, 'STORAGE');
      });
      if (generation !== this.generation) {
        await this.revoke(result.token);
        return;
      }
      this.token = result.token;
      this.publish({ status: 'authenticated', user: result.user });
    } catch (error) {
      if (issuedToken) await this.revoke(issuedToken);
      if (generation !== this.generation) return;
      await this.discard(generation);
      throw error;
    }
  };
  private async revoke(token: string) {
    await this.transport.signOut(token).catch(() => undefined);
  }
  logout = async () => {
    const generation = ++this.generation;
    const token = this.token;
    this.token = null;
    this.publish({ status: 'loading' });
    // サーバーの停止中でも端末からのログアウトを完了できる。失敗した削除は再試行させる。
    await this.discard(generation);
    if (token) await this.revoke(token);
  };
}
