import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Entry, ExtractedObject, Entity } from '../types/index.ts';

const STORAGE_KEY = 'aetheria_supabase_config';
const LOCAL_ENTRIES_KEY = 'aetheria_local_entries';

export interface StoredSupabaseConfig {
  url: string;
  key: string;
}

let cachedBrowserClient: SupabaseClient | null = null;

/**
 * Get credentials from localStorage or Vite environment variables
 */
export function getBrowserSupabaseCredentials(): StoredSupabaseConfig | null {
  if (typeof window === 'undefined') return null;

  // 1. Check localStorage first
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.url && parsed.key) {
        return { url: parsed.url.trim(), key: parsed.key.trim() };
      }
    }
  } catch (e) {
    console.error('Error reading localStorage for supabase credentials:', e);
  }

  // 2. Check import.meta.env
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_KEY;
  if (envUrl && envKey) {
    return { url: envUrl.trim(), key: envKey.trim() };
  }

  return null;
}

/**
 * Save credentials to localStorage
 */
export function saveBrowserSupabaseCredentials(url: string, key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
  cachedBrowserClient = null;
}

/**
 * Clear credentials from localStorage
 */
export function clearBrowserSupabaseCredentials(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  cachedBrowserClient = null;
}

/**
 * Get or create browser Supabase client
 */
export function getBrowserSupabaseClient(): SupabaseClient | null {
  if (cachedBrowserClient) return cachedBrowserClient;

  const creds = getBrowserSupabaseCredentials();
  if (!creds?.url || !creds?.key) return null;

  try {
    cachedBrowserClient = createClient(creds.url, creds.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return cachedBrowserClient;
  } catch (err) {
    console.error('Failed to create browser Supabase client:', err);
    return null;
  }
}

/**
 * Test Supabase connection directly from the browser
 */
export async function testBrowserSupabase(
  urlInput?: string,
  keyInput?: string
): Promise<{
  configured: boolean;
  connected: boolean;
  tablesReady: boolean;
  url?: string;
  error?: string;
}> {
  const url = urlInput || getBrowserSupabaseCredentials()?.url;
  const key = keyInput || getBrowserSupabaseCredentials()?.key;

  if (!url || !key) {
    return {
      configured: false,
      connected: false,
      tablesReady: false,
      error: 'Supabase URL and Key are required.',
    };
  }

  let maskedUrl = url;
  try {
    const parsed = new URL(url);
    maskedUrl = `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    maskedUrl = url.substring(0, 20) + '...';
  }

  try {
    const testClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Test query entries table
    const { data, error } = await testClient.from('entries').select('id').limit(1);

    if (error) {
      const isMissingTable =
        error.code === '42P01' ||
        error.message?.includes('relation "entries" does not exist') ||
        error.message?.includes('does not exist');

      return {
        configured: true,
        connected: true, // Able to contact PostgreSQL
        tablesReady: !isMissingTable,
        url: maskedUrl,
        error: isMissingTable
          ? 'Connected to Supabase! However, the tables are not yet created. Please copy and run the SQL migration below in your Supabase SQL Editor.'
          : error.message,
      };
    }

    // Success! Save verified credentials
    saveBrowserSupabaseCredentials(url, key);

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
      error: err?.message || 'Could not reach Supabase from the browser. Please check your URL and Key.',
    };
  }
}

// ============================================================
// Direct Browser CRUD for Supabase (Used on Vercel / Static hosts)
// ============================================================

export async function fetchEntriesFromBrowserSupabase(): Promise<Entry[] | null> {
  const client = getBrowserSupabaseClient();
  if (!client) return null;

  try {
    const { data: entriesData, error: entriesErr } = await client
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (entriesErr || !entriesData) return null;

    const { data: objectsData } = await client
      .from('objects')
      .select('*')
      .order('created_at', { ascending: false });

    const objectsByEntry: Record<string, ExtractedObject[]> = {};
    if (objectsData) {
      for (const obj of objectsData) {
        if (!objectsByEntry[obj.entry_id]) {
          objectsByEntry[obj.entry_id] = [];
        }
        objectsByEntry[obj.entry_id].push(obj as ExtractedObject);
      }
    }

    const entries: Entry[] = entriesData.map((e: any) => ({
      ...e,
      objects: objectsByEntry[e.id] || [],
    }));

    return entries;
  } catch (err) {
    console.error('Error fetching from browser Supabase:', err);
    return null;
  }
}

export async function saveEntryToBrowserSupabase(
  entry: Entry,
  objects: ExtractedObject[]
): Promise<boolean> {
  const client = getBrowserSupabaseClient();
  if (!client) return false;

  try {
    const { error: entryErr } = await client.from('entries').upsert({
      id: entry.id,
      user_id: entry.user_id,
      raw_text: entry.raw_text,
      cleaned_text: entry.cleaned_text,
      source: entry.source || 'manual',
      status: entry.status,
      parser_version: entry.parser_version,
      schema_version: entry.schema_version,
      model_name: entry.model_name,
      processing_error: entry.processing_error,
      created_at: entry.created_at,
      processed_at: entry.processed_at,
    });

    if (entryErr) {
      console.error('Error saving entry to Supabase:', entryErr);
      return false;
    }

    if (objects.length > 0) {
      const formattedObjects = objects.map(o => ({
        id: o.id,
        entry_id: entry.id,
        user_id: entry.user_id,
        type: o.type,
        title: o.title,
        description: o.description || null,
        status: o.status || 'pending',
        confidence: o.confidence ?? 1.0,
        due_at: o.due_at || null,
        date_precision: o.date_precision || null,
        original_date_phrase: o.original_date_phrase || null,
        metadata: o.metadata || {},
        created_at: o.created_at || new Date().toISOString(),
        updated_at: o.updated_at || new Date().toISOString(),
      }));

      const { error: objErr } = await client.from('objects').upsert(formattedObjects);
      if (objErr) {
        console.error('Error saving objects to Supabase:', objErr);
      }
    }

    return true;
  } catch (err) {
    console.error('Error saving to browser Supabase:', err);
    return false;
  }
}

export async function updateObjectInBrowserSupabase(
  objectId: string,
  updates: Partial<ExtractedObject>
): Promise<boolean> {
  const client = getBrowserSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('objects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', objectId);

    return !error;
  } catch (err) {
    console.error('Error updating object in Supabase:', err);
    return false;
  }
}

export async function deleteObjectInBrowserSupabase(objectId: string): Promise<boolean> {
  const client = getBrowserSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('objects').delete().eq('id', objectId);
    return !error;
  } catch (err) {
    console.error('Error deleting object in Supabase:', err);
    return false;
  }
}

export async function deleteEntryInBrowserSupabase(entryId: string): Promise<boolean> {
  const client = getBrowserSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('entries').delete().eq('id', entryId);
    return !error;
  } catch (err) {
    console.error('Error deleting entry in Supabase:', err);
    return false;
  }
}

export async function syncLocalEntriesToSupabase(entries: Entry[]): Promise<number> {
  const client = getBrowserSupabaseClient();
  if (!client || entries.length === 0) return 0;

  let count = 0;
  for (const entry of entries) {
    const success = await saveEntryToBrowserSupabase(entry, entry.objects || []);
    if (success) count++;
  }
  return count;
}
