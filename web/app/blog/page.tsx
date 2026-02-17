import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — whoami.wiki",
  description: "News, updates, and stories from the whoami.wiki team.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="flex flex-col w-dvw items-center">
      <div className="w-full max-w-3xl flex flex-col gap-8 py-18 px-6">
        <div>
          <div className="font-sans">Blog</div>
          <div className="font-sans text-neutral-500 dark:text-neutral-400">
            Some thoughts that have shaped the tools we build.
          </div>
        </div>

        <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700" />

        {posts.length === 0 && (
          <div className="font-sans text-neutral-500">No posts yet.</div>
        )}

        <div className="flex flex-col gap-10">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="flex flex-row items-start justify-between"
            >
              <div className="flex flex-col">
                <Link
                  href={`/blog/${post.slug}`}
                  className="font-sans text hover:underline underline-offset-4"
                >
                  {post.title}
                </Link>
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
              <Image
                src="/avatars/jeremy.png"
                alt="Jeremy"
                width={28}
                height={28}
                className="size-7 rounded-full bg-neutral-100 dark:bg-neutral-800"
              />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
