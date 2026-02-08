import { AppShell } from '../components/app-shell';
import { LoadingList } from '../components/loading-list';

export default function Loading() {
  return (
    <AppShell nav="home" title="Loading">
      <LoadingList />
    </AppShell>
  );
}

