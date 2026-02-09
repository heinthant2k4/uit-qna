import { AppShell } from '../../components/app-shell';
import { LoadingList } from '../../components/loading-list';

export default function RecoverLoading() {
  return (
    <AppShell nav="home" title="Recover session" subtitle="Loading">
      <LoadingList count={2} />
    </AppShell>
  );
}
