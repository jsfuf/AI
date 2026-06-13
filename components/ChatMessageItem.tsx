import React, { useState } from 'react';
import { ChatMessage, MessageSender } from '../types';
import { 
  FileText, 
  Download, 
  Check, 
  Copy, 
  Sparkles,
  Code2,
  Edit2
} from 'lucide-react';
import { motion } from 'motion/react';

interface ChatMessageItemProps {
  message: ChatMessage;
  onEditMessage?: (id: string, text: string) => void;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, onEditMessage }) => {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);

  const isUser = message.sender === MessageSender.USER;
  const isAdmin = message.sender === MessageSender.AI;
  const isSystem = message.sender === MessageSender.SYSTEM;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleCopyCode = async (code: string, blockId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(blockId);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  const renderTextWithImages = (textPart: string, parentKey: string) => {
    const imageRegex = /!\[([^\]]*)\]\((.*?)\)/g;
    const elements = [];
    let imgLastIndex = 0;
    let imgMatch;
    
    while ((imgMatch = imageRegex.exec(textPart)) !== null) {
      const imgMatchIndex = imgMatch.index;
      if (imgMatchIndex > imgLastIndex) {
        elements.push(
          <span key={`${parentKey}-t1-${imgLastIndex}`}>
            {textPart.substring(imgLastIndex, imgMatchIndex)}
          </span>
        );
      }
      
      const alt = imgMatch[1];
      const url = imgMatch[2];
      elements.push(
        <div key={`${parentKey}-img-${imgMatchIndex}`} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 group/img shadow-md max-w-sm my-4 block">
          <img 
            src={url} 
            alt={alt} 
            referrerPolicy="no-referrer"
            className="w-full h-auto object-cover select-all hover:scale-[1.02] transition-transform duration-350" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity p-2.5 flex items-end justify-between">
            <span className="text-[10px] text-white truncate font-medium">{alt || 'Generated Image'}</span>
            <button 
              onClick={(e) => {
                e.preventDefault();
                fetch(url)
                  .then(r => r.blob())
                  .then(b => {
                    const burl = URL.createObjectURL(b);
                    const a = document.createElement('a');
                    a.href = burl;
                    a.download = (alt || 'image').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.png';
                    a.click();
                  })
                  .catch(err => {
                    console.error('Failed to download image', err);
                    window.open(url, '_blank');
                  });
              }}
              className="p-1 px-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-[9px] flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              GET
            </button>
          </div>
        </div>
      );
      imgLastIndex = imageRegex.lastIndex;
    }
    
    if (imgLastIndex < textPart.length) {
      elements.push(
        <span key={`${parentKey}-t2-${imgLastIndex}`}>
          {textPart.substring(imgLastIndex)}
        </span>
      );
    }
    
    return elements;
  };

  // Parses and renders markdown-like code blocks elegantly
  const renderMessageContent = (text: string) => {
    if (!text) return null;

    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      
      if (matchIndex > lastIndex) {
        parts.push(
          <div key={`text-${lastIndex}`} className="whitespace-pre-wrap text-[15px] sm:text-[15px] leading-relaxed text-[#ececec] font-sans">
            {renderTextWithImages(text.substring(lastIndex, matchIndex), `text-${lastIndex}`)}
          </div>
        );
      }

      const lang = match[1] || 'code';
      const code = match[2];
      const blockId = `code-block-${matchIndex}`;

      parts.push(
        <div key={blockId} className="my-4 rounded-xl overflow-hidden bg-black/50 border border-white/5 shadow-md text-left">
          <div className="flex items-center justify-between px-4 py-2 bg-[#2f2f2f]/60 border-b border-white/5 select-none text-[11px] font-mono font-medium text-slate-300">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-xs font-semibold text-slate-300">
              <Code2 className="w-3.5 h-3.5 text-slate-400" />
              {lang}
            </span>
            <button
              onClick={() => handleCopyCode(code, blockId)}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-[12px]"
            >
              {copiedCode === blockId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy code</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-4 overflow-x-auto font-mono text-[13px] text-emerald-100/95 leading-relaxed max-w-full scrollbar-thin">
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(
        <div key={`text-${lastIndex}`} className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#ececec] font-sans">
          {renderTextWithImages(text.substring(lastIndex), `text-${lastIndex}`)}
        </div>
      );
    }

    return parts.length > 0 ? parts : <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#ececec] font-sans">{renderTextWithImages(text, 'text-fallback')}</div>;
  };

  if (isSystem) {
    return (
      <div className="flex w-full justify-center my-4 px-4">
        <div className="bg-[#2f2f2f]/30 border border-white/5 text-amber-200/90 text-xs rounded-xl px-4 py-2 shadow-sm italic max-w-lg text-center leading-relaxed">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`group w-full flex gap-4 my-6 px-1 lg:px-4 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* ChatGPT Layout: AI messages have a circular logo on left and flow in horizontal columns */}
      {!isUser && (
        <div className="w-[32px] h-[32px] rounded-full bg-[#2f2f2f] border border-white/10 flex items-center justify-center text-[#ececec] shrink-0 shadow-sm mt-0.5 select-none">
          <Sparkles className="w-4 h-4 text-emerald-400 fill-emerald-400/10" />
        </div>
      )}

      {/* Message Inner block */}
      <div className={`flex flex-col ${isUser ? 'max-w-[75%] sm:max-w-[70%] select-text' : 'flex-grow max-w-[85%] sm:max-w-[78%] lg:max-w-2xl text-left'}`}>
        
        {/* User Bubble styling (sleek pill shape on right, bg-[#2f2f2f]) */}
        <div 
          className={`relative transition-all duration-200 ${
            isUser 
              ? 'bg-[#2f2f2f] hover:bg-[#353535] text-[#ececec] rounded-[24px] px-5 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.15)]' 
              : 'text-[#ececec] space-y-3'
          }`}
        >
          {/* Dynamic Markdown & code chunks */}
          <div className="space-y-4">
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea 
                  className="w-full bg-[#1e1e1e] text-slate-200 p-3 rounded-lg border border-[#4d4d4d] focus:outline-none focus:border-teal-500 resize-y min-h-[100px] text-sm font-sans"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setEditText(message.text);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors bg-[#2f2f2f] hover:bg-[#3d3d3d] rounded-md backdrop-blur-md"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      if (onEditMessage && editText.trim() !== '') {
                        onEditMessage(message.id, editText);
                        setIsEditing(false);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-md backdrop-blur-md transition-colors shadow-sm"
                  >
                    Save & Submit
                  </button>
                </div>
              </div>
            ) : (
              renderMessageContent(message.text)
            )}
            
            {message.isStreaming && (
              <span className="inline-flex gap-1 items-center ml-1 select-none">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
              </span>
            )}
          </div>

          {/* Render files in custom stylish list */}
          {message.attachments && message.attachments.length > 0 && (
            <div className={`mt-3 border-t border-white/5 pt-3.5 space-y-2`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.attachments.map((file) => {
                  const isImage = file.type === 'image' || file.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
                  
                  if (isImage) {
                    return (
                      <div 
                        key={file.id} 
                        className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 group/img shadow-md max-w-sm"
                      >
                        <img 
                          src={file.url} 
                          alt={file.name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-auto object-cover max-h-52 select-all hover:scale-[1.02] transition-transform duration-350" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity p-2.5 flex items-end justify-between">
                          <span className="text-[10px] text-white truncate font-medium">{file.name}</span>
                          <a 
                            href={file.url} 
                            download={file.name}
                            className="p-1 px-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-[9px] flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            GET
                          </a>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate flex flex-col">
                            <span className="text-xs text-slate-200 truncate font-semibold">{file.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono">{file.size || 'FILE'}</span>
                          </div>
                        </div>
                        <a 
                          href={file.url} 
                          download={file.name}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/15 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          )}

          {/* Render metadata HUD for generated images */}
          {message.imageDetails && (
            <div className="mt-2.5 p-2 px-3 rounded-lg bg-emerald-950/20 border border-emerald-500/15 text-[10px] font-mono text-emerald-400/90 leading-relaxed">
              <span className="font-bold uppercase tracking-wider block mb-0.5 text-xs text-indigo-300">Generated Spec Metadata</span>
              <p className="text-slate-300">Prompt: "{message.imageDetails.prompt}"</p>
              <p className="text-slate-400 text-[9px] mt-0.5">Style: {message.imageDetails.style} | Aspect Ratio: {message.imageDetails.aspectRatio}</p>
            </div>
          )}
        </div>

        {/* ChatGPT hover utility toolbar (completely hidden by default, visible on hover, matching ChatGPT) */}
        <div className={`flex items-center mt-2.5 gap-3 transition-opacity ${isUser ? 'justify-end opacity-0 group-hover:opacity-100' : 'justify-start opacity-0 group-hover:opacity-100'} select-none`}>
          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
            {message.isEdited && <span>(edited) </span>}
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isUser && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 hover:bg-[#353535] rounded transition-colors text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Edit message"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleCopyText}
            className="p-1 hover:bg-[#353535] rounded transition-colors text-slate-400 hover:text-slate-200 cursor-pointer"
            title="Copy message"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessageItem;
