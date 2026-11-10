import { menuResponseSchema, type MenuResponse } from '@repo/contract';

export class MenuError extends Error {
  constructor(readonly status: number) {
    super('メニューを取得できませんでした');
  }
}

export async function readMenu(response: Response): Promise<MenuResponse> {
  if (!response.ok) throw new MenuError(response.status);
  return menuResponseSchema.parse(await response.json());
}

// 店舗変更・再取得・離脱より前に開始した成功も認証エラーも画面へ反映しない。
export class MenuRequests {
  private generation = 0;
  cancel() {
    this.generation++;
  }
  async run(
    source: () => Promise<MenuResponse>,
    update: (menu: MenuResponse) => void,
    fail: (cause: unknown) => void,
  ) {
    const generation = ++this.generation;
    try {
      const menu = await source();
      if (generation === this.generation) update(menu);
    } catch (cause) {
      if (generation === this.generation) fail(cause);
    }
  }
}

export function menuErrorMessage(cause: unknown) {
  if (cause instanceof MenuError && (cause.status === 404 || cause.status === 400))
    return '店舗が見つかりません。店舗一覧からお店を選び直してください。';
  return 'メニューを取得できませんでした。接続を確認して、もう一度お試しください。';
}
