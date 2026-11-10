import type { DeliveryAddress } from '@repo/contract';
import { describe, expect, it, vi } from 'vitest';

import { AuthRequestError } from '../auth/request';
import { AddressesController, changedFields, type AddressTransport } from './addresses';

const address: DeliveryAddress = {
  id: 'c07517c1-f24d-4f07-8dc9-33c812980da2',
  address: '東京都千代田区1-1',
  building: '101',
  label: '',
  isDefault: false,
  deliveryNote: '玄関前',
  latitude: 35,
  longitude: 139,
};
function setup() {
  const transport = {
    list: vi.fn<AddressTransport['list']>().mockResolvedValue([address]),
    create: vi.fn<AddressTransport['create']>().mockResolvedValue(address),
    update: vi.fn<AddressTransport['update']>().mockResolvedValue(address),
    remove: vi.fn<AddressTransport['remove']>().mockResolvedValue(undefined),
  };
  return { controller: new AddressesController(transport), transport };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe('お届け先操作', () => {
  it('変更した項目だけをPATCHし、空文字で建物を消せる', async () => {
    const { controller, transport } = setup();
    await controller.load();
    controller.edit(address);
    controller.change('building', '');
    await controller.save();
    expect(transport.update).toHaveBeenCalledWith(address.id, { building: '' });
    expect(controller.getSnapshot().editor).toBeUndefined();
    expect(
      changedFields(address, {
        address: ` ${address.address} `,
        building: address.building,
        deliveryNote: address.deliveryNote,
      }),
    ).toBeNull();
  });
  it('labelと既定を編集値に保持し、他項目だけのPATCHでリセットしない', async () => {
    const { controller, transport } = setup();
    const saved = { ...address, label: '自宅', isDefault: true };
    controller.edit(saved);
    expect(controller.getSnapshot().editor?.values).toMatchObject({
      label: '自宅',
      isDefault: true,
    });
    controller.change('building', '202');
    await controller.save();
    expect(transport.update).toHaveBeenCalledWith(saved.id, { building: '202' });
    controller.edit(saved);
    controller.change('label', '');
    controller.change('isDefault', false);
    await controller.save();
    expect(transport.update).toHaveBeenLastCalledWith(saved.id, { label: '', isDefault: false });
  });
  it('既定切替後はAPI一覧を再取得し、他の住所の既定解除を反映する', async () => {
    const { controller, transport } = setup();
    const other = { ...address, id: 'other', label: '職場', isDefault: false };
    const current = { ...address, label: '自宅', isDefault: true };
    transport.list.mockResolvedValueOnce([current, other]);
    await controller.load();
    controller.edit(other);
    controller.change('isDefault', true);
    transport.list.mockResolvedValueOnce([
      { ...current, isDefault: false },
      { ...other, isDefault: true },
    ]);
    await controller.save();
    expect(controller.getSnapshot().addresses.map((item) => item.isDefault)).toEqual([false, true]);
  });
  it.each(['create', 'update'] as const)(
    '%s成功後のGET失敗は旧既定とフォームを消し再送せず再読込できる',
    async (operation) => {
      const { controller, transport } = setup();
      transport.list.mockResolvedValueOnce([{ ...address, label: '旧既定', isDefault: true }]);
      await controller.load();
      controller.edit(operation === 'update' ? address : undefined);
      controller.change('address', '新しい住所');
      controller.change('isDefault', true);
      transport.list.mockRejectedValueOnce(new AuthRequestError('再試行', '', 503));
      await controller.save();
      expect(controller.getSnapshot()).toMatchObject({
        addresses: [],
        editor: undefined,
        loaded: false,
        pending: false,
      });
      expect(controller.getSnapshot().error).toContain('保存しました');
      await controller.save();
      expect(transport[operation]).toHaveBeenCalledTimes(1);
      await controller.load();
      expect(controller.getSnapshot()).toMatchObject({ addresses: [address], loaded: true });
    },
  );
  it('labelはUTF16で20文字まで、失敗入力と既定指定を保持する', async () => {
    const { controller, transport } = setup();
    controller.edit();
    controller.change('address', address.address);
    controller.change('label', '😀'.repeat(11));
    controller.change('isDefault', true);
    await controller.save();
    expect(transport.create).not.toHaveBeenCalled();
    expect(controller.getSnapshot().editor?.values).toMatchObject({
      label: '😀'.repeat(11),
      isDefault: true,
    });
    controller.change('label', '😀'.repeat(10));
    await controller.save();
    expect(transport.create).toHaveBeenCalledWith(
      expect.objectContaining({ label: '😀'.repeat(10), isDefault: true }),
    );
  });
  it('無変更ならAPIを呼ばない', async () => {
    const { controller, transport } = setup();
    controller.edit(address);
    await controller.save();
    expect(transport.update).not.toHaveBeenCalled();
  });
  it('必須住所と100文字制限を共有schemaで検査し、所有者・座標を送らない', async () => {
    const { controller, transport } = setup();
    controller.edit();
    controller.change('deliveryNote', 'あ'.repeat(101));
    await controller.save();
    expect(transport.create).not.toHaveBeenCalled();
    expect(controller.getSnapshot().editor?.values.deliveryNote).toHaveLength(101);
    controller.change('address', ' 東京都千代田区1-1 ');
    controller.change('deliveryNote', 'あ'.repeat(100));
    await controller.save();
    expect(transport.create).toHaveBeenCalledWith({
      address: address.address,
      building: '',
      deliveryNote: 'あ'.repeat(100),
      label: '',
      isDefault: false,
    });
  });
  it('削除確認のキャンセルはAPIと一覧を変えない', async () => {
    const { controller, transport } = setup();
    await controller.load();
    const before = controller.getSnapshot().addresses;
    controller.confirmDelete(address);
    controller.cancel();
    expect(controller.getSnapshot().addresses).toBe(before);
    expect(transport.remove).not.toHaveBeenCalled();
  });
  it.each([422, 503, 0])('%s の保存失敗は一覧・入力を保持し再試行できる', async (status) => {
    const { controller, transport } = setup();
    await controller.load();
    controller.edit(address);
    controller.change('deliveryNote', '変更後');
    transport.update.mockRejectedValueOnce(
      status ? new AuthRequestError('再試行', '', status) : new TypeError('offline'),
    );
    await controller.save();
    expect(controller.getSnapshot()).toMatchObject({
      addresses: [address],
      pending: false,
      editor: { values: { deliveryNote: '変更後' } },
    });
    expect(controller.getSnapshot().error).toBeTruthy();
    await controller.save();
    expect(transport.update).toHaveBeenCalledTimes(2);
  });
  it('削除失敗は対象と一覧を残し再試行できる', async () => {
    const { controller, transport } = setup();
    await controller.load();
    controller.confirmDelete(address);
    transport.remove.mockRejectedValueOnce(new TypeError('offline'));
    await controller.remove();
    expect(controller.getSnapshot()).toMatchObject({ addresses: [address], deleting: address });
    await controller.remove();
    expect(controller.getSnapshot()).toMatchObject({ addresses: [], deleting: undefined });
  });
  it('二重保存・ロード・キャンセル・削除の競合を拒否する', async () => {
    const { controller, transport } = setup();
    const gate = deferred<DeliveryAddress>();
    transport.create.mockReturnValueOnce(gate.promise);
    controller.edit();
    controller.change('address', address.address);
    const saving = controller.save();
    await controller.save();
    await controller.load();
    controller.cancel();
    controller.confirmDelete(address);
    expect(controller.getSnapshot().editor).toBeDefined();
    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(transport.list).not.toHaveBeenCalled();
    expect(controller.getSnapshot().deleting).toBeUndefined();
    gate.resolve(address);
    await saving;
  });
  it('画面破棄・セッション失効後の古い一覧は住所を復活させない', async () => {
    const { controller, transport } = setup();
    const gate = deferred<DeliveryAddress[]>();
    transport.list.mockReturnValueOnce(gate.promise);
    const loading = controller.load();
    controller.reset();
    gate.resolve([address]);
    await loading;
    expect(controller.getSnapshot()).toEqual({ addresses: [], loaded: false, pending: false });
  });
  it('保存後の一覧再取得中に失効・破棄すると旧labelと既定を復活させない', async () => {
    const { controller, transport } = setup();
    await controller.load();
    controller.edit(address);
    controller.change('isDefault', true);
    const gate = deferred<DeliveryAddress[]>();
    transport.list.mockReturnValueOnce(gate.promise);
    const saving = controller.save();
    await vi.waitFor(() => expect(transport.list).toHaveBeenCalledTimes(2));
    controller.reset();
    gate.resolve([{ ...address, label: '旧応答', isDefault: true }]);
    await saving;
    expect(controller.getSnapshot()).toEqual({ addresses: [], loaded: false, pending: false });
  });
  it('再読込失敗でも直前の一覧を残す', async () => {
    const { controller, transport } = setup();
    await controller.load();
    transport.list.mockRejectedValueOnce(new Error('offline'));
    await controller.load();
    expect(controller.getSnapshot().addresses).toEqual([address]);
    expect(controller.getSnapshot().error).toBeTruthy();
  });
});
