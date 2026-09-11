/* eslint-disable @next/next/no-img-element */
export function Avatar({ userId, name, imageTag, size = 28 }: { userId: string; name: string; imageTag: string | null; size?: number }) {
  if (!imageTag) {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground"
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
      loading="lazy"
      decoding="async"
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
