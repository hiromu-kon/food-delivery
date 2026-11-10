import { describe, expect, it, vi } from 'vitest';
import { OrderError, postOrder, restoreAttempt, type OrderAttempt } from './orders';
const attempt: OrderAttempt = {
  key: '00000000-0000-4000-8000-000000000001',
  body: {
    storeId: 'store',
    addressId: 'address',
    items: [{ menuItemId: 'menu', quantity: 2 }],
    fulfillment: 'hand_delivery',
    paymentMethodId: 'pm_test',
  },
};
describe('order transport and retry safety', () => {
  it('includes session credentials and the same UUID/payload on retries', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(Response.json({ order: { id: 'order' } }));
    await expect(postOrder('https://api.example/', attempt, request)).rejects.toMatchObject({
      retrySame: true,
    });
    const restored = restoreAttempt(JSON.stringify(attempt))!;
    await expect(postOrder('https://api.example/', restored, request)).resolves.toEqual({
      id: 'order',
    });
    expect(request.mock.calls[0]?.[0]).toEqual(request.mock.calls[1]?.[0]);
    expect(request.mock.calls[0]?.[1]?.body).toEqual(request.mock.calls[1]?.[1]?.body);
    expect(request.mock.calls[0]?.[1]?.headers).toEqual(request.mock.calls[1]?.[1]?.headers);
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Idempotency-Key': attempt.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(attempt.body),
    });
  });
  it('keeps ambiguous failures and malformed success responses retryable', async () => {
    for (const request of [
      vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 409 })),
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({})),
    ]) {
      await expect(postOrder('https://api.example', attempt, request)).rejects.toMatchObject({
        retrySame: true,
      });
    }
  });
  it('treats card declines and validation errors as definitive failures', async () => {
    for (const status of [400, 401, 403, 404, 402, 422]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status }));
      await expect(postOrder('https://api.example', attempt, request)).rejects.toBeInstanceOf(
        OrderError,
      );
      await expect(postOrder('https://api.example', attempt, request)).rejects.toMatchObject({
        retrySame: false,
      });
    }
  });
  it('fails closed on corrupted persisted attempts', () => {
    expect(restoreAttempt(null)).toBeNull();
    expect(() => restoreAttempt('{')).toThrow();
    expect(() => restoreAttempt(JSON.stringify({ ...attempt, key: 'bad' }))).toThrow();
  });
});
