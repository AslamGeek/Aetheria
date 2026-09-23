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
  TestTube2,
  Copy,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Server,
  KeyRound,
  CheckCircle2
} from 'lucide-react';
import { Insight } from '../types/index.ts';

interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshEntries: () => void;
}

interface SupabaseStatus {
  configured: boolean;
  connected: boolean;
  tablesReady: boolean;
  url?: string;
  error?: string;
}

export const InsightsModal: React.FC<InsightsModalProps> = ({
  isOpen,
  onClose,
  onRefreshEntries,
}) => {
  const [activeTab, setActiveTab] = useState<'insights' | 'database'>('insights');
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  // Supabase status & actions
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null);
  const [checkingSupabase, setCheckingSupabase] = useState(false);
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Direct manual config form
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaveMsg, setConfigSaveMsg] = useState<string | null>(null);

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

  const checkSupabase = async () => {
    setCheckingSupabase(true);
    try {
      const res = await fetch('/api/supabase/status');
      if (res.ok) {
        const data = await res.json();
        setSupabaseStatus(data);
      }
    } catch (err) {
      console.error('Error checking Supabase status:', err);
    } finally {
      setCheckingSupabase(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInsights();
      checkSupabase();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'database') {
      checkSupabase();
    }
  }, [isOpen, activeTab]);

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

  const handleCopyMigrationSql = async () => {
    try {
      const res = await fetch('/api/supabase/migration-sql');
      if (res.ok) {
        const sql = await res.text();
        await navigator.clipboard.writeText(sql);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 3000);
      }
    } catch (err) {
      console.error('Failed to copy SQL:', err);
    }
  };

  const handleSyncToSupabase = async () => {
    setSyncingSupabase(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/supabase/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncResult(`Synced ${data.count} items successfully!`);
      } else {
        setSyncResult(`Sync failed: ${data.error}`);
      }
    } catch (err: any) {
      setSyncResult(`Sync error: ${err?.message}`);
    } finally {
      setSyncingSupabase(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  const handleSaveManualConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl.trim() || !manualKey.trim()) return;
    setSavingConfig(true);
    setConfigSaveMsg(null);
    try {
      const res = await fetch('/api/supabase/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: manualUrl.trim(), key: manualKey.trim() }),
      });
      const data = await res.json();
      if (data.success && data.status?.connected) {
        setSupabaseStatus(data.status);
        setConfigSaveMsg('Credentials saved and connected!');
        setShowConfigForm(false);
      } else {
        setConfigSaveMsg(data.status?.error || 'Failed to connect with provided keys.');
      }
    } catch (err: any) {
      setConfigSaveMsg(err?.message || 'Error saving credentials.');
    } finally {
      setSavingConfig(false);
    }
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
            <div className="w-7 h-7 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-white">Insights & Database</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center px-5 pt-3 border-b border-slate-800/80 gap-3 text-xs font-medium">
          <button
            onClick={() => setActiveTab('insights')}
            className={`pb-2.5 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
              activeTab === 'insights'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reflective Insights</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`pb-2.5 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
              activeTab === 'database'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Supabase Connection</span>
            {supabaseStatus?.connected ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-600" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'insights' ? (
            <>
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
                      Pre-load the 6 realistic test thoughts (Ramesh, competitor pricing, single input box idea, launch delay).
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
                    Download your complete memory archive (entries, objects, entities, relations) as JSON.
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
            </>
          ) : (
            /* Supabase Database Connection Tab */
            <div className="space-y-5">
              {/* Connection Status Card */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Connection Status
                  </span>
                  <button
                    onClick={checkSupabase}
                    disabled={checkingSupabase}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-indigo-300 transition-colors cursor-pointer"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${checkingSupabase ? 'animate-spin' : ''}`} />
                    <span>{checkingSupabase ? 'Checking...' : 'Refresh Status'}</span>
                  </button>
                </div>

                {supabaseStatus?.connected ? (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1.5 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-emerald-200 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Connected to Supabase PostgreSQL
                        </p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-900/60 text-emerald-300 border border-emerald-500/30">
                          LIVE
                        </span>
                      </div>
                      <p className="text-slate-400 font-mono text-[11px]">
                        URL: <span className="text-slate-200">{supabaseStatus.url}</span>
                      </p>
                      {supabaseStatus.tablesReady ? (
                        <p className="text-emerald-300 font-medium">
                          All tables verified: entries, objects, entities, embeddings (pgvector), insights.
                        </p>
                      ) : (
                        <p className="text-amber-300">
                          Connected, but database tables need to be created. Please run the SQL migration below.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-slate-200">
                        {supabaseStatus?.configured ? 'Connection Issue' : 'Not Connected (Using Local Persistence)'}
                      </p>
                      <p className="text-slate-400">
                        {supabaseStatus?.error || 'Aetheria is currently storing thoughts locally in data/aetheria_db.json. Click "Refresh Status" or configure your credentials below.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions when connected */}
                {supabaseStatus?.connected && (
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/80">
                    <button
                      onClick={handleSyncToSupabase}
                      disabled={syncingSupabase}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${syncingSupabase ? 'animate-spin' : ''}`} />
                      <span>{syncingSupabase ? 'Pushing Data...' : 'Push Local Data to Supabase'}</span>
                    </button>
                    {syncResult && (
                      <span className="text-xs text-emerald-300 font-medium">{syncResult}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Direct In-App Credentials Form Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Quick Configuration</span>
                  </div>
                  <button
                    onClick={() => setShowConfigForm(!showConfigForm)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    {showConfigForm ? 'Hide form' : 'Enter / Update Keys in UI'}
                  </button>
                </div>

                {showConfigForm && (
                  <form onSubmit={handleSaveManualConfig} className="space-y-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Supabase Project URL:
                      </label>
                      <input
                        type="text"
                        placeholder="https://xyz.supabase.co"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Supabase Service Role Key (or Anon Key):
                      </label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOi..."
                        value={manualKey}
                        onChange={(e) => setManualKey(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="submit"
                        disabled={savingConfig}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
                      >
                        {savingConfig ? 'Saving & Testing...' : 'Save & Test Connection'}
                      </button>
                      {configSaveMsg && (
                        <span className="text-xs text-indigo-300 font-medium">{configSaveMsg}</span>
                      )}
                    </div>
                  </form>
                )}
              </div>

              {/* Step-by-Step Setup Guide */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Supabase Setup Reference
                </h4>

                <div className="space-y-2.5 text-xs text-slate-300">
                  {/* Step 1 */}
                  <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between font-semibold text-slate-200">
                      <span>1. Create a Supabase Project</span>
                      <a
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <span>Open Supabase</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-slate-400">
                      Go to Supabase and create a new project (free tier includes PostgreSQL & pgvector).
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between font-semibold text-slate-200">
                      <span>2. Run the Schema Migration</span>
                      <button
                        onClick={handleCopyMigrationSql}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedSql ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copied SQL!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Migration SQL</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-slate-400">
                      In your Supabase project dashboard, open the <strong>SQL Editor</strong> tab, click <strong>"New query"</strong>, paste the copied SQL, and click <strong>"Run"</strong>. This creates the <code className="text-indigo-300 font-mono">entries</code>, <code className="text-indigo-300 font-mono">objects</code>, <code className="text-indigo-300 font-mono">entities</code>, and <code className="text-indigo-300 font-mono">embeddings</code> tables with pgvector.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2">
                    <div className="font-semibold text-slate-200">
                      <span>3. Environment Variables in AI Studio Secrets</span>
                    </div>
                    <p className="text-slate-400">
                      Found in Supabase ➔ Project Settings ➔ API:
                    </p>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                      <div><strong className="text-indigo-300">SUPABASE_URL</strong> = https://xyz.supabase.co</div>
                      <div><strong className="text-indigo-300">SUPABASE_SERVICE_ROLE_KEY</strong> = eyJhbGci...</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
