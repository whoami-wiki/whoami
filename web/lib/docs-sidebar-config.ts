import { getDoc, type DocHeading } from "./docs";

export interface SidebarItem {
  title: string;
  slug: string;
  headings: DocHeading[];
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

interface SidebarItemConfig {
  title: string;
  slug: string;
}

interface SidebarSectionConfig {
  title: string;
  items: SidebarItemConfig[];
}

const sidebarLayout: SidebarSectionConfig[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Installation", slug: "installation" },
      { title: "Writing Your First Page", slug: "writing-your-first-page" },
      { title: "Troubleshooting", slug: "troubleshooting" },
    ],
  },
  {
    title: "Learn More",
    items: [
      { title: "Concepts", slug: "concepts" },
      { title: "Page Types", slug: "page-types" },
      { title: "Editorial Standards", slug: "editorial-standards" },
      { title: "Data Sources", slug: "data-sources" },
      { title: "Citation System", slug: "citation-system" },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "CLI", slug: "cli" },
      { title: "Evals", slug: "evals" },
    ],
  },
];

export function getSidebarConfig(): SidebarSection[] {
  return sidebarLayout.map((section) => ({
    title: section.title,
    items: section.items.map((item) => {
      const doc = getDoc(item.slug);
      return {
        title: item.title,
        slug: item.slug,
        headings: doc?.headings ?? [],
      };
    }),
  }));
}
