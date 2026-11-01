export const cartQuantityRange = { min: 1, max: 20 } as const;

export function getCartQuantityControls(quantity: number) {
  if (
    !Number.isInteger(quantity) ||
    quantity < cartQuantityRange.min ||
    quantity > cartQuantityRange.max
  ) {
    return { decreaseTo: null, increaseTo: null };
  }
  return {
    decreaseTo: quantity - 1,
    increaseTo: quantity < cartQuantityRange.max ? quantity + 1 : null,
  };
}
