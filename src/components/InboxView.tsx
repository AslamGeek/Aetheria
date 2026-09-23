import React, { useState } from 'react';
import { 
  RotateCw, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Filter,
  FileText,
  Lightbulb,
  CheckSquare,
  Scale
} from 'lucide-react';
import { Entry, ExtractedObject, ObjectType } from '../types/index.ts';
import { ObjectCard } from './ObjectCard.tsx';

interface InboxViewProps {
  entries: Entry[];
  onReprocess: (entryId: string) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onUpdateObject: (id: string, updates: Partial<ExtractedObject>) => void;
  onDeleteObject: (id: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  entries,
  onReprocess,
  onDeleteEntry,
  onUpdateObject,
  onDeleteObject,
}) => {
  const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, boolean>>({});
  const [reprocessingIds, setReprocessingIds] = useState<Record<string, boolean>>({});
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedEntryIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReprocess = async (id: string) => {
    setReprocessingIds(prev => ({ ...prev, [id]: true }));
    try {
      await onReprocess(id);
    } finally {
      setReprocessingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const filteredEntries = entries.filter(entry => {
    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRaw = entry.raw_text.toLowerCase().includes(q);
      const matchObj = entry.objects?.some(o => o.title.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q));
      if (!matchRaw && !matchObj) return false;
    }

    // Type filter
    if (filterType !== 'all') {
      const hasType = entry.objects?.some(o => o.type === filterType);
      if (!hasType) return false;
    }

    return true;
  });

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-white">Inbox & History</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Original captures and their extracted actions, notes, and ideas.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          {['all', 'task', 'idea', 'decision', 'note'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                filterType === type
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {type === 'all' ? 'All' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter memories, keywords, or names..."
          className="w-full px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
        />
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs rounded-2xl bg-[#0f1422] border border-slate-800/80">
          No thoughts found matching your criteria.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map(entry => {
            const isExpanded = expandedEntryIds[entry.id] ?? true;
            const isReprocessing = reprocessingIds[entry.id] ?? false;
            const objects = entry.objects || [];
            const isFailed = entry.status === 'failed';

            return (
              <div
                key={entry.id}
                className="rounded-2xl bg-[#0f1422] border border-slate-800 shadow-md hover:border-slate-700/80 transition-all overflow-hidden"
              >
                {/* Header: Raw Input & Action Bar */}
                <div className="p-4 bg-slate-950/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/20">
                          Original Capture
                        </span>

                        <span className="text-[11px] font-mono text-slate-500">
                          {new Date(entry.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {isFailed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-medium bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            <AlertCircle className="w-3 h-3" />
                            Needs Processing
                          </span>
                        ) : entry.status === 'processing' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            <RotateCw className="w-3 h-3 animate-spin" />
                            Processing
                          </span>
                        ) : null}
                      </div>

                      {/* Preserved Raw Text (Source of Truth) */}
                      <p className="text-sm text-slate-200 leading-relaxed font-sans select-text">
                        "{entry.raw_text}"
                      </p>

                      {entry.processing_error && (
                        <p className="mt-1.5 text-xs text-rose-400/90 font-mono">
                          Error: {entry.processing_error}
                        </p>
                      )}
                    </div>

                    {/* Quick Entry Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleReprocess(entry.id)}
                        disabled={isReprocessing}
                        className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Re-run AI extraction on original text"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isReprocessing ? 'animate-spin text-indigo-400' : ''}`} />
                      </button>

                      <button
                        onClick={() => onDeleteEntry(entry.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Delete raw capture and derived items"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => toggleExpand(entry.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title={isExpanded ? 'Collapse derived objects' : 'Expand derived objects'}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Extracted Structured Objects Section */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-800/80 space-y-2.5 bg-[#0f1422]">
                    <div className="flex items-center justify-between pb-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Derived Interpretations ({objects.length})</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {entry.model_name} • {entry.parser_version}
                      </span>
                    </div>

                    {objects.length > 0 ? (
                      <div className="space-y-2">
                        {objects.map(obj => (
                          <ObjectCard
                            key={obj.id}
                            object={obj}
                            onUpdate={onUpdateObject}
                            onDelete={onDeleteObject}
                          />
                        ))}
                      </div>
                    ) : isFailed ? (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                        <span>AI extraction failed. The original capture is safely stored.</span>
                        <button
                          onClick={() => handleReprocess(entry.id)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium cursor-pointer"
                        >
                          Retry Extraction
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-1">
                        No distinct tasks or structured objects derived from this entry.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
