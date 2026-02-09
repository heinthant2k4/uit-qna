import Link from 'next/link';

import { Badge } from './ui/badge';

type Props = {
  label: string;
};

export function TagChip({ label }: Props) {
  return (
    <Link href={`/search?q=${encodeURIComponent(label)}&page=1&cat=all`}>
      <Badge className="font-medium cursor-pointer hover:bg-[rgb(var(--surface-2))] transition-colors">
        {label}
      </Badge>
    </Link>
  );
}
