import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { orderStatuses } from './status';

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
