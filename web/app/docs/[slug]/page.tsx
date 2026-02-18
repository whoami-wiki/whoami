import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDoc, getAllDocs } from "@/lib/docs";
import { MDXContent } from "@/components/mdx-content";
import { MarkdownBlocks } from "@/components/markdown-blocks";
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
  h2: ({ children }: { children?: ReactNode }) => (
    <h2
      id={slugify(textContent(children))}
      className="text-lg font-medium font-sans scroll-mt-24"
    >
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3
      id={slugify(textContent(children))}
      className="text-base font-medium text-primary font-sans scroll-mt-24"
    >
      {children}
    </h3>
  ),
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

  return <div />;
}
