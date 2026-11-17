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
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('Idempotency-Key')).toBe(
      attempt.key,
    );
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('Content-Type')).toBe(
      'application/json',
    );
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
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

it('R-05 handles one action and retries the exact attempt before accepting an order', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json(
        { status: 'requires_action', clientSecret: 'pi_test_secret_synthetic' },
        { status: 202 },
      ),
    )
    .mockResolvedValueOnce(Response.json({ order: { id: 'order' } }, { status: 201 }));
  const action = vi.fn().mockResolvedValue(undefined);
  await expect(postOrder('https://api.example', attempt, request, action)).resolves.toEqual({
    id: 'order',
  });
  expect(action).toHaveBeenCalledExactlyOnceWith('pi_test_secret_synthetic');
  expect(request.mock.calls[0]?.[1]?.body).toEqual(request.mock.calls[1]?.[1]?.body);
  expect(new Headers(request.mock.calls[1]?.[1]?.headers).get('Idempotency-Key')).toBe(attempt.key);
});
it('preserves definitive errors from the request after authentication', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json(
        { status: 'requires_action', clientSecret: 'pi_test_secret_synthetic' },
        { status: 202 },
      ),
    )
    .mockResolvedValueOnce(Response.json({ code: 'ORDER_NOT_ORDERABLE' }, { status: 422 }));
  await expect(
    postOrder('https://api.example', attempt, request, vi.fn().mockResolvedValue(undefined)),
  ).rejects.toMatchObject({ retrySame: false });
});
it('R-05 cancellation and repeated action retain the attempt without looping or reporting success', async () => {
  for (const action of [
    vi.fn().mockRejectedValue(new Error('canceled')),
    vi.fn().mockResolvedValue(undefined),
  ]) {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(
          Response.json(
            { status: 'requires_action', clientSecret: 'pi_test_secret_synthetic' },
            { status: 202 },
          ),
        ),
      );
    await expect(postOrder('https://api.example', attempt, request, action)).rejects.toMatchObject({
      retrySame: true,
    });
    expect(action).toHaveBeenCalledOnce();
    expect(request.mock.calls.length).toBeLessThanOrEqual(2);
  }
});
it('rejects malformed action contracts before invoking the SDK', async () => {
  const { checkoutActionRequiredSchema } = await import('@repo/contract');
  for (const value of [
    { status: 'requires_action', clientSecret: 'bad' },
    { status: 'requires_capture', clientSecret: 'pi_test_secret_synthetic' },
    { status: 'requires_action', clientSecret: 'pi_test_secret_synthetic', card: 'private' },
  ]) {
    expect(checkoutActionRequiredSchema.safeParse(value).success).toBe(false);
    const action = vi.fn();
    await expect(
      postOrder(
        'https://api.example',
        attempt,
        vi.fn().mockResolvedValue(Response.json(value, { status: 202 })),
        action,
      ),
    ).rejects.toMatchObject({ retrySame: true });
    expect(action).not.toHaveBeenCalled();
  }
});
