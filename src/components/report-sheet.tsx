'use client';

import { useState } from 'react';

import { PrimaryButton } from './primary-button';
import { TextAreaField } from './text-area-field';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';

type Props = {
  targetLabel: string;
  pending?: boolean;
  onSubmit: (reason: string) => Promise<void> | void;
};

export function ReportSheet({ targetLabel, pending, onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="min-h-11 px-2 text-xs">
          Report
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Report {targetLabel}</SheetTitle>
          <p className="text-sm text-[rgb(var(--muted))]">
            Quiet moderation. Reports are private and reviewed by trust-weighted rules.
          </p>
        </SheetHeader>

        <TextAreaField
          label="Reason"
          value={reason}
          onChange={setReason}
          minRows={4}
          maxLength={600}
          placeholder="Describe the issue clearly."
          required
        />

        {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}

        <div className="mt-4 flex gap-2">
          <PrimaryButton className="flex-1" tone="neutral" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </PrimaryButton>
          <PrimaryButton
            className="flex-1"
            tone="danger"
            disabled={pending}
            onClick={async () => {
              const trimmed = reason.trim();
              if (trimmed.length < 8) {
                setError('Reason must be at least 8 characters.');
                return;
              }
              setError(null);
              await onSubmit(trimmed);
              setReason('');
              setOpen(false);
            }}
          >
            {pending ? 'Submitting...' : 'Submit Report'}
          </PrimaryButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}
