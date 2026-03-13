import * as React from 'react';
const { createContext, useContext, useEffect, useMemo, useState } = React;
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type AccentColor = 'purple' | 'blue' | 'green' | 'orange' | 'rose';
export type BackgroundType = 'solid' | 'gradient' | 'pattern';

export interface SettingsState {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  backgroundType: BackgroundType;
  fontSizeScale: number;
  soundsEnabled: boolean;
  focusSoundsEnabled: boolean;
  selectedFocusSound: string;
  focusVolume: number;
  hasSeenOnboarding: boolean;
}

interface SettingsContextValue extends SettingsState {
  updateSettings: (patch: Partial<SettingsState>) => void;
  colors: {
    background: string;
    cardPrimary: string;
    cardSecondary: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    accent: string;
    accentMuted: string;
  };
  isDark: boolean;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

const STORAGE_KEY = '@ultimate_habit_tracker_settings_v1';

const defaultSettings: SettingsState = {
  themeMode: 'auto',
  accentColor: 'orange',
  backgroundType: 'solid',
  fontSizeScale: 1.0,
  soundsEnabled: true,
  focusSoundsEnabled: true,
  selectedFocusSound: 'rain',
  focusVolume: 0.5,
  hasSeenOnboarding: false,
};

const accentHexMap: Record<AccentColor, { main: string; muted: string }> = {
  purple: { main: '#a855f7', muted: '#a855f733' },
  blue: { main: '#3b82f6', muted: '#3b82f633' },
  green: { main: '#22c55e', muted: '#22c55e33' },
  orange: { main: '#f97316', muted: '#f9731633' },
  rose: { main: '#f43f5e', muted: '#f43f5e33' },
};

export const SettingsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setSettings({ ...defaultSettings, ...JSON.parse(raw) });
        }
      } catch (e) {
        console.warn('Failed to load settings', e);
      } finally {
        setLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const updateSettings = (patch: Partial<SettingsState>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) =>
        console.warn('Failed to save settings', e)
      );
      return next;
    });
  };

  const isDark =
    settings.themeMode === 'dark' || (settings.themeMode === 'auto' && systemScheme === 'dark');

  const themeColors = useMemo(() => {
    const accents = accentHexMap[settings.accentColor];
    if (isDark) {
      return {
        background: '#020617',
        cardPrimary: '#0f172a',
        cardSecondary: '#0b1120',
        textPrimary: '#f9fafb',
        textSecondary: '#9ca3af',
        border: '#1f2937',
        accent: accents.main,
        accentMuted: accents.muted,
      };
    } else {
      return {
        background: '#f8fafc',
        cardPrimary: '#ffffff',
        cardSecondary: '#f1f5f9',
        textPrimary: '#0f172a',
        textSecondary: '#64748b',
        border: '#e2e8f0',
        accent: accents.main,
        accentMuted: accents.muted,
      };
    }
  }, [isDark, settings.accentColor]);

  const value = useMemo(
    () => ({
      ...settings,
      updateSettings,
      colors: themeColors,
      isDark,
    }),
    [settings, themeColors, isDark]
  );

  // Return empty View or null while loading from AsyncStorage to prevent initial flash
  if (!loaded) return null;

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
