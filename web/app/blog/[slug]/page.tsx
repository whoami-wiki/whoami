import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllPosts, getPost } from "@/lib/blog";
import { MDXContent } from "@/components/mdx-content";
import Image from "next/image";

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
      <div className="max-w-2xl w-full flex flex-col gap-8 py-18 px-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans font-medium text-2xl">{post.title}</h1>
        </div>

        <div className="flex flex-row gap-2 items-center w-full justify-between">
          <div className="flex flex-row gap-2 items-center">
            <Image
              src="/avatars/jeremy.png"
              alt="Jeremy"
              width={28}
              height={28}
              className="size-7 rounded-full bg-neutral-100 dark:bg-neutral-800"
            />
            <div className="font-sans text-neutral-500 dark:text-neutral-400 flex flex-row gap-1.5 items-center">
              <div>Posted by</div>
              <Link
                href="https://x.com/jrmyphlmn"
                target="_blank"
                className="flex items-center gap-3 hover:underline underline-offset-4"
              >
                Jeremy
              </Link>
            </div>
          </div>

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

        <article className="font-sans text-neutral-700 dark:text-neutral-300 prose dark:prose-invert prose-p:leading-6.5 prose-img:rounded-xl">
          <MDXContent source={post.content} />
        </article>
      </div>
    </div>
  );
}
