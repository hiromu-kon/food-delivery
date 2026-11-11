import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { assertCustomerCancellation, assertStoreOrderAction, orderStatuses } from './status';

const spec = readFileSync(
  new URL('../../../../docs/specs/order-status.md', import.meta.url),
  'utf8',
);

describe('orderStatuses', () => {
  it('docs/specs/order-status.md の状態の表と、同じ名前が同じ順に並ぶ', () => {
    const section = spec.slice(spec.indexOf('## 状態'), spec.indexOf('## 遷移'));
    const names = [...section.matchAll(/^\|[^|]+\|\s*`([a-z]+)`\s*\|/gm)].flatMap(([, name]) =>
      name ? [name] : [],
    );
    expect(orderStatuses).toEqual(names);
  });
});

it('rejects all transitions absent from the order specification', async () => {
  const { canTransitionOrder } = await import('./status');
  const allowed = new Set([
    'pending:preparing',
    'pending:canceled',
    'preparing:ready',
    'preparing:canceled',
    'ready:delivering',
    'ready:canceled',
    'delivering:delivered',
    'delivering:canceled',
  ]);
  for (const from of orderStatuses)
    for (const to of orderStatuses)
      expect(canTransitionOrder(from, to)).toBe(allowed.has(`${from}:${to}`));
});

it('R-07 permits only pending or replay of customer cancellation', () => {
  expect(() => assertCustomerCancellation('pending', null)).not.toThrow();
  expect(() => assertCustomerCancellation('canceled', 'customer')).not.toThrow();
  for (const status of orderStatuses.filter((status) => status !== 'pending')) {
    expect(() => assertCustomerCancellation(status, null)).toThrow('受付待ち');
  }
  for (const reason of ['admin', 'store_rejected', 'expired']) {
    expect(() => assertCustomerCancellation('canceled', reason)).toThrow('受付待ち');
  }
});

it('R-05 R-06 store actions reject every illegal source state and the deadline boundary', () => {
  const created = new Date('2026-01-01T00:00:00Z');
  for (const status of orderStatuses)
    for (const action of ['accept', 'reject', 'ready'] as const) {
      const run = () => assertStoreOrderAction(status, action, created, created);
      if (status === (action === 'ready' ? 'preparing' : 'pending')) expect(run).not.toThrow();
      else expect(run).toThrow();
    }
  expect(() =>
    assertStoreOrderAction('pending', 'accept', created, new Date(created.getTime() + 599999)),
  ).not.toThrow();
  expect(() =>
    assertStoreOrderAction('pending', 'accept', created, new Date(created.getTime() + 600000)),
  ).toThrow();
});
