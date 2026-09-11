import { revalidatePath } from "next/cache";
import { redirectWithNotice } from "@/lib/notice";

/** Every user action ends here: refresh the user page and the list, then go back with a notice. */
export function backToUser(userId: string, notice: { ok?: string; error?: string }): never {
  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
  redirectWithNotice(`/users/${userId}`, notice);
}
