import React from 'react';
import { Sparkles, Terminal, Palette, Lightbulb, Code2 } from 'lucide-react';

interface AnonymousBotLogoProps {
  onSelectPrompt: (promptText: string) => void;
  onOpenSettings?: () => void;
}

const AnonymousBotLogo: React.FC<AnonymousBotLogoProps> = ({ onSelectPrompt, onOpenSettings }) => {
  const prompts = [
    {
      title: "Help me debug TypeScript",
      subtext: "Explain a type error or resolve compilation bugs.",
      prompt: "I have a TypeScript compiling issue. Can you look at my code and help me identify any type safety or layout bugs?",
      icon: <Terminal className="w-4 h-4 text-emerald-400" />
    },
    {
      title: "Design a sleek interface",
      subtext: "Suggest beautiful design pairings and layouts.",
      prompt: "Suggest a modern minimalist bento-grid slate design layout with elegant typography and high-density spacing.",
      icon: <Palette className="w-4 h-4 text-sky-400" />
    },
    {
      title: "Write high-fidelity code",
      subtext: "Generate clean SOLID components in React.",
      prompt: "Can you design a robust, clean React component in a single, well-documented file following strict SOLID principles?",
      icon: <Code2 className="w-4 h-4 text-violet-400" />
    },
    {
      title: "Brainstorm creative concepts",
      subtext: "Explore edge cases and features.",
      prompt: "Let's brainstorm unique ideas to optimize private high-performance AI workspace applications.",
      icon: <Lightbulb className="w-4 h-4 text-amber-400" />
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center p-4 py-12 md:py-24 z-10 animate-fade-in my-auto max-w-2xl mx-auto select-none font-sans">
      
      {/* Icon logo */}
      <div className="mb-6 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-[#2f2f2f] border border-white/10 flex items-center justify-center text-white shadow-md">
          <Sparkles className="w-7 h-7 text-emerald-400 fill-emerald-400/5 animate-pulse-slow" />
        </div>
      </div>
      
      {/* Greeting Title */}
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#f9f9f9]">
        What can I help with today?
      </h1>
      
      {onOpenSettings && (
        <div className="mt-3 flex items-center gap-2 px-3 py-1 bg-[#2f2f2f]/60 rounded-full text-[11px] text-[#b4b4b4] border border-white/5">
          <span>Provider: <span className="text-emerald-400 font-bold uppercase">Minimax</span></span>
          <span className="text-white/10">|</span>
          <button
            onClick={onOpenSettings}
            className="text-[#ececec] hover:text-white underline transition-colors cursor-pointer"
          >
            Settings
          </button>
        </div>
      )}

      {/* Grid of ChatGPT-inspired starters */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {prompts.map((p, index) => (
          <button
            key={index}
            onClick={() => onSelectPrompt(p.prompt)}
            className="text-left bg-transparent border border-white/[0.08] hover:bg-[#2f2f2f]/50 hover:border-white/15 rounded-2xl p-4 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500/40 relative group"
          >
            <div className="flex flex-col h-full justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#2f2f2f] border border-white/5 flex items-center justify-center">
                  {p.icon}
                </div>
                <span className="text-sm font-medium text-[#ececec] group-hover:text-white transition-colors">
                  {p.title}
                </span>
              </div>
              <p className="text-[12px] text-[#8e8e8e] group-hover:text-slate-300 transition-colors leading-relaxed">
                {p.subtext}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AnonymousBotLogo;
