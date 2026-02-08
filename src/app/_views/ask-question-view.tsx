'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { EmptyState } from '../../components/empty-state';
import { ImageUploadField } from '../../components/image-upload-field';
import { TagChip } from '../../components/tag-chip';
import { TextAreaField } from '../../components/text-area-field';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useCreateQuestionMutation } from '../../hooks/mutations/use-create-question-mutation';
import { useSimilarQuestions } from '../../hooks/queries/use-similar-questions';
import { deleteUploadedImages, uploadPostImages, validateImageFiles } from '../../lib/qna/image-upload';
import { MAX_IMAGES_PER_POST } from '../../lib/qna/images';

function normalizeTags(value: string): string[] {
  const unique = new Set<string>();

  value
    .split(',')
    .map((item) => item.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter((item) => item.length >= 2 && item.length <= 24)
    .forEach((item) => {
      if (unique.size < 3) unique.add(item);
    });

  return [...unique];
}

export function AskQuestionView() {
  const router = useRouter();
  const createQuestionMutation = useCreateQuestionMutation();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rawTags, setRawTags] = useState('');
  const [category, setCategory] = useState<'academic' | 'facilities' | 'policy'>('academic');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const tags = useMemo(() => normalizeTags(rawTags), [rawTags]);
  const similarQuestions = useSimilarQuestions(title);
  const experienceTemplates = [
    'Has anyone experienced',
    'Is it normal that',
    'What should we do when',
  ];

  return (
    <AppShell nav="ask" title="Ask a Question" subtitle="Anonymous, precise, and helpful">
      <div className="space-y-4">
        <div className="space-y-4">
          <Card className="md:hidden">
            <CardContent className="space-y-2 p-4 text-sm text-neutral-600 dark:text-neutral-300">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">Ask calmly and clearly.</p>
              <p>
                For experience questions, frame with: “Has anyone experienced…”, “Is it normal that…”, or “What should
                we do when…”.
              </p>
            </CardContent>
          </Card>

          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setFormError(null);
              setImageError(null);

              const imageValidation = validateImageFiles(imageFiles);
              if (imageValidation) {
                setImageError(imageValidation);
                return;
              }

              let uploadedPaths: string[] = [];

              try {
                uploadedPaths = await uploadPostImages('question', imageFiles);
                const result = await createQuestionMutation.mutateAsync({
                  title,
                  body,
                  tags,
                  category,
                  imagePaths: uploadedPaths,
                });
                router.push(`/q/${result.publicId}`);
              } catch (error) {
                if (uploadedPaths.length > 0) {
                  await deleteUploadedImages(uploadedPaths);
                }
                setFormError(error instanceof Error ? error.message : 'Could not create question.');
              }
            }}
          >
            <Card>
              <CardHeader className="pb-0">
                <CardTitle>Ask Question</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {category !== 'academic' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Experience framing templates</p>
                    <div className="flex flex-wrap gap-2">
                      {experienceTemplates.map((template) => (
                        <Button
                          key={template}
                          type="button"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            if (title.trim().length > 0) return;
                            setTitle(`${template} ...`);
                          }}
                        >
                          {template}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="question-title">Title</Label>
                  <Input
                    id="question-title"
                    value={title}
                    onChange={(event) => setTitle(event.currentTarget.value)}
                    placeholder="Describe the question clearly"
                  />
                </div>

                <TextAreaField
                  label="Body"
                  value={body}
                  onChange={setBody}
                  minRows={6}
                  placeholder="Include context, constraints, and what you already tried."
                />

                <ImageUploadField
                  id="question-images"
                  label="Images (optional)"
                  files={imageFiles}
                  maxFiles={MAX_IMAGES_PER_POST}
                  disabled={createQuestionMutation.isPending}
                  error={imageError}
                  onAddFiles={(added) => {
                    const next = [...imageFiles, ...added];
                    const validation = validateImageFiles(next);
                    if (validation) {
                      setImageError(validation);
                      return;
                    }
                    setImageError(null);
                    setImageFiles(next);
                  }}
                  onRemoveFile={(index) => {
                    setImageError(null);
                    setImageFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
                  }}
                />

                <div className="space-y-2">
                  <Label htmlFor="question-tags">Tags (max 3)</Label>
                  <Input
                    id="question-tags"
                    value={rawTags}
                    onChange={(event) => setRawTags(event.currentTarget.value)}
                    placeholder="e.g. calculus, hostel, exam-policy"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <TagChip key={tag} label={tag} />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="question-category">Category</Label>
                  <select
                    id="question-category"
                    value={category}
                    onChange={(event) => setCategory(event.currentTarget.value as typeof category)}
                    className="flex min-h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none ring-offset-white focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  >
                    <option value="academic">Academic</option>
                    <option value="facilities">Facilities</option>
                    <option value="policy">Policy</option>
                  </select>
                </div>

                {formError ? <p className="text-sm text-rose-700">{formError}</p> : null}

                <Button type="submit" className="w-full" disabled={createQuestionMutation.isPending}>
                  {createQuestionMutation.isPending ? 'Submitting...' : 'Post Question'}
                </Button>
              </CardContent>
            </Card>
          </form>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">Similar Questions</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {similarQuestions.isLoading ? (
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Checking similar posts...</p>
              ) : null}

              {similarQuestions.data && similarQuestions.data.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {similarQuestions.data.map((question) => (
                    <Link
                      key={question.id}
                      href={`/q/${question.public_id}`}
                      className="block rounded-xl border border-neutral-200 p-3 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
                    >
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">{question.title}</p>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{question.answer_count} answers</p>
                    </Link>
                  ))}
                </div>
              ) : null}

              {title.trim().length >= 8 && similarQuestions.data?.length === 0 && !similarQuestions.isLoading ? (
                <div className="mt-2">
                  <EmptyState title="No close matches" description="Your question appears new. Post when ready." />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">Posting Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-4 text-sm text-neutral-600 dark:text-neutral-300">
              <p>1. Be specific about context and what you tried.</p>
              <p>2. Keep experience questions factual, calm, and non-accusatory.</p>
              <p>3. Include only information needed to solve the issue.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
