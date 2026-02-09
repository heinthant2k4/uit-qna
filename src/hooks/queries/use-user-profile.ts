'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchUserProfile } from '../../lib/qna/data';
import { qnaKeys } from '../../lib/qna/query-keys';
import { getBrowserSupabaseClient } from '../../lib/supabase/browser';

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: qnaKeys.profile(),
    queryFn: async () => {
      const client = getBrowserSupabaseClient();
      return fetchUserProfile(client, userId);
    },
    enabled: Boolean(userId),
  });
}

