import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { CartController } from './cart';

const CartContext = createContext<CartController | null>(null);
const key = 'customer.cart.v1';
export function CartProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(
    () =>
      new CartController({
        read: () => AsyncStorage.getItem(key),
        write: (value) => AsyncStorage.setItem(key, value),
      }),
  );
  useEffect(() => {
    void controller.restore();
  }, [controller]);
  return <CartContext.Provider value={controller}>{children}</CartContext.Provider>;
}
export function useCart() {
  const controller = useContext(CartContext);
  if (!controller) throw new Error('CartProvider が必要です');
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { state, controller };
}
