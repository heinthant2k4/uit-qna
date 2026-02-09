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
import { useIdentityGate } from '../../components/providers/identity-gate-provider';
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
  const { requireIdentity } = useIdentityGate();

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
    'Has anyone experienced…',
    'Is it normal that…',
    'What should we do when…',
  ];

  return (
    <AppShell nav="ask" title="Ask a question" subtitle="Clear questions receive better answers">
      <div className="flex gap-6">
        {/* Main form column */}
        <div className="min-w-0 flex-1 space-y-4">
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await requireIdentity(
                async () => {
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
                    setFormError(error instanceof Error ? error.message : 'Couldn\'t create question');
                  }
                },
                { reason: 'ask' },
              );
            }}
          >
            <Card className="fade-in">
              <CardHeader className="pb-0">
                <CardTitle>New question</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {category !== 'academic' ? (
                  <div className="space-y-2">
                    <p className="text-caption text-[rgb(var(--muted))]">Suggested starters</p>
                    <div className="flex flex-wrap gap-2">
                      {experienceTemplates.map((template) => (
                        <Button
                          key={template}
                          type="button"
                          variant="outline"
                          className="text-caption"
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
                    placeholder="how does the grading curve work?"
                  />
                </div>

                <TextAreaField
                  label="Body"
                  value={body}
                  onChange={setBody}
                  minRows={6}
                  placeholder="add context, what you've tried, and any constraints"
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
                    placeholder="e.g. econometrics, library-hours, deferral-policy"
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
                    className="flex min-h-[44px] w-full rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 text-body-sm text-[rgb(var(--fg))] outline-none focus-visible:border-[rgb(var(--accent))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <option value="academic">Academic</option>
                    <option value="facilities">Facilities</option>
                    <option value="policy">Policy</option>
                  </select>
                </div>

                {formError ? <p role="alert" className="text-body-sm text-[rgb(var(--negative))]">{formError}</p> : null}

                <Button type="submit" variant="cta" className="w-full" disabled={createQuestionMutation.isPending}>
                  {createQuestionMutation.isPending ? 'Submitting…' : 'Post question'}
                </Button>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Right sidebar — desktop only */}
        <aside className="hidden w-[260px] shrink-0 space-y-4 lg:block">
          <Card className="fade-in">
            <CardHeader className="pb-0">
              <CardTitle className="text-body-sm">Similar questions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              {similarQuestions.isLoading ? (
                <p className="mt-2 text-body-sm text-[rgb(var(--muted))]">Checking…</p>
              ) : null}

              {similarQuestions.data && similarQuestions.data.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {similarQuestions.data.map((question) => (
                    <Link
                      key={question.id}
                      href={`/q/${question.public_id}`}
                      className="block rounded-xl border border-[rgb(var(--line))] p-3 text-body-sm text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))] transition-colors"
                    >
                      <p className="font-medium">{question.title}</p>
                      <p className="mt-1 text-caption text-[rgb(var(--muted))]">{question.answer_count} answers</p>
                    </Link>
                  ))}
                </div>
              ) : null}

              {title.trim().length >= 8 && similarQuestions.data?.length === 0 && !similarQuestions.isLoading ? (
                <div className="mt-2">
                  <EmptyState title="No close matches" description="Your question looks new. Ready to post?" />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="fade-in">
            <CardHeader className="pb-0">
              <CardTitle className="text-body-sm">Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-4 md:p-5 text-caption text-[rgb(var(--muted))]">
              <p>Be specific about context and steps already tried</p>
              <p>Keep personal experiences calm and factual</p>
              <p>Include only details needed to answer</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Similar questions + guidelines shown below form on mobile */}
      <div className="mt-4 space-y-4 lg:hidden">
        <Card className="fade-in">
          <CardHeader className="pb-0">
            <CardTitle>Similar questions</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-5">
            {similarQuestions.isLoading ? (
              <p className="mt-2 text-body-sm text-[rgb(var(--muted))]">Checking…</p>
            ) : null}

            {similarQuestions.data && similarQuestions.data.length > 0 ? (
              <div className="mt-2 space-y-2">
                {similarQuestions.data.map((question) => (
                  <Link
                    key={question.id}
                    href={`/q/${question.public_id}`}
                    className="block rounded-xl border border-[rgb(var(--line))] p-3 text-body-sm text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))] transition-colors"
                  >
                    <p className="font-medium">{question.title}</p>
                    <p className="mt-1 text-caption text-[rgb(var(--muted))]">{question.answer_count} answers</p>
                  </Link>
                ))}
              </div>
            ) : null}

            {title.trim().length >= 8 && similarQuestions.data?.length === 0 && !similarQuestions.isLoading ? (
              <div className="mt-2">
                <EmptyState title="No close matches" description="Your question looks new. Ready to post?" />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="fade-in">
          <CardHeader className="pb-0">
            <CardTitle>Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-4 md:p-5 text-body-sm text-[rgb(var(--muted))]">
            <p>Be specific about context and steps already tried</p>
            <p>Keep personal experiences calm and factual</p>
            <p>Include only details needed to answer</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
