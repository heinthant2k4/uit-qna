import { AppShell } from '../../components/app-shell';
import { LoadingList } from '../../components/loading-list';

export default function SearchLoading() {
  return (
    <AppShell nav="search" title="Search Questions">
      <LoadingList />
    </AppShell>
  );
}

