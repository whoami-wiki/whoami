import { DesktopScene } from "@/components/desktop-scene";
import { Terminal } from "@/components/terminal";

export default function Home() {
  return (
    <div className="flex flex-col w-dvw items-center">
      <div className="max-w-120 flex flex-col gap-8 py-18">
        <div className="">
          <div className="font-sans">whoami.wiki</div>
          <div className="font-sans text-muted">
            your personal encyclopedia, written by agents
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

      <div className="max-w-150 flex flex-col gap-24 py-18 border-b border-neutral-200">
        <div className="flex flex-1/2 flex-col gap-8 h-fit">
          <div className="font-sans font-medium">Add sources</div>
          <div className="font-sans">
            Start by registering a source—a folder of photos, a chat export, a
            pile of documents you&apos;ve been meaning to organize.
          </div>
          <Terminal
            animate="lines"
            lines={[
              '$ wai snapshot ~/Photos/Goa --title "Goa Trip (2019)"',
              "",
              "Snapshotting ~/Photos/Goa...",
              "",
              "  Files: 847",
              "  New objects: 812 (2.1 GB)",
              "  Deduplicated: 35 files (140 MB saved)",
              "  Snapshot ID: a3f2b8c9",
              "",
              "Created: Source:Goa Trip (2019)",
            ]}
          />
          <div className="font-sans">
            An agent reads through the files, extracts what it can, and
            cross-references against everything else in your wiki. It writes a
            page, links it to related people and places, and flags gaps where
            information is missing. Over time, as you add more sources, the
            encyclopedia fills in.
          </div>
        </div>

        <div className="flex flex-1/2 flex-col gap-8 h-fit">
          <div className="font-sans font-medium">Ask anything</div>
          <div className="font-sans">
            Once your wiki has some pages, you can query it in natural language.
            The agent searches, reads the relevant pages, and gives you an
            answer.
          </div>
          <Terminal
            animate="stream"
            lines={[
              '$ wai query "who was at the Goa trip?"',
              "",
              "Based on photos and the College Gang WhatsApp group, the Goa trip included you, Sid, Priya, Rohit, Vik, and Meera. Vik booked the villa without asking. There are 12 photos with everyone together, mostly from the pool on night two.",
              "",
              "Sources: The Goa Trip, Sid, Astral Projection (band)",
            ]}
          />
          <div className="font-sans">
            Or skip the CLI and browse the wiki directly—it&apos;s just
            MediaWiki, so you can search, click around, and edit pages yourself.
          </div>
        </div>
      </div>

      <div className="max-w-150 flex flex-col gap-24 py-18">
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
              <span className="font-mono p-0.5 px-1 border border-neutral-300 rounded-md">
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
