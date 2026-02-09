import Link from 'next/link';

import { AppShell } from '../components/app-shell';
import { EmptyState } from '../components/empty-state';
import { PrimaryButton } from '../components/primary-button';

export default function NotFound() {
  return (
    <AppShell nav="home" title="Not found" subtitle="This page may be hidden or no longer available">
      <EmptyState title="Content not found" description="This question may have been hidden or removed." />
      <div className="mt-4">
        <Link href="/">
          <PrimaryButton className="w-full">Back to feed</PrimaryButton>
        </Link>
      </div>
    </AppShell>
  );
}
