import { describe, expect, it } from 'vitest';

import {
  addCartItem,
  calculateCartTotals,
  checkCartOrderability,
  clearCart,
  getCartQuantityControls,
  removeCartItem,
  setCartItemQuantity,
  type Cart,
  type CartItem,
} from '../index';

const meal: CartItem = Object.freeze({
  restaurantId: 'restaurant-a',
  productId: 'meal',
  unitPrice: 850,
  quantity: 2,
});
const drink: CartItem = Object.freeze({ ...meal, productId: 'drink', unitPrice: 150, quantity: 1 });
const cart: Cart = Object.freeze([meal, drink]);

describe('R-02 税込整数円の計算', () => {
  it('R-02 850円×2と150円×1の小計1850円に配達料300円を加える', () => {
    expect(calculateCartTotals(cart)).toEqual({
      status: 'ok',
      subtotal: 1850,
      deliveryFee: 300,
      total: 2150,
    });
  });

  it('R-02 配達料を変更でき、0円商品・無料配達も扱う', () => {
    expect(calculateCartTotals(cart, 500)).toMatchObject({ total: 2350, deliveryFee: 500 });
    expect(calculateCartTotals([{ ...meal, unitPrice: 0 }], 0)).toEqual({
      status: 'ok',
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
    });
  });

  it('R-02 空カートは配達料を課さず0円になる', () => {
    expect(calculateCartTotals(clearCart())).toEqual({
      status: 'ok',
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
    });
  });

  it.each([-1, 0.1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'R-02 不正な金額 %s を単価・配達料として受け付けない',
    (amount) => {
      expect(calculateCartTotals([{ ...meal, unitPrice: amount }])).toEqual({
        status: 'invalid',
        reason: 'invalid-money',
      });
      expect(calculateCartTotals(cart, amount)).toEqual({
        status: 'invalid',
        reason: 'invalid-money',
      });
    },
  );

  it('R-02 乗算・小計の加算・配達料の加算それぞれのoverflowを拒否する', () => {
    const expensive = { ...meal, unitPrice: Number.MAX_SAFE_INTEGER, quantity: 1 };
    expect(calculateCartTotals([{ ...expensive, quantity: 2 }], 0)).toEqual({
      status: 'invalid',
      reason: 'unsafe-total',
    });
    expect(calculateCartTotals([expensive, drink], 0)).toEqual({
      status: 'invalid',
      reason: 'unsafe-total',
    });
    expect(calculateCartTotals([expensive])).toEqual({ status: 'invalid', reason: 'unsafe-total' });
    expect(calculateCartTotals([expensive], 0)).toMatchObject({
      status: 'ok',
      total: Number.MAX_SAFE_INTEGER,
    });
  });
});

describe('R-03 カートの操作', () => {
  it('R-03 空カートに追加でき、同商品は数量を加算して最新の入力単価で計算する', () => {
    expect(addCartItem([], meal)).toEqual({ status: 'updated', cart: [meal] });
    expect(addCartItem(cart, { ...meal, quantity: 3, unitPrice: 900 })).toEqual({
      status: 'updated',
      cart: [{ ...meal, quantity: 5, unitPrice: 900 }, drink],
    });
    expect(addCartItem([meal], drink)).toEqual({ status: 'updated', cart });
    expect(cart).toEqual([meal, drink]);
  });

  it('R-03 別店舗は確認なし・明示キャンセルでは状態を変更せず、確認後だけ置き換える', () => {
    const other = { ...meal, restaurantId: 'restaurant-b' };
    for (const options of [{}, { confirmRestaurantChange: false }]) {
      const result = addCartItem(cart, other, options);
      expect(result).toEqual({
        status: 'confirmation-required',
        cart,
        restaurantId: 'restaurant-b',
      });
      if (result.status === 'confirmation-required') expect(result.cart).toBe(cart);
    }
    expect(addCartItem(cart, other, { confirmRestaurantChange: true })).toEqual({
      status: 'updated',
      cart: [other],
    });
    expect(cart).toEqual([meal, drink]);
  });

  it('R-03 数量1と20の境界を受け付け、加算で20を超えたら拒否する', () => {
    expect(setCartItemQuantity(cart, 'meal', 1)).toMatchObject({ status: 'updated' });
    expect(addCartItem([meal], { ...meal, quantity: 18 })).toEqual({
      status: 'updated',
      cart: [{ ...meal, quantity: 20 }],
    });
    expect(addCartItem([meal], { ...meal, quantity: 19 })).toEqual({
      status: 'invalid',
      reason: 'invalid-quantity',
    });
  });

  it.each([-1, 0.5, 21, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'R-03 不正な数量 %s の追加・変更を拒否する',
    (quantity) => {
      expect(addCartItem(cart, { ...meal, quantity })).toEqual({
        status: 'invalid',
        reason: 'invalid-quantity',
      });
      expect(setCartItemQuantity(cart, 'meal', quantity)).toEqual({
        status: 'invalid',
        reason: 'invalid-quantity',
      });
    },
  );

  it('R-03 追加数量0は拒否し、既存UIの数量1からの減算0は削除に使える', () => {
    expect(addCartItem(cart, { ...meal, quantity: 0 })).toEqual({
      status: 'invalid',
      reason: 'invalid-quantity',
    });
    const quantity = getCartQuantityControls(1).decreaseTo;
    expect(quantity).toBe(0);
    if (quantity !== null) {
      expect(setCartItemQuantity(cart, 'meal', quantity)).toEqual({
        status: 'updated',
        cart: [drink],
      });
    }
    expect(removeCartItem([meal], 'meal')).toEqual({ status: 'updated', cart: [] });
    expect(removeCartItem(cart, 'missing')).toEqual({ status: 'updated', cart });
    expect(clearCart()).toEqual([]);
  });

  it('R-03 復元したカートの他店舗混入・重複商品・不正な数量も拒否する', () => {
    const invalidCarts: Cart[] = [
      [meal, { ...drink, restaurantId: 'restaurant-b' }],
      [meal, meal],
      [{ ...meal, quantity: 0 }],
      [{ ...meal, productId: ' ' }],
      [{ ...meal, restaurantId: '' }],
    ];
    for (const invalidCart of invalidCarts) {
      expect(calculateCartTotals(invalidCart).status).toBe('invalid');
      expect(checkCartOrderability(invalidCart).status).toBe('invalid');
      expect(addCartItem(invalidCart, drink).status).toBe('invalid');
      expect(setCartItemQuantity(invalidCart, 'meal', 1).status).toBe('invalid');
      expect(removeCartItem(invalidCart, 'meal').status).toBe('invalid');
    }
  });

  it('R-03 追加・数量変更でも小計のoverflowを拒否し、確認済みでも不正商品には切替しない', () => {
    const expensive = { ...meal, unitPrice: Number.MAX_SAFE_INTEGER, quantity: 1 };
    expect(addCartItem([expensive], drink)).toEqual({ status: 'invalid', reason: 'unsafe-total' });
    expect(setCartItemQuantity([expensive], 'meal', 2)).toEqual({
      status: 'invalid',
      reason: 'unsafe-total',
    });
    expect(
      addCartItem(
        cart,
        { ...expensive, restaurantId: 'other', quantity: 2 },
        { confirmRestaurantChange: true },
      ),
    ).toEqual({ status: 'invalid', reason: 'unsafe-total' });
  });
});

describe('R-04 最低注文金額', () => {
  it('R-04 配達料込みでは最低金額を満たしても、小計だけで不足を判定する', () => {
    expect(calculateCartTotals(cart)).toMatchObject({ total: 2150 });
    expect(checkCartOrderability(cart, 2000)).toEqual({ status: 'below-minimum', shortfall: 150 });
    expect(checkCartOrderability(cart, 1851)).toEqual({ status: 'below-minimum', shortfall: 1 });
    expect(checkCartOrderability(cart, 1850)).toEqual({ status: 'orderable', shortfall: 0 });
    expect(checkCartOrderability(cart, 1849)).toEqual({ status: 'orderable', shortfall: 0 });
    expect(checkCartOrderability(cart)).toEqual({ status: 'orderable', shortfall: 0 });
  });

  it('R-04 空カートは最低金額0でも注文不可、0円商品は最低金額0なら注文可能', () => {
    expect(checkCartOrderability([])).toEqual({ status: 'empty', shortfall: 0 });
    expect(checkCartOrderability([], 1000)).toEqual({ status: 'empty', shortfall: 1000 });
    expect(checkCartOrderability([{ ...meal, unitPrice: 0 }])).toEqual({
      status: 'orderable',
      shortfall: 0,
    });
  });

  it.each([-1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'R-04 不正な最低注文金額 %s を拒否する',
    (minimum) => {
      expect(checkCartOrderability(cart, minimum)).toEqual({
        status: 'invalid',
        reason: 'invalid-money',
      });
    },
  );
});
