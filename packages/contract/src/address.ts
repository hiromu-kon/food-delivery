import type { Address } from '@repo/db';
import { z } from 'zod';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => value.length <= max, `${max}文字以内で入力してください`)
    .refine((value) => !value.includes(String.fromCharCode(0)), '使用できない文字が含まれています');

export const addressInputSchema = z.strictObject({
  address: text(200).min(1),
  label: text(20).default(''),
  isDefault: z.boolean().default(false),
  building: text(100).default(''),
  deliveryNote: text(100).default(''),
}) satisfies z.ZodType<
  Pick<Address, 'address' | 'building' | 'deliveryNote' | 'label' | 'isDefault'>
>;

export const addressUpdateSchema = z
  .strictObject({
    address: text(200).min(1).optional(),
    label: text(20).optional(),
    isDefault: z.boolean().optional(),
    building: text(100).optional(),
    deliveryNote: text(100).optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    '変更内容を指定してください',
  ) satisfies z.ZodType<{
  [Key in 'address' | 'building' | 'deliveryNote' | 'label' | 'isDefault']?:
    Address[Key] | undefined;
}>;

export type AddressUpdate = z.infer<typeof addressUpdateSchema>;

export const addressIdSchema = z.strictObject({ id: z.uuid() });
export const addressSchema = z.object({
  id: z.uuid(),
  address: z.string(),
  label: z.string(),
  isDefault: z.boolean(),
  building: z.string(),
  deliveryNote: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}) satisfies z.ZodType<Omit<Address, 'userId'>>;

type NormalizedAddressInput = z.infer<typeof addressInputSchema>;
export type AddressInput = Omit<NormalizedAddressInput, 'label' | 'isDefault'> &
  Partial<Pick<NormalizedAddressInput, 'label' | 'isDefault'>>;
export type DeliveryAddress = z.infer<typeof addressSchema>;
