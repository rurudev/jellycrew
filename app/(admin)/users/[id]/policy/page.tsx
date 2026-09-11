import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { policyHash } from "@/lib/policy/hash";
import { getReferenceData } from "@/lib/services/reference";
import { toEditorRefData } from "@/lib/services/reference-serialize";
import { getUserDetail } from "@/lib/services/users";
import { PolicyEditor } from "@/components/policy/policy-editor";
import { saveUserPolicyAction } from "./actions";

export const metadata = { title: "Edit access" };

export default async function UserPolicyPage(props: PageProps<"/users/[id]/policy">) {
  await requireAdmin();
  const { id } = await props.params;
  const [detail, ref] = await Promise.all([getUserDetail(id), getReferenceData()]);
  if (!detail) notFound();
  return (
    <div className="space-y-4">
      <div className="text-xs text-zinc-500">
        <Link href="/users" className="hover:underline">
          Users
        </Link>{" "}
        /{" "}
        <Link href={`/users/${id}`} className="hover:underline">
          {detail.row.name}
        </Link>{" "}
        / Edit access
      </div>
      <h1 className="text-xl font-semibold">Edit access for {detail.row.name}</h1>
      <p className="text-zinc-500">
        Changes are previewed as a diff before they are written. If the policy changes on the server while you edit, the save is refused and you can reapply your edits.
      </p>
      <PolicyEditor
        action={saveUserPolicyAction}
        policy={detail.policy}
        hash={policyHash(detail.policy)}
        refData={toEditorRefData(ref)}
        scope="all"
        hidden={{ userId: id }}
        cancelHref={`/users/${id}`}
      />
    </div>
  );
}
