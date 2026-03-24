import { DesktopScene } from "@/components/desktop-scene";
import { AgentLoop } from "@/components/agent-loop";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col w-dvw items-center">
      <div className="max-w-2xl w-full flex flex-col gap-8 py-18 px-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <div className="font-sans text-lg">whoami.wiki</div>
            <div className="font-sans text-md text-muted">
              Your personal encyclopedia, written by agents
            </div>
          </div>

          <div className="flex flex-row gap-2">
            <Link href="/docs" tabIndex={-1}>
              <Button text="Get Started" accent="primary" isCircular />
            </Link>
            <Link href="/blog/personal-encyclopedias" tabIndex={-1}>
              <Button text="Read Essay" accent="secondary" isCircular />
            </Link>
          </div>
        </div>

        <div className="h-px w-full bg-neutral-200 dark:bg-neutral-700" />

        <div className="font-sans">
          The whoami.wiki system turns your digital archives of photos, chats,
          documents, location history, and different types of data into a living
          encyclopedia about your life.
        </div>
      </div>

      <DesktopScene />

      <div className="max-w-2xl w-full flex flex-col gap-8 py-18 px-6 border-b border-neutral-200 dark:border-neutral-700">
        <div className="font-sans">
          Combine your favorite agent harness with the{" "}
          <span className="font-mono p-0.5 px-1 border border-neutral-300 dark:border-neutral-600 rounded-md">
            wai
          </span>{" "}
          extension to build your personal encyclopedia.
        </div>
        <AgentLoop />
      </div>

      <div className="max-w-2xl w-full flex flex-col gap-24 py-18 px-6">
        <div className="flex flex-1/2 flex-col gap-8 h-fit">
          <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-6 font-sans">
            <dt className="">Local-first</dt>
            <dd className="text-muted">
              Everything runs on your machine—MediaWiki in Docker, archive on
              your filesystem. Your data never touches a server unless you put
              it there.
            </dd>
            <dt className="">Works with your tools</dt>
            <dd className="text-muted">
              Built for{" "}
              <a
                href="https://docs.anthropic.com/en/docs/claude-code"
                className="underline underline-offset-4"
              >
                Claude Code
              </a>{" "}
              and{" "}
              <a
                href="https://openai.com/index/introducing-codex/"
                className="underline underline-offset-4"
              >
                Codex
              </a>
              . Agents use the CLI directly, no plugins required. Add{" "}
              <span className="font-mono p-0.5 px-1 border border-neutral-300 dark:border-neutral-600 rounded-md">
                wai
              </span>{" "}
              to any AI workflow that can run bash.
            </dd>
            <dt className="">Citations you can click</dt>
            <dd className="text-muted">
              Every fact links back to its source. Click a citation in the wiki
              and see the original photo, chat message, or document it came
              from.
            </dd>
            <dt className="">Content-addressed</dt>
            <dd className="text-muted">
              Files are stored by hash and deduplicated automatically. The same
              photo across five exports is stored once.
            </dd>
            <dt className="">Export anytime</dt>
            <dd className="text-muted">
              Full export to Markdown and original files. Share a single page
              with family or back up everything. No proprietary formats, no
              lock-in.
            </dd>
            <dt className="">Open source</dt>
            <dd className="text-muted">
              MIT licensed. The core stays open forever. Run it, fork it, extend
              it however you want.
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
