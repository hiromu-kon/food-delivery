import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
import { PaymentCard, PaymentProvider, usePaymentMethod } from './payment';
const sdk = vi.hoisted(() => ({ createPaymentMethod: vi.fn() }));
vi.mock('@stripe/stripe-react-native', () => ({
  CardField: (props: object) => React.createElement('native-card-field', props),
  StripeProvider: ({ children }: { children: React.ReactNode }) => children,
  useStripe: () => sdk,
}));
vi.mock('@/env', () => ({ env: { EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_component' } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => vi.clearAllMocks());
it('uses the native card field, only reads completeness, and disables during submit', async () => {
  const complete = vi.fn();
  let renderer!: ReactTestRenderer;
  await act(() => {
    renderer = create(
      <PaymentProvider>
        <PaymentCard onComplete={complete} disabled />
      </PaymentProvider>,
    );
  });
  const card = renderer.root.findByType('native-card-field' as React.ElementType);
  expect(card.props.disabled).toBe(true);
  expect(card.props.dangerouslyGetFullCardDetails).toBeUndefined();
  const onChange = card.props.onCardChange as (card: { complete: boolean; number: string }) => void;
  await act(() => {
    onChange({ complete: true, number: 'must-not-escape' });
  });
  expect(complete).toHaveBeenCalledExactlyOnceWith(true);
  await act(() => renderer.unmount());
});
it('returns only paymentMethodId and handles incomplete and failed native SDK results', async () => {
  let tokenize!: () => Promise<string>;
  function Harness({ complete }: { complete: boolean }) {
    tokenize = usePaymentMethod(complete);
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(() => {
    renderer = create(<Harness complete={false} />);
  });
  await expect(tokenize()).rejects.toThrow('すべて');
  expect(sdk.createPaymentMethod).not.toHaveBeenCalled();
  await act(() => renderer.update(<Harness complete />));
  sdk.createPaymentMethod.mockResolvedValueOnce({ error: { message: 'declined' } });
  await expect(tokenize()).rejects.toThrow('カード情報');
  sdk.createPaymentMethod.mockResolvedValueOnce({ paymentMethod: { id: 'pm_native' } });
  await expect(tokenize()).resolves.toBe('pm_native');
  expect(sdk.createPaymentMethod).toHaveBeenLastCalledWith({ paymentMethodType: 'Card' });
  await act(() => renderer.unmount());
});
