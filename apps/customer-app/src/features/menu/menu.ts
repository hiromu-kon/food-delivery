import type { MenuResponse } from '@repo/contract';

import { errorMessage } from '../auth/request';
import type { SessionController } from '../auth/session';

export type MenuTransport = { menu: (storeId: string) => Promise<MenuResponse> };
type State = {
  storeId: string | undefined;
  menu: MenuResponse | undefined;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | undefined;
};

export class MenuController {
  private state: State = { storeId: undefined, menu: undefined, status: 'idle', error: undefined };
  private generation = 0;
  private focused = false;
  private listeners = new Set<() => void>();
  constructor(
    private transport: MenuTransport,
    private session: SessionController,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private clear(storeId: string | undefined) {
    this.generation++;
    this.publish({ storeId, menu: undefined, status: 'idle', error: undefined });
  }
  private publish(state: State) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  connect = () => {
    const sync = () => {
      this.clear(this.state.storeId);
      if (this.session.getSnapshot().status === 'authenticated') void this.reload();
    };
    const unsubscribe = this.session.subscribe(sync);
    sync();
    return () => {
      unsubscribe();
      this.clear(undefined);
    };
  };
  setRoute = (storeId: string | undefined, focused: boolean) => {
    this.focused = focused;
    this.clear(storeId);
    if (focused) void this.reload();
  };
  reload = async () => {
    const storeId = this.state.storeId;
    if (!this.focused || !storeId || this.session.getSnapshot().status !== 'authenticated') return;
    const generation = ++this.generation;
    this.publish({ storeId, menu: undefined, status: 'loading', error: undefined });
    try {
      const menu = await this.transport.menu(storeId);
      if (generation === this.generation)
        this.publish({ storeId, menu, status: 'ready', error: undefined });
    } catch (error) {
      if (generation === this.generation)
        this.publish({ storeId, menu: undefined, status: 'error', error: errorMessage(error) });
    }
  };
}
