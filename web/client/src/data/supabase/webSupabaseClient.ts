import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@delivery-contract/database.types';

let cachedClient: SupabaseClient<Database> | null = null;

function getRequiredEnvironmentValue(name: string, value: string | undefined): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`إعداد Supabase ناقص: أضف ${name} إلى ملف web/.env المحلي.`);
  }

  return normalizedValue;
}

/**
 * The only browser Supabase client for the web app.
 * The browser's default localStorage persists the session; no service role key is ever used here.
 */
export function getWebSupabaseClient(): SupabaseClient<Database> {
  if (!cachedClient) {
    const url = getRequiredEnvironmentValue('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
    const publishableKey = getRequiredEnvironmentValue(
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    );

    cachedClient = createClient<Database>(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return cachedClient;
}
