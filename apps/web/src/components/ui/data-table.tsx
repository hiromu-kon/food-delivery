'use client';

import { type ColumnDef, type RowData, tableFeatures, useTable } from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// 並べ替えや絞り込みは API で行うため、表には機能を足さず、受け取った行をそのまま並べる
const dataTableFeatures = tableFeatures({});

type DataTableFeatures = typeof dataTableFeatures;

type DataTableColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData>;

type DataTableProps<TData extends RowData> = {
  columns: DataTableColumn<TData>[];
  data: TData[];
  emptyMessage: string;
};

function DataTable<TData extends RowData>({ columns, data, emptyMessage }: DataTableProps<TData>) {
  const table = useTable({ features: dataTableFeatures, columns, data });
  const rows = table.getRowModel().rows;

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : <table.FlexRender header={header} />}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="text-secondary text-center">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export { DataTable, type DataTableColumn, type DataTableFeatures };
