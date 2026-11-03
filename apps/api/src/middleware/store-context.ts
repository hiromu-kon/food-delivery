import { storeMeResponseSchema, type StoreContext } from '@repo/contract';
import type { Db } from '@repo/db';
import { assertAccountAccess, DomainError } from '@repo/domain';
import { createMiddleware } from 'hono/factory';

import { createStoreAuthRepository } from '../features/store-auth/store-auth.repository';
import type { AuthEnv } from './auth';

export type StoreEnv = AuthEnv & { Variables: { storeContext: StoreContext } };

// requireSession の後に使用する。店舗スコープの唯一の入力は認証された本人の ID。
export function requireStoreContext(db: Db) {
  const repository = createStoreAuthRepository(db);
  return createMiddleware<StoreEnv>(async (c, next) => {
    const user = c.get('authUser');
    if (!user) throw new DomainError('UNAUTHORIZED', 'ログインしてください');
    const context = await repository.findContext(user.id);
    if (!context) throw new DomainError('FORBIDDEN', 'この操作はできません');
    // セッションの発行時の権限や所属を信用せず、毎回同じ DB 読み取りで確認する。
    assertAccountAccess(context.user, ['store'], true);
    c.set('storeContext', storeMeResponseSchema.parse(context));
    await next();
  });
}
