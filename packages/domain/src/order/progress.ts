import type { OrderStatus } from './status';

const progressStatuses = [
  'pending',
  'preparing',
  'ready',
  'delivering',
  'delivered',
] as const satisfies readonly OrderStatus[];

export function getOrderProgress(status: OrderStatus) {
  if (status === 'canceled') return null;
  const current = progressStatuses.indexOf(status);
  return progressStatuses.map((step, index) => ({
    status: step,
    state:
      index < current
        ? ('completed' as const)
        : index === current
          ? ('current' as const)
          : ('upcoming' as const),
  }));
}
