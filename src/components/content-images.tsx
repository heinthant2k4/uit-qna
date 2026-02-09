type Props = {
  urls: string[];
  compact?: boolean;
  className?: string; // Added optional className prop
};

export function ContentImages({ urls, compact, className }: Props) {
  if (!urls.length) return null;

  const visible = compact ? urls.slice(0, 1) : urls;

  return (
    <div className={`mt-3 ${className}`}> {/* Applied className here */}
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {visible.map((url, index) => (
          <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
            <img
              src={url}
              alt="Attached content"
              loading="lazy"
              width={compact ? 720 : 1280}
              height={compact ? 400 : 720}
              className={`w-full rounded-xl border border-[rgb(var(--line))] object-cover ${compact ? 'h-36' : 'h-40'}`}
            />
          </a>
        ))}
      </div>
      {compact && urls.length > 1 ? (
        <p className="mt-1 text-xs text-[rgb(var(--muted))]">+{urls.length - 1} more image(s)</p>
      ) : null}
    </div>
  );
}
