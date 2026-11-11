import type { OrderDetail, OrderSummary } from '@repo/contract';
import { AuthRequestError, errorMessage } from '../auth/request';
import type { SessionController } from '../auth/session';

export type OrdersTransport = {
  list: () => Promise<OrderSummary[]>;
  detail: (id: string) => Promise<OrderDetail>;
};
type State = {
  route: string | undefined;
  orders: OrderSummary[] | undefined;
  order: OrderDetail | undefined;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | undefined;
};
export class OrdersController {
  private state: State = {
    route: undefined,
    orders: undefined,
    order: undefined,
    status: 'idle',
    error: undefined,
  };
  private generation = 0;
  private focused = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  constructor(
    private transport: OrdersTransport,
    private session: SessionController,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: State) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private clear() {
    this.generation++;
    clearTimeout(this.timer);
    this.publish({
      route: this.state.route,
      orders: undefined,
      order: undefined,
      status: 'idle',
      error: undefined,
    });
  }
  connect = () => {
    const sync = () => {
      this.clear();
      if (this.focused) void this.reload();
    };
    const unsubscribe = this.session.subscribe(sync);
    sync();
    return () => {
      unsubscribe();
      this.focused = false;
      this.clear();
    };
  };
  setRoute = (route: string | undefined, focused: boolean) => {
    this.focused = focused;
    this.clear();
    this.publish({ ...this.state, route });
    if (focused) void this.reload();
  };
  reload = async () => {
    if (
      !this.focused ||
      this.state.status === 'loading' ||
      this.session.getSnapshot().status !== 'authenticated'
    )
      return;
    clearTimeout(this.timer);
    const generation = ++this.generation;
    const route = this.state.route;
    this.publish({ ...this.state, status: 'loading', error: undefined });
    try {
      const data = route
        ? { order: await this.transport.detail(route) }
        : { orders: await this.transport.list() };
      if (generation !== this.generation) return;
      this.publish({ ...this.state, ...data, status: 'ready', error: undefined });
    } catch (error) {
      if (generation !== this.generation) return;
      this.publish({
        ...this.state,
        ...(error instanceof AuthRequestError && [400, 404].includes(error.status)
          ? { order: undefined }
          : {}),
        status: 'error',
        error: errorMessage(error),
      });
    }
    // Schedule after completion so a slow request cannot overlap the next poll.
    if (generation === this.generation && this.focused && route)
      this.timer = setTimeout(() => {
        void this.reload();
      }, 5_000);
  };
}
