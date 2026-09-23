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
  const [loading, setLoading] = useState(true);

  // Fetch entries from server
  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/entries');
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
  }, [fetchEntries]);

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

  // Reprocess existing entry
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
      console.error('Reprocess error:', err);
    }
  };

  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    try {
      await fetch(`/api/entries/${entryId}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== entryId));
      if (latestCapturedEntry?.id === entryId) {
        setLatestCapturedEntry(null);
      }
    } catch (err) {
      console.error('Delete entry error:', err);
    }
  };

  // Update extracted object
  const handleUpdateObject = async (id: string, updates: Partial<ExtractedObject>) => {
    // Optimistic local update
    setEntries(prev =>
      prev.map(entry => {
        if (!entry.objects) return entry;
        const updatedObjs = entry.objects.map(obj =>
          obj.id === id ? { ...obj, ...updates } : obj
        );
        return { ...entry, objects: updatedObjs };
      })
    );

    try {
      await fetch(`/api/objects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Update object error:', err);
      fetchEntries(); // Revert on failure
    }
  };

  // Delete extracted object
  const handleDeleteObject = async (id: string) => {
    // Optimistic local update
    setEntries(prev =>
      prev.map(entry => {
        if (!entry.objects) return entry;
        return {
          ...entry,
          objects: entry.objects.filter(obj => obj.id !== id),
        };
      })
    );

    try {
      await fetch(`/api/objects/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Delete object error:', err);
      fetchEntries();
    }
  };

  // Compute pending tasks count across all entries
  const pendingTasksCount = entries.reduce((count, entry) => {
    const activeTasks = (entry.objects || []).filter(
      o => o.type === 'task' && o.status !== 'completed' && o.status !== 'dismissed'
    );
    return count + activeTasks.length;
  }, 0);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans pb-20 sm:pb-10 selection:bg-indigo-500/30 selection:text-white">
      {/* Top Navigation */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingTasksCount={pendingTasksCount}
        totalEntriesCount={entries.length}
        onOpenInsights={() => setIsInsightsOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-6 sm:pt-8">
        {currentTab === 'capture' && (
          <CaptureView
            onCapture={handleCapture}
            onUpdateObject={handleUpdateObject}
            onDeleteObject={handleDeleteObject}
            onSelectTab={setCurrentTab}
            latestCapturedEntry={latestCapturedEntry}
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
            onInspectEntry={(entryId) => {
              setCurrentTab('inbox');
            }}
          />
        )}
      </main>

      {/* Insights / Meta-patterns & Export Modal */}
      <InsightsModal
        isOpen={isInsightsOpen}
        onClose={() => setIsInsightsOpen(false)}
        onRefreshEntries={fetchEntries}
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
}
