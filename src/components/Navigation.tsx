import React from 'react';
import { 
  PenTool, 
  Calendar, 
  Inbox, 
  Search, 
  BrainCircuit, 
  Sparkles, 
  Layers,
  CheckCircle2,
  Bookmark,
  Database
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface NavigationProps {
  currentTab: 'capture' | 'today' | 'inbox' | 'memory';
  onSelectTab: (tab: 'capture' | 'today' | 'inbox' | 'memory') => void;
  pendingTasksCount: number;
  totalEntriesCount: number;
  onOpenInsights: () => void;
  isSupabaseConnected?: boolean;
  onOpenSupabase?: () => void;
}

interface NavTab {
  id: 'capture' | 'today' | 'inbox' | 'memory';
  label: string;
  icon: React.ReactNode;
  badge?: number | null;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  pendingTasksCount,
  totalEntriesCount,
  onOpenInsights,
  isSupabaseConnected = false,
  onOpenSupabase,
}) => {
  const tabs: NavTab[] = [
    {
      id: 'capture',
      label: 'Capture',
      icon: <PenTool className="w-4 h-4" />,
    },
    {
      id: 'today',
      label: 'Today',
      icon: <Calendar className="w-4 h-4" />,
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
    },
    {
      id: 'inbox',
      label: 'Inbox',
      icon: <Inbox className="w-4 h-4" />,
      badge: totalEntriesCount > 0 ? totalEntriesCount : null,
    },
    {
      id: 'memory',
      label: 'Memory',
      icon: <BrainCircuit className="w-4 h-4" />,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              Aetheria
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider -mt-0.5">
              personal intelligence
            </p>
          </div>
        </div>

        {/* Center Tabs (Desktop / Tablet) */}
        <nav className="hidden sm:flex items-center gap-1 bg-[#0f1422] p-1 rounded-xl border border-slate-800">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== null && tab.badge !== undefined && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-tight ${
                      isActive
                        ? 'bg-indigo-900 text-indigo-100'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Supabase status indicator button */}
          <button
            onClick={onOpenSupabase || onOpenInsights}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              isSupabaseConnected
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/50'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={isSupabaseConnected ? 'Connected to Supabase PostgreSQL' : 'Supabase Not Connected (Local Storage)'}
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">
              {isSupabaseConnected ? 'Supabase' : 'Database'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                isSupabaseConnected
                  ? 'bg-emerald-400 shadow-xs shadow-emerald-400 animate-pulse'
                  : 'bg-slate-600'
              }`}
            />
          </button>

          <button
            onClick={onOpenInsights}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors cursor-pointer"
            title="View insights, patterns, and data export"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Insights</span>
          </button>

          <PWAInstallButton />
        </div>
      </div>

      {/* Mobile Bottom Floating Navigation Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090d16]/95 border-t border-slate-800/90 backdrop-blur-lg px-4 py-2">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex flex-col items-center gap-1 p-1.5 rounded-xl transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  {tab.icon}
                  {tab.badge !== null && tab.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-2 px-1 text-[9px] font-mono bg-indigo-600 text-white rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
