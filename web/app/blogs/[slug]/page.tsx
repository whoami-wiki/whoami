import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllPosts, getPost } from "@/lib/blog";
import { MDXContent } from "@/components/mdx-content";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — whoami.wiki`,
    description: post.description,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <div className="flex flex-col w-dvw items-center">
      <div className="max-w-3xl flex flex-col gap-8 py-18 px-6">
        <div>
          <Link
            href="/blog"
            className="font-sans text-sm text-muted hover:text-primary"
          >
            &larr; Back to blog
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-sans font-medium text-3xl">{post.title}</h1>
          <time
            className="font-sans text-base text-neutral-500 dark:text-neutral-400"
            dateTime={post.date}
          >
            {new Date(post.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </div>

        <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700" />

        <article className="font-sans text-neutral-700 dark:text-neutral-300">
          <MDXContent source={post.content} />
        </article>
      </div>
    </div>
  );
}
