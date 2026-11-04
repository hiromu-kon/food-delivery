import { describe, expect, it, vi } from 'vitest';
import { createStripeClient } from './stripe';
const intent = {
  id: 'pi_fake',
  status: 'requires_confirmation',
  amount: 1700,
  amount_capturable: 0,
  currency: 'jpy',
  capture_method: 'manual',
  livemode: false,
};

describe('Stripe REST adapter (injected HTTP, no network)', () => {
  it('R-05 creates unconfirmed manual authorization and uses independent idempotency keys', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(intent)));
    const client = createStripeClient('sk_test_fake', fetcher);
    await client.create(1700, 'pm_fake', 'attempt:create');
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://api.stripe.com/v1/payment_intents');
    const body = new URLSearchParams(options!.body as string);
    expect(Object.fromEntries(body)).toEqual({
      amount: '1700',
      currency: 'jpy',
      capture_method: 'manual',
      confirmation_method: 'manual',
      'payment_method_types[]': 'card',
      payment_method: 'pm_fake',
    });
    expect(options!.headers).toMatchObject({ 'Idempotency-Key': 'attempt:create' });
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({ ...intent, status: 'requires_capture', amount_capturable: 1700 }),
      ),
    );
    await client.confirm('pi_fake', 'attempt:confirm');
    expect(fetcher.mock.calls[1]).toMatchObject([
      'https://api.stripe.com/v1/payment_intents/pi_fake/confirm',
      { method: 'POST', headers: { 'Idempotency-Key': 'attempt:confirm' } },
    ]);
    fetcher.mockResolvedValue(new Response(JSON.stringify({ ...intent, status: 'canceled' })));
    await client.cancel('pi_fake', 'attempt:cancel');
    expect(fetcher.mock.calls[2]).toMatchObject([
      'https://api.stripe.com/v1/payment_intents/pi_fake/cancel',
      { headers: { 'Idempotency-Key': 'attempt:cancel' } },
    ]);
  });
  it('rejects live keys and responses and fails closed without configuration', async () => {
    expect(() => createStripeClient('sk_live_fake')).toThrow('Stripe test key required');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ...intent, livemode: true })));
    await expect(
      createStripeClient('sk_test_fake', fetcher).retrieve('pi_fake'),
    ).rejects.toMatchObject({ code: 'PAYMENT_UNAVAILABLE' });
    fetcher.mockClear();
    await expect(
      createStripeClient(undefined, fetcher).create(1700, 'pm_fake', 'key'),
    ).rejects.toMatchObject({ code: 'PAYMENT_UNAVAILABLE' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([402, 429, 500])(
    'maps Stripe failure %s without returning sensitive payloads',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('private Stripe error', { status }));
      await expect(
        createStripeClient('sk_test_fake', fetcher).retrieve('pi_fake'),
      ).rejects.toMatchObject({
        code: status >= 500 || status === 429 ? 'PAYMENT_UNAVAILABLE' : 'PAYMENT_FAILED',
      });
    },
  );
  it('maps ambiguous network failure to retryable unavailability', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
    await expect(
      createStripeClient('sk_test_fake', fetcher).confirm('pi_fake', 'key'),
    ).rejects.toMatchObject({ code: 'PAYMENT_UNAVAILABLE' });
  });
});
