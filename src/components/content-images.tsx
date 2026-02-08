type Props = {
  urls: string[];
  compact?: boolean;
};

export function ContentImages({ urls, compact }: Props) {
  if (!urls.length) return null;

  const visible = compact ? urls.slice(0, 1) : urls;

  return (
    <div className="mt-3">
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {visible.map((url, index) => (
          <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="block">
            <img
              src={url}
              alt="Attached content"
              loading="lazy"
              className={`w-full rounded-xl border border-slate-200 object-cover ${compact ? 'h-36' : 'h-40'}`}
            />
          </a>
        ))}
      </div>
      {compact && urls.length > 1 ? (
        <p className="mt-1 text-xs text-slate-500">+{urls.length - 1} more image(s)</p>
      ) : null}
    </div>
  );
}

