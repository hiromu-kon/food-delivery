'use client';

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { LocalCart } from './cart-state';

const CartContext = createContext<LocalCart | null>(null);
export function CartProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [store] = useState(() => new LocalCart(`food-delivery:cart:v1:${userId}`));
  return <CartContext.Provider value={store}>{children}</CartContext.Provider>;
}
export function useCart() {
  const store = useContext(CartContext);
  if (!store) throw new Error('CartProvider is required');
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return { ...snapshot, actions: store };
}
