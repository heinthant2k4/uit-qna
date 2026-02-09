import type { ButtonHTMLAttributes } from 'react';

import { Button } from './ui/button';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'neutral' | 'danger';
};

export function PrimaryButton({ tone = 'primary', className, type = 'button', ...props }: Props) {
  const variant = tone === 'primary' ? 'cta' : tone === 'danger' ? 'destructive' : 'secondary';

  return (
    <Button
      type={type}
      variant={variant}
      className={className}
      {...props}
    />
  );
}
