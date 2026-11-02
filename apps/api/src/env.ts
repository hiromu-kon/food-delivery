import { z } from 'zod';

const httpOrigin = z
  .url()
  .transform((value) => new URL(value))
  .refine(
    (url) => ['http:', 'https:'].includes(url.protocol),
    'HTTP または HTTPS を指定してください',
  )
  .transform((url) => url.origin);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8787),
    DATABASE_URL: z.url(),
    AUTH_URL: httpOrigin.default('http://localhost:8787'),
    WEB_URL: httpOrigin.default('http://localhost:3000'),
    AUTH_SECRET: z.string().min(32),
    SMTP_HOST: z.string().min(1).default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(11025),
    SMTP_SECURE: z.stringbool().default(false),
    SMTP_FROM: z.email().default('no-reply@example.test'),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD))
      context.addIssue({
        code: 'custom',
        message: 'SMTP_USER と SMTP_PASSWORD は両方設定してください',
      });
    if (value.NODE_ENV === 'production') {
      if (!value.AUTH_URL.startsWith('https://') || !value.WEB_URL.startsWith('https://'))
        context.addIssue({
          code: 'custom',
          message: '本番の AUTH_URL と WEB_URL は HTTPS にしてください',
        });
      if (value.AUTH_SECRET === 'development-only-secret-change-before-deploy')
        context.addIssue({
          code: 'custom',
          path: ['AUTH_SECRET'],
          message: '本番用の秘密鍵を設定してください',
        });
    }
  });

export function loadEnv(input: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(input);
}
