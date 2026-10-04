import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllPosts, getPost, formatBlogDate } from "@/lib/blog";
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
    openGraph: {
      images: [{ url: `/blog/${slug}/opengraph-image.png?v=2` }],
    },
    twitter: {
      images: [{ url: `/blog/${slug}/twitter-image.png?v=2` }],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <div className="flex flex-col w-dvw items-center">
      {slug === "personal-encyclopedias" && (
        <a
          href="https://news.ycombinator.com/item?id=47522173"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-neutral-100 px-6 py-2 text-center font-sans text-sm text-neutral-700 transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-black dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600 dark:focus-visible:outline-white"
        >
          <span className="inline-flex items-center gap-2">
            Read discussion on Hacker News
            <svg
              viewBox="0 0 16 16"
              height="16"
              width="16"
              aria-hidden="true"
              focusable="false"
              className="shrink-0"
            >
              <path
                fill="currentColor"
                fillRule="evenodd"
                d="M11.5 9.75v1.5q-.02.23-.25.25h-6.5a.25.25 0 0 1-.25-.25v-6.5c0-.14.11-.25.25-.25H7V3H4.75C3.78 3 3 3.78 3 4.75v6.5c0 .97.78 1.75 1.75 1.75h6.5c.97 0 1.75-.78 1.75-1.75V9h-1.5zM8.5 3h3.75c.41 0 .75.34.75.75V7.5h-1.5V5.56L8.53 8.53 8 9.06 6.94 8l.53-.53 2.97-2.97H8.5z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <span className="whitespace-nowrap text-neutral-500 dark:text-neutral-300">
            897 points, 185 comments
          </span>
        </a>
      )}
      <div className="max-w-2xl w-full flex flex-col gap-8 py-18 px-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans font-normal text-2xl">{post.title}</h1>
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
            {formatBlogDate(post.date)}
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
