'use client';

import { formatFileSize } from '../lib/utils/format';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

type Props = {
  id: string;
  label: string;
  files: File[];
  disabled?: boolean;
  maxFiles: number;
  error?: string | null;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
};

export function ImageUploadField({
  id,
  label,
  files,
  disabled,
  maxFiles,
  error,
  onAddFiles,
  onRemoveFile,
}: Props) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      <Input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        disabled={disabled}
        onChange={(event) => {
          const selected = Array.from(event.currentTarget.files ?? []);
          if (selected.length) onAddFiles(selected);
          event.currentTarget.value = '';
        }}
        className="block w-full file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-neutral-100 file:px-3 file:text-xs file:font-semibold dark:file:bg-neutral-800"
      />

      <p className="text-xs text-neutral-500 dark:text-neutral-400">Up to {maxFiles} images. Converted to WEBP automatically.</p>

      {error ? <p className="text-xs text-rose-700">{error}</p> : null}

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <Card>
                <CardContent className="flex items-center justify-between p-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-100">{file.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatFileSize(file.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onRemoveFile(index)}
                    className={cn('text-xs')}
                  >
                    Remove
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
