import React, { useState } from 'react';
import { 
  Search, 
  Send, 
  Sparkles, 
  RotateCw, 
  ExternalLink, 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { MemoryQueryResult } from '../types/index.ts';

interface MemoryViewProps {
  onInspectEntry?: (entryId: string) => void;
}

export const MemoryView: React.FC<MemoryViewProps> = ({ onInspectEntry }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<MemoryQueryResult | null>(null);
  const [showSources, setShowSources] = useState(true);
  const [history, setHistory] = useState<{ query: string; result: MemoryQueryResult }[]>([]);

  const sampleQuestions = [
    "What have I been thinking about this app?",
    "What did I decide about pricing?",
    "What unfinished things involve Ramesh?",
    "When did I first mention competitor pricing?",
    "How has my thinking about the launch date changed?",
    "What ideas have I repeatedly mentioned?"
  ];

  const handleSearch = async (qText?: string) => {
    const textToSearch = (qText || query).trim();
    if (!textToSearch || isSearching) return;

    if (qText) {
      setQuery(qText);
    }

    setIsSearching(true);
    setResult(null);

    try {
      const res = await fetch('/api/memory/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: textToSearch }),
      });

      if (res.ok) {
        const data: MemoryQueryResult = await res.json();
        setResult(data);
        setHistory(prev => [{ query: textToSearch, result: data }, ...prev.slice(0, 4)]);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to search memory');
      }
    } catch (err) {
      console.error('Memory search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-white">Ask My Memory</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Ask questions across your accumulated thoughts, decisions, and action items.
        </p>
      </div>

      {/* Query Search Form */}
      <div className="relative rounded-2xl bg-[#0f1422] border border-slate-800 p-2 shadow-lg focus-within:border-indigo-500/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex items-center gap-2"
        >
          <div className="pl-3 text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. What did I decide about pricing?"
            className="flex-1 bg-transparent py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              query.trim() && !isSearching
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSearching ? (
              <RotateCw className="w-4 h-4 animate-spin text-indigo-300" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Suggested Questions */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
          Suggested Explorations
        </span>
        <div className="flex flex-wrap gap-1.5">
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSearch(q)}
              className="px-2.5 py-1.5 rounded-xl bg-[#0f1422] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs transition-colors cursor-pointer text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isSearching && (
        <div className="p-8 rounded-2xl bg-[#0f1422] border border-slate-800 text-center space-y-3 animate-pulse">
          <Sparkles className="w-6 h-6 text-indigo-400 mx-auto animate-spin" />
          <p className="text-xs text-slate-400">
            Searching semantic vector embeddings and cross-referencing thought archives...
          </p>
        </div>
      )}

      {/* Result Card */}
      {result && !isSearching && (
        <div className="rounded-2xl bg-[#0f1422] border border-indigo-500/30 shadow-xl overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Memory Recall</h3>
            </div>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/20">
              {result.directEvidenceCount} source capture{result.directEvidenceCount === 1 ? '' : 's'}
            </span>
          </div>

          {/* Answer Text */}
          <div className="text-sm text-slate-200 leading-relaxed space-y-2 whitespace-pre-wrap font-sans">
            {result.answer}
          </div>

          {/* Source Provenance Inspector */}
          {result.sources.length > 0 && (
            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center justify-between w-full text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Inspecting Underlying Evidence ({result.sources.length})</span>
                </div>
                {showSources ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showSources && (
                <div className="space-y-2.5 pt-1">
                  {result.sources.map((src, idx) => (
                    <div
                      key={src.entryId || idx}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-indigo-400">
                          Captured {new Date(src.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {src.matchedObjects && src.matchedObjects.length > 0 && (
                          <div className="flex items-center gap-1">
                            {src.matchedObjects.map((o, oIdx) => (
                              <span
                                key={oIdx}
                                className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400"
                              >
                                {o.type}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="text-slate-300 italic">
                        "{src.rawText}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prior searches */}
      {history.length > 1 && (
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Recent Inquiries
          </span>
          <div className="space-y-1.5">
            {history.slice(1).map((h, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(h.query);
                  setResult(h.result);
                }}
                className="w-full text-left p-2.5 rounded-xl bg-[#0f1422] hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="truncate">"{h.query}"</span>
                <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                  {h.result.directEvidenceCount} sources
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
