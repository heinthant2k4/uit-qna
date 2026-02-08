'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requiredPublicEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(
    requiredPublicEnv(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL'),
    requiredPublicEnv(supabaseAnonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  );

  return browserClient;
}
