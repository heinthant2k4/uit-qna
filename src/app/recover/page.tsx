import type { Metadata } from 'next';

import { RecoverAccountView } from '../_views/recover-account-view';

export const metadata: Metadata = {
  title: 'Recover session',
};

export default function RecoverPage() {
  return <RecoverAccountView />;
}
