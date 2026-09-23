import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export async function checkSupabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  tablesReady: boolean;
  url?: string;
  error?: string;
}> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return {
      configured: false,
      connected: false,
      tablesReady: false,
      error: 'Environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are not set.',
    };
  }

  // Masked URL for display
  let maskedUrl = url;
  try {
    const parsed = new URL(url);
    maskedUrl = `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    maskedUrl = url.substring(0, 15) + '...';
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      configured: true,
      connected: false,
      tablesReady: false,
      url: maskedUrl,
      error: 'Failed to initialize Supabase client with provided credentials.',
    };
  }

  try {
    // Test query to entries table
    const { data, error } = await client.from('entries').select('id').limit(1);

    if (error) {
      // Check if it's a table not found error
      const isMissingTable =
        error.code === '42P01' || // PostgreSQL undefined_table
        error.message?.includes('relation "entries" does not exist') ||
        error.message?.includes('does not exist');

      return {
        configured: true,
        connected: true, // Connected to DB, but schema not yet migrated
        tablesReady: !isMissingTable,
        url: maskedUrl,
        error: isMissingTable
          ? 'Connected to Supabase, but the "entries" table was not found. Please run the SQL migration in your Supabase SQL Editor.'
          : error.message,
      };
    }

    return {
      configured: true,
      connected: true,
      tablesReady: true,
      url: maskedUrl,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      tablesReady: false,
      url: maskedUrl,
      error: err?.message || 'Could not connect to Supabase database.',
    };
  }
}
