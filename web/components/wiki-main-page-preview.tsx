import Image from "next/image";

// Visual mirror of desktop/resources/templates/Main_Page.wiki — used
// as the final flip-through page in the landing scroll animation so
// the viewer arrives at the wiki's finished Main Page after watching
// the agent process the desktop archive. Renders inside WikiWindow's
// existing window chrome; no window of its own.

function W({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
      {children}
    </span>
  );
}

function SectionBox({
  title,
  headerColor,
  bodyColor,
  children,
}: {
  title: string;
  headerColor: string;
  bodyColor: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`border border-neutral-300 dark:border-neutral-600 ${bodyColor}`}
    >
      <h2
        className={`${headerColor} px-3 py-1.5 font-sans font-semibold text-sm border-b border-neutral-300 dark:border-neutral-600`}
      >
        {title}
      </h2>
      <div className="p-3 font-sans text-[13px] leading-[1.55] text-neutral-700 dark:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

function Thumbnail({
  src,
  alt,
  caption,
  side = "left",
}: {
  src: string;
  alt: string;
  caption: string;
  side?: "left" | "right";
}) {
  const float =
    side === "left" ? "float-left mr-3 mb-1" : "float-right ml-3 mb-1";
  return (
    <div
      className={`${float} w-[110px] border border-neutral-300 dark:border-neutral-600 overflow-hidden`}
    >
      <div className="relative w-full h-[74px]">
        <Image src={src} alt={alt} fill className="object-cover" />
      </div>
      <div className="px-1.5 py-1 text-[10px] text-muted text-center leading-tight">
        {caption}
      </div>
    </div>
  );
}

export function WikiMainPagePreview() {
  return (
    <div className="w-full max-w-[920px] mx-auto flex flex-col gap-2.5">
      <div className="border border-neutral-300 dark:border-neutral-600 bg-[#f9f9f9] dark:bg-[#171a1d] px-5 py-5 text-center">
        <h1 className="font-serif text-2xl font-normal leading-tight">
          Welcome <W>Jay</W>,
        </h1>
        <p className="font-sans text-sm text-muted mt-0.5">
          to your personal encyclopedia.
        </p>
        <p className="font-sans text-xs text-muted mt-3">
          12.4% of your life documented
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[55fr_45fr] gap-2.5 items-start">
        <div className="flex flex-col gap-2.5">
          <SectionBox
            title="Today's featured page"
            headerColor="bg-[#cef2e0] dark:bg-emerald-950/60"
            bodyColor="bg-[#f5fffa] dark:bg-emerald-950/20"
          >
            <Thumbnail
              src="/images/img_goa_group.png"
              alt="All six at the villa"
              caption="Assagao, Dec 2019"
              side="left"
            />
            <p>
              <strong>
                <W>The Goa Trip</W>
              </strong>{" "}
              was a seven-day trip to Assagao in December 2019 by six members of
              the <W>College Gang</W>. The pool light incident on night two. The{" "}
              <W>Dosa Incident</W> in Mapusa birthed the phrase
              &quot;server&apos;s down again.&quot;
            </p>
            <p className="mt-2 text-right text-xs">
              <em>
                (<W>Full article…</W>)
              </em>
            </p>
          </SectionBox>

          <SectionBox
            title="Did you know…"
            headerColor="bg-[#cef2e0] dark:bg-emerald-950/60"
            bodyColor="bg-[#f5fffa] dark:bg-emerald-950/20"
          >
            <ul className="list-disc list-outside ml-4 space-y-1.5">
              <li>
                …that &quot;server&apos;s down again&quot; originated at a{" "}
                <W>dosa cart in Mapusa</W>?
              </li>
              <li>
                …that <W>Astral Projection</W> played their only show with a
                five-string guitar?
              </li>
              <li>
                …that <W>Sid</W>&apos;s sunset-time list was accurate to the
                minute for seven days?
              </li>
            </ul>
          </SectionBox>
        </div>

        <div className="flex flex-col gap-2.5">
          <SectionBox
            title="This week in the wiki"
            headerColor="bg-[#cedff2] dark:bg-blue-950/60"
            bodyColor="bg-[#f5faff] dark:bg-blue-950/20"
          >
            <ul className="list-disc list-outside ml-4 space-y-1.5">
              <li>
                New page on <W>The Indiranagar Apartment</W> documents the 2BHK
                Jay and Sid have lived in since 2021.
              </li>
              <li>
                Three voice notes were transcribed onto <W>Aai</W>, filling in
                her account of the Rajasthan trip.
              </li>
              <li>
                The <W>Hot Wheels Collection</W> page now includes a
                spreadsheet-tracked inventory of 247 cars.
              </li>
            </ul>
          </SectionBox>

          <SectionBox
            title="On this day"
            headerColor="bg-[#cedff2] dark:bg-blue-950/60"
            bodyColor="bg-[#f5faff] dark:bg-blue-950/20"
          >
            <ul className="list-disc list-outside ml-4 space-y-1.5">
              <li>
                <strong>2019</strong> &ndash; <W>Vik</W> drops the villa
                confirmation, setting <W>the Goa Trip</W> in motion.
              </li>
              <li>
                <strong>2018</strong> &ndash; First rehearsal for{" "}
                <W>Astral Projection</W> in the C-204 common room.
              </li>
              <li>
                <strong>2008</strong> &ndash; The family arrives in Jaipur for
                the <W>Rajasthan Trip</W>.
              </li>
            </ul>
          </SectionBox>
        </div>
      </div>

      <SectionBox
        title="Today's featured picture"
        headerColor="bg-[#ddcef2] dark:bg-purple-950/60"
        bodyColor="bg-[#faf5ff] dark:bg-purple-950/20"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-full max-w-[320px] aspect-[3/2] border border-neutral-300 dark:border-neutral-600 overflow-hidden">
            <Image
              src="/images/img_mumbai_marine.png"
              alt="Marine Drive at dusk"
              fill
              className="object-cover"
            />
          </div>
          <p className="text-center text-xs">
            <W>Marine Drive</W> after the inter-college dance final, February
            2018. <W>Sid</W> later called it &quot;the best night of
            college.&quot;
          </p>
        </div>
      </SectionBox>
    </div>
  );
}
