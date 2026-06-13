import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react';

interface VoiceWaveProps {
  isActive: boolean;
  onClose: () => void;
  onTranscriptReady: (text: string) => void;
}

const VoiceWave: React.FC<VoiceWaveProps> = ({ isActive, onClose, onTranscriptReady }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Listening to your voice...');
  const [bars, setBars] = useState<number[]>(Array(15).fill(15));

  // Generate random sound wave activity for the visualizer
  useEffect(() => {
    if (!isActive || isMuted || !isListening) {
      setBars(Array(15).fill(15));
      return;
    }

    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.floor(Math.random() * 60) + 10));
    }, 120);

    return () => clearInterval(interval);
  }, [isActive, isMuted, isListening]);

  // Mock voice recognition timeline
  useEffect(() => {
    if (!isActive) return;

    setStatusMessage('Listening to your voice...');
    
    const timers = [
      setTimeout(() => setStatusMessage('Processing high-frequency audio...'), 4000),
      setTimeout(() => setStatusMessage('Transcribing speech segments...'), 7000),
      setTimeout(() => {
        setStatusMessage('Speech processed successfully!');
        const MOCK_PROMPTS = [
          "Explain the difference between call and apply in JavaScript.",
          "Write a neat utility component for drag-and-drop in React.",
          "Design a stylish glassmorphic card component with Tailwind CSS.",
          "Show me the absolute best way to handle global state securely."
        ];
        const randomPrompt = MOCK_PROMPTS[Math.floor(Math.random() * MOCK_PROMPTS.length)];
        onTranscriptReady(randomPrompt);
        onClose();
      }, 9500)
    ];

    return () => timers.forEach(clearTimeout);
  }, [isActive, onTranscriptReady, onClose]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-40 animate-fade-in select-none">
      <div 
        className="w-full max-w-sm rounded-3xl bg-slate-900/60 border border-white/10 p-6 flex flex-col items-center relative overflow-hidden text-center"
        style={{
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        {/* Soft pulsing ambient background behind wave */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

        {/* Header Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <h2 className="text-sm font-bold tracking-wider text-cyan-300 uppercase mb-1">
          Clever Voice Mode
        </h2>
        <span className="text-xs text-slate-400 font-mono mb-8 font-medium">
          ULTRA-LOW LATENCY SSE
        </span>

        {/* Beautiful Animated Waveform Visualizer */}
        <div className="flex items-end justify-center gap-1 h-24 mb-8 w-full px-4">
          {bars.map((height, index) => (
            <div
              key={index}
              className="w-1.5 bg-gradient-to-t from-cyan-500 via-blue-500 to-indigo-400 rounded-full transition-all duration-100 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
              style={{ height: `${height}%` }}
            ></div>
          ))}
        </div>

        {/* Realtime Transcribed HUD Text */}
        <div className="mb-8 min-h-[40px] px-2">
          <p className="text-slate-200 text-sm font-medium animate-pulse">
            {statusMessage}
          </p>
          <span className="text-[10px] text-slate-500 block mt-1">
            (BETA: Press mic to toggle active audio transmission stream)
          </span>
        </div>

        {/* Voice control layout panel */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              isMuted 
                ? 'bg-red-500/20 border-red-500/30 text-red-300' 
                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title={isMuted ? "Unmute Assistant voice response" : "Mute Assistant voice response"}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setIsListening(!isListening)}
            className={`p-4 rounded-3xl border transition-all duration-200 cursor-pointer ${
              isListening 
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
                : 'bg-slate-800 border-white/5 text-slate-500'
            }`}
            title={isListening ? "Pause processing vocal chords" : "Resume listening for voice signature"}
          >
            {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceWave;
