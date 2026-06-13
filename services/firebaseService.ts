import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, off, remove } from 'firebase/database';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser 
} from 'firebase/auth';
import { ChatHistoryItem, UserProfile, UserPreferences, UserSettings, LearnedMemory } from '../types';

// Default config from user's project details
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyADpiq496rmfmBQ8hdktUHiCGBIVTXqO4s",
  authDomain: "studio-8488362861-8360d.firebaseapp.com",
  databaseURL: "https://studio-8488362861-8360d-default-rtdb.firebaseio.com",
  projectId: "studio-8488362861-8360d",
  storageBucket: "studio-8488362861-8360d.firebasestorage.app",
  messagingSenderId: "525032802865",
  appId: "1:525032802865:web:b92d99323179ab0dc6a310"
};

export interface FirebaseConnectionConfig {
  apiKey: string;
  databaseURL: string;
  projectId: string;
  enabled: boolean;
}

// Global active app, database, and auth instances
let appInstance: any = null;
let dbInstance: ReturnType<typeof getDatabase> | null = null;
let authInstance: ReturnType<typeof getAuth> | null = null;

export const initFirebase = (config: FirebaseConnectionConfig) => {
  if (!config.enabled) {
    dbInstance = null;
    authInstance = null;
    return null;
  }

  try {
    const activeConfig = {
      ...DEFAULT_FIREBASE_CONFIG,
      // Use config apiKey, or local storage, or environment, or fallback
      apiKey: config.apiKey || (import.meta as any).env?.VITE_FIREBASE_API_KEY || localStorage.getItem('firebase_api_key') || DEFAULT_FIREBASE_CONFIG.apiKey,
      databaseURL: config.databaseURL || DEFAULT_FIREBASE_CONFIG.databaseURL,
      projectId: config.projectId || DEFAULT_FIREBASE_CONFIG.projectId,
    };

    if (getApps().length === 0) {
      appInstance = initializeApp(activeConfig);
    } else {
      appInstance = getApp();
    }
    dbInstance = getDatabase(appInstance);
    authInstance = getAuth(appInstance);
    
    return { db: dbInstance, auth: authInstance };
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    dbInstance = null;
    authInstance = null;
    return null;
  }
};

export const getDB = () => {
  if (!dbInstance) {
    // Attempt default initialization if not already loaded
    initFirebase({
      apiKey: localStorage.getItem('firebase_api_key') || '',
      databaseURL: localStorage.getItem('firebase_db_url') || DEFAULT_FIREBASE_CONFIG.databaseURL,
      projectId: localStorage.getItem('firebase_project_id') || DEFAULT_FIREBASE_CONFIG.projectId,
      enabled: true
    });
  }
  return dbInstance;
};

export const getAuthInstance = () => {
  if (!authInstance) {
    getDB();
  }
  return authInstance;
};

/**
 * Google Sign-In helper. Performs standard signInWithPopup.
 */
export const signInWithGoogle = async (): Promise<FirebaseUser> => {
  const auth = getAuthInstance();
  if (!auth) throw new Error("Firebase Authentication is not initialized properly. Enable Realtime Sync in settings.");
  
  const provider = new GoogleAuthProvider();
  // Ensure we request profile and email
  provider.addScope('profile');
  provider.addScope('email');

  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Automatically seed profile record if it doesn't exist
  await checkAndCreateUserProfile(user);

  return user;
};

/**
 * Register a user via Email and Password
 */
export const signUpWithEmailAndPassword = async (email: string, password: string, displayName: string): Promise<FirebaseUser> => {
  const auth = getAuthInstance();
  if (!auth) throw new Error("Firebase Authentication is not initialized properly. Enable Realtime Sync in settings.");

  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;

  // Add the display name
  await updateProfile(user, { displayName });

  // Automatically seed profile record
  await checkAndCreateUserProfile(user);

  return user;
};

/**
 * Log in a user via Email and Password
 */
export const signInWithEmailAndPasswordHelper = async (email: string, password: string): Promise<FirebaseUser> => {
  const auth = getAuthInstance();
  if (!auth) throw new Error("Firebase Authentication is not initialized properly. Enable Realtime Sync in settings.");

  const result = await signInWithEmailAndPassword(auth, email, password);
  const user = result.user;

  // Ensure user profile path is seeded
  await checkAndCreateUserProfile(user);

  return user;
};

/**
 * Logout Helper
 */
export const logoutUser = async (): Promise<void> => {
  const auth = getAuthInstance();
  if (auth) {
    await signOut(auth);
  }
};

/**
 * Subscribes to Authentication State changes
 */
export const subscribeToAuth = (onUser: (user: FirebaseUser | null) => void) => {
  const auth = getAuthInstance();
  if (!auth) return () => {};
  return onAuthStateChanged(auth, onUser);
};

/**
 * Checks and creates default user profile in RTDB under users/{uid}
 */
export const checkAndCreateUserProfile = async (user: FirebaseUser): Promise<UserProfile> => {
  const db = getDB();
  if (!db) throw new Error("Firebase Database is not ready.");

  const userRef = ref(db, `users/${user.uid}`);
  const snapshot = await get(userRef);

  if (snapshot.exists()) {
    const val = snapshot.val();
    return {
      email: val.profile?.email || val.email || user.email || '',
      displayName: val.profile?.displayName || val.displayName || user.displayName || 'AI Companion User',
      dateOfBirth: val.profile?.dateOfBirth || val.dateOfBirth || '',
      profilePhoto: val.profile?.photoURL || val.profile?.profilePhoto || val.profilePhoto || user.photoURL || '',
      preferences: val.preferences || {
        responseStyle: 'Casual',
        responseLength: 'Medium',
        creativityLevel: 'High',
        languagePreference: 'English'
      },
      settings: val.profile?.settings || val.settings || {
        gender: '',
        bio: 'New AI Assistant companion.',
        location: '',
        occupation: ''
      }
    } as UserProfile;
  }

  // Define default configurations
  const defaultPrefs: UserPreferences = {
    responseStyle: 'Casual',
    responseLength: 'Medium',
    creativityLevel: 'High',
    languagePreference: 'English'
  };

  const defaultSettings: UserSettings = {
    gender: '',
    bio: 'New AI Assistant companion.',
    location: '',
    occupation: ''
  };

  const initialProfile: UserProfile = {
    email: user.email || '',
    displayName: user.displayName || 'AI Companion User',
    dateOfBirth: '',
    profilePhoto: user.photoURL || '',
    preferences: defaultPrefs,
    settings: defaultSettings,
    savedMemory: {}
  };

  // Seed the full structural database nodes of this user workspace
  const fullSeededData = {
    email: user.email || '',
    displayName: user.displayName || 'AI Companion User',
    profilePhoto: user.photoURL || '',
    dateOfBirth: '',
    preferences: defaultPrefs,

    // Specific structural nodes: users/{uid}/profile
    profile: {
      email: user.email || '',
      displayName: user.displayName || 'AI Companion User',
      photoURL: user.photoURL || '',
      profilePhoto: user.photoURL || '',
      dateOfBirth: '',
      settings: defaultSettings
    },
    // Specific structural nodes: users/{uid}/memory
    memory: {
      "init-fact": {
        id: "init-fact",
        fact: "AI Memory Workspace initiated.",
        timestamp: Date.now()
      }
    },
    // Specific structural nodes: users/{uid}/chatDatabase
    chatDatabase: {
      "init-sess": {
        id: "sess-initial",
        title: "Workspace Welcome Hub",
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "msg-welcome-rtdb",
            sender: "ai",
            text: "Hello! Welcome to your secure private AI workspace hub.",
            timestamp: new Date().toISOString()
          }
        ]
      }
    },
    // Specific structural nodes: users/{uid}/settings
    settings: defaultSettings
  };

  await set(userRef, fullSeededData);
  return initialProfile;
};

/**
 * Update complete user profile fields under users/{uid}
 */
export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  const db = getDB();
  if (!db) return;
  const userRef = ref(db, `users/${uid}`);
  const snapshot = await get(userRef);
  
  if (snapshot.exists()) {
    const existing = snapshot.val();
    const updatedPreferences = {
      ...(existing.preferences || {}),
      ...(data.preferences || {})
    };
    const updatedSettings = {
      ...(existing.settings || {}),
      ...(data.settings || {})
    };

    const updatedDisplayName = data.displayName !== undefined ? data.displayName : (existing.displayName || '');
    const updatedDateOfBirth = data.dateOfBirth !== undefined ? data.dateOfBirth : (existing.dateOfBirth || '');
    const updatedProfilePhoto = data.profilePhoto !== undefined ? data.profilePhoto : (existing.profilePhoto || '');

    await set(userRef, {
      ...existing,
      displayName: updatedDisplayName,
      dateOfBirth: updatedDateOfBirth,
      profilePhoto: updatedProfilePhoto,
      preferences: updatedPreferences,
      settings: updatedSettings,
      // Mirror updates to users/{uid}/profile too
      profile: {
        ...(existing.profile || {}),
        email: data.email !== undefined ? data.email : (existing.profile?.email || existing.email || ''),
        displayName: updatedDisplayName,
        dateOfBirth: updatedDateOfBirth,
        photoURL: updatedProfilePhoto,
        profilePhoto: updatedProfilePhoto,
        settings: updatedSettings
      }
    });
  } else {
    // Fallback seed
    await checkAndCreateUserProfile({ uid, email: data.email, displayName: data.displayName, photoURL: data.profilePhoto } as any);
  }
};

/**
 * Load User Profile once
 */
export const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const db = getDB();
  if (!db) return null;
  
  const userRef = ref(db, `users/${uid}`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    const val = snapshot.val();
    return {
      email: val.profile?.email || val.email || '',
      displayName: val.profile?.displayName || val.displayName || 'AI Companion User',
      dateOfBirth: val.profile?.dateOfBirth || val.dateOfBirth || '',
      profilePhoto: val.profile?.photoURL || val.profile?.profilePhoto || val.profilePhoto || '',
      preferences: val.preferences || {
        responseStyle: 'Casual',
        responseLength: 'Medium',
        creativityLevel: 'High',
        languagePreference: 'English'
      },
      settings: val.profile?.settings || val.settings || {
        gender: '',
        bio: 'New AI Assistant companion.',
        location: '',
        occupation: ''
      }
    } as UserProfile;
  }
  return null;
};

/**
 * Save user preferences
 */
export const saveUserPreferences = async (uid: string, prefs: UserPreferences): Promise<void> => {
  const db = getDB();
  if (!db) return;
  const prefsRef = ref(db, `users/${uid}/preferences`);
  await set(prefsRef, prefs);
};

/**
 * Save user settings details
 */
export const saveUserSettings = async (uid: string, settings: UserSettings): Promise<void> => {
  const db = getDB();
  if (!db) return;
  const settingsRef = ref(db, `users/${uid}/settings`);
  await set(settingsRef, settings);
};

/**
 * Push an active session to Firebase RTDB inside users/{uid}/chatDatabase/{sessionId}
 */
export const saveSessionToFirebase = async (uid: string, session: ChatHistoryItem): Promise<boolean> => {
  const db = getDB();
  if (!db) return false;

  try {
    const createdAtISO = session.createdAt instanceof Date 
      ? session.createdAt.toISOString() 
      : (session.createdAt ? new Date(session.createdAt).toISOString() : (session.timestamp instanceof Date ? session.timestamp.toISOString() : new Date().toISOString()));
    
    // Set updatedAt to now whenever we write back to the DB so latest changes are captured
    const updatedAtISO = new Date().toISOString();

    const serializedSession = {
      id: session.id,
      title: session.title || "New Chat",
      timestamp: session.timestamp instanceof Date ? session.timestamp.toISOString() : new Date(session.timestamp).toISOString(),
      createdAt: createdAtISO,
      updatedAt: updatedAtISO,
      isPinned: session.isPinned || false,
      category: session.category || "",
      messages: (session.messages || []).map((m) => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : (m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString()),
      })),
    };

    const sanitizedSession = JSON.parse(JSON.stringify(serializedSession));

    const sessionRef = ref(db, `users/${uid}/chatDatabase/${session.id}`);
    await set(sessionRef, sanitizedSession);
    return true;
  } catch (error) {
    console.error("Failed to save session to Realtime Database:", error);
    return false;
  }
};

/**
 * Delete a session from Firebase RTDB inside users/{uid}/chatDatabase/{sessionId}
 */
export const deleteSessionFromFirebase = async (uid: string, sessionId: string): Promise<boolean> => {
  const db = getDB();
  if (!db) return false;

  try {
    const sessionRef = ref(db, `users/${uid}/chatDatabase/${sessionId}`);
    await remove(sessionRef);
    return true;
  } catch (error) {
    console.error("Failed to delete session from RTDB:", error);
    return false;
  }
};

/**
 * Delete all sessions of a user (Privacy control)
 */
export const clearAllUserSessionsFromFirebase = async (uid: string): Promise<boolean> => {
  const db = getDB();
  if (!db) return false;
  try {
    const sessionsRef = ref(db, `users/${uid}/chatDatabase`);
    await remove(sessionsRef);
    return true;
  } catch (error) {
    console.error("Failed to clear chat sessions from RTDB:", error);
    return false;
  }
};

/**
 * Delete all memories of a user (Privacy control)
 */
export const clearAllUserMemoriesFromFirebase = async (uid: string): Promise<boolean> => {
  const db = getDB();
  if (!db) return false;
  try {
    const memoryRef = ref(db, `users/${uid}/memory`);
    await remove(memoryRef);
    return true;
  } catch (error) {
    console.error("Failed to clear memories from RTDB:", error);
    return false;
  }
};

/**
 * Load all sessions from Firebase RTDB under users/{uid}/chatDatabase
 */
export const fetchSessionsFromFirebase = async (uid: string): Promise<ChatHistoryItem[]> => {
  const db = getDB();
  if (!db) return [];

  try {
    const sessionsRef = ref(db, `users/${uid}/chatDatabase`);
    const snapshot = await get(sessionsRef);
    if (!snapshot.exists()) return [];

    const data = snapshot.val();
    const loadedList: ChatHistoryItem[] = [];

    Object.keys(data).forEach((key) => {
      const item = data[key];
      loadedList.push({
        ...item,
        id: item.id || key,
        title: item.title || "New Chat",
        isPinned: item.isPinned || false,
        timestamp: new Date(item.timestamp || item.updatedAt || Date.now()),
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(item.timestamp || Date.now()),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(item.timestamp || Date.now()),
        category: item.category || "",
        messages: (item.messages || []).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp || Date.now()),
        })),
      });
    });

    return loadedList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  } catch (error) {
    console.error("Failed to fetch sessions from RTDB:", error);
    return [];
  }
};

/**
 * Save new learned memory / cognitive point under users/{uid}/memory/{id}
 */
export const saveLearnedMemory = async (uid: string, memory: LearnedMemory): Promise<boolean> => {
  const db = getDB();
  if (!db) return false;

  try {
    const memoryRef = ref(db, `users/${uid}/memory/${memory.id}`);
    await set(memoryRef, memory);
    return true;
  } catch (error) {
    console.error("Failed to save memory to RTDB:", error);
    return false;
  }
};

/**
 * Remove a specific memory from users/{uid}/memory/{id}
 */
export const removeMemoryFromFirebase = async (uid: string, memoryId: string): Promise<boolean> => {
  const db = getDB();
  if (!db) return false;

  try {
    const memoryRef = ref(db, `users/${uid}/memory/${memoryId}`);
    await remove(memoryRef);
    return true;
  } catch (error) {
    console.error("Failed to delete memory from RTDB:", error);
    return false;
  }
};

/**
 * Real-time listener for current user's sessions under users/{uid}/chatDatabase
 */
export const subscribeToSessions = (uid: string, onData: (sessions: ChatHistoryItem[]) => void) => {
  const db = getDB();
  if (!db) return () => {};

  const sessionsRef = ref(db, `users/${uid}/chatDatabase`);
  const callback = (snapshot: any) => {
    if (!snapshot.exists()) {
      onData([]);
      return;
    }
    const data = snapshot.val();
    const loadedList: ChatHistoryItem[] = [];

    Object.keys(data).forEach((key) => {
      const item = data[key];
      loadedList.push({
        ...item,
        id: item.id || key,
        title: item.title || "New Chat",
        isPinned: item.isPinned || false,
        timestamp: new Date(item.timestamp || item.updatedAt || Date.now()),
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(item.timestamp || Date.now()),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(item.timestamp || Date.now()),
        category: item.category || "",
        messages: (item.messages || []).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp || Date.now()),
        })),
      });
    });

    onData(loadedList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  };

  onValue(sessionsRef, callback);
  return () => off(sessionsRef, 'value', callback);
};

/**
 * Real-time listener for current user's memories under users/{uid}/memory
 */
export const subscribeToMemories = (uid: string, onData: (memories: LearnedMemory[]) => void) => {
  const db = getDB();
  if (!db) return () => {};

  const memoryRef = ref(db, `users/${uid}/memory`);
  const callback = (snapshot: any) => {
    if (!snapshot.exists()) {
      onData([]);
      return;
    }
    const data = snapshot.val();
    onData(Object.values(data) as LearnedMemory[]);
  };

  onValue(memoryRef, callback);
  return () => off(memoryRef, 'value', callback);
};
