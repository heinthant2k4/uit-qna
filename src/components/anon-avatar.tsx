import { cn } from '../lib/utils';

type Props = {
  seed: number;
  size?: 24 | 28;
  className?: string;
};

function normalizeHue(seed: number): number {
  return ((seed % 360) + 360) % 360;
}

export function AnonAvatar({ seed, size = 24, className }: Props) {
  const hue = normalizeHue(seed);
  const accentA = (hue + 36) % 360;
  const accentB = (hue + 72) % 360;
  const shift = (seed % 22) + 8;

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id={`anon-grad-${seed}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`hsl(${hue} 55% 42%)`} />
            <stop offset="100%" stopColor={`hsl(${accentA} 55% 36%)`} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill={`url(#anon-grad-${seed})`} />
        <path d={`M0 ${62 + shift / 3} L40 ${24 + shift} L72 ${56 - shift / 2} L100 38 L100 100 L0 100 Z`} fill={`hsl(${accentA} 72% 82% / 0.5)`} />
        <circle cx={26 + shift / 3} cy={26 + shift / 5} r="11" fill={`hsl(${accentB} 82% 88% / 0.65)`} />
      </svg>
    </span>
  );
}

