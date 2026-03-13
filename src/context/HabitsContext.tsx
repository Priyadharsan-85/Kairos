import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Pressable,
  Alert
} from 'react-native';
import { Audio } from 'expo-av';
import { useSettings } from './SettingsContext';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

const { createContext, useContext, useEffect, useMemo, useState } = React;

export type HabitCategory = 'health' | 'mind' | 'fitness' | 'productivity' | 'social';

export type HabitPriority = 'low' | 'medium' | 'high';

export type HabitGroup = 'morning' | 'evening' | 'anytime';

export type HabitType = 'timer' | 'count';

export interface Habit {
  id: string;
  name: string;
  category: HabitCategory;
  icon: string;
  color: string;
  priority: HabitPriority;
  group: HabitGroup;
  habitType: HabitType;
  targetMinutes?: number;
  targetCount?: number;
  streak: number;
  bestStreak: number;
  lastCompletedDate?: string;
  totalMinutes: number;
  createdAt: string;
}

export interface Routine {
  id: string;
  name: string;
  habitIds: string[];
  icon: string;
  color: string;
}

export interface TimerState {
  habitId: string;
  isRunning: boolean;
  startedAt: number | null;
  elapsedMs: number;
}

export interface HabitDayRecord {
  date: string;
  habitId: string;
  minutes: number;
}

export interface Inventory {
  streakFreezes: number;
  xpBoosters: number;
  activeBoosterUntil: number | null;
}

export interface Artifact {
  id: string;
  name: string;
  description: string;
  icon: string;
  requiredLevel?: number;
  requiredStreak?: number;
  requiredTotalCompletions?: number;
  bonusType: 'timer_xp' | 'category_xp' | 'all_xp';
  bonusValue: number;
  targetCategory?: HabitCategory;
}

export const ARTIFACT_REGISTRY: Artifact[] = [
  {
    id: 'beginners-compass',
    name: "Beginner's Compass",
    description: 'A simple tool for a new journey. 10% bonus for all XP gains.',
    icon: '🧭',
    requiredLevel: 1,
    bonusType: 'all_xp',
    bonusValue: 0.1,
  },
  {
    id: 'celestial-hourglass',
    name: 'Celestial Hourglass',
    description: 'Bends time to your will. 20% bonus XP for all Timer habits.',
    icon: '⏳',
    requiredLevel: 5,
    bonusType: 'timer_xp',
    bonusValue: 0.2, // 20% bonus
  },
  {
    id: 'ancient-quill',
    name: 'Ancient Quill',
    description: 'Relic of the Scribes. 30% bonus XP for Productivity habits.',
    icon: '🪶',
    requiredLevel: 10,
    bonusType: 'category_xp',
    bonusValue: 0.3,
    targetCategory: 'productivity',
  },
  {
    id: 'minds-eye',
    name: "Mind's Eye",
    description: 'Insight beyond sight. 25% bonus XP for Mind habits.',
    icon: '👁️',
    requiredLevel: 15,
    bonusType: 'category_xp',
    bonusValue: 0.25,
    targetCategory: 'mind',
  },
  {
    id: 'titans-belt',
    name: "Titan's Belt",
    description: 'Unstoppable strength. 25% bonus XP for Fitness habits.',
    icon: '🦾',
    requiredLevel: 20,
    bonusType: 'category_xp',
    bonusValue: 0.25,
    targetCategory: 'fitness',
  },
  {
    id: 'consistency-crown',
    name: 'Consistency Crown',
    description: 'For the truly dedicated. Reach a 7-day overall streak. +50% XP.',
    icon: '👑',
    requiredStreak: 7,
    bonusType: 'all_xp',
    bonusValue: 0.5,
  },
  {
    id: 'master-scribe',
    name: 'Master Scribe',
    description: 'Complete 10 productivity habits in one day. +10% Productivity XP.',
    icon: '✒️',
    requiredTotalCompletions: 10,
    bonusType: 'category_xp',
    bonusValue: 0.1,
    targetCategory: 'productivity',
  },
];

interface HabitsContextValue {
  habits: Habit[];
  timers: Record<string, TimerState | undefined>;
  history: HabitDayRecord[];
  /** key: `${YYYY-MM-DD}::${habitId}`, value: current count for that day */
  dailyCounts: Record<string, number>;
  today: string;
  overallStreak: number;
  bestOverallStreak: number;
  xp: number;
  level: number;
  addHabit: (habit: Omit<Habit, 'id' | 'streak' | 'bestStreak' | 'totalMinutes' | 'createdAt'>) => void;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  reorderHabits: (fromIndex: number, toIndex: number) => void;
  completeHabitForToday: (habitId: string, minutes?: number) => void;
  incrementCount: (habitId: string) => void;
  decrementCount: (habitId: string) => void;
  startTimer: (habitId: string) => void;
  pauseTimer: (habitId: string) => void;
  resetTimer: (habitId: string) => void;
  inventory: Inventory;
  purchaseItem: (itemId: 'streak_freeze' | 'xp_booster') => void;
  activateXpBooster: () => void;
  // Routines
  routines: Routine[];
  activeRoutine: { routineId: string; stepIndex: number } | null;
  addRoutine: (routine: Omit<Routine, 'id'>) => void;
  updateRoutine: (id: string, patch: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  startRoutine: (id: string) => void;
  stopRoutine: () => void;
  // Artifacts
  unlockedArtifactIds: string[];
  equippedArtifactId: string | null;
  equipArtifact: (artifactId: string | null) => void;
  // Auth
  session: Session | null;
  user: User | null;
  signOut: () => void;
  syncing: boolean;
  syncStatus: 'synced' | 'syncing' | 'error';
  authLoading: boolean;
}

const HabitsContext = createContext<HabitsContextValue | undefined>(undefined);

const STORAGE_KEY = '@ultimate_habit_tracker_state_v1';

interface PersistedState {
  habits: Habit[];
  timers: Record<string, TimerState | undefined>;
  history: HabitDayRecord[];
  dailyCounts: Record<string, number>;
  overallStreak: number;
  bestOverallStreak: number;
  xp?: number;
  level?: number;
  lastFullCompletionDate?: string;
  inventory?: Inventory;
  routines?: Routine[];
  unlockedArtifactIds?: string[];
  equippedArtifactId?: string | null;
}

const initialTemplates: Habit[] = [
  {
    id: 'template-meditate',
    name: 'Meditate 10 min',
    category: 'mind',
    icon: '🧘',
    color: '#a855f7',
    priority: 'high',
    group: 'morning',
    habitType: 'timer',
    targetMinutes: 10,
    streak: 0,
    bestStreak: 0,
    totalMinutes: 0,
    createdAt: dayjs().toISOString(),
  },
  {
    id: 'template-read',
    name: 'Read 20 pages',
    category: 'productivity',
    icon: '📚',
    color: '#f97316',
    priority: 'medium',
    group: 'evening',
    habitType: 'timer',
    targetMinutes: 30,
    streak: 0,
    bestStreak: 0,
    totalMinutes: 0,
    createdAt: dayjs().toISOString(),
  },
];

const FOCUS_SOUNDS: Record<string, string> = {
  rain: 'https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/rain/heavy-rain.mp3',
  forest: 'https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/nature/jungle.mp3',
  waves: 'https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/nature/waves.mp3',
  white_noise: 'https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/noise/white-noise.wav',
};

// --- Supabase Cloud Sync Mapping Helpers ---
const mapHabitToDb = (h: Habit, userId: string) => ({
  id: h.id,
  user_id: userId,
  name: h.name,
  category: h.category,
  icon: h.icon,
  color: h.color,
  priority: h.priority,
  habit_type: h.habitType,
  target_minutes: h.targetMinutes,
  target_count: h.targetCount,
  streak: h.streak,
  best_streak: h.bestStreak,
  total_minutes: h.totalMinutes,
  last_completed_date: h.lastCompletedDate,
  created_at: h.createdAt,
});

const mapHabitPatchToDb = (patch: Partial<Habit>) => {
  const mapped: any = { ...patch };
  if (patch.habitType) {
    mapped.habit_type = patch.habitType;
    delete mapped.habitType;
  }
  if (patch.targetMinutes !== undefined) {
    mapped.target_minutes = patch.targetMinutes;
    delete mapped.targetMinutes;
  }
  if (patch.targetCount !== undefined) {
    mapped.target_count = patch.targetCount;
    delete mapped.targetCount;
  }
  if (patch.totalMinutes !== undefined) {
    mapped.total_minutes = patch.totalMinutes;
    delete mapped.totalMinutes;
  }
  if (patch.lastCompletedDate !== undefined) {
    mapped.last_completed_date = patch.lastCompletedDate;
    delete mapped.lastCompletedDate;
  }
  return mapped;
};

const mapRoutineToDb = (r: Routine, userId: string) => ({
  id: r.id,
  user_id: userId,
  name: r.name,
  icon: r.icon,
  color: r.color,
  habit_ids: r.habitIds,
});

const mapHistoryToDb = (h: HabitDayRecord, userId: string) => ({
  user_id: userId,
  habit_id: h.habitId,
  date: h.date,
  minutes: h.minutes,
});

const migrateToCloud = async (userId: string, state: PersistedState) => {
  if (!supabase) return;
  try {
    // 1. Sync Profile
    const { error: pErr } = await supabase.from('profiles').upsert({
      id: userId,
      level: state.level || 1,
      xp: state.xp || 0,
      overall_streak: state.overallStreak || 0,
      best_overall_streak: state.bestOverallStreak || 0,
      last_full_completion_date: state.lastFullCompletionDate,
      equipped_artifact_id: state.equippedArtifactId,
      updated_at: new Date().toISOString()
    });
    if (pErr) console.error('[Sync] Profile migration failed:', pErr);

    // 2. Sync Habits
    if (state.habits && state.habits.length > 0) {
      const habitsToInsert = state.habits.map(h => mapHabitToDb(h, userId));
      const { error: hErr } = await supabase.from('habits').upsert(habitsToInsert, { onConflict: 'id' });
      if (hErr) console.error('[Sync] Habits migration failed:', hErr);
    }

    // 3. Sync History
    if (state.history && state.history.length > 0) {
      const historyToInsert = state.history.map(h => mapHistoryToDb(h, userId));
      const { error: hiErr } = await supabase.from('history').upsert(historyToInsert, { onConflict: 'user_id,habit_id,date' });
      if (hiErr) console.error('[Sync] History migration failed:', hiErr);
    }

    // 3. Sync Routines
    if (state.routines && state.routines.length > 0) {
      const routinesToInsert = state.routines.map(r => mapRoutineToDb(r, userId));
      await supabase.from('routines').upsert(routinesToInsert);
    }

    // 4. Sync Artifacts
    if (state.unlockedArtifactIds && state.unlockedArtifactIds.length > 0) {
      const artifactsToInsert = state.unlockedArtifactIds.map(id => ({
        user_id: userId,
        artifact_id: id,
      }));
      await supabase.from('unlocked_artifacts').upsert(artifactsToInsert);
    }

    // 5. Sync History
    if (state.history && state.history.length > 0) {
      const historyToInsert = state.history.map(h => mapHistoryToDb(h, userId));
      await supabase.from('history').upsert(historyToInsert);
    }

    console.log('Cloud Migration Complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

export const HabitsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { focusSoundsEnabled, selectedFocusSound, focusVolume } = useSettings();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [timers, setTimers] = useState<Record<string, TimerState | undefined>>({});
  const [history, setHistory] = useState<HabitDayRecord[]>([]);
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});
  const [overallStreak, setOverallStreak] = useState(0);
  const [bestOverallStreak, setBestOverallStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [inventory, setInventory] = useState<Inventory>({
    streakFreezes: 0,
    xpBoosters: 0,
    activeBoosterUntil: null,
  });
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeRoutine, setActiveRoutine] = useState<{ routineId: string; stepIndex: number } | null>(null);
  const [unlockedArtifactIds, setUnlockedArtifactIds] = useState<string[]>([]);
  const [equippedArtifactId, setEquippedArtifactId] = useState<string | null>(null);
  const [lastFullCompletionDate, setLastFullCompletionDate] = useState<string | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [authLoading, setAuthLoading] = useState(true);
  const today = dayjs().format('YYYY-MM-DD');
  const { soundsEnabled } = useSettings();

  const playRewardSound = async () => {
    if (!soundsEnabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3' },
        { shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('isLoaded' in status && status.isLoaded && (status as any).didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      console.warn('Failed to play reward sound', e);
    }
  };

  const soundRef = React.useRef<Audio.Sound | null>(null);
  const loadingRef = React.useRef<boolean>(false);
  const currentUrlRef = React.useRef<string | null>(null);

  // Setup Audio Mode
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      interruptionModeIOS: 1, // InterruptionModeIOS.DoNotMix
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: 1, // InterruptionModeAndroid.DoNotMix
      playThroughEarpieceAndroid: false,
    }).catch(e => console.warn('Audio.setAudioModeAsync failed', e));
  }, []);

  // Auth Listener
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = () => {
    supabase?.auth.signOut();
  };

  const resetState = React.useCallback(() => {
    setHabits([]);
    setHistory([]);
    setDailyCounts({});
    setOverallStreak(0);
    setBestOverallStreak(0);
    setXp(0);
    setLevel(1);
    setInventory({ streakFreezes: 0, xpBoosters: 0, activeBoosterUntil: null });
    setRoutines([]);
    setUnlockedArtifactIds([]);
    setEquippedArtifactId(null);
    setLastFullCompletionDate(undefined);
    setTimers({});
  }, []);

  const fetchCloudData = async (userId: string): Promise<PersistedState | null> => {
    if (!supabase) return null;
    setSyncStatus('syncing');
    try {
      console.log(`[Sync] Fetching cloud data for user: ${userId}`);
      const [
        { data: profile, error: profileError },
        { data: habitsData, error: habitsError },
        { data: routinesData, error: routinesError },
        { data: historyData, error: historyError },
        { data: artifactsData, error: artifactsError }
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('routines').select('*').eq('user_id', userId),
        supabase.from('history').select('*').eq('user_id', userId),
        supabase.from('unlocked_artifacts').select('*').eq('user_id', userId)
      ]);

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('[Sync] Profile fetch error:', profileError);
        throw profileError;
      }

      if (profile) {
        console.log('[Sync] Cloud profile found. Hydrating...');
        setSyncStatus('synced');
        return {
          habits: (habitsData || []).map((h: any) => ({
            id: h.id,
            name: h.name,
            category: h.category,
            icon: h.icon,
            color: h.color,
            priority: h.priority,
            habitType: h.habit_type,
            targetMinutes: h.target_minutes,
            targetCount: h.target_count,
            streak: h.streak,
            bestStreak: h.best_streak,
            totalMinutes: h.total_minutes,
            lastCompletedDate: h.last_completed_date,
            createdAt: h.created_at
          })),
          routines: (routinesData || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            icon: r.icon,
            color: r.color,
            habitIds: r.habit_ids
          })),
          history: (historyData || []).map((h: any) => ({
            date: h.date,
            habitId: h.habit_id,
            minutes: h.minutes
          })),
          unlockedArtifactIds: (artifactsData || []).map((a: any) => a.artifact_id),
          overallStreak: profile.overall_streak || 0,
          bestOverallStreak: profile.best_overall_streak || 0,
          xp: profile.xp || 0,
          level: profile.level || 1,
          lastFullCompletionDate: profile.last_full_completion_date,
          equippedArtifactId: profile.equipped_artifact_id,
          dailyCounts: {},
          timers: {},
          inventory: { streakFreezes: 0, xpBoosters: 0, activeBoosterUntil: null }
        };
      }
      console.log('[Sync] No cloud profile found.');
      setSyncStatus('synced');
      return null;
    } catch (e) {
      console.error('[Sync] Error fetching cloud data:', e);
      setSyncStatus('error');
      // Show explicit error to user if they are logged in but sync fails
      if (userId) {
        Alert.alert('Cloud Sync Error', 'We could not reach the server to load your data. Please check your internet connection.');
      }
      throw e; // Relaunch to prevent empty migration
    }
  };

  useEffect(() => {
    const initialize = async () => {
      setSyncing(true);
      try {
        let finalState: PersistedState | null = null;
        let cloudFailure = false;

        // 1. Cloud Hydration
        if (session?.user) {
          try {
            finalState = await fetchCloudData(session.user.id);
          } catch (e) {
            cloudFailure = true;
            console.error('[Sync] Persistent cloud failure during init');
          }
        }

        // 2. Local Fallback/Migration
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          try {
            const localState: PersistedState = JSON.parse(raw);
            const isLocalStateEmpty = (!localState.habits || localState.habits.length === 0) && (localState.xp || 0) === 0;
            
            if (session?.user && !finalState && !cloudFailure && !isLocalStateEmpty) {
              // SAFE Migration (only if cloud is empty AND local has data AND cloud didn't error)
              console.log('[Sync] Migrating local data to new cloud account...');
              await migrateToCloud(session.user.id, localState);
              finalState = localState;
            } else if (!session) {
              // Guest mode
              finalState = localState;
            }
          } catch (e) {
            console.error('[Sync] FAILED to parse local storage', e);
          }
        }

        // 3. Prevent Data Wipe on Error
        if (cloudFailure) {
          console.warn('[Sync] Stopping init due to cloud failure to protect data.');
          return; 
        }

        // Apply state or templates
        if (finalState) {
          setHabits((finalState.habits || []).map(h => ({ ...h, habitType: h.habitType ?? 'timer' })));
          setHistory(finalState.history || []);
          setDailyCounts(finalState.dailyCounts || {});
          setOverallStreak(finalState.overallStreak ?? 0);
          setBestOverallStreak(finalState.bestOverallStreak ?? 0);
          setXp(finalState.xp ?? 0);
          setLevel(finalState.level ?? 1);
          setInventory(finalState.inventory || { streakFreezes: 0, xpBoosters: 0, activeBoosterUntil: null });
          setRoutines(finalState.routines || []);
          setUnlockedArtifactIds(finalState.unlockedArtifactIds || []);
          setEquippedArtifactId(finalState.equippedArtifactId || null);
          setLastFullCompletionDate(finalState.lastFullCompletionDate);
          
          // Retroactive unlock check
          const currentLevel = finalState.level ?? 1;
          setUnlockedArtifactIds(prev => {
            const existing = prev || [];
            const newlyUnlocked = ARTIFACT_REGISTRY
              .filter(a => (a.requiredLevel !== undefined && a.requiredLevel <= currentLevel) && !existing.includes(a.id))
              .map(a => a.id);
            return newlyUnlocked.length > 0 ? [...existing, ...newlyUnlocked] : existing;
          });
        } else if (!session) {
          // Fresh Guest Templates
          console.log('[Sync] No data found. Loading templates.');
          setHabits(initialTemplates.map(h => ({ ...h, id: `${h.id}-${Date.now()}` })));
        }
      } catch (e) {
        console.warn('Initialization failed', e);
      } finally {
        setSyncing(false);
      }
    };

    if (session === undefined) return; // Wait for initial session check
    
    if (session) {
      if (!syncing) initialize();
    } else {
      resetState();
      // Fresh templates for new guest
      setHabits(initialTemplates.map(h => ({ ...h, id: `${h.id}-${Date.now()}` })));
    }
  }, [session, resetState]);


  // Focus Mode Audio Logic
  useEffect(() => {
    const active = Object.values(timers).some((t) => t?.isRunning);
    const soundUrl = FOCUS_SOUNDS[selectedFocusSound];

    const syncSound = async () => {
      if (loadingRef.current) return;
      
      const shouldBePlaying = active && focusSoundsEnabled && soundUrl;

      // 1. If we should play but the URL changed
      if (shouldBePlaying && currentUrlRef.current !== soundUrl) {
        loadingRef.current = true;
        try {
          if (soundRef.current) {
            await soundRef.current.unloadAsync().catch(() => {});
            soundRef.current = null;
          }
          
          const { sound } = await Audio.Sound.createAsync(
            { uri: soundUrl },
            { shouldPlay: true, isLooping: true, volume: focusVolume },
            (status) => {
               if ('error' in status && status.error) {
                 console.warn(`Focus sound playback error: ${status.error}`);
               }
            }
          );
          soundRef.current = sound;
          currentUrlRef.current = soundUrl;
        } catch (e) {
          console.warn('Focus audio load failed:', e);
          currentUrlRef.current = null; // reset to allow retry
        } finally {
          loadingRef.current = false;
        }
        return;
      }

      // 2. If we should play and same URL, just update volume/play state
      if (shouldBePlaying && soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.setVolumeAsync(focusVolume);
          if (!status.isPlaying) {
            await soundRef.current.playAsync();
          }
        }
        return;
      }

      // 3. If we should NOT be playing
      if (!shouldBePlaying && soundRef.current) {
        loadingRef.current = true;
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
          currentUrlRef.current = null;
        } catch (e) {
          // ignore
        } finally {
          loadingRef.current = false;
        }
      }
    };

    syncSound();

    return () => {
      // Cleanup on unmount handled by syncSound if we transition to inactive
    };
  }, [timers, focusSoundsEnabled, selectedFocusSound, focusVolume]);

  // Profile Sync Effect: XP, Level, Streaks (Debounced & Guarded)
  useEffect(() => {
    if (!session?.user || !supabase || syncing) return;

    const syncProfile = async () => {
      try {
        const { error } = await supabase.from('profiles').upsert({
          id: session.user.id,
          level,
          xp,
          overall_streak: overallStreak,
          best_overall_streak: bestOverallStreak,
          equipped_artifact_id: equippedArtifactId,
          last_full_completion_date: lastFullCompletionDate,
          updated_at: new Date().toISOString(),
        });
        if (error) console.error('Supabase Profile Sync failed:', error);
      } catch (e) {
        console.error('Failed to sync profile:', e);
      }
    };

    const timeout = setTimeout(syncProfile, 2000); // 2s debounce to avoid spamming
    return () => clearTimeout(timeout);
  }, [xp, level, overallStreak, bestOverallStreak, equippedArtifactId, lastFullCompletionDate, session, syncing]);

  useEffect(() => {
    if (syncing) return; // CRITICAL: Stop local save while cloud is loading

    const persist: PersistedState = {
      habits,
      timers,
      history,
      dailyCounts,
      overallStreak,
      bestOverallStreak,
      xp,
      level,
      lastFullCompletionDate,
      inventory,
      routines,
      unlockedArtifactIds,
      equippedArtifactId,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persist)).catch((e) =>
      console.warn('Failed to save habits locally', e),
    );
  }, [habits, timers, history, dailyCounts, overallStreak, bestOverallStreak, xp, level, lastFullCompletionDate, inventory, routines, session, equippedArtifactId, syncing]);

  const addHabit: HabitsContextValue['addHabit'] = React.useCallback(async (habitInput) => {
    const newHabit: Habit = {
      ...habitInput,
      id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      streak: 0,
      bestStreak: 0,
      totalMinutes: 0,
      createdAt: dayjs().toISOString(),
    };

    setHabits((prev) => [...prev, newHabit]);

    if (session?.user && supabase) {
      supabase.from('habits').insert(mapHabitToDb(newHabit, session.user.id))
        .then(({ error }: { error: any }) => { if (error) console.error('[Sync] Habit add failed:', error); });
    }
  }, [session]);

  const updateHabit: HabitsContextValue['updateHabit'] = React.useCallback(async (id, patch) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));

    if (session?.user && supabase) {
      supabase.from('habits').update(mapHabitPatchToDb(patch)).eq('id', id).eq('user_id', session.user.id)
        .then(({ error }: { error: any }) => { if (error) console.error('[Sync] Habit update failed:', error); });
    }
  }, [session]);

  const deleteHabit: HabitsContextValue['deleteHabit'] = React.useCallback(async (id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setTimers((prev) => {
      const clone = { ...prev };
      delete clone[id];
      return clone;
    });
    setDailyCounts((prev) => {
      const clone = { ...prev };
      Object.keys(clone).forEach((key) => {
        if (key.endsWith(`::${id}`)) delete clone[key];
      });
      return clone;
    });

    if (session?.user && supabase) {
      supabase.from('habits').delete().eq('id', id).eq('user_id', session.user.id)
        .then(({ error }: { error: any }) => { if (error) console.error('[Sync] Habit delete failed:', error); });
    }
  }, [session]);

  const reorderHabits: HabitsContextValue['reorderHabits'] = React.useCallback((from, to) => {
    setHabits((prev) => {
      const clone = [...prev];
      const [item] = clone.splice(from, 1);
      clone.splice(to, 0, item);
      return clone;
    });
  }, []);

  const startTimer: HabitsContextValue['startTimer'] = React.useCallback((habitId) => {
    setTimers((prev) => {
      const existing = prev[habitId];
      if (existing && existing.isRunning) return prev;
      const now = Date.now();
      const baseElapsed = existing?.elapsedMs ?? 0;
      return {
        ...prev,
        [habitId]: {
          habitId,
          isRunning: true,
          startedAt: now,
          elapsedMs: baseElapsed,
        },
      };
    });
  }, []);

  const pauseTimer: HabitsContextValue['pauseTimer'] = React.useCallback((habitId) => {
    setTimers((prev) => {
      const existing = prev[habitId];
      if (!existing || !existing.isRunning || existing.startedAt == null) return prev;
      const now = Date.now();
      const elapsed = existing.elapsedMs + (now - existing.startedAt);
      return {
        ...prev,
        [habitId]: {
          ...existing,
          isRunning: false,
          startedAt: null,
          elapsedMs: elapsed,
        },
      };
    });
  }, []);

  const resetTimer: HabitsContextValue['resetTimer'] = React.useCallback((habitId) => {
    setTimers((prev) => ({
      ...prev,
      [habitId]: {
        habitId,
        isRunning: false,
        startedAt: null,
        elapsedMs: 0,
      },
    }));
  }, []);

  const completeHabitForToday: HabitsContextValue['completeHabitForToday'] = React.useCallback(async (habitId, minutes = 0) => {
    const now = dayjs();
    const curToday = now.format('YYYY-MM-DD');
    const curYesterday = now.subtract(1, 'day').format('YYYY-MM-DD');

    console.log(`[Sync] Atomic Completion for ${habitId} on ${curToday}`);
    setSyncStatus('syncing');

    // 1. Prepare Calculation Context
    const idx = habits.findIndex(h => h.id === habitId);
    if (idx === -1) {
      console.warn('[Sync] Habit not found for completion:', habitId);
      return;
    }

    const h = habits[idx];
    const isAlreadyDoneToday = h.lastCompletedDate === curToday;

    // 2. Calculate Habit Updates
    let newHabitStreak = h.streak;
    let xpGained = 0;

    if (!isAlreadyDoneToday) {
      xpGained = 10;
      if (h.lastCompletedDate === curYesterday) {
        newHabitStreak = h.streak + 1;
      } else {
        if (inventory.streakFreezes > 0) {
          setInventory(prev => ({ ...prev, streakFreezes: prev.streakFreezes - 1 }));
          newHabitStreak = h.streak + 1;
        } else {
          newHabitStreak = 1;
        }
      }
      if (newHabitStreak > 0 && newHabitStreak % 7 === 0) xpGained += 50;

      // Apply bonuses
      const isBoosterActive = inventory.activeBoosterUntil && Date.now() < inventory.activeBoosterUntil;
      let bonusXp = isBoosterActive ? xpGained * 2 : xpGained;
      const equipped = ARTIFACT_REGISTRY.find(a => a.id === equippedArtifactId);
      if (equipped) {
        if (equipped.bonusType === 'all_xp' || 
           (equipped.bonusType === 'timer_xp' && h.habitType === 'timer') ||
           (equipped.bonusType === 'category_xp' && equipped.targetCategory === h.category)) {
          bonusXp *= (1 + equipped.bonusValue);
        }
      }
      xpGained = Math.round(bonusXp);
    }

    const updatedHabit: Habit = {
      ...h,
      lastCompletedDate: curToday,
      streak: newHabitStreak,
      bestStreak: Math.max(h.bestStreak, newHabitStreak),
      totalMinutes: h.totalMinutes + minutes,
    };

    const nextHabits = [...habits];
    nextHabits[idx] = updatedHabit;

    // 3. Calculate Global Updates (Streaks / XP)
    const nextXp = xp + xpGained;
    const nextLevel = Math.floor(nextXp / 100) + 1;
    
    let nextOverallStreak = overallStreak;
    let nextBestOverallStreak = bestOverallStreak;
    let nextLastFullDate = lastFullCompletionDate;

    // A Perfect Day is when EVERY habit in the list is done today
    const allDoneToday = nextHabits.length > 0 && nextHabits.every(hab => hab.lastCompletedDate === curToday);
    console.log(`[Sync] allDoneToday: ${allDoneToday}. Count=${nextHabits.length}. LastFull=${lastFullCompletionDate}`);

    if (allDoneToday) {
      if (lastFullCompletionDate !== curToday) {
        nextOverallStreak = (lastFullCompletionDate === curYesterday) ? (overallStreak || 0) + 1 : 1;
        nextBestOverallStreak = Math.max(bestOverallStreak || 0, nextOverallStreak);
        nextLastFullDate = curToday;
        console.log(`[Sync] Global Streak Up: ${nextOverallStreak}`);
      }
    }

    // 4. Update Local State
    setHabits(nextHabits);
    setXp(nextXp);
    setLevel(nextLevel);
    setOverallStreak(nextOverallStreak);
    setBestOverallStreak(nextBestOverallStreak);
    setLastFullCompletionDate(nextLastFullDate);

    // 5. Atomic Cloud Sync
    if (session?.user && supabase) {
      const syncPromises = [
        supabase.from('habits').upsert(mapHabitToDb(updatedHabit, session.user.id), { onConflict: 'id' }),
        supabase.from('profiles').upsert({
          id: session.user.id,
          xp: nextXp,
          level: nextLevel,
          overall_streak: nextOverallStreak,
          best_overall_streak: nextBestOverallStreak,
          last_full_completion_date: nextLastFullDate,
          equipped_artifact_id: equippedArtifactId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' }),
      ];

      // 6. Artifact Unlock Check
      if (!isAlreadyDoneToday) {
        const currentArtifacts = unlockedArtifactIds || [];
        const newlyUnlocked = ARTIFACT_REGISTRY.filter(a => {
          if (currentArtifacts.includes(a.id)) return false;
          if (a.requiredLevel !== undefined && nextLevel >= a.requiredLevel) return true;
          if (a.requiredStreak !== undefined && (newHabitStreak >= a.requiredStreak || nextOverallStreak >= a.requiredStreak)) return true;
          return false;
        }).map(a => a.id);

        if (newlyUnlocked.length > 0) {
          setUnlockedArtifactIds(prev => [...prev, ...newlyUnlocked]);
          newlyUnlocked.forEach(id => {
            const artifact = ARTIFACT_REGISTRY.find(arc => arc.id === id);
            const p = supabase.from('unlocked_artifacts').insert({ user_id: session.user.id, artifact_id: id });
            syncPromises.push(p);
            p.then(({ error }: { error: any }) => {
              if (!error) {
                playRewardSound();
                Alert.alert('🏆 REWARD UNLOCKED!', `You've earned ${artifact?.name || 'an artifact'}!`);
              }
            });
          });
        }
      }

      Promise.all(syncPromises).then((results) => {
        const hasError = results.some(r => r.error);
        setSyncStatus(hasError ? 'error' : 'synced');
      }).catch(() => setSyncStatus('error'));
    }

    // 7. History Sync
    setHistory((prevHistory) => {
      const hIdx = prevHistory.findIndex(r => r.date === curToday && r.habitId === habitId);
      const newMins = hIdx >= 0 ? prevHistory[hIdx].minutes + minutes : minutes;
      const nextHistory = [...prevHistory];
      if (hIdx >= 0) {
        nextHistory[hIdx] = { ...prevHistory[hIdx], minutes: newMins };
      } else {
        nextHistory.push({ date: curToday, habitId, minutes: newMins });
      }
      if (session?.user && supabase) {
        supabase.from('history').upsert(
          mapHistoryToDb({ date: curToday, habitId, minutes: newMins }, session.user.id),
          { onConflict: 'user_id,habit_id,date' }
        ).then(({ error }: { error: any }) => { if (error) console.error('[Sync] History sync failed:', error); });
      }
      return nextHistory;
    });

    if (activeRoutine) {
      const routine = routines.find(r => r.id === activeRoutine.routineId);
      if (routine && routine.habitIds[activeRoutine.stepIndex] === habitId) {
        const nextStep = activeRoutine.stepIndex + 1;
        if (nextStep < routine.habitIds.length) {
          setTimeout(() => {
            startTimer(routine.habitIds[nextStep]);
            setActiveRoutine({ routineId: routine.id, stepIndex: nextStep });
          }, 1000);
        } else {
          setActiveRoutine(null);
        }
      }
    }
  }, [session, inventory, equippedArtifactId, level, xp, overallStreak, bestOverallStreak, lastFullCompletionDate, activeRoutine, routines, startTimer, unlockedArtifactIds, habits]);

  const incrementCount: HabitsContextValue['incrementCount'] = React.useCallback((habitId) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    const key = `${today}::${habitId}`;
    setDailyCounts((prev) => {
      const current = prev[key] ?? 0;
      const next = current + 1;
      const updated = { ...prev, [key]: next };
      
      // Complete habit if target reached
      if (habit.targetCount && next >= habit.targetCount && habit.lastCompletedDate !== today) {
        completeHabitForToday(habitId, 0);
      }

      // Real-Time Artifact Check for Success Milestones
      const currentArtifacts = unlockedArtifactIds || [];
      const newlyUnlocked = ARTIFACT_REGISTRY.filter(a => {
        if (currentArtifacts.includes(a.id)) return false;
        
        // Count based milestones (e.g. Master Scribe)
        if (a.requiredTotalCompletions !== undefined && next >= a.requiredTotalCompletions) return true;
        return false;
      }).map(a => a.id);

      if (newlyUnlocked.length > 0) {
        setUnlockedArtifactIds(prevIds => [...prevIds, ...newlyUnlocked]);
        if (session?.user && supabase) {
          newlyUnlocked.forEach((id: string) => {
             const artifact = ARTIFACT_REGISTRY.find(arc => arc.id === id);
             supabase.from('unlocked_artifacts').insert({
               user_id: session.user.id,
               artifact_id: id
             }).then(({ error }: { error: any }) => {
                if (error) console.error('Failed to sync artifact unlock', error);
                else Alert.alert('🏆 LEGENDARY REWARD!', `You've earned the ${artifact?.name || 'New Artifact'}! Check the Vault.`);
             });
          });
        }
      }

      return updated;
    });
  }, [habits, today, completeHabitForToday, unlockedArtifactIds, session]);

  const decrementCount: HabitsContextValue['decrementCount'] = React.useCallback((habitId) => {
    const key = `${today}::${habitId}`;
    setDailyCounts((prev) => {
      const current = prev[key] ?? 0;
      if (current <= 0) return prev;
      return { ...prev, [key]: current - 1 };
    });
  }, [today]);

  const purchaseItem = React.useCallback((itemId: 'streak_freeze' | 'xp_booster') => {
    const prices = { streak_freeze: 500, xp_booster: 1000 };
    const price = prices[itemId];
    if (xp >= price) {
      setXp(prev => prev - price);
      setInventory(prev => ({
        ...prev,
        streakFreezes: prev.streakFreezes + (itemId === 'streak_freeze' ? 1 : 0),
        xpBoosters: prev.xpBoosters + (itemId === 'xp_booster' ? 1 : 0),
      }));
    }
  }, [xp]);

  const activateXpBooster = React.useCallback(() => {
    if (inventory.xpBoosters > 0) {
      setInventory(prev => ({
        ...prev,
        xpBoosters: prev.xpBoosters - 1,
        activeBoosterUntil: Date.now() + 24 * 60 * 60 * 1000,
      }));
    }
  }, [inventory.xpBoosters]);

  const addRoutine = React.useCallback(async (routineInput: Omit<Routine, 'id'>) => {
    const newRoutine: Routine = {
      ...routineInput,
      id: `routine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    setRoutines(prev => [...prev, newRoutine]);

    if (session?.user && supabase) {
      await supabase.from('routines').insert(mapRoutineToDb(newRoutine, session.user.id));
    }
  }, [session]);

  const updateRoutine = React.useCallback(async (id: string, patch: Partial<Routine>) => {
    setRoutines(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

    if (session?.user) {
      await supabase.from('routines').update(patch).eq('id', id).eq('user_id', session.user.id);
    }
  }, [session]);

  const deleteRoutine = React.useCallback(async (id: string) => {
    setRoutines(prev => prev.filter(r => r.id !== id));
    setActiveRoutine(curr => curr?.routineId === id ? null : curr);

    if (session?.user) {
      await supabase.from('routines').delete().eq('id', id).eq('user_id', session.user.id);
    }
  }, [session]);

  const startRoutine = React.useCallback((id: string) => {
    const routine = routines.find(r => r.id === id);
    if (!routine || routine.habitIds.length === 0) return;
    setTimers(prev => {
      const stopped = { ...prev };
      Object.keys(stopped).forEach(key => {
        if (stopped[key]) stopped[key] = { ...stopped[key]!, isRunning: false, startedAt: null };
      });
      return stopped;
    });
    setActiveRoutine({ routineId: id, stepIndex: 0 });
    startTimer(routine.habitIds[0]);
  }, [routines, startTimer]);

  const stopRoutine = React.useCallback(() => setActiveRoutine(null), []);

  const equipArtifact = React.useCallback(async (id: string | null) => {
    if (id === null || unlockedArtifactIds.includes(id)) {
      setEquippedArtifactId(id);
      
      if (session?.user) {
        await supabase.from('profiles').update({
          equipped_artifact_id: id
        }).eq('id', session.user.id);
      }
    }
  }, [unlockedArtifactIds, session]);

  // Global Timer and Active Routine Monitor (Auto-Stop & Flow)
  useEffect(() => {
    const runningTimers = Object.values(timers).filter(t => t?.isRunning);
    if (runningTimers.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      
      runningTimers.forEach(t => {
        if (!t || !t.isRunning || t.startedAt == null) return;
        
        const habit = habits.find(h => h.id === t.habitId);
        if (!habit || habit.habitType !== 'timer' || !habit.targetMinutes) return;
        
        const totalElapsedMs = t.elapsedMs + (now - t.startedAt);
        const targetMs = habit.targetMinutes * 60 * 1000;
        
        if (totalElapsedMs >= targetMs) {
          // TARGET REACHED! 🎯
          
          // 1. Complete the habit
          completeHabitForToday(habit.id, Math.round(totalElapsedMs / 60000));
          
          // 2. Pause the timer
          pauseTimer(habit.id);
        }
      });
    }, 1000); // Check every second for precision

    return () => clearInterval(interval);
  }, [timers, habits, completeHabitForToday, pauseTimer]);

  const value = useMemo(
    () => ({
      habits,
      timers,
      history,
      dailyCounts,
      today,
      overallStreak,
      bestOverallStreak,
      xp,
      level,
      addHabit,
      updateHabit,
      deleteHabit,
      reorderHabits,
      completeHabitForToday,
      incrementCount,
      decrementCount,
      startTimer,
      pauseTimer,
      resetTimer,
      inventory,
      purchaseItem,
      activateXpBooster,
      routines,
      activeRoutine,
      addRoutine,
      updateRoutine,
      deleteRoutine,
      startRoutine,
      stopRoutine,
      unlockedArtifactIds,
      equippedArtifactId,
      equipArtifact,
      session,
      user,
      signOut,
      syncing,
      syncStatus,
      authLoading,
    }),
    [
      habits,
      timers,
      history,
      dailyCounts,
      today,
      overallStreak,
      bestOverallStreak,
      xp,
      level,
      inventory,
      routines,
      activeRoutine,
      unlockedArtifactIds,
      equippedArtifactId,
      session,
      user,
      syncing,
      syncStatus,
      authLoading,
    ],
  );

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
};

export const useHabits = () => {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used within HabitsProvider');
  return ctx;
};
