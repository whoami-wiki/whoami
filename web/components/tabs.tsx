"use client";

import { useState, Children, ReactNode } from "react";

export function Tabs({
  labels,
  children,
}: {
  labels: string;
  children?: ReactNode;
}) {
  const parsedLabels: string[] = JSON.parse(labels);
  const panels = Children.toArray(children);
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {parsedLabels.map((label, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`font-sans text-sm px-3 py-1.5 rounded-md cursor-pointer ${
              active === i
                ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div key={i} className={active === i ? "" : "hidden"}>
          {panel}
        </div>
      ))}
    </div>
  );
}

export function Tab({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
