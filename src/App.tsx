import React, { useState, useEffect, useCallback } from 'react';
import { Navigation } from './components/Navigation.tsx';
import { CaptureView } from './components/CaptureView.tsx';
import { TodayView } from './components/TodayView.tsx';
import { InboxView } from './components/InboxView.tsx';
import { MemoryView } from './components/MemoryView.tsx';
import { InsightsModal } from './components/InsightsModal.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { Entry, ExtractedObject } from './types/index.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'capture' | 'today' | 'inbox' | 'memory'>('capture');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [latestCapturedEntry, setLatestCapturedEntry] = useState<Entry | null>(null);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [insightsModalTab, setInsightsModalTab] = useState<'insights' | 'database'>('insights');
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check Supabase connection on load
  const checkSupabaseStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/supabase/status?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setIsSupabaseConnected(!!data.connected);
      }
    } catch (err) {
      console.error('Failed to check Supabase status:', err);
    }
  }, []);

  // Fetch entries from server
  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/entries?_t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to fetch entries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    checkSupabaseStatus();
  }, [fetchEntries, checkSupabaseStatus]);

  // Capture thought
  const handleCapture = async (rawText: string): Promise<{ entry: Entry; summary?: string } | null> => {
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newEntry = data.entry;
        // Update local entries list
        setEntries(prev => [newEntry, ...prev.filter(e => e.id !== newEntry.id)]);
        setLatestCapturedEntry(newEntry);
        return { entry: newEntry, summary: data.summary };
      }
      return null;
    } catch (err) {
      console.error('Error in handleCapture:', err);
      return null;
    }
  };

  // Reprocess entry
  const handleReprocess = async (entryId: string) => {
    try {
      const res = await fetch(`/api/entries/${entryId}/reprocess`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(prev => prev.map(e => (e.id === entryId ? data.entry : e)));
        if (latestCapturedEntry?.id === entryId) {
          setLatestCapturedEntry(data.entry);
        }
      }
    } catch (err) {
      console.error('Error reprocessing entry:', err);
    }
  };

  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    try {
      const res = await fetch(`/api/entries/${entryId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.id !== entryId));
        if (latestCapturedEntry?.id === entryId) {
          setLatestCapturedEntry(null);
        }
      }
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  };

  // Update object
  const handleUpdateObject = async (objectId: string, updates: Partial<ExtractedObject>) => {
    try {
      const res = await fetch(`/api/objects/${objectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.object;
        // Update in state
        setEntries(prev =>
          prev.map(entry => ({
            ...entry,
            objects: (entry.objects || []).map(obj =>
              obj.id === objectId ? { ...obj, ...updated } : obj
            ),
          }))
        );

        if (latestCapturedEntry) {
          setLatestCapturedEntry({
            ...latestCapturedEntry,
            objects: (latestCapturedEntry.objects || []).map(obj =>
              obj.id === objectId ? { ...obj, ...updated } : obj
            ),
          });
        }
      }
    } catch (err) {
      console.error('Error updating object:', err);
    }
  };

  // Delete object
  const handleDeleteObject = async (objectId: string) => {
    try {
      const res = await fetch(`/api/objects/${objectId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
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
      }
    } catch (err) {
      console.error('Error deleting object:', err);
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
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
}
