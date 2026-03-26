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
          Works with your friendly neighborhood agent harness. Currently tested
          with{" "}
          <a
            href="https://docs.anthropic.com/en/docs/claude-code"
            className="underline underline-offset-4"
          >
            Claude Code
          </a>
          ,{" "}
          <a
            href="https://openai.com/index/introducing-codex/"
            className="underline underline-offset-4"
          >
            Codex
          </a>
          , and{" "}
          <a
            href="https://opencode.ai"
            className="underline underline-offset-4"
          >
            OpenCode
          </a>
          . More coming soon!
        </div>
        <AgentLoop />
      </div>

      <div className="max-w-2xl w-full flex flex-col gap-24 py-18 px-6">
        <div className="flex flex-1/2 flex-col gap-8 h-fit">
          <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-6 font-sans">
            <dt className="">Private by default</dt>
            <dd className="text-muted">
              Your wiki and archive live on your machine. Nothing is stored
              remotely.*
            </dd>
            <dt className="">Export anytime</dt>
            <dd className="text-muted">
              Full export to Markdown and original files. Share a single page
              with family or back up everything.
            </dd>
            <dt className="">Open source</dt>
            <dd className="text-muted">
              MIT licensed. Fork it, clone it, hack it, build it, cite it, tag
              it, ship, extend it.
            </dd>
          </dl>
          <p className="text-muted text-sm font-sans pl-[0.6em] -indent-[0.6em]">
            *When using agent harnesses with models hosted online, your data is
            sent to those providers. Use{" "}
            <a
              href="https://opencode.ai"
              className="underline underline-offset-4"
            >
              OpenCode
            </a>{" "}
            + local models for a fully offline experience.
          </p>
        </div>
      </div>
    </div>
  );
}
