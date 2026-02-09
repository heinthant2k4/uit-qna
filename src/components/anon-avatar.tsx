import { cn } from '../lib/utils';

type Props = {
  seed: number;
  size?: 24 | 28 | 40 | 56;
  className?: string;
};

function normalizeHue(seed: number): number {
  return ((seed % 360) + 360) % 360;
}

export function AnonAvatar({ seed, size = 24, className }: Props) {
  const hue = normalizeHue(seed);
  const accentA = (hue + 22) % 360;
  const accentB = (hue + 62) % 360;
  const shift = (seed % 16) + 7;

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id={`anon-grad-${seed}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`hsl(${hue} 42% 74%)`} />
            <stop offset="100%" stopColor={`hsl(${accentA} 40% 58%)`} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="50" fill={`url(#anon-grad-${seed})`} />
        <path
          d={`M0 ${68 + shift / 4} L38 ${26 + shift} L68 ${53 - shift / 3} L100 34 L100 100 L0 100 Z`}
          fill={`hsl(${accentA} 44% 87% / 0.58)`}
        />
        <circle cx={24 + shift / 4} cy={24 + shift / 6} r="12" fill={`hsl(${accentB} 46% 91% / 0.62)`} />
      </svg>
    </span>
  );
}
