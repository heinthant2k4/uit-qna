import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import type { Metadata } from 'next';

import { ProfileView } from '../_views/profile-view';
import { fetchUserAnswers, fetchUserProfile, fetchUserQuestions } from '../../lib/qna/data';
import { qnaKeys } from '../../lib/qna/query-keys';
import { createUserServerClient } from '../../lib/supabase/server';

export const metadata: Metadata = {
  title: 'Profile',
};

export default async function ProfilePage() {
  const supabase = await createUserServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? '';
  const queryClient = new QueryClient();

  if (userId) {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: qnaKeys.profile(),
        queryFn: () => fetchUserProfile(supabase, userId),
      }),
      queryClient.prefetchQuery({
        queryKey: qnaKeys.profileQuestions(1),
        queryFn: () => fetchUserQuestions(supabase, userId, 1),
      }),
      queryClient.prefetchQuery({
        queryKey: qnaKeys.profileAnswers(1),
        queryFn: () => fetchUserAnswers(supabase, userId, 1),
      }),
    ]);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProfileView userId={userId} />
    </HydrationBoundary>
  );
}

