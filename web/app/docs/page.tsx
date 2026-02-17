import { redirect } from "next/navigation";
import { sidebarConfig } from "@/lib/docs-sidebar-config";

export default function DocsPage() {
  const firstItem = sidebarConfig[0]?.items[0];
  if (firstItem) {
    redirect(`/docs/${firstItem.slug}`);
  }
  return null;
}
