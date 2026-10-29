export const orderStatuses = [
  'pending',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'canceled',
] as const;

export type OrderStatus = (typeof orderStatuses)[number];
