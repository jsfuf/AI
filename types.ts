
export enum MessageSender {
  USER = 'user',
  AI = 'ai',
  SYSTEM = 'system',
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'docx' | 'xlsx' | 'csv' | 'json' | 'txt' | 'audio';
  url: string; // Object URL or Base64 for local preview
  size?: string;
  isGenerated?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
  attachments?: Attachment[];
  isEdited?: boolean;
  codeBlock?: {
    language: string;
    code: string;
    explanation?: string;
  };
  imageDetails?: {
    prompt: string;
    style: string;
    aspectRatio: string;
  };
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  timestamp: Date;
  messages: ChatMessage[];
  category?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserPreferences {
  responseStyle: 'Professional' | 'Casual' | 'Enthusiastic' | 'Concise';
  responseLength: 'Short' | 'Medium' | 'Long';
  creativityLevel: 'Low' | 'Medium' | 'High';
  languagePreference: string;
}

export interface UserSettings {
  gender: string;
  bio: string;
  location: string;
  occupation: string;
}

export interface LearnedMemory {
  id: string;
  fact: string;
  timestamp: number;
  sourceSessionId?: string;
}

export interface UserProfile {
  email: string;
  displayName: string;
  dateOfBirth?: string;
  profilePhoto?: string;
  preferences?: UserPreferences;
  savedMemory?: { [id: string]: LearnedMemory };
  settings?: UserSettings;
}
