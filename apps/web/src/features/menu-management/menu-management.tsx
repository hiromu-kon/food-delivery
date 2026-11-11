'use client';

import { useEffect, useRef, useState } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FoodPhoto } from '@/components/ui/food-photo';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { Switch } from '@/components/ui/switch';
import { MenuEditor, type Editor } from './menu-editor';
import {
  deleteMenuEntity,
  getManagedMenu,
  MenuAccessError,
  menuManagementMessage,
  saveCategory,
  saveItem,
  setItemSoldout,
  type CategoryInput,
  type ItemInput,
  type ManagedMenu,
} from './requests';

type Removal = { kind: 'category' | 'item'; id: string; name: string };

export function MenuManagement() {
  const [menu, setMenu] = useState<ManagedMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void getManagedMenu(controller.signal).then(
      (result) => {
        if (current) {
          setMenu(result);
          setLoading(false);
        }
      },
      (cause: unknown) => {
        if (current) {
          setError(menuManagementMessage(cause));
          setLoading(false);
          setMenu(null);
        }
      },
    );
    return () => {
      current = false;
      controller.abort();
    };
  }, [revision]);

  function refresh() {
    setMenu(null);
    setError('');
    setLoading(true);
    setRevision((value) => value + 1);
  }
  function openEditor(value: Editor) {
    setError('');
    setNotice('');
    setEditor(value);
  }
  async function mutate(action: () => Promise<unknown>, message: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (!active.current) return;
      setEditor(null);
      setRemoval(null);
      setNotice(message);
      refresh();
    } catch (cause) {
      if (!active.current) return;
      if (cause instanceof MenuAccessError) {
        setMenu(null);
        setEditor(null);
        setRemoval(null);
      }
      setError(menuManagementMessage(cause));
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  function save(input: CategoryInput | ItemInput) {
    if (!editor) return;
    void mutate(
      () =>
        editor.kind === 'category'
          ? saveCategory(input, editor.value?.id)
          : saveItem(input as ItemInput, editor.value?.id),
      '保存しました。',
    );
  }

  if (editor && menu)
    return (
      <MenuEditor
        editor={editor}
        categories={menu.categories}
        busy={busy}
        error={error}
        onSave={save}
        onCancel={() => {
          setEditor(null);
          setError('');
          refresh();
        }}
      />
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-heading-l">メニュー管理</h1>
          <p className="text-body-m text-secondary">
            カテゴリと商品を管理します。変更や削除後も、過去の注文内容・金額は変わりません。
          </p>
        </div>
        <Button
          disabled={busy || loading || !menu}
          onClick={() => openEditor({ kind: 'category' })}
        >
          カテゴリを追加
        </Button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">変更を保存しています…</p>}
      {loading && <p role="status">メニューを読み込んでいます…</p>}
      {error && !removal && (
        <NoticeBanner tone="danger" role="alert">
          {error}
        </NoticeBanner>
      )}
      {!loading && (
        <Button variant="secondary" disabled={busy} onClick={refresh}>
          一覧を再読み込み
        </Button>
      )}
      {menu?.categories.length === 0 && (
        <p>カテゴリはまだありません。カテゴリを追加してから商品を登録してください。</p>
      )}
      {menu?.categories.map((category) => (
        <section key={category.id} className="space-y-3" aria-label={category.name}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              {category.photoUrl && (
                <FoodPhoto
                  photoUrl={category.photoUrl}
                  alt={category.name}
                  className="size-20 shrink-0"
                />
              )}
              <div className="min-w-0 space-y-1">
                <h2 className="text-heading-m wrap-anywhere">{category.name}</h2>
                <p className="whitespace-pre-wrap wrap-anywhere">{category.description}</p>
                <p className="text-body-s text-secondary">表示順 {category.sortOrder}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="M"
                variant="secondary"
                disabled={busy}
                onClick={() => openEditor({ kind: 'category', value: category })}
              >
                カテゴリを編集
              </Button>
              <Button
                size="M"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setError('');
                  setRemoval({ kind: 'category', id: category.id, name: category.name });
                }}
              >
                カテゴリを削除
              </Button>
              <Button
                size="M"
                disabled={busy}
                onClick={() => openEditor({ kind: 'item', categoryId: category.id })}
              >
                商品を追加
              </Button>
            </div>
          </div>
          {category.items.length === 0 && (
            <p className="text-secondary">このカテゴリにはまだ商品がありません。</p>
          )}
          <ul className="divide-default divide-y">
            {category.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 gap-4">
                  <FoodPhoto
                    photoUrl={item.photoUrl ?? undefined}
                    alt={item.name}
                    className={`size-14 shrink-0 ${item.soldout ? 'opacity-50' : ''}`}
                  />
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-label-m wrap-anywhere">{item.name}</h3>
                    <p className="text-body-s text-secondary whitespace-pre-wrap wrap-anywhere">
                      {item.description}
                    </p>
                    <p>¥{item.price.toLocaleString('ja-JP')}（税込）</p>
                    <p className="text-body-s text-secondary">表示順 {item.sortOrder}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2">
                    <Switch
                      aria-label={`${item.name}の売り切れ`}
                      checked={item.soldout}
                      disabled={busy}
                      onCheckedChange={(soldout) =>
                        void mutate(
                          () => setItemSoldout(item.id, soldout),
                          soldout ? '売り切れにしました。' : '販売中にしました。',
                        )
                      }
                    />
                    {item.soldout ? '売り切れ' : '販売中'}
                  </label>
                  <Button
                    size="M"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      openEditor({ kind: 'item', value: item, categoryId: category.id })
                    }
                  >
                    商品を編集
                  </Button>
                  <Button
                    size="M"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setError('');
                      setRemoval({ kind: 'item', id: item.id, name: item.name });
                    }}
                  >
                    商品を削除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <AlertDialog
        open={!!removal}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setRemoval(null);
            setError('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {removal?.kind === 'category' ? 'カテゴリを削除しますか？' : '商品を削除しますか？'}
          </AlertDialogTitle>
          <AlertDialogDescription className="wrap-anywhere">
            「{removal?.name}」
            {removal?.kind === 'category'
              ? 'と、このカテゴリに現在含まれるすべての商品を削除します。'
              : 'を削除します。'}
            この操作は取り消せません。過去の注文内容・金額は変わりません。
          </AlertDialogDescription>
          {error && (
            <NoticeBanner tone="danger" role="alert">
              {error}
            </NoticeBanner>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>キャンセル</AlertDialogCancel>
            <Button
              size="M"
              variant="danger"
              loading={busy}
              onClick={() => {
                if (removal)
                  void mutate(() => deleteMenuEntity(removal.kind, removal.id), '削除しました。');
              }}
            >
              削除する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
