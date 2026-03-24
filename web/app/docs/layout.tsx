import type { Metadata } from "next";
import { DocsMobileNav } from "@/components/docs-mobile-nav";
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
    <div className="flex flex-col w-dvw items-center min-h-screen">
      <DocsMobileNav sections={sections} />
      <div className="w-full max-w-5xl flex flex-row gap-8 py-18 px-6">
        {children}
      </div>
    </div>
  );
}
