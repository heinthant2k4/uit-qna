import { Card, CardContent, CardTitle } from './ui/card';

type Props = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: Props) {
  return (
    <Card className="fade-in">
      <CardContent className="p-6 text-center">
        <div className="mx-auto mb-3 h-2 w-14 rounded-full bg-brand-200 dark:bg-brand-800/50" />
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--muted))]">{description}</p>
      </CardContent>
    </Card>
  );
}
