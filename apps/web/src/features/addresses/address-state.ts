import {
  addressInputSchema,
  addressUpdateSchema,
  type AddressInput,
  type DeliveryAddress,
} from '@repo/contract';

export function changedAddress(input: AddressInput, previous: DeliveryAddress) {
  const normalized = addressInputSchema.parse({
    ...input,
    label: input.label ?? previous.label,
    isDefault: input.isDefault ?? previous.isDefault,
  });
  const changes = Object.fromEntries(
    Object.entries(normalized).filter(
      ([key, value]) => previous[key as keyof AddressInput] !== value,
    ),
  );
  return Object.keys(changes).length ? addressUpdateSchema.parse(changes) : null;
}

// 一覧取得中に変更が始まったら、その一覧応答は成功・失敗とも採用しない。
export class AddressRequests {
  private generation = 0;
  private pending = false;
  list() {
    return ++this.generation;
  }
  current(generation: number) {
    return generation === this.generation;
  }
  begin() {
    if (this.pending) return false;
    this.pending = true;
    this.generation++;
    return true;
  }
  end() {
    this.pending = false;
  }
}

export class AddressRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function assertAddressSuccess(response: Response) {
  if (response.ok) return;
  const messages: Record<number, string> = {
    400: '入力内容を確認して、もう一度お試しください。',
    401: 'ログインし直してください。',
    403: 'このアカウントでは利用できません。',
    404: 'お届け先が見つかりません。一覧を再読み込みしてください。',
    422: '住所の位置を確認できませんでした。番地などを確認して、もう一度お試しください。',
    503: '地図サービスを利用できません。時間をおいてもう一度お試しください。',
  };
  throw new AddressRequestError(
    messages[response.status] ?? '処理できませんでした。もう一度お試しください。',
    response.status,
  );
}

export function addressErrorMessage(error: unknown) {
  return error instanceof AddressRequestError
    ? error.message
    : '通信できませんでした。接続を確認して、もう一度お試しください。保存済みか不明な場合は一覧を再読み込みして確認してください。';
}
