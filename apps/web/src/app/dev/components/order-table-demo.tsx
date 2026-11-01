'use client';

import type { OrderStatus } from '@repo/domain';
import { createColumnHelper } from '@tanstack/react-table';

import { DataTable, type DataTableFeatures } from '@/components/ui/data-table';
import { StatusLabel } from '@/components/ui/status-label';

type OrderRow = {
  number: string;
  store: string;
  status: OrderStatus;
  total: string;
  orderedAt: string;
};

const helper = createColumnHelper<DataTableFeatures, OrderRow>();
const columns = helper.columns([
  helper.accessor('number', {
    header: '注文番号',
    cell: (info) => <span className="text-label-m">{info.getValue()}</span>,
  }),
  helper.accessor('store', { header: '店舗' }),
  helper.accessor('status', {
    header: '状態',
    cell: (info) => <StatusLabel status={info.getValue()} />,
  }),
  helper.accessor('total', {
    header: () => <span className="block text-right">合計</span>,
    cell: (info) => <span className="text-label-m block text-right">{info.getValue()}</span>,
  }),
  helper.accessor('orderedAt', { header: '注文日時' }),
]);

const rows: OrderRow[] = [
  {
    number: '1024',
    store: '〇〇食堂',
    status: 'preparing',
    total: '¥2,360',
    orderedAt: '10/25 18:30',
  },
  { number: '1023', store: '△△亭', status: 'pending', total: '¥1,480', orderedAt: '10/25 18:22' },
  {
    number: '1022',
    store: '〇〇食堂',
    status: 'delivered',
    total: '¥3,120',
    orderedAt: '10/25 17:55',
  },
];

export function OrderTableDemo({ empty = false }: { empty?: boolean }) {
  return <DataTable columns={columns} data={empty ? [] : rows} emptyMessage="注文はありません" />;
}
