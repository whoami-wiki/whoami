import { MDXRemote, MDXRemoteProps } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { ReactNode } from "react";
import { slugify } from "@/lib/blog";
import { MarkdownBlocks } from "@/components/markdown-blocks";
import { Features } from "@/components/features";
import { ScoreTable } from "@/components/score-table";

function textContent(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textContent).join("");
  if (children && typeof children === "object" && "props" in children)
    return textContent(
      (children as { props: { children?: ReactNode } }).props.children,
    );
  return "";
}

const mdxComponents = {
  ...MarkdownBlocks,
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-3xl font-medium font-sans">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2
      id={slugify(textContent(children))}
      className="text-2xl font-medium font-sans scroll-mt-24"
    >
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3
      id={slugify(textContent(children))}
      className="text-xl font-medium text-primary font-sans scroll-mt-24"
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
    <ul className="leading-7 flex flex-col gap-1 list-disc pl-6 mb-4">
      {children}
    </ul>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-7 text-base">{children}</li>
  ),
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="text-sm font-mono p-4 border border-neutral-300 dark:border-neutral-600 rounded-md overflow-x-auto mb-4 bg-neutral-50 dark:bg-neutral-800">
      {children}
    </pre>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-2 border-neutral-300 dark:border-neutral-600 pl-4 italic text-muted mb-4">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-neutral-200 dark:border-neutral-700" />,
  Placeholder: ({ content }: { content: string }) => (
    <div className="w-full dark:bg-neutral-700 bg-neutral-100 h-80 rounded-md text-center text-sm text-muted flex flex-row items-center justify-center">
      {content}
    </div>
  ),
  Features,
  ScoreTable,
  ThemedImage: ({
    light,
    dark,
    alt = "",
  }: {
    light: string;
    dark: string;
    alt?: string;
  }) => (
    <>
      <img src={light} alt={alt} className="w-full dark:hidden" />
      <img src={dark} alt={alt} className="hidden dark:block w-full" />
    </>
  ),
};

export function MDXContent({
  source,
  components,
}: {
  source: string;
  components?: Record<string, React.ComponentType<any>>;
}) {
  return (
    <MDXRemote
      source={source}
      options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
      components={
        { ...mdxComponents, ...components } as MDXRemoteProps["components"]
      }
    />
  );
}
