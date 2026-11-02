import type { User } from '@repo/db';
import { accountRoles, legalDocumentVersions } from '@repo/domain';
import { z } from 'zod';

const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);

export const signUpSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email,
  password,
  phoneNumber: z
    .string()
    .max(32)
    .transform((value) => value.replace(/[ -]/g, ''))
    .pipe(z.string().regex(/^\+?[0-9]{10,15}$/)),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  termsVersion: z.literal(legalDocumentVersions.terms),
  privacyVersion: z.literal(legalDocumentVersions.privacy),
});
export const signInSchema = z.strictObject({ email, password: z.string().min(1).max(128) });
export const emailSchema = z.strictObject({ email });
export const resetPasswordSchema = z.strictObject({
  token: z.string().min(1).max(512),
  newPassword: password,
});
export const verificationQuerySchema = z.strictObject({ token: z.string().min(1).max(4096) });

export const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  phoneNumber: z.string(),
  role: z.enum(accountRoles),
}) satisfies z.ZodType<
  Pick<User, 'id' | 'name' | 'email' | 'emailVerified' | 'phoneNumber' | 'role'>
>;

export type AuthUser = z.infer<typeof authUserSchema>;
