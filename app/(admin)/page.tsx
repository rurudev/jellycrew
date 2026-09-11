import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";

export default async function HomePage() {
  await requireAdmin();
  redirect("/users");
}
