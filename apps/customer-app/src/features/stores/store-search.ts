import type { DeliveryAddress, StoreSearchResult } from '@repo/contract';

import { errorMessage } from '../auth/request';
import type { SessionController } from '../auth/session';

export type StoreSearchTransport = {
  addresses: () => Promise<DeliveryAddress[]>;
  stores: (addressId: string) => Promise<StoreSearchResult[]>;
};
type State = {
  addresses: DeliveryAddress[];
  selectedId: string | undefined;
  stores: StoreSearchResult[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | undefined;
};
const initial = (): State => ({
  addresses: [],
  selectedId: undefined,
  stores: [],
  status: 'idle',
  error: undefined,
});

// 住所一覧の再取得も店舗検索と同じ世代で扱う。編集・削除前の店舗を再表示しない。
export class StoreSearchController {
  private state = initial();
  private generation = 0;
  private focused = false;
  private preferredId: string | undefined;
  private owner: string | undefined;
  private listeners = new Set<() => void>();
  constructor(
    private transport: StoreSearchTransport,
    private session: SessionController,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private clear() {
    this.generation++;
    this.state = initial();
    this.listeners.forEach((listener) => listener());
  }
  connect = () => {
    const sync = () => {
      const auth = this.session.getSnapshot();
      if (auth.status === 'authenticated') {
        if (this.owner !== auth.user.id) {
          this.preferredId = undefined;
          this.clear();
        }
        this.owner = auth.user.id;
        if (this.focused) void this.reload();
      } else {
        if (!(auth.status === 'loading' && auth.authenticated)) {
          this.owner = undefined;
          this.preferredId = undefined;
        }
        this.clear();
      }
    };
    const unsubscribe = this.session.subscribe(sync);
    sync();
    return () => {
      unsubscribe();
      this.clear();
    };
  };
  setFocused = (focused: boolean) => {
    this.focused = focused;
    if (focused && this.session.getSnapshot().status === 'authenticated') void this.reload();
    else this.clear();
  };
  reload = async () => {
    if (!this.focused || this.session.getSnapshot().status !== 'authenticated') return;
    const generation = ++this.generation;
    this.publish({
      addresses: [],
      selectedId: undefined,
      stores: [],
      status: 'loading',
      error: undefined,
    });
    try {
      const addresses = await this.transport.addresses();
      if (generation !== this.generation) return;
      const selectedId =
        addresses.find((item) => item.id === this.preferredId)?.id ?? addresses[0]?.id;
      this.preferredId = selectedId;
      this.publish({ addresses, selectedId });
      const stores = selectedId ? await this.transport.stores(selectedId) : [];
      if (generation === this.generation) this.publish({ stores, status: 'ready' });
    } catch (error) {
      if (generation === this.generation)
        this.publish({ stores: [], status: 'error', error: errorMessage(error) });
    }
  };
  select = async (id: string) => {
    if (
      !this.focused ||
      this.session.getSnapshot().status !== 'authenticated' ||
      !this.state.addresses.some((item) => item.id === id)
    )
      return;
    const generation = ++this.generation;
    this.preferredId = id;
    this.publish({ selectedId: id, stores: [], status: 'loading', error: undefined });
    try {
      const stores = await this.transport.stores(id);
      if (generation === this.generation) this.publish({ stores, status: 'ready' });
    } catch (error) {
      if (generation === this.generation)
        this.publish({ stores: [], status: 'error', error: errorMessage(error) });
    }
  };
}
