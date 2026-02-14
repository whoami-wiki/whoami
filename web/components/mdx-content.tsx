import { MDXRemote, MDXRemoteProps } from "next-mdx-remote/rsc";
import Link from "next/link";
import { ReactNode } from "react";
import { slugify } from "@/lib/blog";

function textContent(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textContent).join("");
  if (children && typeof children === "object" && "props" in children)
    return textContent((children as { props: { children?: ReactNode } }).props.children);
  return "";
}

const mdxComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-3xl font-medium font-sans">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2
      id={slugify(textContent(children))}
      className="text-2xl font-medium font-sans mt-8 mb-4 scroll-mt-24"
    >
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3
      id={slugify(textContent(children))}
      className="text-xl font-medium text-primary font-sans mt-6 mb-3 scroll-mt-24"
    >
      {children}
    </h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="leading-7 text-base mb-4">{children}</p>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="leading-7 list-decimal pl-6 mb-4">{children}</ol>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="leading-7 flex flex-col gap-1 list-disc pl-6 mb-4">{children}</ul>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-7 text-base">{children}</li>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="text-sm font-mono p-0.5 px-1 border border-neutral-300 dark:border-neutral-600 rounded-md text-primary">
      {children}
    </code>
  ),
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="text-sm font-mono p-4 border border-neutral-300 dark:border-neutral-600 rounded-md overflow-x-auto mb-4 bg-neutral-50 dark:bg-neutral-800">
      {children}
    </pre>
  ),
  a: ({ children, href = "" }: { children?: ReactNode; href?: string }) => (
    <Link
      href={href}
      className="text-neutral-900 dark:text-neutral-100 hover:text-blue-600 hover:dark:text-blue-400 hover:underline underline underline-offset-4"
      target={href.startsWith("http") ? "_blank" : undefined}
    >
      {children}
    </Link>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-2 border-neutral-300 dark:border-neutral-600 pl-4 italic text-muted mb-4">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-neutral-200 dark:border-neutral-700" />,
};

export function MDXContent({ source }: { source: string }) {
  return (
    <MDXRemote
      source={source}
      components={mdxComponents as MDXRemoteProps["components"]}
    />
  );
}
