import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { policyHash } from "@/lib/policy/hash";
import { getReferenceData } from "@/lib/services/reference";
import { toEditorRefData } from "@/lib/services/reference-serialize";
import { getUserDetail } from "@/lib/services/users";
import { PolicyEditor } from "@/components/policy/policy-editor";
import { PageHeader } from "@/components/ui/page-header";
import { saveUserPolicyAction } from "./actions";

export const metadata = { title: "Edit access" };

export default async function UserPolicyPage(props: PageProps<"/users/[id]/policy">) {
  await requireAdmin();
  const { id } = await props.params;
  const [detail, ref] = await Promise.all([getUserDetail(id), getReferenceData()]);
  if (!detail) notFound();
  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "Users", href: "/users" }, { label: detail.row.name, href: `/users/${id}` }, { label: "Edit access" }]}
        title={`Edit access for ${detail.row.name}`}
        description="Changes are previewed as a diff before they are written. If the policy changes on the server while you edit, the save is refused and you can reapply your edits."
      />
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
