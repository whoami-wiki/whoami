import type { Metadata } from "next";
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
            News, updates, and stories from the team.
          </div>
        </div>

        <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700" />

        {posts.length === 0 && (
          <div className="font-sans text-neutral-500">No posts yet.</div>
        )}

        <div className="flex flex-col gap-10">
          {posts.map((post) => (
            <article key={post.slug} className="flex flex-col gap-2">
              <Link
                href={`/blogs/${post.slug}`}
                className="font-sans font-medium text-xl hover:underline underline-offset-4"
              >
                {post.title}
              </Link>
              {post.description && (
                <p className="font-sans text-neutral-600 dark:text-neutral-400 text-base">
                  {post.description}
                </p>
              )}
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
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
