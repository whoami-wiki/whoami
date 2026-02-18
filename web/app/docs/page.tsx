import { redirect } from "next/navigation";
import { getSidebarConfig } from "@/lib/docs-sidebar-config";

export default function DocsPage() {
  const sections = getSidebarConfig();
  const firstItem = sections[0]?.items[0];
  if (firstItem) {
    redirect(`/docs/${firstItem.slug}`);
  }
  return null;
}
