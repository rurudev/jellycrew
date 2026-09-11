import { describe, expect, it } from "vitest";
import { JellyfinError, buildAuthHeader, unwrap } from "./client";

describe("jellyfin client", () => {
  it("formats the MediaBrowser authorization header", () => {
    const h = buildAuthHeader({ deviceId: "dev123", token: "tok", version: "1.2.3" });
    expect(h).toBe('MediaBrowser Client="jellycrew", Device="server", DeviceId="dev123", Version="1.2.3", Token="tok"');
  });

  it("omits the token for anonymous calls", () => {
    const h = buildAuthHeader({ deviceId: "dev123", version: "1.2.3" });
    expect(h).not.toContain("Token=");
    expect(h).toContain('DeviceId="dev123"');
  });

  it("unwrap throws JellyfinError with status and body on failure", () => {
    const response = new Response("Error processing request.", { status: 400 });
    expect(() => unwrap("CreateUserByName", { error: "Error processing request.", response })).toThrow(JellyfinError);
    try {
      unwrap("CreateUserByName", { error: "Error processing request.", response });
    } catch (e) {
      const err = e as JellyfinError;
      expect(err.status).toBe(400);
      expect(err.body).toBe("Error processing request.");
      expect(err.message).toContain("HTTP 400");
    }
  });

  it("unwrap returns data on success", () => {
    const response = new Response(null, { status: 204 });
    expect(unwrap("X", { data: undefined, response })).toBeUndefined();
    expect(unwrap("Y", { data: { a: 1 }, response: new Response("{}", { status: 200 }) })).toEqual({ a: 1 });
  });
});
