import React, { useState, useEffect } from 'react';
import { UserProfile, UserPreferences, UserSettings } from '../types';
import { 
  updateUserProfile, 
  clearAllUserSessionsFromFirebase, 
  clearAllUserMemoriesFromFirebase,
  getAuthInstance,
  fetchUserProfile
} from '../services/firebaseService';
import { User, Settings, ShieldAlert, Sparkles, LogOut, Check, ArrowDownToLine, Trash2, Globe, Monitor, HelpCircle, Eye } from 'lucide-react';

interface OpenCodeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onProfileUpdated: () => void;
  onLogout: () => void;
  currentProvider: 'gemini' | 'opencode' | 'qwen';
  onProviderChange: (provider: 'gemini' | 'opencode' | 'qwen') => void;
}

type SettingsTab = 'general' | 'profile' | 'aiprefs' | 'privacy';

const OpenCodeSettingsModal: React.FC<OpenCodeSettingsModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onProfileUpdated,
  onLogout,
  currentProvider,
  onProviderChange,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  
  // AI Provider state
  const [localAiProvider, setLocalAiProvider] = useState<'gemini' | 'opencode' | 'qwen'>('opencode');
  
  // Profile state
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [occupation, setOccupation] = useState('');

  // AI Preferences state
  const [responseStyle, setResponseStyle] = useState<'Professional' | 'Casual' | 'Enthusiastic' | 'Concise'>('Casual');
  const [responseLength, setResponseLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');
  const [creativityLevel, setCreativityLevel] = useState<'Low' | 'Medium' | 'High'>('High');
  const [languagePreference, setLanguagePreference] = useState('English');

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Initialize form state when profile is supplied
  useEffect(() => {
    setLocalAiProvider((localStorage.getItem('ai_provider') as 'gemini' | 'opencode' | 'qwen') || 'opencode');
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setDateOfBirth(userProfile.dateOfBirth || '');
      setGender(userProfile.settings?.gender || '');
      setBio(userProfile.settings?.bio || '');
      setLocation(userProfile.settings?.location || '');
      setOccupation(userProfile.settings?.occupation || '');

      setResponseStyle(userProfile.preferences?.responseStyle || 'Casual');
      setResponseLength(userProfile.preferences?.responseLength || 'Medium');
      setCreativityLevel(userProfile.preferences?.creativityLevel || 'High');
      setLanguagePreference(userProfile.preferences?.languagePreference || 'English');
    }
  }, [userProfile, isOpen]);

  if (!isOpen) return null;

  const handleSaveAll = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const auth = getAuthInstance();
      const currentUser = auth?.currentUser;
      if (!currentUser) throw new Error("No authenticated user found.");

      const updatedData: Partial<UserProfile> = {
        displayName,
        dateOfBirth,
        preferences: {
          responseStyle,
          responseLength,
          creativityLevel,
          languagePreference,
        },
        settings: {
          gender,
          bio,
          location,
          occupation,
        }
      };

      await updateUserProfile(currentUser.uid, updatedData);
      setStatusMsg({ type: 'success', text: 'Settings updated successfully!' });
      onProfileUpdated();
      
      setTimeout(() => {
        setStatusMsg(null);
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChats = async () => {
    if (!window.confirm("Are you absolutely sure you want to delete all chat history? This action is irreversible.")) return;
    try {
      const auth = getAuthInstance();
      const currentUser = auth?.currentUser;
      if (!currentUser) return;
      await clearAllUserSessionsFromFirebase(currentUser.uid);
      setStatusMsg({ type: 'success', text: 'All conversations successfully deleted!' });
      onProfileUpdated();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete chat history.' });
    }
  };

  const handleDeleteMemories = async () => {
    if (!window.confirm("Are you absolutely sure you want to clear all learned memories?")) return;
    try {
      const auth = getAuthInstance();
      const currentUser = auth?.currentUser;
      if (!currentUser) return;
      await clearAllUserMemoriesFromFirebase(currentUser.uid);
      setStatusMsg({ type: 'success', text: 'All learned memories successfully cleared!' });
      onProfileUpdated();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to clear memories.' });
    }
  };

  const handleExportData = async () => {
    try {
      const auth = getAuthInstance();
      const currentUser = auth?.currentUser;
      if (!currentUser) return;
      
      const profile = await fetchUserProfile(currentUser.uid);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `assistant-backup-${currentUser.uid}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setStatusMsg({ type: 'success', text: 'Backup downloaded successfully!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Export failed: ' + err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-3xl bg-[#171717] border border-[#2d2d2d] rounded-2xl overflow-hidden shadow-2xl relative flex flex-col h-[90vh] md:h-[650px] max-h-[90vh] text-[#ececec] font-sans animate-scale-up"
        id="chatgpt-settings-modal"
      >
        {/* ChatGPT Minimal Header */}
        <div className="px-5 py-4 border-b border-[#2d2d2d] flex justify-between items-center bg-[#171717]">
          <h3 className="text-base sm:text-lg font-semibold text-slate-100 flex items-center gap-2">
            Settings
          </h3>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#2f2f2f] transition-all cursor-pointer flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Master details split window */}
        <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
          
          {/* Sidebar tabs selection */}
          <div className="w-full md:w-56 bg-[#171717] border-b md:border-b-0 md:border-r border-[#2d2d2d] p-2 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible md:space-y-1 gap-1 shrink-0 scrollbar-hide">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-all text-left cursor-pointer whitespace-nowrap w-auto md:w-full ${
                activeTab === 'general'
                  ? 'bg-[#2f2f2f] text-white'
                  : 'text-slate-400 hover:bg-[#212121] hover:text-[#ececec]'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              General
            </button>
            
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-all text-left cursor-pointer whitespace-nowrap w-auto md:w-full ${
                activeTab === 'profile'
                  ? 'bg-[#2f2f2f] text-white'
                  : 'text-slate-400 hover:bg-[#212121] hover:text-[#ececec]'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              Profile
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('aiprefs')}
              className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-all text-left cursor-pointer whitespace-nowrap w-auto md:w-full ${
                activeTab === 'aiprefs'
                  ? 'bg-[#2f2f2f] text-white'
                  : 'text-slate-400 hover:bg-[#212121] hover:text-[#ececec]'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              AI Preferences
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-all text-left cursor-pointer whitespace-nowrap w-auto md:w-full ${
                activeTab === 'privacy'
                  ? 'bg-[#2f2f2f] text-white'
                  : 'text-slate-400 hover:bg-[#212121] hover:text-[#ececec]'
              }`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Data Controls
            </button>

            <div className="hidden md:block flex-grow" />

            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2.5 text-rose-455 hover:bg-rose-500/10 transition-all text-left cursor-pointer whitespace-nowrap w-auto md:w-full border border-transparent mt-auto"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sign Out
            </button>
          </div>

          {/* Details viewport display */}
          <div className="flex-grow p-4 sm:p-6 overflow-y-auto bg-[#212121] flex flex-col justify-between">
            <div className="space-y-5 flex-grow">
              {statusMsg && (
                <div className={`p-3 rounded-lg text-xs font-semibold border animate-fade-in ${
                  statusMsg.type === 'success' 
                    ? 'bg-[#1b2b24] border-emerald-500/30 text-emerald-400' 
                    : 'bg-[#2c1c1f] border-rose-500/30 text-rose-400'
                }`}>
                  {statusMsg.text}
                </div>
              )}

              {activeTab === 'general' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="border-b border-[#2d2d2d] pb-3">
                    <h4 className="text-sm font-medium text-slate-200">General settings</h4>
                    <p className="text-xs text-slate-500 mt-1">Configure language and primary conversation triggers.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-[#2d2d2d]/30 gap-3">
                    <div>
                      <h5 className="text-sm text-slate-200 font-medium">Model provider</h5>
                      <p className="text-xs text-slate-500">Switch between different AI models.</p>
                    </div>
                    <div className="flex bg-[#2f2f2f] p-1 rounded-lg">
                      <button 
                        type="button" 
                        onClick={() => onProviderChange('qwen')}
                        className={`px-3.5 py-1 text-xs rounded-md ${currentProvider === 'qwen' ? 'bg-[#212121] text-slate-100 font-medium shadow-sm' : 'text-slate-400 font-medium'}`}
                      >
                        Qwen
                      </button>
                      <button 
                        type="button" 
                        onClick={() => onProviderChange('opencode')}
                        className={`px-3.5 py-1 text-xs rounded-md ${currentProvider === 'opencode' ? 'bg-[#212121] text-slate-100 font-medium shadow-sm' : 'text-slate-400 font-medium'}`}
                      >
                        MiniMax
                      </button>
                      <button 
                        type="button" 
                        onClick={() => onProviderChange('gemini')}
                        className={`px-3.5 py-1 text-xs rounded-md ${currentProvider === 'gemini' ? 'bg-[#212121] text-slate-100 font-medium shadow-sm' : 'text-slate-400 font-medium'}`}
                      >
                        Gemini
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-[#2d2d2d]/30 gap-3">
                    <div>
                      <h5 className="text-sm text-slate-200 font-medium">Language Preference</h5>
                      <p className="text-xs text-slate-500">Primary communication speech language model uses.</p>
                    </div>
                    <input
                      type="text"
                      className="w-full sm:w-44 bg-[#171717] border border-[#2d2d2d] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-100 text-right sm:text-left"
                      value={languagePreference}
                      onChange={(e) => setLanguagePreference(e.target.value)}
                      placeholder="e.g. English"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 gap-3">
                    <div>
                      <h5 className="text-sm text-slate-200 font-medium">Delete Chat History</h5>
                      <p className="text-xs text-slate-500">Clears all of your saved chat history conversations forever.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeleteChats}
                      className="px-4 py-2 text-xs rounded-lg bg-rose-600/10 hover:bg-rose-650/20 text-rose-400 border border-rose-500/25 transition-all font-medium cursor-pointer"
                    >
                      Delete all
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-b border-[#2d2d2d] pb-3">
                    <h4 className="text-sm font-medium text-slate-200">Profile Information</h4>
                    <p className="text-xs text-slate-500 mt-1">Configure profile variables for deeper personalized responses.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Display Name</label>
                      <input
                        type="text"
                        className="w-full bg-[#171717] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-100"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Date of Birth</label>
                      <input
                        type="date"
                        className="w-full bg-[#171717] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-100"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Work / Occupation</label>
                      <input
                        type="text"
                        className="w-full bg-[#171717] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-100"
                        value={occupation}
                        onChange={(e) => setOccupation(e.target.value)}
                        placeholder="e.g. Software Engineer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Location</label>
                      <input
                        type="text"
                        className="w-full bg-[#171717] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-100"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. London, UK"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Personal Biography / Bio</label>
                    <textarea
                      rows={3}
                      className="w-full bg-[#171717] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-100 resize-none"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell MiniMax AI about yourself..."
                    />
                  </div>
                </div>
              )}

              {activeTab === 'aiprefs' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-b border-[#2d2d2d] pb-3">
                    <h4 className="text-sm font-medium text-slate-200">AI Preferences</h4>
                    <p className="text-xs text-slate-500 mt-1">Configure style parameters for the MiniMax AI workspace model.</p>
                  </div>

                  {/* Style */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Response Tone & Style</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['Casual', 'Professional', 'Enthusiastic', 'Concise'] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setResponseStyle(style)}
                          className={`py-2 rounded-lg text-xs font-medium cursor-pointer border transition-all ${
                            responseStyle === style
                              ? 'bg-[#2f2f2f] border-slate-400 text-white shadow-sm'
                              : 'bg-[#171717] border-[#2d2d2d] text-slate-400 hover:text-white'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Length */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Response Length limit</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Short', 'Medium', 'Long'] as const).map((len) => (
                        <button
                          key={len}
                          type="button"
                          onClick={() => setResponseLength(len)}
                          className={`py-2 rounded-lg text-xs font-medium cursor-pointer border transition-all ${
                            responseLength === len
                              ? 'bg-[#2f2f2f] border-slate-400 text-white shadow-sm'
                              : 'bg-[#171717] border-[#2d2d2d] text-slate-400 hover:text-white'
                          }`}
                        >
                          {len}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Creativity */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">Creativity Level (Temperature)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Low', 'Medium', 'High'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setCreativityLevel(level)}
                          className={`py-2 rounded-lg text-xs font-medium cursor-pointer border transition-all ${
                            creativityLevel === level
                              ? 'bg-[#2f2f2f] border-slate-400 text-white shadow-sm'
                              : 'bg-[#171717] border-[#2d2d2d] text-slate-400 hover:text-white'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-b border-[#2d2d2d] pb-3">
                    <h4 className="text-sm font-medium text-slate-200">Data Controls</h4>
                    <p className="text-xs text-slate-500 mt-1">Manage private information models can access, learn, and store.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-[#2d2d2d]/30 gap-3">
                    <div>
                      <h5 className="text-sm text-slate-200 font-medium">Export Workspace Data</h5>
                      <p className="text-xs text-slate-500">Download complete profiles, settings, and memory logs inside a single JSON Document.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportData}
                      className="px-4 py-2 text-xs rounded-lg bg-[#2f2f2f] hover:bg-slate-700 text-slate-100 font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                      Export JSON
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-[#2d2d2d]/30 gap-3">
                    <div>
                      <h5 className="text-sm text-slate-200 font-medium">Clear AI Memories</h5>
                      <p className="text-xs text-slate-500">Clears all explicit cognitive learned memory nodes from the database.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeleteMemories}
                      className="px-4 py-2 text-xs rounded-lg bg-[#2f2f2f] hover:bg-slate-700 text-slate-100 font-medium flex items-center gap-1.5 transition-all cursor-pointer text-[#ececec]"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                      Clear memory
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 gap-3">
                    <div>
                      <h5 className="text-xs text-slate-500 italic">Information Isolation Guarantee</h5>
                      <p className="text-[10px] text-slate-500">Every account runs as a completely independent Sandbox. Memories or conversation documents are locked to your Firebase Auth Google UID and never mixed with any concurrent users.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom action panel */}
            <div className="pt-4 border-t border-[#2d2d2d] flex justify-between items-center gap-2 mt-5 shrink-0">
              <button
                type="button"
                onClick={onLogout}
                className="md:hidden text-xs font-semibold text-rose-455 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
              <div className="flex-grow md:block hidden" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#2d2d2d] bg-transparent text-slate-400 hover:text-white hover:bg-[#212121] transition-all cursor-pointer h-9"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#2f2f2f] hover:bg-[#3f3f3f] border border-[#4d4d4d] text-white transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 h-9"
                >
                  {saving ? 'Saving...' : <><Check className="w-3.5 h-3.5" /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenCodeSettingsModal;
