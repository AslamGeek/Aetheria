import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Download, 
  RotateCw, 
  X, 
  Layers, 
  Trash2, 
  Check, 
  FileDown, 
  Database,
  TestTube2
} from 'lucide-react';
import { Insight } from '../types/index.ts';

interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshEntries: () => void;
}

export const InsightsModal: React.FC<InsightsModalProps> = ({
  isOpen,
  onClose,
  onRefreshEntries,
}) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/insights');
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
      }
    } catch (err) {
      console.error('Error fetching insights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInsights();
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const res = await fetch('/api/insights/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
      }
    } catch (err) {
      console.error('Error generating insights:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/insights/${id}`, { method: 'DELETE' });
      setInsights(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error('Error deleting insight:', err);
    }
  };

  const handleExport = () => {
    window.location.href = '/api/export';
  };

  const handleSeedExamples = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed-examples', { method: 'POST' });
      if (res.ok) {
        setSeedSuccess(true);
        onRefreshEntries();
        setTimeout(() => setSeedSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error seeding test examples:', err);
    } finally {
      setSeeding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-[#0f1422] border border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-base font-semibold text-white">Insights & Data</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Insights Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Reflective Meta-Patterns</h4>
                <p className="text-xs text-slate-400">
                  AI-identified recurring themes, shifts in focus, or unresolved decisions.
                </p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                <span>{generating ? 'Reflecting...' : 'Reflect Now'}</span>
              </button>
            </div>

            {loading ? (
              <div className="p-6 text-center text-xs text-slate-500 animate-pulse">
                Loading observations...
              </div>
            ) : insights.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 text-xs text-slate-400 text-center">
                No patterns identified yet. Capture a few thoughts or click "Reflect Now".
              </div>
            ) : (
              <div className="space-y-2.5">
                {insights.map(ins => (
                  <div
                    key={ins.id}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/20">
                        {ins.category.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => handleDelete(ins.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition-opacity cursor-pointer"
                        title="Delete insight"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h5 className="text-xs font-semibold text-slate-200">
                      {ins.title}
                    </h5>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {ins.observation}
                    </p>

                    <span className="text-[10px] font-mono text-slate-500 block pt-1">
                      Evidence drawn from {ins.evidence_entry_ids.length} captured thought{ins.evidence_entry_ids.length === 1 ? '' : 's'}.
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seed Examples Section */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-300">Seed Test Dataset</h4>
                <p className="text-[11px] text-slate-400">
                  Pre-load the 6 realistic test thoughts (Ramesh, competitor pricing, single input box idea, launch delay) into your database.
                </p>
              </div>
              <button
                onClick={handleSeedExamples}
                disabled={seeding || seedSuccess}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  seedSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {seedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Imported!</span>
                  </>
                ) : (
                  <>
                    <TestTube2 className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
                    <span>{seeding ? 'Importing...' : 'Load Examples'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Full Data Export Section */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-300">Data Sovereignty & Export</h4>
              <p className="text-[11px] text-slate-400">
                Download your complete memory archive (entries, objects, entities, relations) as a JSON file.
              </p>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
