import { AppShell } from '../../components/app-shell';
import { LoadingList } from '../../components/loading-list';

export default function AskLoading() {
  return (
    <AppShell nav="ask" title="Ask a question" subtitle="Loading">
      <LoadingList count={1} />
    </AppShell>
  );
}
