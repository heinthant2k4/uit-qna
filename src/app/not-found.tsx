import Link from 'next/link';

import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { PrimaryButton } from '../components/primary-button';

export default function NotFound() {
  return (
    <AppShell nav="home" title="Not Found">
      <EmptyState title="Content not found" description="This question may be hidden or removed." />
      <div className="mt-4">
        <Link href="/">
          <PrimaryButton className="w-full">Back to Feed</PrimaryButton>
        </Link>
      </div>
    </AppShell>
  );
}

