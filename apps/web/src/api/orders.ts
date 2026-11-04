import { z } from 'zod';

const attemptSchema = z.object({
  key: z.uuid(),
  body: z.object({
    storeId: z.string().min(1),
    addressId: z.string().min(1),
    items: z
      .array(z.object({ menuItemId: z.string().min(1), quantity: z.number().int().positive() }))
      .min(1),
    fulfillment: z.enum(['hand_delivery', 'leave_at_door']),
    dropoffLocation: z.enum(['front_door', 'delivery_box', 'other']).optional(),
    deliveryNote: z.string().optional(),
    paymentMethodId: z.string().startsWith('pm_'),
  }),
});
export type OrderAttempt = z.infer<typeof attemptSchema>;
export function restoreAttempt(raw: string | null): OrderAttempt | null {
  if (!raw) return null;
  return attemptSchema.parse(JSON.parse(raw));
}
export class OrderError extends Error {
  constructor(
    message: string,
    readonly retrySame: boolean,
  ) {
    super(message);
  }
}
export async function postOrder(apiUrl: string, attempt: OrderAttempt, request = fetch) {
  let response: Response;
  try {
    response = await request(`${apiUrl.replace(/\/$/, '')}/orders`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.key },
      body: JSON.stringify(attempt.body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new OrderError('注文結果を確認できません。同じ注文を再確認してください。', true);
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: '注文内容を確認してください。',
      401: 'ログインし直してください。',
      403: 'このアカウントでは注文できません。',
      404: '商品またはお届け先が見つかりません。',
      402: 'カードの承認ができませんでした。別のテストカードをお試しください。',
      422: '商品・お届け先・カード情報を確認してください。',
    };
    throw new OrderError(
      messages[response.status] ?? '注文結果を確認できません。同じ注文を再確認してください。',
      response.status >= 500 || response.status === 409 || response.status === 429,
    );
  }
  try {
    return z.object({ order: z.object({ id: z.string().min(1) }) }).parse(await response.json())
      .order;
  } catch {
    throw new OrderError('注文結果を確認できません。同じ注文を再確認してください。', true);
  }
}
