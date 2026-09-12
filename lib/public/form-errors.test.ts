import { describe, expect, it } from "vitest";
import { publicErrorMessage } from "./form-errors";

describe("publicErrorMessage", () => {
  it("prefers the handler's own message", () => {
    expect(publicErrorMessage(400, { error: "That username is taken." }, "Signup failed.")).toBe("That username is taken.");
  });

  it("explains rate limiting in words a guest can act on", () => {
    expect(publicErrorMessage(429, {}, "Signup failed.")).toBe("Too many attempts. Wait a minute and try again.");
  });

  it("covers a missing or broken body", () => {
    expect(publicErrorMessage(500, null, "Signup failed.")).toBe("The server had a problem. Try again in a moment.");
    expect(publicErrorMessage(400, undefined, "Signup failed.")).toBe("Signup failed.");
    expect(publicErrorMessage(400, { error: "   " }, "Signup failed.")).toBe("Signup failed.");
    expect(publicErrorMessage(400, { error: 42 }, "Signup failed.")).toBe("Signup failed.");
  });

  it("says a dead link is dead", () => {
    expect(publicErrorMessage(404, {}, "Signup failed.")).toBe("That link is no longer valid.");
  });
});
