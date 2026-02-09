import type { Metadata } from 'next';

import { AskQuestionView } from '../_views/ask-question-view';

export const metadata: Metadata = {
  title: 'Ask a question',
};

export default function AskPage() {
  return <AskQuestionView />;
}

