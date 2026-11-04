import {
  addressInputSchema,
  addressUpdateSchema,
  type AddressInput,
  type AddressUpdate,
  type DeliveryAddress,
} from '@repo/contract';

import { errorMessage } from '../auth/request';

export type AddressTransport = {
  list: () => Promise<DeliveryAddress[]>;
  create: (input: AddressInput) => Promise<DeliveryAddress>;
  update: (id: string, input: AddressUpdate) => Promise<DeliveryAddress>;
  remove: (id: string) => Promise<void>;
};
type Editor = {
  original?: DeliveryAddress | undefined;
  values: Required<AddressInput>;
};
type State = {
  addresses: DeliveryAddress[];
  loaded: boolean;
  pending: boolean;
  editor?: Editor | undefined;
  deleting?: DeliveryAddress | undefined;
  error?: string | undefined;
};
export function changedFields(original: AddressInput, values: AddressInput): AddressUpdate | null {
  const next = addressInputSchema.parse(values);
  const patch: AddressUpdate = {};
  for (const field of ['address', 'building', 'deliveryNote', 'label'] as const) {
    if (original[field] !== next[field]) patch[field] = next[field];
  }
  if ((original.isDefault ?? false) !== next.isDefault) patch.isDefault = next.isDefault;
  return Object.keys(patch).length ? addressUpdateSchema.parse(patch) : null;
}
// 一覧・編集・削除を同じ排他制御に載せ、画面破棄後の応答も無効にする。
export class AddressesController {
  private state: State = { addresses: [], loaded: false, pending: false };
  private generation = 0;
  private listeners = new Set<() => void>();
  constructor(private transport: AddressTransport) {}
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
  reset = () => {
    this.generation++;
    this.state = { addresses: [], loaded: false, pending: false };
    this.listeners.forEach((listener) => listener());
  };
  edit = (original?: DeliveryAddress) => {
    if (this.state.pending) return;
    this.publish({
      editor: {
        original,
        values: original
          ? {
              address: original.address,
              label: original.label,
              isDefault: original.isDefault,
              building: original.building,
              deliveryNote: original.deliveryNote,
            }
          : { address: '', building: '', deliveryNote: '', label: '', isDefault: false },
      },
      error: undefined,
    });
  };
  change = <Key extends keyof AddressInput>(field: Key, value: Required<AddressInput>[Key]) => {
    if (this.state.pending || !this.state.editor) return;
    this.publish({
      editor: { ...this.state.editor, values: { ...this.state.editor.values, [field]: value } },
    });
  };
  cancel = () => {
    if (!this.state.pending)
      this.publish({ editor: undefined, deleting: undefined, error: undefined });
  };
  confirmDelete = (address: DeliveryAddress) => {
    if (!this.state.pending) this.publish({ deleting: address, error: undefined });
  };
  private async run(action: () => Promise<Partial<State>>) {
    if (this.state.pending) return;
    const generation = ++this.generation;
    this.publish({ pending: true, error: undefined });
    try {
      const patch = await action();
      if (generation === this.generation) this.publish(patch);
    } catch (error) {
      if (generation === this.generation) this.publish({ error: errorMessage(error) });
    } finally {
      if (generation === this.generation) this.publish({ pending: false });
    }
  }
  load = () => this.run(async () => ({ addresses: await this.transport.list(), loaded: true }));
  save = () =>
    this.run(async () => {
      const editor = this.state.editor;
      if (!editor) return {};
      const parsed = addressInputSchema.safeParse(editor.values);
      if (!parsed.success)
        return {
          error:
            '住所は必須で200文字以内、ラベルは20文字以内、建物名と配達メモは各100文字以内で入力してください。',
        };
      const patch = editor.original ? changedFields(editor.original, parsed.data) : null;
      if (editor.original && !patch) return { editor: undefined };
      await (editor.original
        ? this.transport.update(editor.original.id, patch!)
        : this.transport.create(parsed.data));
      try {
        return { addresses: await this.transport.list(), loaded: true, editor: undefined };
      } catch {
        // 書込済みのフォームを再送させず、古い既定表示も残さない。
        return {
          addresses: [],
          loaded: false,
          editor: undefined,
          error: '保存しましたが一覧を取得できませんでした。一覧を再読み込みしてください。',
        };
      }
    });
  remove = () =>
    this.run(async () => {
      const target = this.state.deleting;
      if (!target) return {};
      await this.transport.remove(target.id);
      return {
        addresses: this.state.addresses.filter((item) => item.id !== target.id),
        deleting: undefined,
      };
    });
}
