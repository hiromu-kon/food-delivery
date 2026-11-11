import type { OrderDetail, OrderSummary } from '@repo/contract';
import { AuthRequestError, errorMessage } from '../auth/request';
import type { SessionController } from '../auth/session';

export type OrdersTransport = {
  cancel: (id: string) => Promise<{ id: string; status: 'canceled' }>;
  list: () => Promise<OrderSummary[]>;
  detail: (id: string) => Promise<OrderDetail>;
};
type State = {
  route: string | undefined;
  orders: OrderSummary[] | undefined;
  order: OrderDetail | undefined;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | undefined;
  cancellation?: 'submitting' | 'uncertain' | 'blocked' | undefined;
  cancellationMessage?: string | undefined;
};
export type CancellationStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
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
  private canceling = false;
  private focused = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  constructor(
    private transport: OrdersTransport,
    private session: SessionController,
    private storage: CancellationStorage,
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
  cancel = async (id: string) => {
    const order = this.state.order;
    if (
      this.canceling ||
      !this.focused ||
      !order ||
      order.id !== id ||
      (order.status !== 'pending' && this.state.cancellation !== 'uncertain') ||
      this.state.cancellation === 'blocked' ||
      this.session.getSnapshot().status !== 'authenticated'
    )
      return;
    this.canceling = true;
    clearTimeout(this.timer);
    const generation = ++this.generation;
    const auth = this.session.getSnapshot();
    if (auth.status !== 'authenticated') {
      this.canceling = false;
      return;
    }
    const key = `order-cancellation:${auth.user.id}:${order.id}`;
    this.publish({
      ...this.state,
      status: 'ready',
      error: undefined,
      cancellation: 'submitting',
      cancellationMessage: undefined,
    });
    try {
      // Persist before sending: a lost response or app restart must retain reconciliation.
      await this.storage.setItem(key, 'uncertain');
      if (generation !== this.generation) return;
      const result = await this.transport.cancel(order.id);
      await this.storage.removeItem(key);
      if (generation !== this.generation) return;
      this.publish({
        ...this.state,
        order: { ...order, status: result.status },
        cancellation: undefined,
        cancellationMessage: '注文と仮売上の取消が完了しました。',
      });
    } catch (error) {
      if (generation !== this.generation) return;
      const status = error instanceof AuthRequestError ? error.status : 0;
      if ([400, 404, 409].includes(status))
        await this.storage.removeItem(key).catch(() => undefined);
      if (generation !== this.generation) return;
      this.publish({
        ...this.state,
        ...(status === 400 || status === 404
          ? { order: undefined, status: 'error' as const, error: errorMessage(error) }
          : {}),
        cancellation: [400, 401, 403, 404, 409].includes(status) ? 'blocked' : 'uncertain',
        cancellationMessage:
          status === 409
            ? errorMessage(error)
            : [400, 401, 403, 404].includes(status)
              ? undefined
              : '取消と仮売上の取消の完了を確認できません。表示中の注文状況だけでは仮売上の取消完了は確認できません。同じ注文の取消を再試行してください。',
      });
    } finally {
      this.canceling = false;
      void this.reload();
    }
  };
  reload = async () => {
    if (
      this.canceling ||
      !this.focused ||
      this.state.status === 'loading' ||
      this.session.getSnapshot().status !== 'authenticated'
    )
      return;
    clearTimeout(this.timer);
    const generation = ++this.generation;
    const route = this.state.route;
    const auth = this.session.getSnapshot();
    this.publish({ ...this.state, status: 'loading', error: undefined });
    try {
      const data = route
        ? { order: await this.transport.detail(route) }
        : { orders: await this.transport.list() };
      const uncertain =
        route && auth.status === 'authenticated'
          ? await this.storage.getItem(`order-cancellation:${auth.user.id}:${route}`)
          : null;
      if (generation !== this.generation) return;
      this.publish({
        ...this.state,
        ...(uncertain && this.state.cancellation !== 'blocked'
          ? {
              cancellation: 'uncertain' as const,
              cancellationMessage:
                '取消と仮売上の取消の完了は未確認です。同じ注文の取消を再試行してください。',
            }
          : {}),
        ...data,
        status: 'ready',
        error: undefined,
      });
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
