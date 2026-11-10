import { CardField, StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { AuthRequestError } from '@/features/auth/request';
import type { ReactElement } from 'react';
import { env } from '@/env';

export const stripeTestKey = env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')
  ? env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
  : undefined;
export function PaymentProvider({ children }: { children: ReactElement }) {
  return (
    <StripeProvider
      publishableKey={stripeTestKey ?? 'pk_test_unconfigured'}
      urlScheme="fooddelivery-customer"
    >
      {children}
    </StripeProvider>
  );
}
export function PaymentCard({
  onComplete,
  disabled,
}: {
  onComplete: (complete: boolean) => void;
  disabled: boolean;
}) {
  return (
    <CardField
      postalCodeEnabled={false}
      disabled={disabled}
      accessibilityLabel="カード番号・有効期限・セキュリティコード"
      onCardChange={(card) => onComplete(card.complete)}
      // Native SDK styles mirror color.text.primary / border.strong / radius.sm tokens.
      cardStyle={{
        backgroundColor: '#ffffff',
        textColor: '#1d2126',
        borderColor: '#c9ced6',
        borderWidth: 1,
        borderRadius: 8,
        fontSize: 14,
      }}
      style={{ height: 56, width: '100%' }}
    />
  );
}
export function usePaymentMethod(complete: boolean) {
  const { createPaymentMethod } = useStripe();
  return async () => {
    if (!stripeTestKey) throw new AuthRequestError('テスト決済の設定がありません。');
    if (!complete) throw new AuthRequestError('カード情報をすべて入力してください。');
    const result = await createPaymentMethod({ paymentMethodType: 'Card' });
    if (result.error || !result.paymentMethod)
      throw new AuthRequestError('カード情報を確認し、もう一度入力してください。');
    return result.paymentMethod.id;
  };
}
