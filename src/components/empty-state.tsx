import { Card, CardContent, CardTitle } from './ui/card';

type Props = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: Props) {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{description}</p>
      </CardContent>
    </Card>
  );
}
