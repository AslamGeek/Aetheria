import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

let supabaseClient: SupabaseClient | null = null;
const CONFIG_FILE = path.resolve(process.cwd(), 'data', 'supabase_config.json');

export function getSupabaseCredentials(): { url: string | null; key: string | null } {
  // Check process.env first
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || null;

  // Fallback to local config file if saved via UI
  if ((!url || !key) && fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (data.url && data.key) {
        url = data.url;
        key = data.key;
      }
    } catch (e) {
      console.error('Error reading supabase_config.json:', e);
    }
  }

  return {
    url: url ? url.trim() : null,
    key: key ? key.trim() : null,
  };
}

export function resetSupabaseClient(): void {
  supabaseClient = null;
}

export function saveSupabaseCredentials(url: string, key: string): void {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ url: url.trim(), key: key.trim() }, null, 2), 'utf-8');
  resetSupabaseClient();
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const { url, key } = getSupabaseCredentials();

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
  const { url, key } = getSupabaseCredentials();

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

  resetSupabaseClient();
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
