import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";

export const MAILPIT_IMAGE = "axllent/mailpit:v1.31.1";

export interface MailpitServer {
  smtpUrl: string;
  apiUrl: string;
}

export async function startMailpit(): Promise<{ container: StartedTestContainer; server: MailpitServer }> {
  const container = await new GenericContainer(MAILPIT_IMAGE)
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forHttp("/api/v1/info", 8025).forStatusCode(200))
    .withStartupTimeout(60_000)
    .start();
  const host = container.getHost();
  return {
    container,
    server: { smtpUrl: `smtp://${host}:${container.getMappedPort(1025)}`, apiUrl: `http://${host}:${container.getMappedPort(8025)}` },
  };
}

export interface MailpitMessage {
  ID: string;
  To: Array<{ Address: string }>;
  Subject: string;
  Text: string;
  HTML: string;
}

/** Waits for a message addressed to `to` and returns its full body. */
export async function waitForMail(api: string, to: string, opts: { timeoutMs?: number; subject?: RegExp } = {}): Promise<MailpitMessage> {
  const deadline = Date.now() + (opts.timeoutMs ?? 10_000);
  while (Date.now() < deadline) {
    const res = await fetch(`${api}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=20`);
    const list = (await res.json()) as { messages: Array<{ ID: string; Subject: string; Created: string }> };
    const hit = list.messages.filter((m) => !opts.subject || opts.subject.test(m.Subject)).sort((a, b) => (a.Created < b.Created ? 1 : -1))[0];
    if (hit) {
      const full = await fetch(`${api}/api/v1/message/${hit.ID}`);
      return (await full.json()) as MailpitMessage;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no mail to ${to} within timeout`);
}

export async function countMail(api: string, to: string): Promise<number> {
  const res = await fetch(`${api}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=1`);
  return ((await res.json()) as { total: number }).total;
}

export async function deleteAllMail(api: string): Promise<void> {
  await fetch(`${api}/api/v1/messages`, { method: "DELETE" });
}

export function extractLink(text: string, pathPrefix: string): string {
  const m = new RegExp(`https?://[^\\s]*${pathPrefix.replace(/\//g, "\\/")}[^\\s]*`).exec(text);
  if (!m) throw new Error(`no link with ${pathPrefix} in mail`);
  return m[0];
}
