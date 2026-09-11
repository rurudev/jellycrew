/* eslint-disable @next/next/no-img-element */
export function Avatar({ userId, name, imageTag, size = 28 }: { userId: string; name: string; imageTag: string | null; size?: number }) {
  if (!imageTag) {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`/users/${encodeURIComponent(userId)}/avatar?tag=${encodeURIComponent(imageTag)}`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
