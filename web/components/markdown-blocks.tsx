import Link from "next/link";
import { ReactNode } from "react";

export const MarkdownBlocks = {
  p: ({ children }: { children?: ReactNode }) => {
    return <p className="leading-6 text-base">{children}</p>;
  },
  ol: ({ children }: { children?: ReactNode }) => {
    return <ol className="leading-6">{children}</ol>;
  },
  ul: ({ children }: { children?: ReactNode }) => {
    return <ul className="leading-6 flex flex-col gap-1">{children}</ul>;
  },
  li: ({ children }: { children?: ReactNode }) => {
    return <li className="leading-6 text-base list-disc">{children}</li>;
  },
  code: ({ children }: { children?: ReactNode }) => {
    return (
      <code className="text-sm font-mono p-0.5 px-1 border border-neutral-300 dark:border-neutral-800 rounded-md">
        {children}
      </code>
    );
  },
  a: ({ children, href = "" }: { children?: ReactNode; href?: string }) => {
    return (
      <Link
        href={href}
        className="text-neutral-900 dark:text-neutral-100 hover:text-blue-600 hover:dark:text-blue-400 hover:underline font-normal underline underline-offset-4"
        target={href.startsWith("http") ? "_blank" : undefined}
      >
        {children}
      </Link>
    );
  },
};
