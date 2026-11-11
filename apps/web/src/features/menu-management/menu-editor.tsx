'use client';

import { categoryCreateSchema, itemCreateSchema } from '@repo/contract';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FoodPhoto } from '@/components/ui/food-photo';
import { Input } from '@/components/ui/input';
import { NoticeBanner } from '@/components/ui/notice-banner';
import type { Category, CategoryInput, Item, ItemInput } from './requests';

export type Editor =
  { kind: 'category'; value?: Category } | { kind: 'item'; value?: Item; categoryId: string };

export function MenuEditor({
  editor,
  categories,
  busy,
  error,
  onSave,
  onCancel,
}: {
  editor: Editor;
  categories: Category[];
  busy: boolean;
  error: string;
  onSave: (input: CategoryInput | ItemInput) => void;
  onCancel: () => void;
}) {
  const [validation, setValidation] = useState('');
  const [photoUrl, setPhotoUrl] = useState(editor.value?.photoUrl ?? '');
  const preview = categoryCreateSchema.shape.photoUrl.safeParse(photoUrl.trim());
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === 'string' ? value : '';
    };
    const input = {
      name: text('name'),
      description: text('description'),
      photoUrl: text('photoUrl').trim() || null,
      sortOrder: Number(data.get('sortOrder')),
      ...(editor.kind === 'item'
        ? {
            categoryId: text('categoryId'),
            price: Number(data.get('price')),
            soldout: data.get('soldout') === 'on',
          }
        : {}),
    };
    const result = (editor.kind === 'item' ? itemCreateSchema : categoryCreateSchema).safeParse(
      input,
    );
    if (!result.success) {
      setValidation(
        '入力内容を確認してください。名前は1〜100文字、説明は1000文字以内、価格・表示順は0〜2147483647の整数、画像はHTTPS URLで入力してください。',
      );
      return;
    }
    setValidation('');
    onSave(result.data);
  }
  const title = `${editor.kind === 'item' ? '商品' : 'カテゴリ'}${editor.value ? 'を編集' : 'を追加'}`;
  return (
    <section className="space-y-6" aria-labelledby="editor-title">
      <h1 id="editor-title" className="text-heading-l" tabIndex={-1} ref={heading}>
        {title}
      </h1>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,640px)_280px]">
        <div className="order-2 space-y-3">
          <FoodPhoto
            photoUrl={preview.success ? (preview.data ?? undefined) : undefined}
            alt="編集中の写真のプレビュー"
            sizes="280px"
            className="aspect-square w-full max-w-70"
          />
          <p className="text-body-s text-secondary">登録した画像URLのプレビュー</p>
        </div>
        <form onSubmit={submit} className="order-1 min-w-0 space-y-5">
          <fieldset disabled={busy} className="space-y-5">
            <label className="block space-y-2">
              {' '}
              <span>名前（必須）</span>
              <Input name="name" required maxLength={100} defaultValue={editor.value?.name ?? ''} />
            </label>
            <label className="block space-y-2">
              <span>説明</span>
              <textarea
                name="description"
                maxLength={1000}
                defaultValue={editor.value?.description ?? ''}
                className="border-strong bg-base w-full rounded-sm border p-4"
                rows={4}
              />
            </label>
            {editor.kind === 'item' && (
              <>
                <label className="block space-y-2">
                  <span id="category-label">カテゴリ（必須）</span>
                  <select
                    name="categoryId"
                    aria-labelledby="category-label"
                    required
                    defaultValue={editor.value?.categoryId ?? editor.categoryId}
                    className="border-strong bg-base h-12 w-full rounded-sm border px-4"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span>税込価格（円・必須）</span>
                  <Input
                    name="price"
                    type="number"
                    required
                    min={0}
                    max={2147483647}
                    step={1}
                    defaultValue={editor.value?.price ?? ''}
                  />
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="soldout"
                    defaultChecked={editor.value?.soldout ?? false}
                  />
                  売り切れ
                </label>
              </>
            )}
            <label className="block space-y-2">
              <span>表示順（小さい順）</span>
              <Input
                name="sortOrder"
                type="number"
                required
                min={0}
                max={2147483647}
                step={1}
                defaultValue={editor.value?.sortOrder ?? 0}
              />
            </label>
            <label className="block space-y-2">
              <span>画像URL（HTTPS）</span>
              <Input
                name="photoUrl"
                type="url"
                maxLength={2048}
                aria-describedby="image-help"
                value={photoUrl}
                onChange={(event) => setPhotoUrl(event.target.value)}
                placeholder="https://…/menu-images/…"
              />
            </label>
            <p id="image-help" className="text-body-m text-secondary">
              画像は運営が確認・配置したURLを入力してください。ファイルの直接アップロードはまだ利用できません。空欄で保存すると画像の登録を解除します。
            </p>
          </fieldset>
          {(validation || error) && (
            <NoticeBanner tone="danger" role="alert">
              {validation || error}
            </NoticeBanner>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={busy}>
              保存する
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
              一覧に戻る
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
