import type { ReactNode } from 'react';

interface Props {
  speaker?: string;
  children?: ReactNode;
}

export function Dialogue({ speaker, children }: Props) {
  return (
    <figure className="my-4 pl-4 border-l-4 border-violet-400">
      {speaker ? <figcaption className="text-sm font-semibold text-violet-700 dark:text-violet-300 mb-1">{speaker}:</figcaption> : null}
      <div className="italic">{children}</div>
    </figure>
  );
}
