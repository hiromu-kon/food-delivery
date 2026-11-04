import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createCardPayment, StripeCard, type CardElement, type StripeClient } from './stripe-card';

describe('Stripe card component', () => {
  it('fails closed without a test publishable key and never loads Stripe for a live key', () => {
    for (const publishableKey of [undefined, 'pk_live_not_allowed']) {
      const html = renderToStaticMarkup(
        <StripeCard publishableKey={publishableKey} disabled={false} onReady={() => {}} />,
      );
      expect(html).toContain('テスト決済は現在利用できません');
      expect(html).not.toContain('js.stripe.com');
      expect(html).not.toContain('type="text"');
    }
  });
  it('passes the hosted Element to Stripe and returns paymentMethodId', async () => {
    const card = {} as CardElement;
    const createPaymentMethod = vi.fn().mockResolvedValue({ paymentMethod: { id: 'pm_element' } });
    const stripe = { createPaymentMethod } as unknown as StripeClient;
    await expect(createCardPayment(stripe, card)).resolves.toBe('pm_element');
    expect(createPaymentMethod).toHaveBeenCalledWith({ type: 'card', card });
  });
  it('propagates payment failures without producing a payment method', async () => {
    const stripe = {
      createPaymentMethod: vi
        .fn()
        .mockResolvedValue({ error: { message: 'カードを確認してください' } }),
    } as unknown as StripeClient;
    await expect(createCardPayment(stripe, {} as CardElement)).rejects.toThrow(
      'カードを確認してください',
    );
  });
});
