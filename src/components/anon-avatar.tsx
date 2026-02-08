import { cn } from '../lib/utils';

type Props = {
  seed: number;
  handle: string;
  size?: 24 | 28;
  className?: string;
};

function initialsFromHandle(handle: string): string {
  const cleaned = handle.replace(/[^a-zA-Z]/g, '');
  if (!cleaned) return 'AN';
  return cleaned.slice(0, 2).toUpperCase();
}

function colorsFromSeed(seed: number) {
  const hue = ((seed % 360) + 360) % 360;
  return {
    bg: `hsl(${hue} 52% 42%)`,
    fg: 'hsl(0 0% 100%)',
    accent: `hsl(${(hue + 36) % 360} 70% 78% / 0.55)`,
  };
}

export function AnonAvatar({ seed, handle, size = 24, className }: Props) {
  const initials = initialsFromHandle(handle);
  const colors = colorsFromSeed(seed);

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', className)}
      style={{ width: size, height: size, background: colors.bg, color: colors.fg }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r="50" fill={colors.bg} />
        <path d="M0 72 L42 28 L75 61 L100 44 L100 100 L0 100 Z" fill={colors.accent} />
        <text
          x="50"
          y="58"
          textAnchor="middle"
          fontSize="30"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
          fill={colors.fg}
        >
          {initials}
        </text>
      </svg>
    </span>
  );
}
