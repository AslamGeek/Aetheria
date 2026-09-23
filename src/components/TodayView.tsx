import React, { useEffect, useState } from 'react';
import { 
  AlertCircle, 
  CalendarCheck, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  ChevronRight,
  ArrowRight,
  Bookmark
} from 'lucide-react';
import { ExtractedObject } from '../types/index.ts';
import { ObjectCard } from './ObjectCard.tsx';

interface TodayData {
  overdueTasks: ExtractedObject[];
  dueTodayTasks: ExtractedObject[];
  upcomingTasks: ExtractedObject[];
  unscheduledTasks: ExtractedObject[];
  revisit: {
    object: ExtractedObject;
    rawText: string | null;
  } | null;
}

interface TodayViewProps {
  onUpdateObject: (id: string, updates: Partial<ExtractedObject>) => void;
  onDeleteObject: (id: string) => void;
  onSelectTab: (tab: 'capture' | 'today' | 'inbox' | 'memory') => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  onUpdateObject,
  onDeleteObject,
  onSelectTab,
}) => {
  const [data, setData] = useState<TodayData>({
    overdueTasks: [],
    dueTodayTasks: [],
    upcomingTasks: [],
    unscheduledTasks: [],
    revisit: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchTodayData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/today');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching today data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayData();
  }, []);

  const handleUpdate = (id: string, updates: Partial<ExtractedObject>) => {
    onUpdateObject(id, updates);
    // Optimistic UI updates
    setData(prev => ({
      ...prev,
      overdueTasks: prev.overdueTasks.map(t => t.id === id ? { ...t, ...updates } : t).filter(t => updates.status !== 'completed'),
      dueTodayTasks: prev.dueTodayTasks.map(t => t.id === id ? { ...t, ...updates } : t).filter(t => updates.status !== 'completed'),
      upcomingTasks: prev.upcomingTasks.map(t => t.id === id ? { ...t, ...updates } : t).filter(t => updates.status !== 'completed'),
      unscheduledTasks: prev.unscheduledTasks.map(t => t.id === id ? { ...t, ...updates } : t).filter(t => updates.status !== 'completed'),
    }));
  };

  const totalActionable = data.overdueTasks.length + data.dueTodayTasks.length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header Statement */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-white">Today</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {totalActionable === 0
              ? 'You are all caught up for today.'
              : `${totalActionable} item${totalActionable === 1 ? '' : 's'} deserve your attention now.`}
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500">
          {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs animate-pulse">
          Reviewing today's commitments...
        </div>
      ) : (
        <>
          {/* Overdue Section */}
          {data.overdueTasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 uppercase tracking-wider">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Overdue ({data.overdueTasks.length})</span>
              </div>
              <div className="space-y-2">
                {data.overdueTasks.map(task => (
                  <ObjectCard
                    key={task.id}
                    object={task}
                    onUpdate={handleUpdate}
                    onDelete={onDeleteObject}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Due Today Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Due Today ({data.dueTodayTasks.length})</span>
            </div>

            {data.dueTodayTasks.length > 0 ? (
              <div className="space-y-2">
                {data.dueTodayTasks.map(task => (
                  <ObjectCard
                    key={task.id}
                    object={task}
                    onUpdate={handleUpdate}
                    onDelete={onDeleteObject}
                  />
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400 text-center">
                No active tasks scheduled specifically for today.
              </div>
            )}
          </div>

          {/* Upcoming Section */}
          {data.upcomingTasks.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                <span>Upcoming ({data.upcomingTasks.length})</span>
              </div>
              <div className="space-y-2">
                {data.upcomingTasks.map(task => (
                  <ObjectCard
                    key={task.id}
                    object={task}
                    onUpdate={handleUpdate}
                    onDelete={onDeleteObject}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Unscheduled / Open Items */}
          {data.unscheduledTasks.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>Other Action Items ({data.unscheduledTasks.length})</span>
                <button
                  onClick={() => onSelectTab('inbox')}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 normal-case cursor-pointer"
                >
                  View all in Inbox →
                </button>
              </div>
              <div className="space-y-2">
                {data.unscheduledTasks.map(task => (
                  <ObjectCard
                    key={task.id}
                    object={task}
                    onUpdate={handleUpdate}
                    onDelete={onDeleteObject}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Subtle Revisit Section */}
          {data.revisit && (
            <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-2 mt-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                <span>Revisit from your memory</span>
              </div>
              <h4 className="text-sm font-medium text-slate-200">
                {data.revisit.object.title}
              </h4>
              {data.revisit.rawText && (
                <p className="text-xs text-slate-400 italic">
                  "{data.revisit.rawText}"
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
