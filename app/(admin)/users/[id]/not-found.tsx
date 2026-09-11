import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function UserNotFound() {
  return (
    <EmptyState
      title="No such user"
      description="Jellyfin does not know this user. It may have been deleted, or the link is stale."
      action={
        <Link href="/users" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to users
        </Link>
      }
    />
  );
}
