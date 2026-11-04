import type { MenuResponse } from '@repo/contract';
import { formatYen } from '@repo/domain';
import { FoodPhoto } from '@/components/ui/food-photo';
import { MenuItem } from '@/components/ui/menu-item';
import { StoreNoren } from '@/components/ui/store-noren';
import { Tag } from '@/components/ui/tag';

export function MenuContent({ menu }: { menu: MenuResponse }) {
  const { store, categories } = menu;
  return (
    <>
      <FoodPhoto
        photoUrl={store.photoUrl ?? undefined}
        alt={`${store.name}の料理`}
        sizes="(max-width: 767px) 100vw, 800px"
        className="h-59 w-full rounded-none"
        iconClassName="size-10"
      />
      <div className="relative mx-4 -mt-15">
        <StoreNoren heading="h1" name={store.name} description={store.description} />
      </div>
      <div className="space-y-3 px-6 py-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="text-body-s text-secondary">最低注文</dt>
            <dd className="text-label-m mt-1">{formatYen(store.minimumOrderAmount)}</dd>
          </div>
          <div>
            <dt className="text-body-s text-secondary">受付</dt>
            <dd className="text-label-m mt-1">
              {store.isAcceptingOrders ? '受付中' : <Tag tone="warning">受付停止中</Tag>}
            </dd>
          </div>
        </dl>
        <p className="text-body-s text-secondary break-words">{store.address}</p>
        <p className="text-body-s text-secondary">メニューの閲覧のみご利用いただけます。</p>
      </div>
      {categories.length > 0 ? (
        <>
          <nav aria-label="メニューのカテゴリ" className="border-default overflow-x-auto border-b">
            <ul className="text-label-m flex w-max min-w-full gap-6 px-4">
              {categories.map((category) => (
                <li key={category.id}>
                  <a
                    href={`#category-${category.id}`}
                    className="text-brand flex min-h-12 items-center border-b-2 border-current py-3 focus-visible:outline-2 focus-visible:outline-(--border-color-focus)"
                  >
                    {category.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-6 px-4 py-6 md:px-6">
            {categories.map((category) => (
              <section
                key={category.id}
                id={`category-${category.id}`}
                aria-labelledby={`heading-${category.id}`}
                className="scroll-mt-6"
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 id={`heading-${category.id}`} className="text-heading-m break-words">
                      {category.name}
                    </h2>
                    {category.description && (
                      <p className="text-body-s text-secondary mt-2 break-words whitespace-pre-line">
                        {category.description}
                      </p>
                    )}
                  </div>
                  {category.photoUrl && (
                    <FoodPhoto
                      photoUrl={category.photoUrl}
                      alt={`${category.name}の写真`}
                      className="size-24 shrink-0"
                    />
                  )}
                </div>
                {category.items.length > 0 ? (
                  <ul className="mt-3">
                    {category.items.map((item) => (
                      <li key={item.id}>
                        <MenuItem
                          name={item.name}
                          description={item.description}
                          price={item.price}
                          soldOut={item.soldout}
                          {...(item.photoUrl ? { photoUrl: item.photoUrl } : {})}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body-m text-secondary py-6">
                    このカテゴリにはまだ商品がありません。
                  </p>
                )}
              </section>
            ))}
          </div>
        </>
      ) : (
        <p role="status" className="text-body-m text-secondary px-4 py-8">
          メニューはまだ登録されていません。
        </p>
      )}
    </>
  );
}
