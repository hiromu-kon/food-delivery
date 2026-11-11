import { DomainError } from '../errors';

export const orderStatuses = [
  'pending',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'canceled',
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['preparing', 'canceled'],
  preparing: ['ready', 'canceled'],
  ready: ['delivering', 'canceled'],
  delivering: ['delivered', 'canceled'],
  delivered: [],
  canceled: [],
};

/** Structural transitions only; actor/payment preconditions belong to the API. */
export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from].includes(to);
}

/** A customer cancellation may be replayed after reserving the transition. */
export function assertCustomerCancellation(status: OrderStatus, reason: string | null): void {
  if (status !== 'pending' && !(status === 'canceled' && reason === 'customer'))
    throw new DomainError('ORDER_NOT_CANCELABLE', '受付待ちの注文だけ取り消せます');
}

export function acceptanceDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + 10 * 60 * 1000);
}

export function assertStoreOrderAction(
  status: OrderStatus,
  action: 'accept' | 'reject' | 'ready',
  createdAt: Date,
  now: Date,
): void {
  if (action === 'ready' ? status !== 'preparing' : status !== 'pending')
    throw new DomainError(
      'ORDER_INVALID_TRANSITION',
      '注文状態が変わりました。再読み込みしてください',
    );
  if (action === 'accept' && now >= acceptanceDeadline(createdAt))
    throw new DomainError('ORDER_INVALID_TRANSITION', '受付期限を過ぎています');
}
