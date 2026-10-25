import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url(),
});

// EXPO_PUBLIC_* はビルド時に文字列へ置き換えられるため、process.env をまとめて渡さず 1 つずつ参照する。
export const env = envSchema.parse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});
