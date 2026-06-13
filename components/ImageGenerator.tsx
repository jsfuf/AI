import React, { useState } from 'react';
import { Image, Layers, Sparkles, Sliders, X } from 'lucide-react';

interface ImageGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, style: string, ratio: string) => void;
}

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ isOpen, onClose, onGenerate }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Photorealistic Studio');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [quality, setQuality] = useState('High Defin');

  const STYLES = [
    { name: 'Photorealistic Studio', desc: 'Ultra crisp dynamic exposure' },
    { name: 'Apple Glass Glossy', desc: 'Symmetrical 3D design translucency' },
    { name: 'Cyberpunk Neon', desc: 'Vaporwave colors and holographic flare' },
    { name: 'Minimalist Vector Art', desc: 'Flat geometries and soft palette' },
    { name: 'Classic Anime Sketch', desc: 'Detailed ink contours' },
  ];

  const RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];

  const handleCreate = () => {
    if (!prompt.trim()) return;
    onGenerate(prompt.trim(), selectedStyle, aspectRatio);
    onClose();
    setPrompt('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-40 animate-fade-in select-none">
      <div 
        className="w-full max-w-md rounded-3xl bg-slate-900/60 border border-white/10 p-6 flex flex-col relative text-left"
        style={{
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        {/* Absolute brand ambient light */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide text-cyan-300 uppercase leading-none">
              DALL-E / Imagen 3 Engine
            </h2>
            <span className="text-[10px] text-slate-400">MULTIPROCESSING IMAGE STUDIO</span>
          </div>
        </div>

        {/* Prompt description input */}
        <div className="mb-4">
          <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 pl-1 block mb-2">Descriptive Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to render (e.g. 'A futuristic sleek developer workspace under liquid neon lights')..."
            className="w-full bg-black/35 border border-white/10 focus:border-cyan-500/40 hover:border-white/15 outline-none rounded-2xl p-3 text-xs text-white placeholder-slate-500 min-h-[70px] resize-none"
          />
        </div>

        {/* Style presets list */}
        <div className="mb-4">
          <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 pl-1 block mb-2 leading-none">Aesthetic Preset Style</label>
          <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
            {STYLES.map((style) => (
              <button
                key={style.name}
                onClick={() => setSelectedStyle(style.name)}
                className={`w-full text-left p-2 rounded-xl transition-all border flex flex-col cursor-pointer ${
                  selectedStyle === style.name
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                    : 'bg-transparent border-transparent hover:bg-white/[0.03] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span className="text-xs font-bold leading-none">{style.name}</span>
                </div>
                <span className="text-[10px] opacity-70 mt-0.5 pl-4">{style.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio selector */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 pl-1 block mb-2">Aspect Ratio</label>
            <div className="flex gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
              {RATIOS.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    aspectRatio === ratio ? 'bg-cyan-600/30 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={!prompt.trim()}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-[0_8px_24px_rgba(6,182,212,0.3)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-cyan-400/20"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          Render Masterpiece
        </button>
      </div>
    </div>
  );
};

export default ImageGenerator;
