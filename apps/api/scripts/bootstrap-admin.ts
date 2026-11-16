import { createDb } from '@repo/db';

import { bootstrapAdmin } from '../src/features/admin-auth/admin-bootstrap';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL を指定してください');
const db = createDb(databaseUrl);
try {
  await bootstrapAdmin(db, {
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    phoneNumber: process.env.ADMIN_PHONE_NUMBER,
  });
  console.info('初期運営アカウントを作成しました');
} catch {
  console.error('初期発行に失敗しました。入力・DB 接続・既存アカウントを確認してください');
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
