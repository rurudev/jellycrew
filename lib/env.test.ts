import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const good = {
  JELLYFIN_URL: "http://jellyfin:8096/",
  JELLYFIN_API_KEY: "abc",
  PUBLIC_BASE_URL: "https://users.example.com/",
  SESSION_SECRET: "x".repeat(32),
};

describe("env", () => {
  it("accepts a minimal valid environment and applies defaults", () => {
    const e = parseEnv(good);
    expect(e.JELLYFIN_URL).toBe("http://jellyfin:8096");
    expect(e.PUBLIC_BASE_URL).toBe("https://users.example.com");
    expect(e.DATA_DIR).toBe("./data");
    expect(e.LOG_LEVEL).toBe("info");
    expect(e.SMTP_URL).toBeUndefined();
  });

  it("treats empty SMTP values as unset", () => {
    const e = parseEnv({ ...good, SMTP_URL: "", SMTP_FROM: "" });
    expect(e.SMTP_URL).toBeUndefined();
  });

  it("requires SMTP_FROM when SMTP_URL is set", () => {
    expect(() => parseEnv({ ...good, SMTP_URL: "smtp://mail:1025" })).toThrow(/SMTP_FROM/);
  });

  it("rejects short session secrets and bad urls", () => {
    expect(() => parseEnv({ ...good, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
    expect(() => parseEnv({ ...good, JELLYFIN_URL: "not a url" })).toThrow(/JELLYFIN_URL/);
  });
});
