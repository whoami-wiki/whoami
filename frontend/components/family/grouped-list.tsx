import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

interface Props {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function GroupedList({ title, action, children }: Props) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <section className="flex flex-col gap-2">
      {title || action ? (
        <div className="flex items-end justify-between gap-3 px-1">
          {title ? (
            <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </h2>
          ) : <span />}
          {action}
        </div>
      ) : null}
      <Card className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12">
        {items.map((item, i) => (
          <div key={i}>
            {i > 0 ? <div className="rule-hair border-t" /> : null}
            {item}
          </div>
        ))}
      </Card>
    </section>
  );
}
