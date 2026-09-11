/** Plain-text first: every mail has a text body; HTML is a light wrapper around it. */
export interface TemplateInput {
  serverName: string;
  userName: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function wrap(lines: string[]): { text: string; html: string } {
  const text = lines.join("\n");
  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.5">${lines.map((l) => (l === "" ? "<br>" : `<p>${escapeHtml(l).replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>`)).join("")}</div>`;
  return { text, html };
}

export function resetLinkMail(input: TemplateInput & { url: string; expiresInMinutes: number; requestedByAdmin: boolean }) {
  const body = wrap([
    `Hello ${input.userName},`,
    "",
    input.requestedByAdmin ? `An administrator of ${input.serverName} created a password reset link for your account.` : `Someone asked to reset the password of your ${input.serverName} account.`,
    "",
    "Open this link to choose a new password:",
    input.url,
    "",
    `The link works once and expires in ${input.expiresInMinutes} minutes.`,
    input.requestedByAdmin ? "" : "If you did not ask for this, you can ignore this email; your password stays unchanged.",
  ]);
  return { subject: `Reset your ${input.serverName} password`, ...body };
}

export function verifyEmailMail(input: TemplateInput & { url: string; expiresInHours: number }) {
  const body = wrap([
    `Hello ${input.userName},`,
    "",
    `Confirm that this address belongs to your ${input.serverName} account by opening:`,
    input.url,
    "",
    `The link expires in ${input.expiresInHours} hours. A verified address lets you reset your password yourself.`,
    "If you did not add this address, ignore this email.",
  ]);
  return { subject: `Verify your email for ${input.serverName}`, ...body };
}
