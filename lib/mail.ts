import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { logger } from "@/lib/log";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function isMailConfigured(): boolean {
  const e = env();
  return !!e.SMTP_URL && !!e.SMTP_FROM;
}

declare global {
  var __jellycrewMailer: Transporter | undefined;
}

function transporter(): Transporter {
  if (!globalThis.__jellycrewMailer) {
    const e = env();
    if (!e.SMTP_URL) throw new MailNotConfiguredError();
    globalThis.__jellycrewMailer = nodemailer.createTransport(e.SMTP_URL);
  }
  return globalThis.__jellycrewMailer;
}

export function resetMailer(): void {
  globalThis.__jellycrewMailer = undefined;
}

export class MailNotConfiguredError extends Error {
  constructor() {
    super("Email is not configured on this server. Contact the administrator.");
    this.name = "MailNotConfiguredError";
  }
}

export async function sendMail(mail: Mail): Promise<{ messageId: string }> {
  if (!isMailConfigured()) throw new MailNotConfiguredError();
  const info = await transporter().sendMail({ from: env().SMTP_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
  logger.info({ to: mail.to, subject: mail.subject, messageId: info.messageId }, "mail sent");
  return { messageId: String(info.messageId ?? "") };
}

/** Connects to the SMTP server and authenticates without sending anything. */
export async function verifySmtp(): Promise<{ ok: boolean; message: string }> {
  if (!isMailConfigured()) return { ok: false, message: "SMTP_URL / SMTP_FROM not set" };
  try {
    await transporter().verify();
    return { ok: true, message: "SMTP connection verified" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
