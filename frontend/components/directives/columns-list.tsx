import type { ReactNode } from 'react';

interface Props {
  cols?: string;
  children?: ReactNode;
}

export function ColumnsList({ cols, children }: Props) {
  const n = Number(cols ?? '2');
  const className = n >= 3 ? 'columns-3' : n === 2 ? 'columns-2' : '';
  return <div className={`${className} my-4`}>{children}</div>;
}
