'use client';

import { staffCreateSchema, storeCreateSchema } from '@repo/contract';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NoticeBanner } from '@/components/ui/notice-banner';
import {
  deleteStore,
  getStore,
  issueStaff,
  saveStore,
  storeAdminMessage,
  type ManagedStore,
} from './requests';

export function StoreEditor({ storeId }: { storeId?: string }) {
  const router = useRouter();
  const [store, setStore] = useState<ManagedStore>();
  const [loaded, setLoaded] = useState(!storeId);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    if (storeId)
      void getStore(storeId, current.signal)
        .then((row) => {
          if (!current.signal.aborted) {
            setStore(row);
            setLoaded(true);
          }
        })
        .catch((err: unknown) => {
          if (!current.signal.aborted) setError(storeAdminMessage(err));
        });
    return () => current.abort();
  }, [storeId, attempt]);
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action(signal);
    } catch (err) {
      if (!signal.aborted) setError(storeAdminMessage(err));
    } finally {
      if (!signal.aborted) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = storeCreateSchema.safeParse({
      name: data.get('name'),
      description: data.get('description'),
      address: data.get('address'),
      deliveryRadiusMeters: Number(data.get('deliveryRadiusMeters')),
      minimumOrderAmount: Number(data.get('minimumOrderAmount')),
      isAcceptingOrders: data.get('isAcceptingOrders') === 'on',
      photoUrl: data.get('photoUrl') || null,
    });
    if (!input.success) {
      setError(
        '入力内容を確認してください。配達半径は正の数、最低注文金額は0〜2147483647の整数、画像URLはHTTPSで入力してください。',
      );
      return;
    }
    void run(async (signal) => {
      const saved = await saveStore(input.data, signal, storeId);
      if (signal.aborted) return;
      if (!storeId) router.replace(`/admin/stores/${saved.id}`);
      else {
        setStore(saved);
        setNotice('店舗情報を保存しました。');
      }
    });
  }
  function staff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = staffCreateSchema.safeParse(Object.fromEntries(data));
    if (!input.success || !storeId) {
      setError(
        '氏名、メール、電話番号（10〜15桁）、初期パスワード（8〜128文字）を確認してください。',
      );
      return;
    }
    void run(async (signal) => {
      const issued = await issueStaff(storeId, input.data, signal);
      if (!signal.aborted) {
        form.reset();
        setNotice(
          `${issued.email} のスタッフアカウントを発行しました。本人に初期パスワードを安全に伝え、ログイン画面から確認メールの送信を案内してください。`,
        );
      }
    });
  }
  return (
    <>
      <Link href="/admin/stores" className="text-brand underline">
        店舗一覧に戻る
      </Link>
      <h1 className="text-heading-l">{storeId ? '店舗を編集' : '店舗を登録'}</h1>
      {error && (
        <NoticeBanner tone="danger" role="alert">
          {error}
        </NoticeBanner>
      )}
      {notice && <p role="status">{notice}</p>}
      {!loaded ? (
        <>
          <p role="status">店舗を読み込んでいます…</p>
          {error && (
            <Button
              onClick={() => {
                setError('');
                setAttempt((value) => value + 1);
              }}
            >
              再読み込み
            </Button>
          )}
        </>
      ) : (
        <>
          <form onSubmit={save} className="max-w-2xl">
            <fieldset disabled={busy} className="flex flex-col gap-5">
              <label>
                店舗名
                <Input name="name" required maxLength={100} defaultValue={store?.name} />
              </label>
              <label>
                説明
                <Input name="description" maxLength={1000} defaultValue={store?.description} />
              </label>
              <label>
                住所
                <Input name="address" required maxLength={200} defaultValue={store?.address} />
              </label>
              <label>
                配達半径（m）
                <Input
                  name="deliveryRadiusMeters"
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  defaultValue={store?.deliveryRadiusMeters ?? 3000}
                />
              </label>
              <label>
                最低注文金額（円）
                <Input
                  name="minimumOrderAmount"
                  type="number"
                  min="0"
                  max="2147483647"
                  step="1"
                  required
                  defaultValue={store?.minimumOrderAmount ?? 0}
                />
              </label>
              <label>
                店舗画像URL（任意）
                <Input
                  name="photoUrl"
                  type="url"
                  maxLength={2048}
                  defaultValue={store?.photoUrl ?? ''}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  name="isAcceptingOrders"
                  type="checkbox"
                  defaultChecked={store?.isAcceptingOrders ?? false}
                />
                注文を受け付ける
              </label>
              <Button type="submit" loading={busy}>
                店舗情報を保存
              </Button>
            </fieldset>
          </form>
          {storeId && (
            <section className="flex max-w-2xl flex-col gap-5">
              <h2 className="text-heading-m">スタッフアカウントを発行</h2>
              <p>
                本人がメール確認を完了すると店舗へログインできます。既存アカウントは転用できません。
              </p>
              <form onSubmit={staff}>
                <fieldset disabled={busy} className="flex flex-col gap-5">
                  <label>
                    氏名
                    <Input name="name" required maxLength={100} autoComplete="off" />
                  </label>
                  <label>
                    メールアドレス
                    <Input name="email" type="email" required maxLength={254} autoComplete="off" />
                  </label>
                  <label>
                    電話番号
                    <Input
                      name="phoneNumber"
                      type="tel"
                      required
                      maxLength={32}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    初期パスワード
                    <Input
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  </label>
                  <Button type="submit" loading={busy}>
                    スタッフを発行
                  </Button>
                </fieldset>
              </form>
              <h2 className="text-heading-m">店舗を削除</h2>
              <p>
                店舗とメニュー・所属が削除されます。注文履歴がある店舗は削除できません。スタッフのアカウントは残りますが、店舗業務にアクセスできなくなります。
              </p>
              {confirmDelete ? (
                <>
                  <p>この店舗を削除しますか？ 元に戻せません。</p>
                  <div className="flex gap-3">
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        void run(async (signal) => {
                          await deleteStore(storeId, signal);
                          if (!signal.aborted) router.replace('/admin/stores');
                        })
                      }
                    >
                      削除を確定
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setConfirmDelete(false)}
                    >
                      キャンセル
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
                  店舗を削除
                </Button>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
