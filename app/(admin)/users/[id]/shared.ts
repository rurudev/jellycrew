import { revalidatePath } from "next/cache";
import { redirectWithNotice } from "@/lib/notice";

/** Every redirecting user action ends here: the user page and the list are refreshed, then back with a notice. */
export function backToUser(userId: string, notice: { ok?: string; error?: string }): never {
  redirectWithNotice(`/users/${userId}`, notice, { revalidate: [`/users/${userId}`, "/users"] });
}

/** The same refresh for actions that return state to a dialog instead of redirecting. */
export function refreshUser(userId: string): void {
  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
}
