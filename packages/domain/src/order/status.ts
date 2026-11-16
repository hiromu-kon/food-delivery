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

const acceptanceWindowMs = 10 * 60 * 1000;

export function acceptanceDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + acceptanceWindowMs);
}

export function acceptanceExpiryCutoff(now: Date): Date {
  return new Date(now.getTime() - acceptanceWindowMs);
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

export function assertAdminCancellation(status: OrderStatus, reason: string | null): void {
  if (!(
    ['preparing', 'ready', 'delivering'].includes(status) ||
    (status === 'canceled' && reason === 'admin')
  ))
    throw new DomainError('ORDER_NOT_CANCELABLE', '受付後・配達完了前の注文だけキャンセルできます');
}
export function assertAdminUnassignment(status: OrderStatus): void {
  if (status === 'delivered' || status === 'canceled')
    throw new DomainError(
      'ORDER_INVALID_TRANSITION',
      '完了・キャンセル済みの注文は担当解除できません',
    );
}

export function canRetryRefund(startedAt: Date, now: Date): boolean {
  return now.getTime() - startedAt.getTime() < 23 * 3600000;
}

export function japanOrderDateRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00+09:00`);
  return { start, end: new Date(start.getTime() + 86400000) };
}
