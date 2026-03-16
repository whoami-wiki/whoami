import { ReactNode } from "react";
import { InfoIcon } from "@/components/icons";

export function Note({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3 py-3 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300 text-sm mb-4">
      <InfoIcon className="shrink-0 text-lg mt-0.5" />
      <div className="leading-6">{children}</div>
    </div>
  );
}
