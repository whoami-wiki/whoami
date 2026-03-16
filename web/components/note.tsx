import { ReactNode } from "react";
import { InfoIcon } from "@/components/icons";

export function Note({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 text-sm mb-4">
      <InfoIcon className="shrink-0 text-lg" />
      <div className="leading-6">{children}</div>
    </div>
  );
}
