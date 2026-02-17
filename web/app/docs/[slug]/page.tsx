import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDoc, getAllDocs } from "@/lib/docs";
import { MDXContent } from "@/components/mdx-content";

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
      <article className="font-sans text-neutral-700 dark:text-neutral-300 prose dark:prose-invert prose-p:leading-6.5 prose-img:rounded-xl">
        <MDXContent source={doc.content} />
      </article>
    </div>
  );
}
