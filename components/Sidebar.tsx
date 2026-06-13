import React, { useState } from 'react';
import { ChatHistoryItem, MessageSender } from '../types';
import { 
  Bot, 
  ChevronLeft, 
  ChevronRight, 
  FolderGit2, 
  History, 
  Plus, 
  Search, 
  Settings, 
  Trash2, 
  FileText, 
  Sparkles,
  Layers,
  HelpCircle
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  sessions: ChatHistoryItem[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onSelectAgent: (agentName: string, promptPreset: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  onOpenSettings,
  onSelectAgent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'agents' | 'files'>('chats');

  // Filtered chats based on search
  const filteredSessions = sessions.filter(session => 
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.messages.some(msg => msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Pre-configured AI Agents
  const PRESET_AGENTS = [
    {
      name: 'Architect Coder',
      desc: 'Expert in fullstack structures & refactoring',
      prompt: 'You are Architect Coder. Help me review, refactor, and write highly efficient, modular TypeScript/React structures.'
    },
    {
      name: 'Visionary Designer',
      desc: 'Creates CSS palettes & liquid presets',
      prompt: 'You are Visionary Designer. Provide visually striking UI, custom glassmorphism style rules, and high-fidelity mockups.'
    },
    {
      name: 'Document Analyst',
      desc: 'Summarizes data, CSVs, and PDFs',
      prompt: 'You are Document Analyst. I will share files. Help me synthesize raw data, formulate projections, and chart summaries.'
    }
  ];

  // Dummy uploaded workspace files
  const WORKSPACE_FILES = [
    { name: 'architecture_diagram.png', type: 'image', size: '2.4 MB' },
    { name: 'financial_report_q2.pdf', type: 'pdf', size: '1.2 MB' },
    { name: 'config_schema.json', type: 'json', size: '45 KB' },
  ];

  return (
    <div 
      className={`relative h-full flex flex-col transition-all duration-300 ease-in-out shrink-0 z-20 ${
        isOpen ? 'w-72' : 'w-0 sm:w-16'
      }`}
    >
      {/* Floating glass sidebar card content */}
      <div 
        className={`h-full flex flex-col bg-slate-900/40 backdrop-blur-3xl border-r border-white/10 text-white transition-all duration-300 ${
          isOpen ? 'p-4 opacity-100' : 'p-0 sm:p-2 opacity-0 sm:opacity-100 overflow-hidden'
        }`}
        style={{
          boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
      >
        {/* Top brand header */}
        {isOpen ? (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold bg-gradient-to-r from-white via-cyan-100 to-indigo-100 bg-clip-text text-transparent leading-none">
                  Liquid Workspace
                </span>
                <span className="text-[9px] text-cyan-400 font-mono tracking-widest mt-0.5">NEXT-GEN OS</span>
              </div>
            </div>
            
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/15 transition-all text-slate-400 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-slate-400 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Action Button: Create New Chat */}
        {isOpen ? (
          <button
            onClick={onNewChat}
            className="w-full py-3 px-4 mb-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all duration-200 transform active:scale-98 shadow-[0_4px_12px_rgba(6,182,212,0.25)] hover:shadow-[0_4px_16px_rgba(6,182,212,0.4)] cursor-pointer border border-cyan-400/20"
          >
            <Plus className="w-4 h-4" />
            Compose Workspace
          </button>
        ) : (
          <button
            onClick={onNewChat}
            className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 flex items-center justify-center text-white transition-all cursor-pointer shadow-md border border-cyan-400/20"
            title="Compose Workspace"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {/* Search tool for sessions */}
        {isOpen && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chat workspace..."
              className="w-full bg-white/5 border border-white/10 hover:border-white/15 focus:border-cyan-500/50 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-400 outline-none transition-all"
            />
          </div>
        )}

        {/* Sidebar Nav Tabs */}
        {isOpen && (
          <div className="flex border-b border-white/5 mb-3 p-0.5 bg-black/20 rounded-xl">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'chats' ? 'bg-white/10 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Chats
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'agents' ? 'bg-white/10 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Agents
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'files' ? 'bg-white/10 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Files
            </button>
          </div>
        )}

        {/* Collapsed sidebar shortcut icons */}
        {!isOpen && (
          <div className="flex flex-col items-center gap-3 py-4 border-b border-white/5">
            <button 
              onClick={() => { onToggle(); setActiveTab('chats'); }}
              className={`p-2 rounded-xl transition-all ${activeTab === 'chats' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
              title="Chat History"
            >
              <History className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { onToggle(); setActiveTab('agents'); }}
              className={`p-2 rounded-xl transition-all ${activeTab === 'agents' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
              title="AI Agents"
            >
              <Bot className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { onToggle(); setActiveTab('files'); }}
              className={`p-2 rounded-xl transition-all ${activeTab === 'files' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
              title="Workspace Files"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Body Section */}
        {isOpen && (
          <div className="flex-grow overflow-y-auto space-y-1.5 custom-scrollbar pr-1 select-none">
            {activeTab === 'chats' && (
              <>
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 leading-normal">
                    No active sessions found.
                  </div>
                ) : (
                  filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      className={`group relative flex items-center justify-between rounded-xl p-2.5 transition-all text-left border ${
                        activeSessionId === session.id
                          ? 'bg-gradient-to-r from-cyan-600/15 to-blue-600/15 border-cyan-500/30 text-white'
                          : 'bg-transparent border-transparent hover:bg-white/[0.04] text-slate-300 hover:text-white'
                      }`}
                    >
                      <button
                        onClick={() => onSelectSession(session.id)}
                        className="flex-grow flex items-center gap-2.5 min-w-0 text-left cursor-pointer focus:outline-none"
                      >
                        <FileText className={`w-3.5 h-3.5 shrink-0 ${activeSessionId === session.id ? 'text-cyan-400' : 'text-slate-400'}`} />
                        <div className="truncate text-xs font-medium">
                          {session.title || "Empty Workspace Session"}
                        </div>
                      </button>

                      <button
                        onClick={() => onDeleteSession(session.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-all cursor-pointer ml-1"
                        title="Delete Session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'agents' && (
              <div className="space-y-2">
                {PRESET_AGENTS.map((agent, index) => (
                  <button
                    key={index}
                    onClick={() => onSelectAgent(agent.name, agent.prompt)}
                    className="w-full text-left bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-cyan-500/30 p-3 rounded-xl transition-all cursor-pointer group flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-xs font-bold text-cyan-300 group-hover:text-cyan-200">
                        {agent.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-normal">
                      {agent.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'files' && (
              <div className="space-y-1.5">
                {WORKSPACE_FILES.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-xs text-slate-300 truncate">{file.name}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono shrink-0">{file.size}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sidebar Footer Settings section */}
        {isOpen ? (
          <div className="pt-3 border-t border-white/5 mt-auto flex flex-col gap-2">
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all font-medium text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-400" />
                <span>Endpoint Settings</span>
              </div>
              <span className="text-[9px] text-cyan-400 font-mono tracking-widest bg-cyan-950/40 border border-cyan-500/20 px-1.5 py-0.5 rounded-md">V1</span>
            </button>
          </div>
        ) : (
          <div className="pt-3 border-t border-white/5 mt-auto flex justify-center">
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Endpoint Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
