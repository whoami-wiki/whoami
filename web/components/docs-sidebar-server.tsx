import type { SidebarSection } from "@/lib/docs-sidebar-config";
import { SidebarLink, SidebarHeadings } from "./sidebar-active";

export function DocsSidebarServer({
  sections,
}: {
  sections: SidebarSection[];
}) {
  return (
    <nav className="w-56 shrink-0 font-sans text-sm max-h-[calc(100dvh-5rem)] overflow-y-auto">
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <div className="text-primary text-sm mb-1">{section.title}</div>

            {section.items.map((item) => (
              <div key={item.slug} className="flex flex-col gap-2">
                <SidebarLink slug={item.slug} title={item.title} />

                {item.headings.length > 0 && (
                  <SidebarHeadings
                    slug={item.slug}
                    headings={item.headings}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
