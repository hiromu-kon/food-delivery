import { describe, expect, it } from 'vitest';

import { getOrderProgress } from './progress';

describe('getOrderProgress', () => {
  it('受付待ちでは最初の段階だけが現在地になる', () => {
    expect(getOrderProgress('pending')?.map((step) => step.state)).toEqual([
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });
  it('R-12 配達中では準備完了までが済み、配達完了はまだ先になる', () => {
    expect(getOrderProgress('delivering')).toEqual([
      { status: 'pending', state: 'completed' },
      { status: 'preparing', state: 'completed' },
      { status: 'ready', state: 'completed' },
      { status: 'delivering', state: 'current' },
      { status: 'delivered', state: 'upcoming' },
    ]);
  });
  it('R-12 配達完了では最後の段階が現在地になる', () => {
    expect(getOrderProgress('delivered')?.map((step) => step.state)).toEqual([
      'completed',
      'completed',
      'completed',
      'completed',
      'current',
    ]);
  });
  it('キャンセルは配達の進行段階として表示しない', () => {
    expect(getOrderProgress('canceled')).toBeNull();
  });
});
