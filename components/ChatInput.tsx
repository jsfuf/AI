import React, { useRef, useState, useEffect } from 'react';
import { ArrowUp, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import { Attachment } from '../types';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: Attachment[]) => void;
  isLoading: boolean;
  inputValue: string;
  setInputValue: (val: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, inputValue, setInputValue }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Auto-grow textarea handler (exactly like ChatGPT with dynamic padding and height adjustments)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // Set to scrollHeight but max out around 200px
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  };

  const handleSend = () => {
    const trimmedInput = inputValue.trim();
    if ((trimmedInput || attachments.length > 0) && !isLoading) {
      onSendMessage(trimmedInput, attachments);
      setInputValue('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If enter pressed without shift key, initiate send
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleFileSelectClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Check file size limit
    if (file.size > 8 * 1024 * 1024) {
      alert("Image is too large. Please upload an image under 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      const sizeStr = (file.size / 1024).toFixed(1) + ' KB';
      
      const newAttachment: Attachment = {
        id: 'att-' + Date.now(),
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'txt',
        url: base64Data,
        size: sizeStr
      };

      setAttachments(prev => [...prev, newAttachment]);
    };
    reader.readAsDataURL(file);

    // Reset input
    event.target.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const hasContent = inputValue.trim().length > 0 || attachments.length > 0;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 mb-4 shrink-0 z-10 flex flex-col gap-2">
      
      {/* File preview rails inside or above capsule, styled with slick rounded pills */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2.5 p-2 px-3 bg-[#2f2f2f]/80 rounded-2xl border border-white/5 backdrop-blur-md animate-fade-in w-fit">
          {attachments.map((att) => (
            <div 
              key={att.id} 
              className="relative group w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-[#171717] flex items-center justify-center shadow-md animate-scale-up"
            >
              {att.type === 'image' ? (
                <img 
                  src={att.url} 
                  alt="Attachment thumbnail" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <Paperclip className="w-5 h-5 text-slate-400" />
                  <span className="text-[7px] truncate max-w-[45px] p-0.5">{att.name}</span>
                </div>
              )}
              
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 rounded-full text-slate-300 hover:text-white shadow transition-all cursor-pointer opacity-90 group-hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* integrated input container capsule */}
      <div className="flex flex-col bg-[#2f2f2f] hover:bg-[#353535]/95 focus-within:bg-[#353535] rounded-[26px] p-2.5 border border-[#3e3e3e] focus-within:border-[#525252] transition-all duration-200 shadow-[0_10px_30px_rgba(0,0,0,0.25)] min-h-[52px]">
        {/* Input Text Area Row */}
        <div className="flex items-start w-full px-2 pt-1">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder="Message Clever AI..."
            className="flex-grow bg-transparent text-[15px] text-slate-100 placeholder-slate-500 font-sans leading-relaxed resize-none outline-none focus:outline-none focus:ring-0 border-0 m-0 p-0 max-h-[200px] scrollbar-none"
            rows={1}
            disabled={isLoading}
            style={{ minHeight: '24px' }}
          />
        </div>

        {/* Action rows at bottom of capsule */}
        <div className="flex items-center justify-between mt-2.5 px-1 pb-0.5">
          {/* File select trigger button on left */}
          <div className="flex items-center gap-1">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            <button
              type="button"
              onClick={handleFileSelectClick}
              disabled={isLoading}
              className="p-1.5 bg-[#212121]/50 hover:bg-[#212121] text-[#b4b4b4] hover:text-white rounded-full transition-all cursor-pointer flex items-center justify-center border border-white/5 disabled:opacity-40"
              title="Add image attachment"
            >
              <Paperclip className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* Send up-arrow button on right */}
          <button
            onClick={handleSend}
            disabled={isLoading || !hasContent}
            className={`w-[32px] h-[32px] rounded-full flex items-center justify-center transition-all duration-300 font-bold ${
              hasContent && !isLoading
                ? 'bg-white text-[#171717] hover:opacity-90 active:scale-90 shadow-md cursor-pointer'
                : 'bg-[#212121]/50 text-[#5f5f5f] border border-white/5 cursor-not-allowed'
            }`}
            title="Send prompt"
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>
      
      {/* Disclaimer subtext exactly like ChatGPT */}
      <span className="text-[11px] text-[#8e8e8e] select-none text-center block font-sans mt-0.5">
        Clever AI can make mistakes. Consider checking important information.
      </span>
    </div>
  );
};

export default ChatInput;
