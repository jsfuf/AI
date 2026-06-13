import React, { useState } from 'react';
import { LearnedMemory } from '../types';
import { Brain, Trash2, Plus, Sparkles, Database, Calendar, X, AlertCircle } from 'lucide-react';

interface MemoryBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: LearnedMemory[];
  onAddMemory: (fact: string) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  firebaseEnabled: boolean;
  isLoading: boolean;
  autoMemoryEnabled: boolean;
  onToggleAutoMemory: () => void;
}

const MemoryBankModal: React.FC<MemoryBankModalProps> = ({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  onDeleteMemory,
  firebaseEnabled,
  isLoading,
  autoMemoryEnabled,
  onToggleAutoMemory,
}) => {
  const [newFact, setNewFact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onAddMemory(newFact.trim());
      setNewFact('');
    } catch (err: any) {
      setError(err?.message || 'Failed to add memory');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-scale-up flex flex-col max-h-[85vh]"
        id="memory-bank-modal"
      >
        {/* Subtle purple-blue aura indicator of intellect */}
        <div className="absolute top-[-40px] left-[-40px] w-[180px] h-[180px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-40px] right-[-40px] w-[180px] h-[180px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/35 text-indigo-400 rounded-xl">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <h3 className="text-md font-bold bg-gradient-to-r from-white via-indigo-100 to-purple-400 bg-clip-text text-transparent">
                AI Cognitive Memory Bank
              </h3>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider">
                SYNC: {firebaseEnabled ? '✓ ACTIVE (FIREBASE RTDB)' : '✗ LOCAL ONLY'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cognitive Auto-Learning (Memory) Toggle Row */}
        <div className="flex items-center justify-between p-3.5 mb-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs shrink-0 select-none">
          <div className="flex flex-col text-left pr-4">
            <span className="font-semibold text-slate-200">Cognitive Auto-Learning (Memory)</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Let Clever AI automatically learn your preferences and details from the chat feed. If disabled, what you type won't be saved or shown on the website.</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input 
              type="checkbox" 
              checked={autoMemoryEnabled} 
              onChange={onToggleAutoMemory}
              className="sr-only peer" 
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-emerald-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-950/60 border border-white/5 peer-checked:border-emerald-500/20"></div>
          </label>
        </div>

        {/* Database Status Alert */}
        {!firebaseEnabled && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 mb-4 flex gap-2.5 items-start text-xs text-yellow-300 font-sans shrink-0">
            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-left">
              <span className="font-semibold block mb-0.5">Firebase Synced Learner Inactive</span>
              Configure your Firebase Realtime Database parameters in the Connection Settings (gear icon) to synchronize these memories and chat logs across physical machines.
            </div>
          </div>
        )}

        {/* Manual Fact Insertion Form */}
        <form onSubmit={handleSubmit} className="mb-4 shrink-0">
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-left">
            Teach AI a preference, fact, or specific knowledge
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFact}
              onChange={(e) => setNewFact(e.target.value)}
              placeholder="e.g., Prefers functional React code instead of class templates..."
              disabled={isSubmitting}
              className="flex-grow bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/40"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newFact.trim()}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Teach</span>
            </button>
          </div>
          {error && <p className="text-red-400 text-[10px] mt-1.5 text-left">{error}</p>}
        </form>

        {/* Memories list container */}
        <div className="flex-grow overflow-y-auto min-h-0 space-y-2 pr-1 custom-scrollbar">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent mb-3"></div>
              <span className="text-xs font-mono">Syncing neuron pathways...</span>
            </div>
          ) : memories.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
              <Database className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-sans">Cognitive Memory is currently blank.</p>
              <p className="text-[10px] text-slate-500 mt-1 max-w-sm mx-auto">
                Start chatting with standard OpenAI/Gemini streams! The AI will automatically extract and structure learned patterns here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono tracking-wider uppercase mb-1">
                <span>Core Cognitions ({memories.length})</span>
                <span>Realtime Synced</span>
              </div>
              {memories.map((mem) => (
                <div 
                  key={mem.id}
                  className="bg-white/5 border border-white/5 rounded-xl p-3 flex gap-3 items-start justify-between hover:bg-white/[0.08] hover:border-white/10 transition-all group"
                >
                  <div className="flex gap-2.5 items-start text-left">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 mt-0.5">
                      <Sparkles className="w-3 h-3 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">{mem.fact}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span className="text-[9px] text-slate-500 font-mono">
                          {new Date(mem.timestamp).toLocaleDateString()} {new Date(mem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteMemory(mem.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                    title="Erase fact from brain database"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between shrink-0">
          <span className="text-[9px] text-slate-500 font-mono">
            Powered by Firebase RTDB
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs font-semibold text-slate-300 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemoryBankModal;
