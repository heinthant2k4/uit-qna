import { AppShell } from '../../../components/app-shell';
import { QuestionDetailSkeleton } from '../../../components/question-detail-skeleton';

export default function LoadingQuestion() {
  return (
    <AppShell nav="home" title="Question" subtitle="Loading">
      <QuestionDetailSkeleton />
    </AppShell>
  );
}
