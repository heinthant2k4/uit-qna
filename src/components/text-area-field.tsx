'use client';

import { useId, useRef } from 'react';

import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

type Props = {
  label: string;
  value: string;
  minRows?: number;
  maxLength?: number;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  required?: boolean;
};

function resize(target: HTMLTextAreaElement) {
  target.style.height = 'auto';
  target.style.height = `${target.scrollHeight}px`;
}

export function TextAreaField({
  label,
  value,
  onChange,
  minRows = 4,
  maxLength,
  placeholder,
  required,
}: Props) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        ref={ref}
        value={value}
        rows={minRows}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        onInput={(event) => resize(event.currentTarget)}
        onChange={(event) => {
          onChange(event.currentTarget.value);
          if (ref.current) resize(ref.current);
        }}
        className="resize-none leading-relaxed"
      />
      {maxLength ? (
        <p className="text-right text-caption text-[rgb(var(--muted))]">
          {value.length}/{maxLength}
        </p>
      ) : null}
    </div>
  );
}
