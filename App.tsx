import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Chat } from '@google/genai';
import { extractMemoryFromDialog } from './services/geminiService';
import { ChatMessage, MessageSender, ChatHistoryItem, Attachment, UserProfile, LearnedMemory } from './types';
import ChatMessageItem from './components/ChatMessageItem';
import ChatInput from './components/ChatInput';
import LoadingSpinner from './components/LoadingSpinner';
import AnonymousBotLogo from './components/AnonymousBotLogo';
import { getOpenCodeStream, OpenCodeConfig } from './services/opencodeService';
import OpenCodeSettingsModal from './components/OpenCodeSettingsModal';
import { 
  initFirebase,
  saveSessionToFirebase,
  deleteSessionFromFirebase,
  saveLearnedMemory,
  removeMemoryFromFirebase,
  subscribeToSessions,
  subscribeToMemories,
  subscribeToAuth,
  fetchUserProfile,
  logoutUser,
  signInWithGoogle,
  signUpWithEmailAndPassword,
  signInWithEmailAndPasswordHelper
} from './services/firebaseService';
import MemoryBankModal from './components/MemoryBankModal';
import { 
  Sparkles, 
  Settings,
  Plus,
  Brain,
  LogOut,
  User,
  ShieldCheck,
  AlertCircle,
  Mail,
  Lock,
  Menu,
  Search,
  Pin,
  Edit2,
  Check,
  X,
  Clock,
  MessageSquare,
  MoreHorizontal,
  Copy,
  Download,
  Archive
} from 'lucide-react';

const CLEVER_AI_SYSTEM_INSTRUCTION = `You are a powerful, multimodal assistant named clever AI that can read and write text, analyze and edit images, generate new images, run code snippets, and produce structured outputs. Be concise, helpful, and proactive about clarifying ambiguous user goals only when essential. Prioritize safety, accessibility, and user control.

**Capabilities to enable**  
- **Text**: natural language conversation, summaries, step‑by‑step instructions, code generation, translation, and structured data outputs (JSON, CSV, Markdown).  
- **Multimodal**: accept image uploads for analysis, annotation, and editing; accept image URLs and metadata.  
- **Image generation**: create new images from text prompts with style, aspect ratio, resolution, and seed controls.  
- **Image editing**: crop, retouch, replace background, add or remove objects, apply style transfer, and overlay text.  
- **Batch operations**: accept multiple images or multiple prompts and run bulk transforms or bulk generation with per-item overrides.  
- **File handling**: accept common file types for context (PNG, JPG, SVG, PDF, TXT) and extract text or images for processing.  
- **Streaming and progressive replies**: stream partial text responses and progressive image previews when available.  
- **State and memory**: remember user preferences for style, tone, and default image settings during the session.  
- **Safety and privacy**: refuse or safely handle requests that violate policy; always ask for consent before storing personal data.

**Behavioral rules**  
- Ask at most 1–2 short clarifying questions only when essential.  
- Offer explicit, actionable options and presets for image style, size, and format.  
- Provide short summaries up front, then detailed steps or alternatives.  
- Use accessible language and include alt text for any image descriptions you produce.  
- When returning multiple options, label them clearly (Option A, Option B, Option C) and include a one‑line summary for each.

**Response format**  
When the user requests an image or UI spec, return:  
1. **One‑line summary** of the result.  
2. **Parameters** used (style, size, seed, prompt).  
3. **Step‑by‑step actions** taken or recommended.  
4. **Editable JSON** block with all parameters for reproducibility.  
5. **Accessibility notes** and suggested alt text.`;

const DEFAULT_OPENCODE_KEY = "sk-dqFoC6RBsAA4CCXoNcIfb6wXXkt9wuyZPFIxLZAnS1HT1FaZHOCleBPxfvSk7Wna";
const DEFAULT_OPENCODE_BASE_URL = "https://api.opencode.ai/v1";
const DEFAULT_OPENCODE_MODEL = "opencode-coder-v1";

const getGroupForDate = (date: Date): 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Previous 30 Days' | 'Older' => {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayMidnight = todayMidnight - 24 * 60 * 60 * 1000;
  const sevenDaysAgoMidnight = todayMidnight - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgoMidnight = todayMidnight - 30 * 24 * 60 * 60 * 1000;

  const dateTime = date.getTime();

  if (dateTime >= todayMidnight) {
    return 'Today';
  } else if (dateTime >= yesterdayMidnight) {
    return 'Yesterday';
  } else if (dateTime >= sevenDaysAgoMidnight) {
    return 'Previous 7 Days';
  } else if (dateTime >= thirtyDaysAgoMidnight) {
    return 'Previous 30 Days';
  } else {
    return 'Older';
  }
};

const deduplicateAndPurgeClones = async (userUid: string, rawSessions: ChatHistoryItem[], firebaseEnabled: boolean) => {
  if (!rawSessions || rawSessions.length === 0) return rawSessions;

  const uniqueSessions: ChatHistoryItem[] = [];
  const idsToPurgeFromFirebase: string[] = [];

  const sorted = [...rawSessions].sort((a, b) => {
    const tA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
    const tB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
    return tB - tA;
  });

  for (const session of sorted) {
    const isDuplicate = uniqueSessions.some(existing => {
      if (existing.id === session.id) return true;

      const existingMsgs = existing.messages || [];
      const sessionMsgs = session.messages || [];

      // Never count empty sessions as duplicates of each other if they have different IDs
      if (existingMsgs.length === 0 || sessionMsgs.length === 0) {
        return false;
      }

      if (existingMsgs.length !== sessionMsgs.length) return false;

      return existingMsgs.every((m, idx) => {
        const companion = sessionMsgs[idx];
        return companion && m.text === companion.text && m.sender === companion.sender;
      });
    });

    if (isDuplicate) {
      idsToPurgeFromFirebase.push(session.id);
    } else {
      uniqueSessions.push(session);
    }
  }

  if (idsToPurgeFromFirebase.length > 0 && firebaseEnabled) {
    for (const dupId of idsToPurgeFromFirebase) {
      try {
        await deleteSessionFromFirebase(userUid, dupId);
      } catch (err) {
        console.error("Failed to purge duplicate clone:", dupId, err);
      }
    }
  }

  return uniqueSessions;
};

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Authentication and live profile states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  
  // Email/Password mode states
  const [isSignUpMode, setIsSignUpMode] = useState<boolean>(false);
  const [emailInputValue, setEmailInputValue] = useState<string>('');
  const [passwordInputValue, setPasswordInputValue] = useState<string>('');
  const [displayNameInputValue, setDisplayNameInputValue] = useState<string>('');
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);

  // Multi-session state with local state fallback when Firebase sync is initializing
  const [sessions, setSessions] = useState<ChatHistoryItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Search, inline edit, and pinning states for ChatGPT-like history panel
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const handleTogglePinSession = async (sess: ChatHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedPinned = !sess.isPinned;
    setSessions(prev => prev.map(s => s.id === sess.id ? { ...s, isPinned: updatedPinned } : s));
    if (firebaseEnabled && currentUser) {
      await saveSessionToFirebase(currentUser.uid, {
        ...sess,
        isPinned: updatedPinned
      });
    }
  };

  const handleStartEditing = (sess: ChatHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(sess.id);
    setEditingTitle(sess.title);
  };

  const handleSaveTitle = async (sess: ChatHistoryItem) => {
    if (!editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    setSessions(prev => prev.map(s => s.id === sess.id ? { ...s, title: editingTitle } : s));
    setEditingSessionId(null);
    if (firebaseEnabled && currentUser) {
      await saveSessionToFirebase(currentUser.uid, {
        ...sess,
        title: editingTitle
      });
    }
  };

  const handleDuplicateSession = async (sess: ChatHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicated: ChatHistoryItem = {
      ...sess,
      id: Date.now().toString() + '-chat',
      title: sess.title + ' (Copy)',
      timestamp: new Date(),
      createdAt: new Date(),
    };
    setSessions(prev => [duplicated, ...prev]);
    if (firebaseEnabled && currentUser) {
      await saveSessionToFirebase(currentUser.uid, duplicated);
    }
    setOpenContextMenuId(null);
  };

  const handleArchiveSession = async (sess: ChatHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const isArchived = !sess.isArchived;
    setSessions(prev => prev.map(s => s.id === sess.id ? { ...s, isArchived } : s));
    if (firebaseEnabled && currentUser) {
      await saveSessionToFirebase(currentUser.uid, { ...sess, isArchived });
    }
    setOpenContextMenuId(null);
  };

  const handleExportSession = (sess: ChatHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const content = sess.messages.map(m => `[${m.sender}] ${m.text}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sess.title}.txt`;
    a.click();
    setOpenContextMenuId(null);
  };

  // Connection settings
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState<string>('');
  const [openContextMenuId, setOpenContextMenuId] = useState<string | null>(null);

  const [aiProvider, setAiProvider] = useState<'gemini' | 'opencode' | 'qwen'>(() => {
    return (localStorage.getItem('ai_provider') as 'gemini' | 'opencode' | 'qwen') || 'opencode';
  });
  
  const [opencodeConfig, setOpencodeConfig] = useState<OpenCodeConfig>(() => {
    let savedKey = localStorage.getItem('opencode_api_key');
    if (!savedKey || savedKey === '1' || savedKey.trim() === '' || savedKey === 'sk-TTQQRrH75dAOmFCfF4q5BpwFNbcz3ZGMMhQPt6DXIsIKZQgZke5Ht7ZG6ojjCYyH') {
      savedKey = DEFAULT_OPENCODE_KEY;
      localStorage.setItem('opencode_api_key', savedKey);
    }
    const savedUrl = localStorage.getItem('opencode_base_url') || DEFAULT_OPENCODE_BASE_URL;
    const savedModel = localStorage.getItem('opencode_model') || DEFAULT_OPENCODE_MODEL;
    return {
      apiKey: savedKey,
      baseUrl: savedUrl,
      model: savedModel,
      systemInstruction: CLEVER_AI_SYSTEM_INSTRUCTION,
    };
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Firebase configurations
  const [firebaseEnabled, setFirebaseEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('firebase_enabled');
    return saved === null ? true : saved === 'true'; // Default to true
  });
  const [firebaseDbUrl, setFirebaseDbUrl] = useState<string>(() => {
    return localStorage.getItem('firebase_db_url') || 'https://studio-8488362861-8360d-default-rtdb.firebaseio.com';
  });
  const [firebaseProjectId, setFirebaseProjectId] = useState<string>(() => {
    return localStorage.getItem('firebase_project_id') || 'studio-8488362861-8360d';
  });

  const [memories, setMemories] = useState<LearnedMemory[]>([]);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);
  const [isMemoryLoading, setIsMemoryLoading] = useState<boolean>(false);

  // Responsive device sidebar toggle (defaults to open on desktop, sliding closed on mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    return window.innerWidth >= 768;
  });

  // Cognitive Auto-Memory toggle (defaults to false to prevent unsolicited saving or showing on website)
  const [autoMemoryEnabled, setAutoMemoryEnabled] = useState<boolean>(() => {
    return localStorage.getItem('auto_memory_learning') === 'true'; // Defaults to false
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleToggleAutoMemory = () => {
    setAutoMemoryEnabled(prev => {
      const nextVal = !prev;
      localStorage.setItem('auto_memory_learning', nextVal ? 'true' : 'false');
      return nextVal;
    });
  };

  // Initialize Firebase RTDB Client when configuration changes
  useEffect(() => {
    initFirebase({
      apiKey: '', // Lazy loads VITE_FIREBASE_API_KEY from environment or defaults
      databaseURL: firebaseDbUrl,
      projectId: firebaseProjectId,
      enabled: firebaseEnabled,
    });
  }, [firebaseDbUrl, firebaseProjectId, firebaseEnabled]);

  // Handle Authentication Subscription
  useEffect(() => {
    if (!firebaseEnabled) {
      setAuthLoading(false);
      return;
    }

    setAuthLoading(true);
    const unsubscribeAuth = subscribeToAuth(async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const profile = await fetchUserProfile(user.uid);
          setUserProfile(profile);
          localStorage.setItem('firebase_user_uid', user.uid);
        } catch (e) {
          console.error("Failed to load user profile:", e);
        }
      } else {
        setUserProfile(null);
        setSessions([]);
        setActiveSessionId(null);
        localStorage.removeItem('firebase_user_uid');
      }
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, [firebaseEnabled]);

  const handleProfileUpdated = async () => {
    if (currentUser) {
      try {
        const profile = await fetchUserProfile(currentUser.uid);
        setUserProfile(profile);
      } catch (e) {
        console.error("Failed to reload profile:", e);
      }
    }
  };

  // Sync user-specific chatData sessions and memories list changes in real-time
  useEffect(() => {
    if (!firebaseEnabled || !currentUser) return;

    setIsMemoryLoading(true);

    const unsubscribeSessions = subscribeToSessions(currentUser.uid, async (syncedSessions) => {
      if (syncedSessions) {
        // Automatically deduplicate alike cloned sessions in the user's real-time database
        const cleaned = await deduplicateAndPurgeClones(currentUser.uid, syncedSessions, firebaseEnabled);
        
        setSessions(cleaned);
        // Set active session ID if not set or not in synced list
        if (cleaned.length > 0) {
          const ids = cleaned.map(s => s.id);
          if (!activeSessionId || !ids.includes(activeSessionId)) {
            setActiveSessionId(cleaned[0].id);
          }
        } else {
          // If completely empty, compose an initial draft session and persist it to the unified database
          const initialId = 'sess-initial';
          const draft: ChatHistoryItem = {
            id: initialId,
            title: 'New Session Workspace',
            timestamp: new Date(),
            messages: []
          };
          setSessions([draft]);
          setActiveSessionId(initialId);
          await saveSessionToFirebase(currentUser.uid, draft);
        }
      }
    });

    const unsubscribeMemories = subscribeToMemories(currentUser.uid, (syncedMemories) => {
      setMemories(syncedMemories);
      setIsMemoryLoading(false);
    });

    return () => {
      unsubscribeSessions();
      unsubscribeMemories();
    };
  }, [firebaseEnabled, currentUser, activeSessionId]);

  // Handle provider changes
  const handleProviderChange = (provider: 'gemini' | 'opencode' | 'qwen') => {
    setAiProvider(provider);
    localStorage.setItem('ai_provider', provider);
    setError(null);
  };

  useEffect(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [sessions, activeSessionId]);

  // Derive variables for currently selected session
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || null;
  const messages = activeSession ? activeSession.messages : [];

  // Mutator to update messages list on the active session (with optional title renaming atomically)
  const updateActiveSessionMessages = (
    msgOrUpdater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
    newTitle?: string
  ) => {
    if (!activeSessionId) return;
    setSessions(prevSessions => {
      const updated = prevSessions.map(sess => {
        if (sess.id === activeSessionId) {
          const newMsgs = typeof msgOrUpdater === 'function' ? msgOrUpdater(sess.messages) : msgOrUpdater;
          
          let title = sess.title;
          if (newTitle && (title.startsWith('Ready for') || title.trim() === 'New Session Workspace' || title.trim() === '')) {
            title = newTitle.length > 28 ? newTitle.substring(0, 26) + '...' : newTitle;
          }

          return {
            ...sess,
            title,
            messages: newMsgs,
            timestamp: new Date()
          };
        }
        return sess;
      });

      // Synchronize in Cloud Database
      const sessionToSave = updated.find(s => s.id === activeSessionId);
      if (sessionToSave && firebaseEnabled && currentUser) {
        saveSessionToFirebase(currentUser.uid, sessionToSave);
      }
      return updated;
    });
  };

  // Action: Compose/Create a fresh new session
  const handleNewChat = () => {
    // Check if the currently active session is already completely empty
    const currentActive = sessions.find(s => s.id === activeSessionId);
    if (currentActive && (!currentActive.messages || currentActive.messages.length === 0)) {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
      return; // Already in a clean blank workspace, stay here!
    }

    const newId = 'sess-' + Date.now();
    const newSess: ChatHistoryItem = {
      id: newId,
      title: 'New Session Workspace',
      timestamp: new Date(),
      messages: []
    };
    setSessions(prev => [newSess, ...prev]);
    setActiveSessionId(newId);
    setError(null);
    if (firebaseEnabled && currentUser) {
      saveSessionToFirebase(currentUser.uid, newSess);
    }

    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // Action: Delete / Purge Session Thread
  const handleDeleteSession = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    
    if (firebaseEnabled && currentUser) {
      deleteSessionFromFirebase(currentUser.uid, id).catch(err => {
        console.error("Failed to delete from RTDB:", err);
      });
    }

    if (activeSessionId === id) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else {
        // Compose a new blank workspace if none left
        const replacementId = 'sess-' + Date.now();
        setSessions([{
          id: replacementId,
          title: 'New Session Workspace',
          timestamp: new Date(),
          messages: []
        }]);
        setActiveSessionId(replacementId);
      }
    }
  };

  // AI Context Integration function
  const getDynamicHistoryAndSystemInstruction = useCallback(() => {
    // 1. Load saved user memories (from Firebase or local state)
    const memoryFactsText = memories && memories.length > 0 
      ? memories.map(m => `- ${m.fact}`).join('\n')
      : "No saved memories yet.";

    // 2. Load relevant chat history from Firebase (convo titles and highlights of other sessions)
    const otherSessionsText = sessions
      .filter(s => s.id !== activeSessionId && s.messages && s.messages.length > 0)
      .slice(0, 5) // Last 5 conversations for relevant context
      .map(s => {
        const lastMsgText = s.messages[s.messages.length - 1]?.text || "";
        return `- Chat Title: "${s.title}" (Last Response excerpt: "${lastMsgText.substring(0, 75)}...")`;
      })
      .join('\n');

    const relevantHistoryContext = otherSessionsText 
      ? `\nHere is some historical context from user's other relevant conversations in Firebase:\n${otherSessionsText}` 
      : "";

    // 3. Synthesize into detailed system instructions as requested
    const dynamicSystemInstruction = `${CLEVER_AI_SYSTEM_INSTRUCTION}

=== USER COGNITIVE PROFILE & SAVED MEMORIES (LOADED FROM FIREBASE) ===
${memoryFactsText}
======================================================================
${relevantHistoryContext}

Incorporate these details naturally to maintain context consistency and long-term continuity across user sessions.`;

    // 4. Translate recent messages of the current conversation into Google GenAI content format
    const activeConvo = sessions.find(s => s.id === activeSessionId);
    const recentMessages = activeConvo ? activeConvo.messages : [];
    
    // Group and structure history turns to ensure correct alternate role sequence ('user' and 'model')
    const historyTurns: any[] = [];
    
    recentMessages.forEach((msg) => {
      if (msg.isStreaming || !msg.text?.trim()) return;

      const role = msg.sender === MessageSender.USER ? 'user' : 'model';
      let textContent = msg.text;

      if (msg.attachments && msg.attachments.length > 0) {
        const attachmentNames = msg.attachments.map(att => `[Attached ${att.type}: ${att.name}]`).join(' ');
        textContent = `${attachmentNames}\n${textContent}`;
      }

      if (historyTurns.length > 0 && historyTurns[historyTurns.length - 1].role === role) {
        historyTurns[historyTurns.length - 1].parts[0].text += `\n\n${textContent}`;
      } else {
        historyTurns.push({
          role: role,
          parts: [{ text: textContent }],
        });
      }
    });

    return {
      systemInstruction: dynamicSystemInstruction,
      history: historyTurns
    };
  }, [memories, sessions, activeSessionId]);

  const handleEditMessage = async (msgId: string, newText: string) => {
    if (isLoading || !activeSessionId) return;

    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) return;

    const msgIndex = currentSession.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const originalMsg = currentSession.messages[msgIndex];
    if (originalMsg.text === newText) {
      setEditingMessageId(null);
      return;
    }

    const historyToKeep = currentSession.messages.slice(0, msgIndex);
    const updatedUserMsg: ChatMessage = {
      ...originalMsg,
      text: newText,
      isEdited: true
    };
    
    setEditingMessageId(null);
    setEditingMessageText('');
    
    const updatedMessages = [...historyToKeep, updatedUserMsg];
    updateActiveSessionMessages(updatedMessages, newText);
    
    setIsLoading(true);
    setError(null);
    
    await executeGeneration(newText, updatedMessages);
  };

  const executeGeneration = async (inputText: string, updatedMessages: ChatMessage[]) => {
    const aiMessageId = Date.now().toString() + '-ai';
    
    // Check if it's an image generation request
    const isImageGeneration = inputText.toLowerCase().includes('generate') && inputText.toLowerCase().includes('image');
    let previousProvider = aiProvider;

    if (isImageGeneration) {
      showToast('Switched to Qwen Image Model');
      setAiProvider('qwen');
    }

    // Add placeholder item for text stream rendering or image loading
    updateActiveSessionMessages(prev => [
      ...prev,
      {
        id: aiMessageId,
        sender: MessageSender.AI,
        text: isImageGeneration ? 'Creating image...' : '',
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    try {
      let currentAiText = '';

      if (isImageGeneration) {
          // Call image generation endpoint
          const response = await fetch('/api/image/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: inputText })
          });
          const data = await response.json();
          if (data.imageUrl) {
            currentAiText = `Here is your generated image:\n\n![Generated Image](${data.imageUrl})`;
          } else {
            currentAiText = `Failed to generate image.`;
          }
          updateActiveSessionMessages(prev =>
            prev.map(msg =>
              msg.id === aiMessageId ? { ...msg, text: currentAiText, isStreaming: false } : msg
            )
          );
          
          // Switch back to previous provider after generation finishes
          if (previousProvider !== 'qwen') {
            setTimeout(() => {
              setAiProvider(previousProvider);
              showToast(`Returned to ${previousProvider === 'opencode' ? 'MiniMax' : 'Gemini'} Text Model`);
            }, 3000); // Small delay to let user read the generated state
          }
      } else if (aiProvider === 'gemini') {
        const contextData = getDynamicHistoryAndSystemInstruction();
        const requestBody = {
          messages: updatedMessages,
          systemInstruction: contextData.systemInstruction
        };

        const response = await fetch('/api/gemini/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const parsedError = errorText.includes('{') ? JSON.parse(errorText) : null;
          const msg = parsedError?.error || errorText;
          if (response.status === 401 && msg.includes('configured')) {
            throw new Error("Gemini API key is missing. If you configured MiniMax in Vercel, please switch to the MiniMax provider in the top right Select Provider menu.");
          } else {
            throw new Error(msg || 'Unknown Gemini API Error');
          }
        }
        
        if (!response.body) {
          throw new Error("No response body returned from edge stream.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunkText = decoder.decode(value, { stream: true });
            const lines = chunkText.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.text) {
                    currentAiText += data.text;
                    updateActiveSessionMessages(prev =>
                      prev.map(msg =>
                        msg.id === aiMessageId ? { ...msg, text: currentAiText, isStreaming: true } : msg
                      )
                    );
                  } else if (data.error) {
                     throw new Error(data.error);
                  }
                } catch (e) {
                  // Ignore JSON parse errors for incomplete chunks, though data streams typically send complete lines
                }
              }
            }
          }
        }
      } else {
        // ... (existing opencode logic)
        await getOpenCodeStream(
          updatedMessages,
          { ...opencodeConfig, model: aiProvider },
          userProfile,
          memories,
          (chunk) => {
            currentAiText += chunk;
            updateActiveSessionMessages(prev =>
              prev.map(msg =>
                msg.id === aiMessageId ? { ...msg, text: currentAiText, isStreaming: true } : msg
              )
            );
          }
        );
      }

      // Complete and seal the streaming response
      updateActiveSessionMessages(prev =>
        prev.map(msg =>
          msg.id === aiMessageId ? { ...msg, text: currentAiText, isStreaming: false, timestamp: new Date() } : msg
        )
      );

      // Automatic cognitive insight background learning (only if user explicitly opted in)
      if (autoMemoryEnabled && currentAiText.trim()) {
        setTimeout(async () => {
          try {
            const learnedFact = await extractMemoryFromDialog(inputText, currentAiText);
            if (learnedFact && currentUser) {
              const newMemoryItem: LearnedMemory = {
                id: 'mem-' + Date.now(),
                fact: learnedFact,
                timestamp: Date.now(),
                sourceSessionId: activeSessionId || undefined,
              };
              if (firebaseEnabled) {
                await saveLearnedMemory(currentUser.uid, newMemoryItem);
              } else {
                setMemories(prev => [newMemoryItem, ...prev]);
              }
            }
          } catch (learningError) {
            console.error("Cognitive background learning failure:", learningError);
          }
        }, 1200);
      }

    } catch (e: any) {
      console.error("NVIDIA or Gemini stream failures:", e);
      const errorMessage = e.message || "An error occurred while communicating with the AI workspace.";
      setError(errorMessage);
      
      // Remove placeholder loading bubble and push strict system alert
      updateActiveSessionMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
      updateActiveSessionMessages(prev => [
        ...prev,
        {
          id: Date.now().toString() + '-error',
          sender: MessageSender.SYSTEM,
          text: `Endpoint Feedback Alert: ${errorMessage}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      // Clean locks
      updateActiveSessionMessages(prev =>
        prev.map(msg =>
          msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
    }
  };

  // Core Send message dispatch pipeline
  const handleSendMessage = async (inputText: string, attachments?: Attachment[]) => {
    if (isLoading) return;
    if (!activeSessionId) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString() + '-user',
      sender: MessageSender.USER,
      text: inputText,
      timestamp: new Date(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined
    };
    
    const oldMessages = [...messages];
    const updatedMessages = [...oldMessages, userMessage];
    updateActiveSessionMessages(updatedMessages, inputText || "Image uploaded");
    setIsLoading(true);
    setError(null);

    await executeGeneration(inputText, updatedMessages);
  };

  const handleAddMemory = async (factText: string) => {
    if (!currentUser) return;
    const newMemory: LearnedMemory = {
      id: 'mem-' + Date.now(),
      fact: factText,
      timestamp: Date.now(),
      sourceSessionId: activeSessionId || undefined,
    };
    if (firebaseEnabled) {
      await saveLearnedMemory(currentUser.uid, newMemory);
    } else {
      setMemories(prev => [newMemory, ...prev]);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!currentUser) return;
    if (firebaseEnabled) {
      await removeMemoryFromFirebase(currentUser.uid, id);
    } else {
      setMemories(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    // Clear session-related local storage
    localStorage.removeItem('firebase_user_uid');
    
    // Clear all state immediately
    setCurrentUser(null);
    setUserProfile(null);
    setMemories([]);
    setSessions([]);
    setActiveSessionId(null);
    setIsSettingsOpen(false);
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInputValue.trim() || !passwordInputValue.trim()) {
      setError("Please fill in both email and password fields.");
      return;
    }
    if (isSignUpMode && !displayNameInputValue.trim()) {
      setError("Please provide a Display Name first.");
      return;
    }

    try {
      setError(null);
      setAuthSubmitting(true);
      if (isSignUpMode) {
        await signUpWithEmailAndPassword(
          emailInputValue.trim(),
          passwordInputValue.trim(),
          displayNameInputValue.trim()
        );
      } else {
        await signInWithEmailAndPasswordHelper(
          emailInputValue.trim(),
          passwordInputValue.trim()
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Render Authentication overlay if Google Sign-In is required and not authenticated
  if (firebaseEnabled && !currentUser && !authLoading) {
    return (
      <div className="flex min-h-screen w-screen bg-slate-950 text-white relative overflow-y-auto py-8 px-4 font-sans items-center justify-center">
        {/* Background vision lens halos */}
        <div className="absolute top-[-25%] left-[-20%] w-[70%] h-[60%] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none select-none"></div>
        <div className="absolute bottom-[-25%] right-[-20%] w-[70%] h-[60%] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none select-none"></div>

        <div className="w-full max-w-lg bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl animate-scale-up">
          <div className="absolute top-[-50px] right-[-50px] w-[150px] h-[150px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none animate-pulse-slow"></div>

          <div className="mb-4 flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Sparkles className="w-7 h-7 text-white animate-pulse" />
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-white via-cyan-100 to-indigo-200 bg-clip-text text-transparent">
              Clever AI Companion
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Enterprise-grade real-time workspace with secure database isolation and multimodal processing.
            </p>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailPasswordSubmit} className="mt-6 space-y-4 text-left">
            <div className="border-b border-white/5 pb-2">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest font-mono">
                {isSignUpMode ? "Register New Account" : "Access Securespace Login"}
              </span>
            </div>

            {isSignUpMode && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-[11px] font-semibold text-slate-300">Display Name</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your name (e.g. Dave)"
                    value={displayNameInputValue}
                    onChange={(e) => setDisplayNameInputValue(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-xl text-slate-200 text-xs focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500/50 focus:outline-none transition-all placeholder-slate-600"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-300">Email Address</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={emailInputValue}
                  onChange={(e) => setEmailInputValue(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-xl text-slate-200 text-xs focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500/50 focus:outline-none transition-all placeholder-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-300">Access Password</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInputValue}
                  onChange={(e) => setPasswordInputValue(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-xl text-slate-200 text-xs focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500/50 focus:outline-none transition-all placeholder-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authSubmitting || isLoading}
              className="w-full bg-gradient-to-tr from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs tracking-wider transition-all shadow-md shadow-cyan-900/20 active:scale-[0.98] cursor-pointer disabled:opacity-40"
            >
              {authSubmitting ? (
                <div className="flex items-center justify-center gap-1.5">
                  <LoadingSpinner size="w-3.5 h-3.5" color="text-white" />
                  <span>Configuring Companion...</span>
                </div>
              ) : (
                <span>{isSignUpMode ? "CREATE SECURE ACCOUNT" : "SIGN IN WITH CREDENTIALS"}</span>
              )}
            </button>

            <div className="text-center pt-1 text-[11px]">
              <span className="text-slate-500">
                {isSignUpMode ? "Already verified? " : "New to Clever Workspace? "}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsSignUpMode(!isSignUpMode);
                  setError(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold underline bg-transparent cursor-pointer"
              >
                {isSignUpMode ? "Log In here" : "Register Credentials"}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative flex py-4 items-center justify-center">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-3 text-[9px] text-slate-500 font-bold uppercase tracking-wider">or continue with</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          {/* Social Sign-In */}
          <button 
            type="button"
            onClick={async () => {
              try {
                setError(null);
                setIsLoading(true);
                await signInWithGoogle();
              } catch (err: any) {
                console.error(err);
                setError(err.message || 'Google Auth Connection Aborted.');
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading || authSubmitting}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 hover:bg-slate-100 font-semibold py-3 px-6 rounded-2xl transition-all cursor-pointer shadow-lg shadow-black/15 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <LoadingSpinner size="w-4 h-4" color="text-slate-500" />
                <span>Connecting Secure Link...</span>
              </div>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l3.66-2.82z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.82c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-xs">Continue with Google Account</span>
              </>
            )}
          </button>

          {error && (
            <div className="mt-5 text-left p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-200">
              {error.includes('unauthorized-domain') || error.includes('unauthorized') ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs select-none">
                    <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                    <span>Authorized Domain Needed</span>
                  </div>
                  
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Firebase has blocked Google login because this hosting domain is not authorized. You must add this host to <span className="text-cyan-300 font-semibold">Authorized domains</span> inside your Firebase Console, or continue seamlessly by using the <span className="text-white font-semibold">Email and password</span> fields above.
                  </p>

                  <div className="space-y-1">
                    <span className="text-[10px] text-teal-300 uppercase tracking-wider font-bold">Domain to Copy:</span>
                    <div className="flex items-center justify-between p-2.5 bg-slate-950/80 border border-white/10 rounded-xl font-mono text-[10px] text-cyan-300 select-all font-semibold">
                      <span>{window.location.hostname}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.hostname);
                        }}
                        className="text-[9px] bg-white/5 border border-white/10 active:scale-95 px-2 py-0.5 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <span className="font-bold text-[10px] text-slate-400">Step-by-Step Fix:</span>
                    <ol className="list-decimal list-inside pl-0.5 text-[10px] text-slate-400 space-y-1.5 leading-relaxed">
                      <li>Open the <a href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300 inline">Firebase Console - Auth Settings</a>.</li>
                      <li>Click the <span className="font-semibold text-slate-200">Settings</span> tab near the top.</li>
                      <li>Go to <span className="font-semibold text-slate-200">Authorized domains</span> (on the left menu).</li>
                      <li>Click <span className="font-semibold text-slate-200">Add domain</span> and paste <code className="text-cyan-300 font-mono text-[11px] bg-white/5 px-1 rounded">{window.location.hostname}</code>.</li>
                    </ol>
                  </div>
                </div>
              ) : error.includes('popup-closed-by-user') || error.includes('popup-blocked') ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs select-none">
                    <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                    <span>Popup Closed or Blocked</span>
                  </div>
                  
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    The Google Sign‑In modal was closed or blocked. Because this application is loaded inside an iframe, browsers often block login pop-ups to protect security.
                  </p>

                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <span className="font-bold text-[10px] text-teal-300 uppercase tracking-wider">Fast Workarounds:</span>
                    <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1">
                      <li>Use the <span className="text-white font-semibold">Email & password login form</span> above which does not require any popups.</li>
                      <li>Click the <span className="text-white font-semibold">“Open in new tab”</span> button in your editor to log in without iframe constraints.</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-center gap-1.5 text-slate-500 text-[10px] tracking-widest font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-500/80" />
            <span>REALTIME PRIVACY BOUNDARIES ENFORCED</span>
          </div>
        </div>
      </div>
    );
  }

  // Common Loading Splash
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen bg-slate-950 items-center justify-center flex-col select-none text-white">
        <LoadingSpinner size="w-10 h-10" color="text-teal-400 animate-spin-slow" />
        <p className="text-slate-400 mt-4 text-xs tracking-wider uppercase font-bold animate-pulse">Initializing Clever Session...</p>
      </div>
    );
  }

  const isWorkspaceReady = true;
  const showInitialLoading = false;
  const showInitError = aiProvider === 'gemini' && error;

  // Group and sort conversations for premium, ChatGPT-style history sidebar
  const filteredSessions = sessions.filter(sess => {
    if (sess.isArchived) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    
    const titleMatch = sess.title?.toLowerCase().includes(query);
    const msgMatch = sess.messages?.some(m => m.text?.toLowerCase().includes(query));
    return titleMatch || msgMatch;
  });

  const pinnedGroup: ChatHistoryItem[] = [];
  const todayGroup: ChatHistoryItem[] = [];
  const yesterdayGroup: ChatHistoryItem[] = [];
  const lastSevenDaysGroup: ChatHistoryItem[] = [];
  const lastThirtyDaysGroup: ChatHistoryItem[] = [];
  const olderGroup: ChatHistoryItem[] = [];

  filteredSessions.forEach(sess => {
    if (sess.isPinned) {
      pinnedGroup.push(sess);
    } else {
      const date = sess.timestamp instanceof Date ? sess.timestamp : new Date(sess.timestamp);
      const group = getGroupForDate(date);
      if (group === 'Today') todayGroup.push(sess);
      else if (group === 'Yesterday') yesterdayGroup.push(sess);
      else if (group === 'Previous 7 Days') lastSevenDaysGroup.push(sess);
      else if (group === 'Previous 30 Days') lastThirtyDaysGroup.push(sess);
      else olderGroup.push(sess);
    }
  });

  const renderSessionItem = (sess: ChatHistoryItem) => {
    const isEditing = editingSessionId === sess.id;
    const isActive = activeSessionId === sess.id;
    
    const dateObj = sess.timestamp instanceof Date ? sess.timestamp : new Date(sess.timestamp);
    const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const displayTime = `${dateFormatted}, ${timeFormatted}`;

    return (
      <div 
        key={sess.id}
        className={`group w-full p-2 py-2.5 rounded-lg text-left text-[13px] transition-all relative flex flex-col gap-0.5 border cursor-pointer select-none ${
          isActive
            ? 'bg-[#212121] border-[#2d2d2d] text-[#ececec] font-medium shadow-sm'
            : 'bg-transparent border-transparent text-slate-400 hover:bg-[#212121]/50 hover:text-slate-200'
        }`}
        onClick={() => {
          setActiveSessionId(sess.id);
          if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
          }
        }}
      >
        <div className="flex items-center justify-between w-full">
          {isEditing ? (
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle(sess);
                if (e.key === 'Escape') setEditingSessionId(null);
              }}
              onBlur={() => handleSaveTitle(sess)}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[#2f2f2f] text-white px-1.5 py-0.5 rounded text-xs outline-none border border-teal-500/50"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1.5 truncate pr-16">
              <MessageSquare className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400 flex-shrink-0" />
              <span className="truncate">{sess.title || "New Chat"}</span>
            </div>
          )}

          {!isEditing && (
            <div className="absolute right-2 top-2 flex items-center gap-0.5 transition-all">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenContextMenuId(openContextMenuId === sess.id ? null : sess.id);
                }}
                className={`p-1 rounded transition-all cursor-pointer ${openContextMenuId === sess.id ? 'bg-[#353535] text-slate-200' : 'text-slate-500 hover:text-slate-200 opacity-0 group-hover:opacity-100 hover:bg-[#353535]'}`}
                title="Options"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              
              {openContextMenuId === sess.id && (
                <div 
                  className="absolute right-0 top-6 w-36 bg-[#2f2f2f] border border-[#3f3f3f] rounded-lg shadow-xl py-1 z-50 text-[11px] font-medium"
                >
                  <button onClick={() => { setActiveSessionId(sess.id); setOpenContextMenuId(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d] text-slate-300">Open</button>
                  <button onClick={(e) => { handleStartEditing(sess, e); setOpenContextMenuId(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d] text-slate-300">Rename</button>
                  <button onClick={(e) => { handleTogglePinSession(sess, e); setOpenContextMenuId(null); }} className="w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d] text-slate-300">
                    {sess.isPinned ? "Unpin" : "Pin"}
                  </button>
                  <button onClick={(e) => handleArchiveSession(sess, e)} className="w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d] text-slate-300">Archive</button>
                  <button onClick={(e) => handleDuplicateSession(sess, e)} className="w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d] text-slate-300">Duplicate</button>
                  <button onClick={(e) => handleExportSession(sess, e)} className="w-full text-left px-3 py-1.5 hover:bg-[#3d3d3d] text-slate-300">Export</button>
                  <div className="my-1 border-t border-[#3f3f3f]"></div>
                  <button onClick={(e) => handleDeleteSession(sess.id, e)} className="w-full text-left px-3 py-1.5 hover:bg-rose-500/20 text-rose-450">Delete</button>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 pl-5 select-none tracking-tight">
          <Clock className="w-2.5 h-2.5 flex-shrink-0" />
          <span>{displayTime}</span>
          <span className="text-[#2d2d2d]">•</span>
          <span>{sess.messages?.length || 0} msgs</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen bg-[#212121] text-white relative overflow-hidden font-sans">
      {/* Side Drawer Backdrop / Scrim for Mobile Devices */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sessions Left Sidebar Menu */}
      <div 
        className={`fixed md:relative top-0 bottom-0 left-0 w-60 bg-[#171717] border-r border-[#2d2d2d] h-full flex flex-col z-40 md:z-20 transition-all duration-300 ease-in-out shrink-0 ${
          isSidebarOpen 
            ? 'translate-x-0' 
            : '-translate-x-full md:absolute md:-translate-x-full md:w-0'
        }`}
      >
        <div className="p-3.5 flex justify-between items-center bg-[#171717] pb-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest select-none">Recents</span>
          <button
            onClick={handleNewChat}
            className="p-1 px-1.5 rounded-lg bg-transparent hover:bg-[#212121] text-[#b4b4b4] hover:text-[#ececec] transition-all flex items-center gap-1 cursor-pointer text-xs"
            title="New Chat Session"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* ChatGPT Style Search Box */}
        <div className="px-3 pb-2 pt-1 border-b border-[#2d2d2d]/30">
          <div className="relative flex items-center bg-[#212121] rounded-lg border border-[#2d2d2d] focus-within:border-[#4d4d4d] transition-all">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recents..."
              className="w-full bg-transparent pl-8 pr-7 py-1.5 text-xs text-slate-200 outline-none placeholder-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-500 hover:text-slate-300 absolute right-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Grouped and Searchable Conversations List */}
        <div className="flex-grow overflow-y-auto p-2 space-y-4 custom-scrollbar">
          {/* Pinned Section */}
          {pinnedGroup.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-teal-400/80 uppercase tracking-wider pl-2 flex items-center gap-1 mb-1">
                <Pin className="w-2.5 h-2.5 fill-teal-400 rotate-45" />
                <span>Pinned</span>
              </div>
              {pinnedGroup.map((sess) => renderSessionItem(sess))}
            </div>
          )}

          {/* Today */}
          {todayGroup.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-2 mb-1">Today</div>
              {todayGroup.map((sess) => renderSessionItem(sess))}
            </div>
          )}

          {/* Yesterday */}
          {yesterdayGroup.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-2 mb-1">Yesterday</div>
              {yesterdayGroup.map((sess) => renderSessionItem(sess))}
            </div>
          )}

          {/* Previous 7 Days */}
          {lastSevenDaysGroup.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-2 mb-1">Previous 7 Days</div>
              {lastSevenDaysGroup.map((sess) => renderSessionItem(sess))}
            </div>
          )}

          {/* Previous 30 Days */}
          {lastThirtyDaysGroup.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-2 mb-1">Previous 30 Days</div>
              {lastThirtyDaysGroup.map((sess) => renderSessionItem(sess))}
            </div>
          )}

          {/* Older */}
          {olderGroup.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-2 mb-1">Older</div>
              {olderGroup.map((sess) => renderSessionItem(sess))}
            </div>
          )}

          {filteredSessions.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-xs px-2 select-none">
              {searchQuery ? "No matching conversations." : "No recents found."}
            </div>
          )}
        </div>

        {/* Connected User Node Badge */}
        {userProfile && (
          <div className="p-3 bg-[#171717] border-t border-white-[0.03] flex items-center gap-2.5 select-none text-left">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-xs font-bold text-slate-200 overflow-hidden shrink-0">
              {userProfile.profilePhoto ? (
                <img src={userProfile.profilePhoto} alt="User Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                userProfile.displayName ? userProfile.displayName.charAt(0) : 'U'
              )}
            </div>
            <div className="flex flex-col truncate flex-grow">
              <span className="text-[12px] font-bold text-slate-200 truncate">{userProfile.displayName}</span>
              <span className="text-[10px] text-slate-500 truncate">{userProfile.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1 px-1.5 rounded hover:bg-[#212121] border border-transparent text-[#b4b4b4] hover:text-rose-400 cursor-pointer"
              title="Disconnect session auth"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Primary Workspace Window */}
      <div className="flex-grow flex flex-col min-w-0 h-full bg-[#212121] relative z-15">
        
        {/* Top Notification Toast */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 20, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute left-1/2 -translate-x-1/2 z-50 bg-[#2f2f2f] text-slate-200 px-4 py-2 rounded-full shadow-lg text-sm font-medium border border-[#3f3f3f] pointer-events-none"
            >
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ChatGPT Style Minimalist Navigation Header */}
        <div className="sticky top-0 w-full bg-[#212121]/95 backdrop-blur-md border-b border-[#2d2d2d] py-2.5 px-4 z-25 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Sidebar toggle button (collapses sidebar on desktop, menu trigger on mobile) */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#2f2f2f] transition-all cursor-pointer flex items-center justify-center mr-1"
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <Menu className="w-4.5 h-4.5" />
            </button>

            <div className="p-1.5 px-3 rounded-lg hover:bg-[#2f2f2f] text-[#ececec] font-semibold text-[15px] flex items-center gap-1.5 transition-colors cursor-pointer select-none">
              <span className="text-slate-500 text-[9px] mt-0.5 select-none font-bold">▼</span>
            </div>

            {activeSession?.title && (
              <span className="text-xs text-slate-500 font-normal hidden sm:inline truncate max-w-[200px]">
                — {activeSession.title}
              </span>
            )}
          </div>

          {/* Quick interactive utility launcher buttons */}
          <div className="flex items-center gap-3">
            
            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              className="p-1.5 px-2.5 rounded-lg bg-transparent hover:bg-[#2f2f2f] text-slate-300 hover:text-white font-medium transition-all text-xs flex items-center gap-1 cursor-pointer"
              title="Start a fresh chat workspace"
            >
              <Plus className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">New Chat</span>
            </button>

            {/* Brain Cognitive Memory Bank Button */}
            <button
              onClick={() => setIsMemoryModalOpen(true)}
              style={{ display: 'none' }}
              className="p-1.5 px-2.5 rounded-lg bg-transparent hover:bg-[#2f2f2f] text-indigo-300 hover:text-indigo-200 font-medium transition-all text-xs flex items-center gap-1.5 cursor-pointer relative"
              title="AI Cognitive Memory Bank"
            >
              <Brain className="w-4 h-4 text-violet-400" />
              <span>Memory ({memories.length})</span>
            </button>

            {/* Settings Gear Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg bg-transparent hover:bg-[#2f2f2f] text-slate-400 hover:text-slate-200 transition-all cursor-pointer flex items-center justify-center"
              title="Connection Settings"
            >
              <Settings className="w-4 h-4 text-slate-400" />
            </button>

          </div>
        </div>

        {/* Primary chat area rendering stream */}
        {showInitError && (
          <div className="flex-grow flex flex-col items-center justify-center p-6 text-center z-15 w-full max-w-xl mx-auto select-none font-sans">
            <p className="text-red-400 text-lg font-bold">{error}</p>
            <p className="text-slate-400 mt-2 text-sm">Verify connections or configure your custom assistant proxy settings.</p>
          </div>
        )}

        {isWorkspaceReady && (
          <div className="flex-grow flex flex-col overflow-hidden w-full relative">
            <div 
              ref={chatContainerRef} 
              className="flex-grow overflow-y-auto px-4 py-8 space-y-6 custom-scrollbar z-10 scroll-smooth flex flex-col"
            >
              {messages.length === 0 ? (
                <AnonymousBotLogo 
                  onSelectPrompt={(p) => setInputValue(p)}
                  onOpenSettings={aiProvider === 'opencode' ? () => setIsSettingsOpen(true) : undefined}
                />
              ) : (
                <div className="w-full max-w-4xl mx-auto space-y-4">
                  {messages.map((msg) => (
                    <ChatMessageItem 
                      key={msg.id} 
                      message={msg} 
                      onEditMessage={handleEditMessage} 
                    />
                  ))}
                </div>
              )}
              
              {/* Spinner loader indicator */}
              {isLoading && messages[messages.length - 1]?.sender !== MessageSender.AI && (
                <div className="w-full max-w-4xl mx-auto flex justify-start pl-4 select-none">
                  <div className="bg-[#2f2f2f] border border-white/5 p-2.5 px-4 rounded-full flex items-center gap-2.5 shadow-md">
                    <LoadingSpinner size="w-3.5 h-3.5" color="text-emerald-400" />
                    <span className="text-xs text-slate-300">Clever AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt composer */}
            <ChatInput 
              onSendMessage={handleSendMessage} 
              isLoading={isLoading} 
              inputValue={inputValue} 
              setInputValue={setInputValue} 
            />
          </div>
        )}

        {showInitialLoading && (
          <div className="flex-grow flex flex-col items-center justify-center p-6 z-15 select-none">
            <LoadingSpinner size="w-10 h-10" color="text-teal-400" />
            <p className="text-slate-400 mt-4 text-xs tracking-wider uppercase font-bold">Synchronizing Clever Hub...</p>
          </div>
        )}
      </div>

      {/* Endpoint Connection Config Modal */}
      <OpenCodeSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userProfile={userProfile}
        onProfileUpdated={handleProfileUpdated}
        onLogout={handleLogout}
        currentProvider={aiProvider}
        onProviderChange={handleProviderChange}
      />

      {/* Cognitive Memory Bank Modal */}
      <MemoryBankModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        memories={memories}
        onAddMemory={handleAddMemory}
        onDeleteMemory={handleDeleteMemory}
        firebaseEnabled={firebaseEnabled}
        isLoading={isMemoryLoading}
        autoMemoryEnabled={autoMemoryEnabled}
        onToggleAutoMemory={handleToggleAutoMemory}
      />
    </div>
  );
};

export default App;
