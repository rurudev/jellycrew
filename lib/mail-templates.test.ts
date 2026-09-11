import { describe, expect, it } from "vitest";
import { resetLinkMail, verifyEmailMail } from "./mail-templates";

describe("mail templates", () => {
  it("builds a reset mail with the link in text and html", () => {
    const m = resetLinkMail({ serverName: "Home", userName: "alice", url: "https://x/reset/abc", expiresInMinutes: 60, requestedByAdmin: false });
    expect(m.subject).toBe("Reset your Home password");
    expect(m.text).toContain("https://x/reset/abc");
    expect(m.text).toContain("expires in 60 minutes");
    expect(m.html).toContain('<a href="https://x/reset/abc">');
    expect(m.text).toContain("ignore this email");
  });
  it("mentions the administrator when they requested it and escapes html", () => {
    const m = resetLinkMail({ serverName: "<b>", userName: "a&b", url: "https://x/reset/abc", expiresInMinutes: 60, requestedByAdmin: true });
    expect(m.text).toContain("An administrator");
    expect(m.html).toContain("&lt;b&gt;");
    expect(m.html).toContain("a&amp;b");
  });
  it("builds a verification mail", () => {
    const m = verifyEmailMail({ serverName: "Home", userName: "bob", url: "https://x/me/verify/t", expiresInHours: 24 });
    expect(m.subject).toContain("Verify");
    expect(m.text).toContain("https://x/me/verify/t");
  });
});
