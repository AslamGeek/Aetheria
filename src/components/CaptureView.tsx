import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUp, 
  Sparkles, 
  Mic, 
  MicOff, 
  CheckCircle2, 
  RotateCw, 
  ChevronRight,
  Lightbulb,
  Clock,
  Sparkle
} from 'lucide-react';
import { Entry, ExtractedObject } from '../types/index.ts';
import { ObjectCard } from './ObjectCard.tsx';

interface CaptureViewProps {
  onCapture: (text: string) => Promise<{ entry: Entry; summary?: string } | null>;
  onUpdateObject: (id: string, updates: Partial<ExtractedObject>) => void;
  onDeleteObject: (id: string) => void;
  onSelectTab: (tab: 'capture' | 'today' | 'inbox' | 'memory') => void;
  latestCapturedEntry: Entry | null;
}

export const CaptureView: React.FC<CaptureViewProps> = ({
  onCapture,
  onUpdateObject,
  onDeleteObject,
  onSelectTab,
  latestCapturedEntry,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeInterpretation, setActiveInterpretation] = useState<{
    entry: Entry;
    summary?: string;
  } | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sync latest captured entry from parent if present
  useEffect(() => {
    if (latestCapturedEntry && (!activeInterpretation || activeInterpretation.entry.id !== latestCapturedEntry.id)) {
      setActiveInterpretation({
        entry: latestCapturedEntry,
      });
    }
  }, [latestCapturedEntry]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`;
    }
  }, [inputText]);

  // Web Speech recognition for voice dictation
  const toggleSpeechRecognition = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported natively in this browser. You can dictate using Wispr Flow or your system dictation tool directly into the text field.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(prev => {
          // If we had text before starting recording, append smoothly
          return transcript;
        });
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition initiation error:', err);
      setIsRecording(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSubmit = inputText.trim();
    if (!textToSubmit || isSubmitting) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    // Fast capture principle:
    // 1. Clear input immediately so capture feels instantaneous
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // 2. Set processing state
    setIsSubmitting(true);

    try {
      const result = await onCapture(textToSubmit);
      if (result) {
        setActiveInterpretation(result);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd+Enter or Ctrl+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const loadExample = (exampleText: string) => {
    setInputText(exampleText);
    textareaRef.current?.focus();
  };

  const samplePrompts = [
    {
      label: 'Call Ramesh & pricing',
      text: "Need to call Ramesh tomorrow about the land documents. Also maybe we should validate whether anyone wants reporting before building the dashboard. Check competitor pricing sometime this week."
    },
    {
      label: 'Launch decision',
      text: "We decided to delay the launch until February."
    },
    {
      label: 'Electricity bill & Arun',
      text: "Need to pay the electricity bill tomorrow and ask Arun if he's free this weekend."
    },
    {
      label: 'Tentative idea',
      text: "Maybe I should talk to Ravi about pricing."
    },
    {
      label: 'Send prototype',
      text: "I've got to send Priya the prototype before Friday."
    }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Primary Capture Box */}
      <div className="relative rounded-2xl bg-[#0f1422] border border-slate-800 shadow-xl overflow-hidden transition-all focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20">
        <form onSubmit={handleSubmit} className="p-4 sm:p-5">
          <label htmlFor="thought-input" className="block text-xs font-semibold uppercase tracking-wider text-indigo-400/90 mb-2">
            What's on your mind?
          </label>
          <textarea
            id="thought-input"
            ref={textareaRef}
            rows={3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type, paste, or dictate a thought in plain words..."
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-base sm:text-lg focus:outline-none resize-none leading-relaxed min-h-[84px]"
            autoFocus
          />

          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 mt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isRecording
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Dictate thought"
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span className="hidden sm:inline text-xs">
                  {isRecording ? 'Listening...' : 'Dictate'}
                </span>
              </button>

              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">⌘ + Enter</kbd> to capture
              </span>
            </div>

            <button
              type="submit"
              disabled={!inputText.trim() || isSubmitting}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                inputText.trim() && !isSubmitting
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-indigo-200" />
                  <span>Understanding...</span>
                </>
              ) : (
                <>
                  <span>Capture</span>
                  <ArrowUp className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick realistic seeds */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          <span className="text-[11px] text-slate-500 shrink-0 flex items-center gap-1">
            <Sparkle className="w-3 h-3 text-indigo-400" />
            Try:
          </span>
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => loadExample(p.text)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors shrink-0 text-xs cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lightweight processing indicator if submitting */}
      {isSubmitting && (
        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-center gap-3 text-indigo-300 text-sm animate-pulse">
          <RotateCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Raw thought saved permanently. Deconstructing actions and entities...</span>
        </div>
      )}

      {/* Interpretation Card: "Here's what I picked up" */}
      {activeInterpretation && (
        <div className="rounded-2xl bg-[#0f1422] border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">
                Here's what I picked up
              </h3>
            </div>

            <button
              onClick={() => onSelectTab('inbox')}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View in Inbox</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Source thought quote */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 italic">
            <span className="text-slate-500 not-italic font-mono uppercase tracking-wider text-[10px] block mb-1">
              Source Capture (Preserved):
            </span>
            "{activeInterpretation.entry.raw_text}"
          </div>

          {/* Summary if available */}
          {activeInterpretation.summary && (
            <p className="text-xs text-slate-300 font-medium">
              {activeInterpretation.summary}
            </p>
          )}

          {/* Structured objects list */}
          <div className="space-y-2">
            {activeInterpretation.entry.objects && activeInterpretation.entry.objects.length > 0 ? (
              activeInterpretation.entry.objects.map((obj) => (
                <ObjectCard
                  key={obj.id}
                  object={obj}
                  onUpdate={onUpdateObject}
                  onDelete={onDeleteObject}
                />
              ))
            ) : (
              <p className="text-xs text-slate-500 italic py-2">
                {activeInterpretation.entry.status === 'processing'
                  ? 'Analyzing actions and notes...'
                  : 'No action items or distinct objects were extracted from this thought.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
