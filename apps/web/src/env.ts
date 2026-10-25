import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
});

// NEXT_PUBLIC_* はビルド時に文字列へ置き換えられるため、process.env をまとめて渡さず 1 つずつ参照する。
export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
