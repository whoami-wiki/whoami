import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDoc, getAllDocs } from "@/lib/docs";
import { MDXContent } from "@/components/mdx-content";
import { MarkdownBlocks } from "@/components/markdown-blocks";
import { CopyCodeBlock } from "@/components/copy-code-block";
import { LinkIcon } from "@/components/icons";
import { slugify } from "@/lib/blog";
import { ReactNode } from "react";

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

const docsComponents = {
  h2: ({ children }: { children?: ReactNode }) => {
    const id = slugify(textContent(children));
    return (
      <h2 id={id} className="text-lg font-medium font-sans scroll-mt-24">
        <a
          href={`#${id}`}
          className="group no-underline flex flex-row items-center gap-2 text-inherit hover:text-inherit"
        >
          {children}
          <LinkIcon className="text-sm text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      </h2>
    );
  },
  h3: ({ children }: { children?: ReactNode }) => {
    const id = slugify(textContent(children));
    return (
      <h3
        id={id}
        className="text-base font-medium text-primary font-sans scroll-mt-24"
      >
        <a
          href={`#${id}`}
          className="group no-underline flex flex-row items-center gap-2 text-inherit hover:text-inherit"
        >
          {children}
          <LinkIcon className="text-sm text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      </h3>
    );
  },
  pre: CopyCodeBlock,
  ol: MarkdownBlocks.ol,
  ul: MarkdownBlocks.ul,
  li: MarkdownBlocks.li,
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllDocs().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return {};
  return {
    title: `${doc.title} — whoami.wiki docs`,
    description: doc.description,
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-medium">{doc.title}</h1>
      <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700" />
      <article className="font-sans text-neutral-700 dark:text-neutral-300 prose dark:prose-invert prose-strong:font-normal prose-p:leading-6.5 prose-img:rounded-xl prose-li:m-0 prose-p:m-0 prose-ul:mt-0 prose-code:before:content-none prose-code:after:content-none flex flex-col gap-4 prose-headings:mb-0 prose-ol:mt-0 prose-pre:m-0 prose-th:font-normal">
        <MDXContent source={doc.content} components={docsComponents} />
      </article>
    </div>
  );
}
