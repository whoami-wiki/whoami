"use client";

import { cn } from "@/utils/functions";
import { ReactNode, useState } from "react";
import { LoadingSpinner } from "../icons";

interface Props {
  text?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  accent?: "primary" | "secondary" | "tertiary" | "destructive";
  onClick?: () => void;
  isCircular?: boolean;
}

export function Button(props: Props) {
  const {
    prefix,
    suffix,
    text,
    accent = "primary",
    isCircular = false,
    onClick,
  } = props;

  const [isLoading, setIsLoading] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        if (!onClick) return;

        setIsLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          await Promise.resolve(onClick());
        } finally {
          setIsLoading(false);
        }
      }}
      className={cn(
        "flex flex-row gap-1 items-center w-fit h-fit px-3.5 py-2 cursor-pointer select-none focus:outline-3 font-sans",
        {
          "rounded-full": isCircular,
          "rounded-lg": !isCircular,
          "bg-blue-600 text-blue-50 dark:bg-blue-800 dark:text-blue-100 outline-blue-600/50 dark:outline-blue-800/50":
            accent === "primary",
          "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-50 outline-neutral-200/50 dark:outline-neutral-700/50":
            accent === "secondary",
          "bg-neutral-800 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900 outline-neutral-800/50 dark:outline-neutral-100/50":
            accent === "tertiary",
          "bg-red-600 text-red-50 dark:bg-red-800 dark:text-red-100 outline-red-600/50 dark:outline-red-800/50":
            accent === "destructive",
          "pl-1.5": prefix || isLoading,
          "pr-2": suffix,
        },
      )}
    >
      {isLoading ? (
        <div>
          <LoadingSpinner size={20} />
        </div>
      ) : prefix ? (
        <div className="opacity-65">{prefix}</div>
      ) : null}

      <div className="text-sm">{text}</div>

      {suffix ? <div className="opacity-65">{suffix}</div> : null}
    </button>
  );
}
