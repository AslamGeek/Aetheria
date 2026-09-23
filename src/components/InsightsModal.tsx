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
  CheckCircle2,
  Clock,
  LogOut
} from 'lucide-react';
import { Insight, Entry } from '../types/index.ts';
import { 
  getBrowserSupabaseCredentials, 
  testBrowserSupabase, 
  saveBrowserSupabaseCredentials,
  clearBrowserSupabaseCredentials,
  syncLocalEntriesToSupabase
} from '../lib/browserSupabase.ts';
import { MIGRATION_SQL } from '../lib/migrationSql.ts';

interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshEntries: () => void;
  initialTab?: 'insights' | 'database';
  onSupabaseStatusChange?: (connected: boolean) => void;
  localEntries?: Entry[];
}

interface SupabaseStatus {
  configured: boolean;
  connected: boolean;
  tablesReady: boolean;
  url?: string;
  error?: string;
  source?: 'server' | 'browser';
}

export const InsightsModal: React.FC<InsightsModalProps> = ({
  isOpen,
  onClose,
  onRefreshEntries,
  initialTab = 'insights',
  onSupabaseStatusChange,
  localEntries = [],
}) => {
  const [activeTab, setActiveTab] = useState<'insights' | 'database'>(initialTab);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  // Supabase status & actions
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null);
  const [checkingSupabase, setCheckingSupabase] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Direct manual config form
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [manualUrl, setManualUrl] = useState(() => {
    return getBrowserSupabaseCredentials()?.url || 'https://tprpkannsiyslsdegymv.supabase.co';
  });
  const [manualKey, setManualKey] = useState(() => {
    return getBrowserSupabaseCredentials()?.key || '';
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaveMsg, setConfigSaveMsg] = useState<{ text: string; success: boolean } | null>(null);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/insights?_t=${Date.now()}`, {
        cache: 'no-store',
      });
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
      // 1. First attempt check via Node server API
      let serverCheckSucceeded = false;
      try {
        const res = await fetch(`/api/supabase/status?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });

        // Verify that response is valid JSON (and not a 404 HTML page like Vercel returns)
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data: SupabaseStatus = await res.json();
          if (data.connected) {
            setSupabaseStatus({ ...data, source: 'server' });
            setLastCheckedTime(new Date().toLocaleTimeString());
            serverCheckSucceeded = true;
            if (onSupabaseStatusChange) onSupabaseStatusChange(true);
            return;
          }
        }
      } catch {
        // Server route unavailable or returned HTML 404 (e.g. Vercel static deployment)
      }

      // 2. Fallback: Check directly from browser using stored or provided credentials
      const browserCreds = getBrowserSupabaseCredentials();
      const testUrl = browserCreds?.url || manualUrl.trim();
      const testKey = browserCreds?.key || manualKey.trim();

      if (testUrl && testKey) {
        const clientResult = await testBrowserSupabase(testUrl, testKey);
        setSupabaseStatus({ ...clientResult, source: 'browser' });
        setLastCheckedTime(new Date().toLocaleTimeString());
        if (clientResult.connected && onSupabaseStatusChange) {
          onSupabaseStatusChange(true);
        }
      } else {
        setSupabaseStatus({
          configured: false,
          connected: false,
          tablesReady: false,
          error: 'Not connected. Enter your Supabase Project URL and Key below to link your database.',
        });
        setLastCheckedTime(new Date().toLocaleTimeString());
      }
    } catch (err: any) {
      console.error('Error in checkSupabase:', err);
      setSupabaseStatus({
        configured: false,
        connected: false,
        tablesReady: false,
        error: err?.message || 'Connection test failed',
      });
      setLastCheckedTime(new Date().toLocaleTimeString());
    } finally {
      setCheckingSupabase(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      fetchInsights();
      checkSupabase();
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'database') {
      checkSupabase();
    }
  }, [activeTab]);

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
      await navigator.clipboard.writeText(MIGRATION_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch (err) {
      console.error('Failed to copy SQL:', err);
    }
  };

  const handleSyncToSupabase = async () => {
    setSyncingSupabase(true);
    setSyncResult(null);
    try {
      // 1. Try server sync first
      let serverSynced = false;
      try {
        const res = await fetch('/api/supabase/sync', { method: 'POST' });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success) {
            setSyncResult(`Synced ${data.count} items successfully!`);
            serverSynced = true;
          }
        }
      } catch {
        // Fallback to client-side sync
      }

      // 2. If server sync was not applicable, perform direct browser sync
      if (!serverSynced) {
        const count = await syncLocalEntriesToSupabase(localEntries);
        setSyncResult(`Synced ${count} thought${count === 1 ? '' : 's'} directly to Supabase!`);
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
    const url = manualUrl.trim();
    const key = manualKey.trim();

    if (!url || !key) return;

    setSavingConfig(true);
    setConfigSaveMsg(null);

    try {
      // 1. Direct browser verification using @supabase/supabase-js
      const result = await testBrowserSupabase(url, key);

      if (result.connected) {
        saveBrowserSupabaseCredentials(url, key);
        setSupabaseStatus({ ...result, source: 'browser' });
        setLastCheckedTime(new Date().toLocaleTimeString());
        setConfigSaveMsg({ text: 'Connected to Supabase successfully!', success: true });
        
        if (onSupabaseStatusChange) {
          onSupabaseStatusChange(true);
        }

        // 2. Progressive background notification to backend (silently ignore if static/404)
        fetch('/api/supabase/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, key }),
        }).catch(() => {});

        setTimeout(() => {
          setShowConfigForm(false);
          setConfigSaveMsg(null);
        }, 2000);
      } else {
        setConfigSaveMsg({ 
          text: result.error || 'Could not connect. Please verify your Project URL and API Key.', 
          success: false 
        });
      }
    } catch (err: any) {
      setConfigSaveMsg({ text: err?.message || 'Error testing Supabase connection.', success: false });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDisconnect = () => {
    clearBrowserSupabaseCredentials();
    setSupabaseStatus({
      configured: false,
      connected: false,
      tablesReady: false,
      error: 'Disconnected from Supabase.',
    });
    if (onSupabaseStatusChange) onSupabaseStatusChange(false);
    setConfigSaveMsg(null);
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
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
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
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400 animate-pulse" />
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Connection Status
                    </span>
                    {lastCheckedTime && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Checked at {lastCheckedTime}</span>
                      </span>
                    )}
                  </div>
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
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 animate-pulse">
                          LIVE
                        </span>
                      </div>
                      <p className="text-slate-400 font-mono text-[11px]">
                        URL: <span className="text-slate-200 font-semibold">{supabaseStatus.url}</span>
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
                    <div className="text-xs space-y-1 flex-1">
                      <p className="font-semibold text-slate-200">
                        {supabaseStatus?.configured ? 'Connection Issue' : 'Not Connected to Supabase'}
                      </p>
                      <p className="text-slate-400 leading-relaxed">
                        {supabaseStatus?.error || 'Enter your Supabase URL & Key below to link your PostgreSQL database.'}
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
                    <button
                      onClick={handleDisconnect}
                      className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1 ml-auto cursor-pointer"
                      title="Clear stored Supabase credentials"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Direct In-App Credentials Form */}
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Supabase Credentials Configuration</span>
                  </div>
                  <button
                    onClick={() => setShowConfigForm(!showConfigForm)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    {showConfigForm ? 'Hide form' : 'Enter / Update Keys'}
                  </button>
                </div>

                {(!supabaseStatus?.connected || showConfigForm) && (
                  <form onSubmit={handleSaveManualConfig} className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                        Supabase Project URL:
                      </label>
                      <input
                        type="url"
                        placeholder="https://tprpkannsiyslsdegymv.supabase.co"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                        Supabase Anon Key or Service Role Key:
                      </label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOi..."
                        value={manualKey}
                        onChange={(e) => setManualKey(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500 font-mono"
                        required
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Found in your Supabase Dashboard ➔ Project Settings ➔ API ➔ "anon" or "service_role" key.
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 gap-2">
                      <button
                        type="submit"
                        disabled={savingConfig}
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${savingConfig ? 'animate-spin' : ''}`} />
                        <span>{savingConfig ? 'Connecting & Verifying...' : 'Save & Connect to Supabase'}</span>
                      </button>

                      {configSaveMsg && (
                        <span className={`text-xs font-medium ${configSaveMsg.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {configSaveMsg.text}
                        </span>
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
                      <span>1. Your Supabase Project</span>
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
                      Your project URL: <code className="text-indigo-300 font-mono text-[11px]">https://tprpkannsiyslsdegymv.supabase.co</code>
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
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied SQL!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
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
                      <span>3. Find Your API Key</span>
                    </div>
                    <p className="text-slate-400">
                      In Supabase ➔ Project Settings ➔ API, copy the <strong>anon public</strong> key (or service_role key), paste it into the form above, and click <strong>"Save & Connect to Supabase"</strong>.
                    </p>
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
