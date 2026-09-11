import { ListSkeleton } from "@/components/ui/page-skeleton";

/** Shown while any console list page loads; detail and form routes have their own shapes. */
export default function AdminLoading() {
  return <ListSkeleton />;
}
