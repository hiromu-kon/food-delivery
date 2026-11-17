'use client';

import {
  courierListResponseSchema,
  type courierSchema,
  createCourierSchema,
  updateCourierSchema,
} from '@repo/contract';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { z } from 'zod';

import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';

type Courier = z.infer<typeof courierSchema>;
export function CourierManager() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [editing, setEditing] = useState<Courier | null>();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const active = useRef(false);
  const generation = useRef(0);
  const locked = useRef(false);
  function check(response: Response) {
    if (response.status === 401 || response.status === 403) {
      window.location.replace('/admin/login?reason=denied');
      throw new Error('運営権限を確認してください');
    }
    if (response.status === 409)
      throw new Error('このメールアドレスは使用済みです。別のメールアドレスを入力してください');
    if (!response.ok) throw new Error('処理できませんでした。一覧を再読込して確認してください');
  }
  const load = useCallback(async () => {
    const request = ++generation.current;
    const response = await apiClient.admin.couriers.$get({ query: {} });
    if (!active.current || request !== generation.current) return;
    check(response);
    const data = courierListResponseSchema.parse(await response.json());
    if (active.current && request === generation.current) {
      setCouriers(data.couriers);
      setReady(true);
    }
  }, []);
  useEffect(() => {
    active.current = true;
    let mounted = true;
    void load().catch(() => {
      if (mounted) setMessage('一覧を取得できませんでした。再読込してください');
    });
    return () => {
      mounted = false;
      active.current = false;
      ++generation.current;
    };
  }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = editing
      ? updateCourierSchema.safeParse({ ...values, disabled: values.disabled === 'on' })
      : createCourierSchema.safeParse(values);
    if (!parsed.success) {
      setMessage(
        '氏名・メール・電話番号（数字10〜15桁）・パスワード（8〜128文字）を確認してください',
      );
      return;
    }
    locked.current = true;
    setPending(true);
    setMessage('');
    try {
      const response = editing
        ? await apiClient.admin.couriers[':id'].$patch({
            param: { id: editing.id },
            json: updateCourierSchema.parse(parsed.data),
          })
        : await apiClient.admin.couriers.$post({ json: createCourierSchema.parse(parsed.data) });
      if (!active.current) return;
      check(response);
      setEditing(undefined);
      await load();
      if (active.current) setMessage('保存しました');
    } catch (error) {
      if (active.current)
        setMessage(
          error instanceof Error ? error.message : '通信できませんでした。一覧を再読込してください',
        );
    } finally {
      locked.current = false;
      if (active.current) setPending(false);
    }
  }
  return (
    <>
      <Link href="/admin">運営管理へ</Link>
      <h1 className="text-heading-l">配達員一覧</h1>
      {message && <p role="status">{message}</p>}
      <div className="flex gap-3">
        <Button
          disabled={pending || !ready}
          onClick={() => {
            setEditing(null);
            setMessage('');
          }}
        >
          配達員を登録
        </Button>
        <Button
          disabled={pending}
          onClick={() => {
            window.location.reload();
          }}
        >
          一覧を再読込
        </Button>
      </div>
      {editing !== undefined && (
        <form
          key={editing?.id ?? 'new'}
          onSubmit={(event) => void submit(event)}
          className="max-w-xl space-y-4 rounded-lg border p-5"
        >
          <h2 className="text-heading-m">{editing ? '配達員を編集' : '配達員を登録'}</h2>
          <p>
            本人確認済みのメールアドレスを登録してください。初期パスワードは本人へ安全に伝えてください。
          </p>
          <fieldset disabled={pending} className="space-y-4">
            <label className="block">
              氏名
              <input
                className="block w-full rounded border p-2"
                name="name"
                required
                maxLength={100}
                defaultValue={editing?.name}
              />
            </label>
            <label className="block">
              メールアドレス
              <input
                className="block w-full rounded border p-2"
                name="email"
                type="email"
                required
                defaultValue={editing?.email}
              />
            </label>
            <label className="block">
              電話番号
              <input
                className="block w-full rounded border p-2"
                name="phoneNumber"
                type="tel"
                required
                defaultValue={editing?.phoneNumber}
              />
            </label>
            {editing ? (
              <label className="block">
                <input name="disabled" type="checkbox" defaultChecked={editing.disabled} />
                アカウントを停止する
              </label>
            ) : (
              <label className="block">
                初期パスワード
                <input
                  className="block w-full rounded border p-2"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
            )}
            <div className="flex gap-3">
              <Button type="submit">{pending ? '保存中…' : '保存する'}</Button>
              <Button type="button" onClick={() => setEditing(undefined)}>
                キャンセル
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {!ready ? (
        <p>一覧を取得しています…</p>
      ) : couriers.length === 0 ? (
        <p>登録された配達員はいません。</p>
      ) : (
        <ul className="space-y-3">
          {couriers.map((courier) => (
            <li
              key={courier.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div>
                <p>{courier.name}</p>
                <p>
                  {courier.email} / {courier.phoneNumber}
                </p>
                <p>アカウント：{courier.disabled ? '停止中' : '有効'} ／ 稼働状態：未取得</p>
              </div>
              <Button
                disabled={pending}
                onClick={() => {
                  setEditing(courier);
                  setMessage('');
                }}
              >
                編集・停止
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
