import { Badge } from './ui/badge';

type Props = {
  label: string;
};

export function TagChip({ label }: Props) {
  return <Badge>{label}</Badge>;
}
