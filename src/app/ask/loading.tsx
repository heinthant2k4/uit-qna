import { AppShell } from '../../components/app-shell';
import { LoadingList } from '../../components/loading-list';

export default function AskLoading() {
  return (
    <AppShell nav="ask" title="Ask a Question">
      <LoadingList count={1} />
    </AppShell>
  );
}

