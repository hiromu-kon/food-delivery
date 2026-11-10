export type PaymentIntent = {
  id: string;
  status: string;
  amount: number;
  amount_capturable: number;
  currency: string;
  capture_method: string;
};

export interface StripeClient {
  create(amount: number, paymentMethodId: string, key: string): Promise<PaymentIntent>;
  retrieve(id: string): Promise<PaymentIntent>;
  confirm(id: string, key: string): Promise<PaymentIntent>;
  cancel(id: string, key: string): Promise<PaymentIntent>;
}

export class PaymentError extends Error {
  constructor(
    readonly code: 'PAYMENT_UNAVAILABLE' | 'PAYMENT_FAILED' | 'PAYMENT_RECONCILIATION_REQUIRED',
  ) {
    super(code);
  }
}
