import { describe, expect, it } from 'vitest';

import { getCartQuantityControls } from './quantity';

describe('getCartQuantityControls', () => {
  it('R-03 数量が 1 のときは減らす操作でカートから外す', () => {
    expect(getCartQuantityControls(1)).toEqual({ decreaseTo: 0, increaseTo: 2 });
  });
  it('R-03 数量が 20 のときは増やせない', () => {
    expect(getCartQuantityControls(20)).toEqual({ decreaseTo: 19, increaseTo: null });
  });
  it('R-03 範囲内では 1 点ずつ増減する', () => {
    expect(getCartQuantityControls(2)).toEqual({ decreaseTo: 1, increaseTo: 3 });
    expect(getCartQuantityControls(19)).toEqual({ decreaseTo: 18, increaseTo: 20 });
  });
  it.each([0, -1, 21, 1.5, NaN, Infinity])('R-03 不正な数量 %s から変更しない', (quantity) => {
    expect(getCartQuantityControls(quantity)).toEqual({ decreaseTo: null, increaseTo: null });
  });
});
