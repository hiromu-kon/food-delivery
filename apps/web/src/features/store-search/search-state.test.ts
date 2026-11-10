import type { DeliveryAddress } from '@repo/contract';
import { describe, expect, it, vi } from 'vitest';
import { SearchError, StoreSearchRequests } from './search-state';

const address = (id: string): DeliveryAddress => ({
  id,
  address: id,
  building: '',
  label: '',
  isDefault: false,
  deliveryNote: '',
  latitude: 35,
  longitude: 139,
});
const a = address('00000000-0000-4000-8000-000000000001');
const b = address('00000000-0000-4000-8000-000000000002');
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('店舗検索の取得制御', () => {
  it.each(['', 'invalid', 'another-user-id'])(
    '欠落・不正・他人の選択 %s は本人住所へ復旧する',
    async (preferred) => {
      const stores = vi.fn().mockResolvedValue([]);
      const update = vi.fn();
      await new StoreSearchRequests().run(
        { addresses: () => Promise.resolve([a, b]), stores },
        preferred,
        update,
        vi.fn(),
      );
      expect(stores).toHaveBeenCalledWith(a.id);
      expect(update).toHaveBeenCalledWith({ addresses: [a, b], selectedId: a.id, stores: [] });
    },
  );
  it('明示選択を既定より優先し、欠落時は既定、既定なしはID順に復旧する', async () => {
    const home = { ...b, isDefault: true, label: '自宅' };
    for (const [addresses, preferredId, expectedId] of [
      [[home, a], a.id, a.id],
      [[a, home], '', b.id],
      [[a, home], 'deleted', b.id],
      [[b, a], '', a.id],
    ] as const) {
      const update = vi.fn();
      await new StoreSearchRequests().run(
        { addresses: () => Promise.resolve([...addresses]), stores: () => Promise.resolve([]) },
        preferredId,
        update,
        vi.fn(),
      );
      expect(update).toHaveBeenCalledWith({
        addresses: [...addresses],
        selectedId: expectedId,
        stores: [],
      });
    }
  });
  it('未登録なら店舗APIを呼ばない', async () => {
    const stores = vi.fn();
    const update = vi.fn();
    await new StoreSearchRequests().run(
      { addresses: () => Promise.resolve([]), stores },
      a.id,
      update,
      vi.fn(),
    );
    expect(stores).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ addresses: [], selectedId: '', stores: [] });
  });
  it('住所が削除された404は再取得して別住所へ復旧する', async () => {
    const addresses = vi.fn().mockResolvedValueOnce([a, b]).mockResolvedValueOnce([b]);
    const stores = vi.fn().mockRejectedValueOnce(new SearchError(404)).mockResolvedValueOnce([]);
    const update = vi.fn();
    await new StoreSearchRequests().run({ addresses, stores }, a.id, update, vi.fn());
    expect(stores.mock.calls).toEqual([[a.id], [b.id]]);
    expect(update).toHaveBeenCalledWith({ addresses: [b], selectedId: b.id, stores: [] });
  });
  it('404の復旧を繰り返さず再試行できるエラーにする', async () => {
    const addresses = vi.fn().mockResolvedValue([a]);
    const fail = vi.fn();
    await new StoreSearchRequests().run(
      {
        addresses,
        stores: () => Promise.reject(new SearchError(404)),
      },
      a.id,
      vi.fn(),
      fail,
    );
    expect(addresses).toHaveBeenCalledTimes(2);
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
  });
  it.each([401, 403, 500])('HTTP %s は呼び出し側へ渡し、再試行できる', async (status) => {
    const requests = new StoreSearchRequests();
    const fail = vi.fn();
    const update = vi.fn();
    const source = {
      addresses: vi.fn().mockRejectedValueOnce(new SearchError(status)).mockResolvedValueOnce([b]),
      stores: () => Promise.resolve([]),
    };
    await requests.run(source, b.id, update, fail);
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({ status }));
    await requests.run(source, b.id, update, fail);
    expect(update).toHaveBeenCalledWith({ addresses: [b], selectedId: b.id, stores: [] });
  });
  it.each(['success', 'failure'])('逆順の古い店舗応答 %s を無視する', async (outcome) => {
    const requests = new StoreSearchRequests();
    const old = deferred<[]>();
    const started = deferred<void>();
    const update = vi.fn();
    const fail = vi.fn();
    const first = requests.run(
      {
        addresses: () => Promise.resolve([a, b]),
        stores: () => {
          started.resolve();
          return old.promise;
        },
      },
      a.id,
      update,
      fail,
    );
    await started.promise;
    await requests.run(
      { addresses: () => Promise.resolve([a, b]), stores: () => Promise.resolve([]) },
      b.id,
      update,
      fail,
    );
    if (outcome === 'success') old.resolve([]);
    else old.reject(new SearchError(500));
    await first;
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ addresses: [a, b], selectedId: b.id, stores: [] });
    expect(fail).not.toHaveBeenCalled();
  });
  it('古い住所一覧と離脱後の応答を無視する', async () => {
    const requests = new StoreSearchRequests();
    const old = deferred<DeliveryAddress[]>();
    const stores = vi.fn();
    const update = vi.fn();
    const first = requests.run({ addresses: () => old.promise, stores }, a.id, update, vi.fn());
    requests.cancel();
    old.resolve([a]);
    await first;
    expect(stores).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
