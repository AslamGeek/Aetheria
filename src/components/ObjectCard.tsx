import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Lightbulb, 
  CheckSquare, 
  FileText, 
  Scale, 
  Calendar, 
  Clock, 
  Trash2, 
  Edit3, 
  Save, 
  X,
  AlertCircle
} from 'lucide-react';
import { ExtractedObject, ObjectType } from '../types/index.ts';

interface ObjectCardProps {
  object: ExtractedObject;
  onUpdate: (id: string, updates: Partial<ExtractedObject>) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

export const ObjectCard: React.FC<ObjectCardProps> = ({
  object,
  onUpdate,
  onDelete,
  compact = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(object.title);
  const [editDescription, setEditDescription] = useState(object.description || '');
  const [editType, setEditType] = useState<ObjectType>(object.type);
  const [editDatePhrase, setEditDatePhrase] = useState(object.original_date_phrase || '');

  const isCompleted = object.status === 'completed';

  const typeConfig: Record<ObjectType, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
    task: {
      label: 'Task',
      icon: <CheckSquare className="w-3.5 h-3.5 text-blue-400" />,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    idea: {
      label: 'Idea',
      icon: <Lightbulb className="w-3.5 h-3.5 text-amber-400" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    note: {
      label: 'Note',
      icon: <FileText className="w-3.5 h-3.5 text-emerald-400" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    decision: {
      label: 'Decision',
      icon: <Scale className="w-3.5 h-3.5 text-purple-400" />,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
    event: {
      label: 'Event',
      icon: <Calendar className="w-3.5 h-3.5 text-rose-400" />,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
    },
  };

  const currentType = typeConfig[object.type] || typeConfig.note;
  const isTentative = object.metadata?.is_tentative || object.confidence < 0.75;

  const handleSave = () => {
    if (!editTitle.trim()) return;
    onUpdate(object.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      type: editType,
      original_date_phrase: editDatePhrase.trim() || null,
    });
    setIsEditing(false);
  };

  const toggleComplete = () => {
    onUpdate(object.id, {
      status: isCompleted ? 'pending' : 'completed',
    });
  };

  if (isEditing) {
    return (
      <div className="p-3.5 bg-slate-900/90 rounded-xl border border-indigo-500/40 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Type:</span>
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value as ObjectType)}
              className="bg-slate-800 text-xs font-medium text-white border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500"
            >
              <option value="task">Task</option>
              <option value="idea">Idea</option>
              <option value="note">Note</option>
              <option value="decision">Decision</option>
              <option value="event">Event</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
              title="Save changes"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="Title"
          />
        </div>

        <div>
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={2}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 resize-none"
            placeholder="Optional context / description"
          />
        </div>

        <div>
          <input
            type="text"
            value={editDatePhrase}
            onChange={(e) => setEditDatePhrase(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            placeholder="Date phrase (e.g. tomorrow, sometime next week)"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative rounded-xl transition-all border ${
        isCompleted 
          ? 'bg-slate-900/30 border-slate-800/40 opacity-70' 
          : 'bg-[#121826]/70 border-slate-800 hover:border-slate-700/80 hover:bg-[#151c2e]'
      } ${compact ? 'p-2.5' : 'p-3.5'}`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox for tasks */}
        {object.type === 'task' ? (
          <button
            onClick={toggleComplete}
            className="mt-0.5 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer shrink-0"
            title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Circle className="w-4 h-4 text-slate-500 hover:text-slate-300" />
            )}
          </button>
        ) : (
          <div className="mt-0.5 shrink-0">
            {currentType.icon}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase ${currentType.bg} ${currentType.color} border ${currentType.border}`}
            >
              {currentType.label}
            </span>

            {isTentative && (
              <span className="inline-flex items-center gap-1 text-[10px] font-normal text-amber-300/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                <AlertCircle className="w-2.5 h-2.5" />
                Possible
              </span>
            )}

            {object.original_date_phrase && (
              <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300/90 font-mono">
                <Clock className="w-3 h-3 text-indigo-400" />
                {object.original_date_phrase}
              </span>
            )}

            {object.entities && object.entities.length > 0 && (
              <div className="flex items-center gap-1">
                {object.entities.map((ent) => (
                  <span
                    key={ent.id}
                    className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded"
                  >
                    @{ent.canonical_name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <h4
            className={`text-sm font-medium leading-snug transition-colors ${
              isCompleted
                ? 'line-through text-slate-500'
                : 'text-slate-200 group-hover:text-white'
            }`}
          >
            {object.title}
          </h4>

          {object.description && (
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              {object.description}
            </p>
          )}
        </div>

        {/* Hover action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Edit item"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(object.id)}
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            title="Delete item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
