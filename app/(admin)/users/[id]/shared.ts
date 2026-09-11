import { redirectWithNotice } from "@/lib/notice";

/** Every user action ends here: the user page and the list are refreshed, then back with a notice. */
export function backToUser(userId: string, notice: { ok?: string; error?: string }): never {
  redirectWithNotice(`/users/${userId}`, notice, { revalidate: [`/users/${userId}`, "/users"] });
}
