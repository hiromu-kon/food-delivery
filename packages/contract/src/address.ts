import type { Address } from '@repo/db';
import { z } from 'zod';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !value.includes(String.fromCharCode(0)), '使用できない文字が含まれています');

export const addressInputSchema = z.strictObject({
  address: text(200).min(1),
  building: text(100).default(''),
  deliveryNote: text(100).default(''),
}) satisfies z.ZodType<Pick<Address, 'address' | 'building' | 'deliveryNote'>>;

export const addressUpdateSchema = z
  .strictObject({
    address: text(200).min(1).optional(),
    building: text(100).optional(),
    deliveryNote: text(100).optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    '変更内容を指定してください',
  ) satisfies z.ZodType<{
  [Key in 'address' | 'building' | 'deliveryNote']?: Address[Key] | undefined;
}>;

export type AddressUpdate = z.infer<typeof addressUpdateSchema>;

export const addressIdSchema = z.strictObject({ id: z.uuid() });
export const addressSchema = z.object({
  id: z.uuid(),
  address: z.string(),
  building: z.string(),
  deliveryNote: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}) satisfies z.ZodType<Omit<Address, 'userId'>>;

export type AddressInput = z.infer<typeof addressInputSchema>;
export type DeliveryAddress = z.infer<typeof addressSchema>;
