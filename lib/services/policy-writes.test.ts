import { describe, expect, it } from "vitest";
import { withUserPolicyLock } from "./policy-writes";

function deferred() {
  let resolve!: (value?: unknown) => void;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("withUserPolicyLock", () => {
  it("runs writes for one user one at a time", async () => {
    const order: string[] = [];
    let running = 0;
    let peak = 0;
    const write = (name: string, ms: number) =>
      withUserPolicyLock("u1", async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, ms));
        order.push(name);
        running -= 1;
        return name;
      });
    const results = await Promise.all([write("first", 20), write("second", 1), write("third", 1)]);
    expect(peak).toBe(1);
    expect(order).toEqual(["first", "second", "third"]);
    expect(results).toEqual(["first", "second", "third"]);
  });

  it("lets writes for different users overlap", async () => {
    const gate = deferred();
    let secondRan = false;
    const held = withUserPolicyLock("a", async () => {
      await gate.promise;
      return "a";
    });
    await withUserPolicyLock("b", async () => {
      secondRan = true;
      return "b";
    });
    expect(secondRan).toBe(true);
    gate.resolve();
    expect(await held).toBe("a");
  });

  it("does not wedge the queue when a write throws", async () => {
    await expect(
      withUserPolicyLock("c", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(withUserPolicyLock("c", async () => "after")).resolves.toBe("after");
  });
});
