/**
 * Jellyfin has no conditional write, so a policy change is always read-modify-write: fetch the
 * whole policy, change a field, post it all back. Two of those overlapping means whichever lands
 * second replaces the other's field with a value it read before the change, and both callers
 * record a successful audit row. The lifecycle pass disabling an expired account while an admin
 * applies a profile to the same user is exactly that shape.
 *
 * Writes for one user are therefore serialised in this process. It does not help two containers
 * sharing one Jellyfin, where the editor's stale-write check is still the guard, but it removes
 * the overlap that happens inside one.
 */
const inFlight = new Map<string, Promise<void>>();

export async function withUserPolicyLock<T>(userId: string, write: () => Promise<T>): Promise<T> {
  const previous = inFlight.get(userId) ?? Promise.resolve();
  const mine = previous.then(write, write);
  // The queue only needs to know when this write is over, not how it went.
  const tail = mine.then(
    () => undefined,
    () => undefined,
  );
  inFlight.set(userId, tail);
  try {
    return await mine;
  } finally {
    // Leave the entry alone if someone has already queued behind us.
    if (inFlight.get(userId) === tail) inFlight.delete(userId);
  }
}
