import type { DeliveryAddress, StoreSearchResult } from '@repo/contract';

export class SearchError extends Error {
  constructor(readonly status: number) {
    super('店舗一覧を取得できませんでした。接続を確認して、もう一度お試しください。');
  }
}

export function assertSearchSuccess(response: Response) {
  if (!response.ok) throw new SearchError(response.status);
}

type SearchSource = {
  addresses: () => Promise<DeliveryAddress[]>;
  stores: (addressId: string) => Promise<StoreSearchResult[]>;
};

export type SearchResult = {
  addresses: DeliveryAddress[];
  selectedId: string;
  stores: StoreSearchResult[];
};

// 住所取得から店舗取得までを同じ世代として扱い、逆順応答と画面離脱を無効化する。
export class StoreSearchRequests {
  private generation = 0;
  cancel() {
    this.generation++;
  }
  async run(
    source: SearchSource,
    preferredId: string,
    update: (result: SearchResult) => void,
    fail: (cause: unknown) => void,
  ) {
    const generation = ++this.generation;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const addresses = await source.addresses();
        if (generation !== this.generation) return;
        const selectedId =
          addresses.find((item) => item.id === preferredId)?.id ?? addresses[0]?.id ?? '';
        try {
          const stores = selectedId ? await source.stores(selectedId) : [];
          if (generation === this.generation) update({ addresses, selectedId, stores });
          return;
        } catch (cause) {
          // 一覧取得直後に削除された住所は一度だけ最新一覧から選び直す。
          if (attempt === 0 && cause instanceof SearchError && cause.status === 404) continue;
          throw cause;
        }
      }
    } catch (cause) {
      if (generation === this.generation) fail(cause);
    }
  }
}
