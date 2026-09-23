import React, { useState, useEffect, useCallback } from 'react';
import { Navigation } from './components/Navigation.tsx';
import { CaptureView } from './components/CaptureView.tsx';
import { TodayView } from './components/TodayView.tsx';
import { InboxView } from './components/InboxView.tsx';
import { MemoryView } from './components/MemoryView.tsx';
import { InsightsModal } from './components/InsightsModal.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { Entry, ExtractedObject } from './types/index.ts';
import { 
  getBrowserSupabaseCredentials, 
  testBrowserSupabase,
  fetchEntriesFromBrowserSupabase,
  saveEntryToBrowserSupabase,
  updateObjectInBrowserSupabase,
  deleteObjectInBrowserSupabase,
  deleteEntryInBrowserSupabase
} from './lib/browserSupabase.ts';
import { parseThoughtClientSide } from './lib/clientParser.ts';

const LOCAL_STORAGE_ENTRIES_KEY = 'aetheria_cached_entries';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'capture' | 'today' | 'inbox' | 'memory'>('capture');
  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ENTRIES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [latestCapturedEntry, setLatestCapturedEntry] = useState<Entry | null>(null);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [insightsModalTab, setInsightsModalTab] = useState<'insights' | 'database'>('insights');
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync entries to localStorage for offline resilience
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_ENTRIES_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error('Failed to cache entries to localStorage:', e);
    }
  }, [entries]);

  // Check Supabase status (both server API and browser-direct)
  const checkSupabaseStatus = useCallback(async () => {
    // 1. Try server API first
    try {
      const res = await fetch(`/api/supabase/status?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.connected) {
          setIsSupabaseConnected(true);
          return;
        }
      }
    } catch {
      // Backend unavailable or running as static host (e.g. Vercel)
    }

    // 2. Try browser-direct Supabase connection
    const creds = getBrowserSupabaseCredentials();
    if (creds?.url && creds?.key) {
      try {
        const result = await testBrowserSupabase(creds.url, creds.key);
        setIsSupabaseConnected(result.connected);
      } catch {
        setIsSupabaseConnected(false);
      }
    } else {
      setIsSupabaseConnected(false);
    }
  }, []);

  // Fetch entries from server or direct from Supabase
  const fetchEntries = useCallback(async () => {
    setLoading(true);

    // 1. Attempt fetching from Node server API
    let serverFetched = false;
    try {
      const res = await fetch(`/api/entries?_t=${Date.now()}`, { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.entries)) {
          setEntries(data.entries);
          serverFetched = true;
        }
      }
    } catch {
      // Server not reachable
    }

    // 2. If server not reachable (e.g. Vercel static deployment), fetch directly from Supabase
    if (!serverFetched) {
      const supabaseEntries = await fetchEntriesFromBrowserSupabase();
      if (supabaseEntries && supabaseEntries.length > 0) {
        setEntries(supabaseEntries);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
    checkSupabaseStatus();
  }, [fetchEntries, checkSupabaseStatus]);

  // Capture thought (server API with seamless client-side + Supabase fallback)
  const handleCapture = async (rawText: string): Promise<{ entry: Entry; summary?: string } | null> => {
    const trimmed = rawText.trim();
    if (!trimmed) return null;

    // 1. Try server API
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: trimmed,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const newEntry = data.entry;
        setEntries(prev => [newEntry, ...prev.filter(e => e.id !== newEntry.id)]);
        setLatestCapturedEntry(newEntry);
        return { entry: newEntry, summary: data.summary };
      }
    } catch {
      // Fall through to client-side fallback
    }

    // 2. Client-side fallback (for Vercel static deployment)
    const now = new Date();
    const entryId = crypto.randomUUID();
    const userId = '00000000-0000-0000-0000-000000000001';

    const parsed = parseThoughtClientSide(trimmed);
    const extractedObjects: ExtractedObject[] = parsed.objects.map(o => ({
      id: crypto.randomUUID(),
      entry_id: entryId,
      user_id: userId,
      type: o.type,
      title: o.title,
      description: o.description || null,
      status: o.status || 'pending',
      confidence: o.confidence,
      due_at: o.due_at || null,
      date_precision: o.date_precision || null,
      original_date_phrase: o.original_date_phrase || null,
      metadata: {},
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }));

    const clientEntry: Entry = {
      id: entryId,
      user_id: userId,
      raw_text: trimmed,
      cleaned_text: parsed.cleaned_text,
      source: 'manual',
      status: 'complete',
      parser_version: 'v1.0.0-client',
      schema_version: 1,
      model_name: 'client-nlp',
      processing_error: null,
      created_at: now.toISOString(),
      processed_at: now.toISOString(),
      objects: extractedObjects,
    };

    // Save directly to Supabase if connected
    saveEntryToBrowserSupabase(clientEntry, extractedObjects).catch(err => {
      console.warn('Direct Supabase save noticed:', err);
    });

    setEntries(prev => [clientEntry, ...prev.filter(e => e.id !== clientEntry.id)]);
    setLatestCapturedEntry(clientEntry);

    const taskCount = extractedObjects.filter(o => o.type === 'task').length;
    const summary = taskCount > 0 
      ? `Extracted ${taskCount} task${taskCount === 1 ? '' : 's'} directly into your memory.`
      : `Captured and structured into your memory.`;

    return { entry: clientEntry, summary };
  };

  // Reprocess entry
  const handleReprocess = async (entryId: string) => {
    try {
      const res = await fetch(`/api/entries/${entryId}/reprocess`, {
        method: 'POST',
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setEntries(prev => prev.map(e => (e.id === entryId ? data.entry : e)));
        if (latestCapturedEntry?.id === entryId) {
          setLatestCapturedEntry(data.entry);
        }
        return;
      }
    } catch {
      // Reprocess on client if server not reachable
    }

    const target = entries.find(e => e.id === entryId);
    if (target) {
      const parsed = parseThoughtClientSide(target.raw_text);
      const newObjs: ExtractedObject[] = parsed.objects.map(o => ({
        id: crypto.randomUUID(),
        entry_id: target.id,
        user_id: target.user_id,
        type: o.type,
        title: o.title,
        description: o.description || null,
        status: o.status || 'pending',
        confidence: o.confidence,
        due_at: o.due_at || null,
        date_precision: o.date_precision || null,
        original_date_phrase: o.original_date_phrase || null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const updated = {
        ...target,
        status: 'complete' as const,
        cleaned_text: parsed.cleaned_text,
        objects: newObjs,
        processed_at: new Date().toISOString(),
      };

      saveEntryToBrowserSupabase(updated, newObjs).catch(() => {});
      setEntries(prev => prev.map(e => (e.id === entryId ? updated : e)));
      if (latestCapturedEntry?.id === entryId) setLatestCapturedEntry(updated);
    }
  };

  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    try {
      await fetch(`/api/entries/${entryId}`, { method: 'DELETE' });
    } catch {
      // Ignore network errors
    }
    deleteEntryInBrowserSupabase(entryId).catch(() => {});
    setEntries(prev => prev.filter(e => e.id !== entryId));
    if (latestCapturedEntry?.id === entryId) {
      setLatestCapturedEntry(null);
    }
  };

  // Update object
  const handleUpdateObject = async (objectId: string, updates: Partial<ExtractedObject>) => {
    try {
      await fetch(`/api/objects/${objectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch {
      // Ignore network errors
    }

    updateObjectInBrowserSupabase(objectId, updates).catch(() => {});

    setEntries(prev =>
      prev.map(entry => ({
        ...entry,
        objects: (entry.objects || []).map(obj =>
          obj.id === objectId ? { ...obj, ...updates, updated_at: new Date().toISOString() } : obj
        ),
      }))
    );

    if (latestCapturedEntry) {
      setLatestCapturedEntry({
        ...latestCapturedEntry,
        objects: (latestCapturedEntry.objects || []).map(obj =>
          obj.id === objectId ? { ...obj, ...updates, updated_at: new Date().toISOString() } : obj
        ),
      });
    }
  };

  // Delete object
  const handleDeleteObject = async (objectId: string) => {
    try {
      await fetch(`/api/objects/${objectId}`, { method: 'DELETE' });
    } catch {
      // Ignore network errors
    }

    deleteObjectInBrowserSupabase(objectId).catch(() => {});

    setEntries(prev =>
      prev.map(entry => ({
        ...entry,
        objects: (entry.objects || []).filter(obj => obj.id !== objectId),
      }))
    );

    if (latestCapturedEntry) {
      setLatestCapturedEntry({
        ...latestCapturedEntry,
        objects: (latestCapturedEntry.objects || []).filter(obj => obj.id !== objectId),
      });
    }
  };

  // Count pending tasks
  const pendingTasksCount = entries.reduce((acc, entry) => {
    const tasks = (entry.objects || []).filter(
      o => o.type === 'task' && o.status === 'pending'
    );
    return acc + tasks.length;
  }, 0);

  const openInsights = (tab: 'insights' | 'database' = 'insights') => {
    setInsightsModalTab(tab);
    setIsInsightsOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-[#e2e8f0] flex flex-col font-sans pb-16 sm:pb-0">
      {/* Top Header & Navigation */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingTasksCount={pendingTasksCount}
        totalEntriesCount={entries.length}
        onOpenInsights={() => openInsights('insights')}
        isSupabaseConnected={isSupabaseConnected}
        onOpenSupabase={() => openInsights('database')}
      />

      {/* Main Surface */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {currentTab === 'capture' && (
          <CaptureView
            onCapture={handleCapture}
            latestCapturedEntry={latestCapturedEntry}
            onUpdateObject={handleUpdateObject}
            onDeleteObject={handleDeleteObject}
            onSelectTab={setCurrentTab}
          />
        )}

        {currentTab === 'today' && (
          <TodayView
            onUpdateObject={handleUpdateObject}
            onDeleteObject={handleDeleteObject}
            onSelectTab={setCurrentTab}
          />
        )}

        {currentTab === 'inbox' && (
          <InboxView
            entries={entries}
            onReprocess={handleReprocess}
            onDeleteEntry={handleDeleteEntry}
            onUpdateObject={handleUpdateObject}
            onDeleteObject={handleDeleteObject}
          />
        )}

        {currentTab === 'memory' && (
          <MemoryView
            onInspectEntry={(_entryId) => {
              setCurrentTab('inbox');
            }}
          />
        )}
      </main>

      {/* Insights / Meta-patterns & Supabase Database Modal */}
      <InsightsModal
        isOpen={isInsightsOpen}
        onClose={() => setIsInsightsOpen(false)}
        onRefreshEntries={fetchEntries}
        initialTab={insightsModalTab}
        onSupabaseStatusChange={(connected) => setIsSupabaseConnected(connected)}
        localEntries={entries}
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
}
