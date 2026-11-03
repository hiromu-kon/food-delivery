import { describe, expect, it } from 'vitest';
import { addressInputSchema, addressUpdateSchema, type DeliveryAddress } from '@repo/contract';
import {
  AddressRequests,
  AddressRequestError,
  addressErrorMessage,
  assertAddressSuccess,
  changedAddress,
} from './address-state';

const saved: DeliveryAddress = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  address: '東京都千代田区丸の内1-1',
  building: '101',
  label: '',
  isDefault: false,
  deliveryNote: '玄関前',
  latitude: 35,
  longitude: 139,
};
const input = {
  address: saved.address,
  building: saved.building,
  deliveryNote: saved.deliveryNote,
};

describe('お届け先フォームとリクエストの整合性', () => {
  it('R-15 メモだけの編集は住所・座標・userIdを送らず再測位を避ける', () => {
    expect(changedAddress({ ...input, deliveryNote: ' 呼び出してください ' }, saved)).toEqual({
      deliveryNote: '呼び出してください',
    });
    expect(changedAddress({ ...input, building: '' }, saved)).toEqual({ building: '' });
  });
  it('住所変更は変更した住所だけを送り、空白の正規化後に差分を判定する', () => {
    expect(changedAddress({ ...input, address: '大阪府大阪市1-1' }, saved)).toEqual({
      address: '大阪府大阪市1-1',
    });
    expect(changedAddress({ ...input, address: ` ${saved.address} ` }, saved)).toBeNull();
  });
  it('R-15 100文字を許可し101文字・未入力・権限や座標の注入を拒否する', () => {
    expect(addressInputSchema.safeParse({ ...input, deliveryNote: 'あ'.repeat(100) }).success).toBe(
      true,
    );
    for (const values of [
      { ...input, deliveryNote: 'あ'.repeat(101) },
      { ...input, building: 'あ'.repeat(101) },
      { ...input, address: '  ' },
      { ...input, latitude: 35 },
      { ...input, userId: 'other' },
    ]) {
      expect(addressInputSchema.safeParse(values).success).toBe(false);
    }
    expect(addressUpdateSchema.safeParse({}).success).toBe(false);
  });
  it('二重送信を同期的に止め、変更前に開始した一覧の成功・失敗を破棄する', () => {
    const requests = new AddressRequests();
    const oldList = requests.list();
    expect(requests.begin()).toBe(true);
    expect(requests.begin()).toBe(false);
    requests.end();
    expect(requests.current(oldList)).toBe(false);
    const nextList = requests.list();
    expect(requests.current(nextList)).toBe(true);
    expect(requests.begin()).toBe(true);
    expect(requests.current(nextList)).toBe(false);
  });
  it('後から始めた一覧を優先する', () => {
    const requests = new AddressRequests();
    const first = requests.list();
    const second = requests.list();
    expect(requests.current(first)).toBe(false);
    expect(requests.current(second)).toBe(true);
  });
  it.each([400, 401, 403, 404, 422, 503, 500])(
    'HTTP %s は成功扱いせず再試行・認証案内を返す',
    (status) => {
      expect(() => assertAddressSuccess(new Response('', { status }))).toThrow(AddressRequestError);
      try {
        assertAddressSuccess(new Response('', { status }));
      } catch (error) {
        expect(addressErrorMessage(error)).not.toContain('通信できませんでした');
      }
    },
  );
  it('通信失敗時は保存結果の確認と再試行を案内する', () => {
    expect(addressErrorMessage(new TypeError('Failed to fetch'))).toContain('一覧を再読み込み');
    expect(assertAddressSuccess(new Response('', { status: 201 }))).toBeUndefined();
  });
});
