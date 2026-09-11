import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ProfileNotFound() {
  return (
    <EmptyState
      title="No such profile"
      description="This profile does not exist. It may have been deleted."
      action={
        <Link href="/profiles" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to profiles
        </Link>
      }
    />
  );
}
