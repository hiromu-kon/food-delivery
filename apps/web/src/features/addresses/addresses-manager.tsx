'use client';

import {
  addressInputSchema,
  addressSchema,
  type AddressInput,
  type DeliveryAddress,
} from '@repo/contract';
import { useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { NoticeBanner } from '@/components/ui/notice-banner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  AddressRequests,
  AddressRequestError,
  addressErrorMessage,
  assertAddressSuccess,
  changedAddress,
} from './address-state';

const empty: AddressInput = { address: '', building: '', deliveryNote: '' };
const fields = [
  {
    name: 'address',
    label: '住所（必須）',
    max: 200,
    helper: '都道府県・市区町村・番地まで入力してください。',
  },
  { name: 'building', label: '建物名・部屋番号', max: 100, helper: '100文字以内' },
  { name: 'deliveryNote', label: '配達メモ', max: 100, helper: '受け渡し方法など、100文字以内' },
] as const;

export function AddressesManager({
  initialAddresses,
  initialError,
}: {
  initialAddresses: DeliveryAddress[];
  initialError: string | null;
}) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [values, setValues] = useState(empty);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryAddress | null>(null);
  const [deleting, setDeleting] = useState<DeliveryAddress | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const requests = useRef(new AddressRequests());
  const formRef = useRef<HTMLFormElement>(null);

  function fail(cause: unknown) {
    if (cause instanceof AddressRequestError) {
      if (cause.status === 401) {
        window.location.replace('/login');
        return;
      }
      if (cause.status === 403) {
        window.location.replace('/access-denied');
        return;
      }
    }
    setError(addressErrorMessage(cause));
  }
  function reset() {
    setFormOpen(false);
    setEditing(null);
    setValues(empty);
    setErrors({});
    setError(null);
  }
  async function reload() {
    if (pending) return;
    const generation = requests.current.list();
    setLoading(true);
    setError(null);
    setNotice('');
    try {
      const response = await apiClient.addresses.$get();
      assertAddressSuccess(response);
      const result = z.object({ addresses: z.array(addressSchema) }).parse(await response.json());
      if (requests.current.current(generation)) setAddresses(result.addresses);
    } catch (cause) {
      if (requests.current.current(generation)) fail(cause);
    } finally {
      if (requests.current.current(generation)) setLoading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = addressInputSchema.safeParse(values);
    setErrors({});
    setError(null);
    setNotice('');
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = fields.find((field) => field.name === issue.path[0]);
        if (field) next[field.name] = `${field.label}を${field.max}文字以内で入力してください。`;
      }
      setErrors(next);
      setError('入力内容を確認してください。');
      formRef.current?.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
      return;
    }
    const changes = editing ? changedAddress(parsed.data, editing) : null;
    if (editing && !changes) {
      setNotice('変更はありません。');
      return;
    }
    if (!requests.current.begin()) return;
    setPending(true);
    setLoading(false);
    try {
      const response = editing
        ? await apiClient.addresses[':id'].$patch({ param: { id: editing.id }, json: changes! })
        : await apiClient.addresses.$post({ json: parsed.data });
      assertAddressSuccess(response);
      const result = z.object({ address: addressSchema }).parse(await response.json());
      setAddresses((current) =>
        editing
          ? current.map((item) => (item.id === editing.id ? result.address : item))
          : [...current, result.address],
      );
      setNotice(editing ? 'お届け先を変更しました。' : 'お届け先を登録しました。');
      reset();
    } catch (cause) {
      fail(cause);
    } finally {
      requests.current.end();
      setPending(false);
    }
  }
  async function remove() {
    if (!deleting || !requests.current.begin()) return;
    setPending(true);
    setLoading(false);
    setError(null);
    setNotice('');
    try {
      const response = await apiClient.addresses[':id'].$delete({ param: { id: deleting.id } });
      assertAddressSuccess(response);
      setAddresses((current) => current.filter((item) => item.id !== deleting.id));
      if (editing?.id === deleting.id) reset();
      setDeleting(null);
      setNotice('お届け先を削除しました。');
    } catch (cause) {
      setDeleting(null);
      fail(cause);
    } finally {
      requests.current.end();
      setPending(false);
    }
  }
  return (
    <div className="space-y-3">
      {error && (
        <NoticeBanner tone="danger" role="alert">
          {error}
        </NoticeBanner>
      )}
      <p role="status" className="text-body-m text-secondary empty:hidden">
        {notice}
      </p>
      <section aria-labelledby="addresses-list" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="addresses-list" className="text-heading-m">
            登録済みのお届け先
          </h2>
          <Button
            variant="secondary"
            size="M"
            disabled={pending}
            loading={loading}
            onClick={() => void reload()}
          >
            一覧を再読み込み
          </Button>
        </div>
        {!addresses.length && (
          <p className="text-body-m text-secondary">
            {initialError && error
              ? '一覧を取得できていません。再読み込みしてください。'
              : 'お届け先はまだ登録されていません。下のボタンから登録できます。'}
          </p>
        )}
        <ul className="space-y-3">
          {addresses.map((item) => (
            <li key={item.id} className="rounded-lg border p-4 space-y-3">
              <div className="text-body-m space-y-1 break-words">
                <h3>
                  {item.address}
                  {item.building && ` ${item.building}`}
                </h3>
                {item.deliveryNote && (
                  <p className="text-body-s text-secondary whitespace-pre-wrap">
                    配達メモ：{item.deliveryNote}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="ghost"
                  size="M"
                  className="px-0 underline underline-offset-4"
                  disabled={pending}
                  aria-label={`${item.address}を編集`}
                  onClick={() => {
                    setFormOpen(true);
                    setEditing(item);
                    setValues({
                      address: item.address,
                      building: item.building,
                      deliveryNote: item.deliveryNote,
                    });
                    setErrors({});
                    setError(null);
                    setNotice('');
                    requestAnimationFrame(() =>
                      formRef.current?.querySelector<HTMLInputElement>('[name="address"]')?.focus(),
                    );
                  }}
                >
                  変更する
                </Button>
                <Button
                  variant="ghost"
                  size="M"
                  className="text-secondary px-0 underline underline-offset-4"
                  disabled={pending}
                  aria-label={`${item.address}を削除`}
                  onClick={() => setDeleting(item)}
                >
                  削除する
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {!formOpen && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={() => {
            setFormOpen(true);
            requestAnimationFrame(() =>
              formRef.current?.querySelector<HTMLInputElement>('[name="address"]')?.focus(),
            );
          }}
        >
          お届け先を追加する
        </Button>
      )}
      {formOpen && (
        <section aria-labelledby="address-form-title" className="space-y-5">
          <h2 id="address-form-title" className="text-heading-m">
            {editing ? 'お届け先を編集' : 'お届け先を登録'}
          </h2>
          <form
            ref={formRef}
            onSubmit={(event) => void submit(event)}
            noValidate
            className="space-y-5"
          >
            {fields.map((field) => (
              <TextField
                key={field.name}
                name={field.name}
                label={field.label}
                helperText={field.helper}
                errorMessage={errors[field.name]}
                value={values[field.name]}
                required={field.name === 'address'}
                disabled={pending}
                autoComplete={field.name === 'address' ? 'street-address' : 'off'}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              />
            ))}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={pending}>
                {editing ? '変更を保存' : '登録する'}
              </Button>
              <Button type="button" variant="secondary" disabled={pending} onClick={reset}>
                キャンセル
              </Button>
            </div>
          </form>
        </section>
      )}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>このお届け先を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            {deleting?.address}
            <br />
            {deleting?.building}
            <br />
            削除すると元に戻せません。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {pending ? '削除中…' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
