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
