import type { Metadata } from "next";
import { DocsSidebar } from "@/components/docs-sidebar";
import { getSidebarConfig } from "@/lib/docs-sidebar-config";

export const metadata: Metadata = {
  title: "Docs — whoami.wiki",
  description: "Documentation for whoami.wiki",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sections = getSidebarConfig();

  return (
    <div className="flex flex-col w-dvw items-center">
      <div className="w-full max-w-5xl flex flex-row gap-8 py-18 px-6">
        <div className="hidden md:block self-start sticky top-18">
          <DocsSidebar sections={sections} />
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
