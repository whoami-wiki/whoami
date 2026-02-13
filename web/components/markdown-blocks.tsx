import Link from "next/link";
import { ReactNode } from "react";

export const MarkdownBlocks = {
  h1: ({ children }: { children?: ReactNode }) => {
    return <h1 className="text-3xl font-medium font-serif">{children}</h1>;
  },
  h2: ({ children }: { children?: ReactNode }) => {
    return <h2 className="text-2xl font-medium font-serif">{children}</h2>;
  },
  h3: ({ children }: { children?: ReactNode }) => {
    return <h3 className="text-xl font-medium text-primary font-serif">{children}</h3>;
  },
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
      <code className="text-sm font-mono p-0.5 px-1 border border-neutral-300 dark:border-neutral-600 rounded-md text-primary">
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
