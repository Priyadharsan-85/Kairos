import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  Platform,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import TypewriterText from '@/components/TypewriterText';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useHabits, HabitCategory, HabitGroup, HabitPriority, HabitType } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { getRandomQuote } from '@/utils/quotes';
import HabitCard from '@/components/HabitCard';
import dayjs from 'dayjs';
import AmbientParticles from '@/components/AmbientParticles';
import ConfettiBurst from '@/components/ConfettiBurst';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import HabitDetailModal from '@/components/HabitDetailModal';
import VaultModal from '@/components/VaultModal';
import OnboardingOverlay from '@/components/OnboardingOverlay';
import { ARTIFACT_REGISTRY } from '@/context/HabitsContext';

const categories: { id: HabitCategory; label: string }[] = [
  { id: 'health', label: 'Health' },
  { id: 'mind', label: 'Mind' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'social', label: 'Social' },
];

const groups: { id: HabitGroup; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'evening', label: 'Evening' },
  { id: 'anytime', label: 'Anytime' },
];

const priorities: { id: HabitPriority; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

const habitTypes: { id: HabitType; label: string; desc: string }[] = [
  { id: 'timer', label: '⏱ Timer', desc: 'Track time' },
  { id: 'count', label: '🔢 Counter', desc: 'Count reps/items' },
];

const focusSoundOptions = [
  { id: 'rain', label: 'Rain', emoji: '🌧️' },
  { id: 'forest', label: 'Forest', emoji: '🌲' },
  { id: 'waves', label: 'Waves', emoji: '🌊' },
  { id: 'white_noise', label: 'Noise', emoji: '🔉' },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning, warrior ☀️';
  if (hour < 18) return 'Crushing the afternoon 💪';
  return 'Good evening, achiever 🌙';
};

const HomeScreen: React.FC = () => {
  const { 
    habits, 
    addHabit, 
    today, 
    overallStreak, 
    timers, 
    routines, 
    activeRoutine, 
    startRoutine, 
    stopRoutine, 
    addRoutine,
    deleteRoutine,
    level,
    xp,
    equippedArtifactId,
    syncStatus,
  } = useHabits();
  const { 
    colors, 
    fontSizeScale, 
    soundsEnabled, 
    backgroundType, 
    isDark,
    focusSoundsEnabled,
    selectedFocusSound,
    hasSeenOnboarding,
    updateSettings 
  } = useSettings();
  
  const isAnyTimerRunning = Object.values(timers).some(t => t?.isRunning);
  
  const [quote, setQuote] = useState(getRandomQuote());
  const [showAdd, setShowAdd] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<
    | null
    | {
        type: 'single' | 'all-done' | 'milestone';
        habitName?: string;
        streakDays?: number;
      }
  >(null);
  const prevHabitsState = useRef({ completed: 0, total: 0 });

  const [showVault, setShowVault] = useState(false);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🔥');
  const [color, setColor] = useState(colors.accent);
  const [category, setCategory] = useState<HabitCategory>('health');
  const [group, setGroup] = useState<HabitGroup>('anytime');
  const [priority, setPriority] = useState<HabitPriority>('medium');
  const [habitType, setHabitType] = useState<HabitType>('timer');
  const [targetMinutes, setTargetMinutes] = useState('10');
  const [targetCount, setTargetCount] = useState('8');

  // Routine creation state
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [routineIcon, setRoutineIcon] = useState('🚀');
  const [routineColor, setRoutineColor] = useState(colors.accent);
  const [routineHabitIds, setRoutineHabitIds] = useState<string[]>([]);
  const [isEditingRoutine, setIsEditingRoutine] = useState<string | null>(null);

  const toggleHabitInRoutine = (id: string) => {
    setRoutineHabitIds(prev => 
      prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]
    );
  };

  const handleSaveRoutine = () => {
    const cleanName = routineName.trim();
    
    if (!cleanName) {
      Alert.alert('Missing Name', 'Please give your routine a name.');
      return;
    }
    
    if (routineHabitIds.length === 0) {
      Alert.alert('No Habits', 'Please select at least one habit for the stack.');
      return;
    }
    
    try {
      addRoutine({
        name: cleanName,
        icon: routineIcon,
        color: routineColor,
        habitIds: routineHabitIds,
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRoutineModal(false);
      setRoutineName('');
      setRoutineHabitIds([]);
      Alert.alert('Success', 'Routine saved successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to save routine. Please try again.');
      console.error(err);
    }
  };

  useEffect(() => {
    setQuote(getRandomQuote());
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setQuote(getRandomQuote());
    }, [])
  );

  const completedToday = useMemo(
    () => habits.filter((h) => h.lastCompletedDate === today).length,
    [habits, today]
  );
  const animatedCompleted = useAnimatedCounter(completedToday);
  const totalHabits = habits.length || 1;
  const completionPercent = Math.round((completedToday / totalHabits) * 100);
  const animatedPercent = useAnimatedCounter(completionPercent);
  const animatedOverallStreak = useAnimatedCounter(overallStreak);
  const overlayScale = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const handleCreateHabit = () => {
    if (!name.trim()) return;
    addHabit({
      name: name.trim(),
      icon: icon || '🔥',
      color: color || colors.accent,
      category,
      group,
      priority,
      habitType,
      targetMinutes: habitType === 'timer' && targetMinutes ? Number(targetMinutes) : undefined,
      targetCount: habitType === 'count' && targetCount ? Number(targetCount) : undefined,
    });
    setName('');
    setTargetMinutes('10');
    setTargetCount('8');
    setHabitType('timer');
    setShowAdd(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const playChime = async () => {
    if (!soundsEnabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        {
          uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
        },
        { shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('isLoaded' in status && status.isLoaded && (status as any).didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {
      // ignore sound failures
    }
  };

  const triggerCelebration = (payload: {
    type: 'single' | 'all-done' | 'milestone';
    habitName?: string;
    streakDays?: number;
  }) => {
    setCelebration(payload);
    overlayScale.setValue(0.6);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(overlayScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 120,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    playChime();
    setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setCelebration(null));
    }, 1700);
  };

  const handleHabitCompleted = (payload: { habit: any; newStreak: number }) => {
    const milestones = [3, 7, 14, 21, 30, 60, 100];
    if (milestones.includes(payload.newStreak)) {
      triggerCelebration({
        type: 'milestone',
        habitName: payload.habit.name,
        streakDays: payload.newStreak,
      });
    } else {
      triggerCelebration({ type: 'single', habitName: payload.habit.name });
    }
  };

  useEffect(() => {
    const prev = prevHabitsState.current;
    
    if (
      completedToday === habits.length && 
      habits.length > 0 && 
      prev.total === habits.length &&
      completedToday > prev.completed
    ) {
      triggerCelebration({ type: 'all-done' });
    }
    
    prevHabitsState.current = { completed: completedToday, total: habits.length };
  }, [completedToday, habits.length]);

  const dynamicStyles = {
    container: [styles.container, { backgroundColor: colors.background }],
    greeting: [styles.greeting, { color: colors.textPrimary, fontSize: 22 * fontSizeScale }],
    quote: [styles.quote, { color: colors.textSecondary, fontSize: 14 * fontSizeScale }],
    quoteAuthor: [styles.quoteAuthor, { color: colors.textSecondary, fontSize: 12 * fontSizeScale }],
    streakFire: [styles.streakFire, { backgroundColor: colors.accentMuted }],
    streakText: [styles.streakText, { color: colors.accent, fontSize: 13 * fontSizeScale }],
    completionPill: [styles.completionPill, { backgroundColor: colors.cardPrimary }],
    completionText: [styles.completionText, { color: colors.textPrimary, fontSize: 13 * fontSizeScale }],
    emptyTitle: [styles.emptyTitle, { color: colors.textPrimary, fontSize: 18 * fontSizeScale }],
    emptySubtitle: [styles.emptySubtitle, { color: colors.textSecondary, fontSize: 13 * fontSizeScale }],
    fab: [styles.fab, { backgroundColor: colors.accent }],
    modalCard: [styles.modalCard, { backgroundColor: colors.background }],
    modalTitle: [styles.modalTitle, { color: colors.textPrimary, fontSize: 18 * fontSizeScale }],
    input: [styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border, fontSize: 14 * fontSizeScale }],
    chip: [styles.chip, { borderColor: colors.border }],
    chipActive: [styles.chipActive, { borderColor: colors.accent, backgroundColor: colors.accentMuted }],
    chipText: [styles.chipText, { color: colors.textPrimary, fontSize: 11 * fontSizeScale }],
    button: [styles.button, { backgroundColor: colors.accent }],
    buttonText: [styles.buttonText, { fontSize: 14 * fontSizeScale }],
    buttonGhost: [styles.buttonGhost, { borderColor: colors.border }],
    buttonGhostText: [styles.buttonGhostText, { color: colors.textPrimary, fontSize: 14 * fontSizeScale }],
    celebrationCard: [styles.celebrationCard, { backgroundColor: isDark ? '#020617ee' : '#ffffffee', borderColor: colors.accent }],
    celebrationTitle: [styles.celebrationTitle, { color: colors.textPrimary, fontSize: 18 * fontSizeScale }],
    celebrationBody: [styles.celebrationBody, { color: colors.textSecondary, fontSize: 13 * fontSizeScale }],
    routineCard: [styles.routineCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: colors.border }],
    routineName: [styles.routineName, { color: colors.textPrimary, fontSize: 13 * fontSizeScale }],
    routineCount: [styles.routineCount, { color: colors.textSecondary, fontSize: 11 * fontSizeScale }],
    emptyRoutinesText: [styles.emptyRoutinesText, { color: colors.textSecondary, fontSize: 12 * fontSizeScale }],
    vaultBtn: [styles.vaultBtn, { backgroundColor: colors.accentMuted, borderColor: colors.accent }],
    vaultIcon: [styles.vaultIcon, { fontSize: 20 * fontSizeScale }],
  };

  const getGradientColors = (): readonly [string, string] => {
    if (backgroundType !== 'gradient') return ['transparent', 'transparent'];
    const c1 = isDark ? '#000000' : '#ffffff';
    const c2 = colors.accentMuted;
    return [c1, c2];
  };

  return (
    <View style={dynamicStyles.container}>
      {backgroundType === 'gradient' && (
        <LinearGradient
          colors={getGradientColors()}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      {backgroundType === 'pattern' && <AmbientParticles />}

      <View style={[styles.header, equippedArtifactId && styles.headerArtifactGlow]}>
        {equippedArtifactId && (
          <View style={[styles.artifactAura, { backgroundColor: colors.accent, shadowColor: colors.accent }]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={dynamicStyles.greeting}>{getGreeting()}</Text>
          <TypewriterText
            text={`"${typeof quote === 'string' ? quote : (quote?.text || 'Stay motivated!')}"`}
            fadeInDuration={700}
            typewriterSpeed={32}
            style={dynamicStyles.quote}
          />
          <Text style={dynamicStyles.quoteAuthor}>— {typeof quote === 'string' ? 'Kairos' : (quote?.author || 'Kairos')}</Text>
        </View>
        <Pressable 
          onPress={() => setShowVault(true)}
          style={dynamicStyles.vaultBtn}
          hitSlop={15}
        >
          <Text style={dynamicStyles.vaultIcon}>
            {equippedArtifactId ? ARTIFACT_REGISTRY.find(a => a.id === equippedArtifactId)?.icon : '🏛️'}
          </Text>
          {equippedArtifactId && (
            <View style={[styles.vaultActiveDot, { backgroundColor: colors.accent }]} />
          )}
        </Pressable>
        
        {/* Sync Status Indicator */}
        <View style={styles.syncContainer}>
          <View style={[
            styles.syncDot, 
            { backgroundColor: syncStatus === 'synced' ? '#10b981' : syncStatus === 'syncing' ? '#f59e0b' : '#ef4444' }
          ]} />
          <Text style={[styles.syncText, { color: colors.textSecondary }]}>
            {syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Syncing...' : 'Sync Error'}
          </Text>
        </View>
      </View>

      <View style={styles.streakRow}>
        <View style={dynamicStyles.streakFire}>
          <Text style={styles.fireIcon}>🔥</Text>
          <Text style={dynamicStyles.streakText}>
            {animatedCompleted}/{totalHabits} today · {animatedOverallStreak} day streak
          </Text>
        </View>
        <View style={dynamicStyles.completionPill}>
          <Text style={dynamicStyles.completionText}>{animatedPercent}% complete</Text>
        </View>
      </View>

      {/* Routines Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: 13 * fontSizeScale }]}>Daily Routines</Text>
        <Pressable onPress={() => setShowRoutineModal(true)}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>+ Create</Text>
        </Pressable>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.routinesScroll}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {routines.map(routine => (
          <Pressable 
            key={routine.id}
            onPress={() => activeRoutine?.routineId === routine.id ? stopRoutine() : startRoutine(routine.id)}
            style={[
              dynamicStyles.routineCard,
              activeRoutine?.routineId === routine.id && { borderColor: routine.color, borderWidth: 2 }
            ]}
          >
            <Text style={{ fontSize: 24 }}>{routine.icon}</Text>
            <Text style={dynamicStyles.routineName} numberOfLines={1}>{routine.name}</Text>
            <Text style={dynamicStyles.routineCount}>{routine.habitIds.length} habits</Text>
            {activeRoutine?.routineId === routine.id && (
              <View style={[styles.activeIndicator, { backgroundColor: routine.color }]} />
            )}
          </Pressable>
        ))}
        {routines.length === 0 && (
          <Text style={dynamicStyles.emptyRoutinesText}>Stack habits into routines.</Text>
        )}
      </ScrollView>

      {activeRoutine && (
        <LinearGradient
          colors={[colors.accent, colors.accentMuted]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.activeRoutineBanner}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.activeRoutineLabel}>ROUTINE ACTIVE</Text>
            <Text style={styles.activeHabitName}>
              {routines.find(r => r.id === activeRoutine.routineId)?.name} • Step {activeRoutine.stepIndex + 1}
            </Text>
          </View>
          <Pressable onPress={stopRoutine} style={styles.stopRoutineBtn}>
            <Text style={styles.stopRoutineText}>Stop</Text>
          </Pressable>
        </LinearGradient>
      )}

      {/* Focus Mode Selector */}
      <View style={styles.focusSection}>
        <View style={styles.focusHeader}>
          <Text style={[styles.focusTitle, { color: colors.textPrimary, fontSize: 13 * fontSizeScale }]}>
            Focus Mode {focusSoundsEnabled ? (isAnyTimerRunning ? '· Active 🎧' : '· Ready') : '· Off'}
          </Text>
          <Pressable 
            onPress={() => updateSettings({ focusSoundsEnabled: !focusSoundsEnabled })}
            style={[styles.focusToggle, { backgroundColor: focusSoundsEnabled ? colors.accent : colors.cardSecondary }]}
          >
            <Text style={{ fontSize: 10, color: focusSoundsEnabled ? '#fff' : colors.textSecondary, fontWeight: '700' }}>
              {focusSoundsEnabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>
        <FlatList
          horizontal
          data={focusSoundOptions}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.focusList}
          renderItem={({ item }) => {
            const isSelected = selectedFocusSound === item.id;
            return (
              <Pressable
                onPress={() => updateSettings({ selectedFocusSound: item.id })}
                style={[
                  styles.focusChip,
                  { 
                    backgroundColor: isSelected ? colors.accentMuted : colors.cardPrimary,
                    borderColor: isSelected ? colors.accent : 'transparent',
                    borderWidth: 1,
                  }
                ]}
              >
                <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
                <Text style={[styles.focusChipText, { color: isSelected ? colors.accent : colors.textSecondary }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={habits}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <HabitCard
            habit={item}
            onCompleted={handleHabitCompleted}
            onOpenDetail={() => setSelectedHabitId(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={dynamicStyles.emptyTitle}>No habits yet</Text>
            <Text style={dynamicStyles.emptySubtitle}>Start with one tiny habit. Momentum will follow.</Text>
          </View>
        }
      />

      <Pressable style={dynamicStyles.fab} onPress={() => {
        setColor(colors.accent);
        setShowAdd(true);
      }}>
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>

      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={dynamicStyles.modalCard}>
            <Text style={dynamicStyles.modalTitle}>Create a new habit</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Habit name"
              placeholderTextColor={colors.textSecondary}
              style={dynamicStyles.input}
            />
            <TextInput
              value={icon}
              onChangeText={setIcon}
              placeholder="Emoji icon"
              placeholderTextColor={colors.textSecondary}
              style={dynamicStyles.input}
            />
            <TextInput
              value={color}
              onChangeText={setColor}
              placeholder={colors.accent}
              placeholderTextColor={colors.textSecondary}
              style={dynamicStyles.input}
            />
            {/* Habit type toggle */}
            <View style={styles.rowChips}>
              {habitTypes.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setHabitType(t.id)}
                  style={[dynamicStyles.chip, habitType === t.id && dynamicStyles.chipActive]}
                >
                  <Text style={dynamicStyles.chipText}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            {habitType === 'timer' ? (
              <TextInput
                value={targetMinutes}
                onChangeText={setTargetMinutes}
                placeholder="Target minutes (optional)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                style={dynamicStyles.input}
              />
            ) : (
              <TextInput
                value={targetCount}
                onChangeText={setTargetCount}
                placeholder="Target count (e.g. 8 glasses)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                style={dynamicStyles.input}
              />
            )}

            <View style={styles.rowChips}>
              {groups.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => setGroup(g.id)}
                  style={[dynamicStyles.chip, group === g.id && dynamicStyles.chipActive]}
                >
                  <Text style={dynamicStyles.chipText}>{g.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.rowChips}>
              {priorities.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setPriority(p.id)}
                  style={[dynamicStyles.chip, priority === p.id && dynamicStyles.chipActive]}
                >
                  <Text style={dynamicStyles.chipText}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.rowChips}>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[dynamicStyles.chip, category === c.id && dynamicStyles.chipActive]}
                >
                  <Text style={dynamicStyles.chipText}>{c.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={[dynamicStyles.button, dynamicStyles.buttonGhost]} onPress={() => setShowAdd(false)}>
                <Text style={dynamicStyles.buttonGhostText}>Cancel</Text>
              </Pressable>
              <Pressable style={dynamicStyles.button} onPress={handleCreateHabit}>
                <Text style={dynamicStyles.buttonText}>Save habit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {celebration && (
        <View pointerEvents="none" style={styles.celebrationOverlay}>
          <Animated.View
            style={[
              dynamicStyles.celebrationCard,
              {
                opacity: overlayOpacity,
                transform: [{ scale: overlayScale }],
              },
            ]}
          >
            <Text style={styles.celebrationEmoji}>
              {celebration.type === 'all-done' ? '🎉' : celebration.type === 'milestone' ? '🏆' : '✅'}
            </Text>
            <Text style={dynamicStyles.celebrationTitle}>
              {celebration.type === 'all-done'
                ? 'All habits complete!'
                : celebration.type === 'milestone'
                ? `Streak unlocked!`
                : 'Nice work!'}
            </Text>
            {celebration.type === 'milestone' && celebration.habitName && celebration.streakDays ? (
              <Text style={dynamicStyles.celebrationBody}>
                {celebration.habitName} · {celebration.streakDays} days in a row.
              </Text>
            ) : celebration.type === 'single' && celebration.habitName ? (
              <Text style={dynamicStyles.celebrationBody}>{celebration.habitName} crushed for today.</Text>
            ) : (
              <Text style={dynamicStyles.celebrationBody}>Keep the flame alive.</Text>
            )}
          </Animated.View>
        </View>
      )}
      
      {celebration && celebration.type === 'all-done' && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
          <ConfettiBurst colors={[colors.accent, colors.accentMuted, '#f59e0b', '#3b82f6', '#10b981']} />
        </View>
      )}

      <Modal visible={showRoutineModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={dynamicStyles.modalCard}>
            <Text style={dynamicStyles.modalTitle}>Create a Routine</Text>
            
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TextInput
                value={routineIcon}
                onChangeText={setRoutineIcon}
                style={[dynamicStyles.input, { width: 60, fontSize: 24, textAlign: 'center' }]}
              />
              <TextInput
                value={routineName}
                onChangeText={setRoutineName}
                placeholder="Morning Routine..."
                placeholderTextColor={colors.textSecondary}
                style={[dynamicStyles.input, { flex: 1 }]}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[styles.focusTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Select Habits for Stack</Text>
              {habits.length > 0 && (
                <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '600' }}>Tap to select</Text>
              )}
            </View>
            <ScrollView style={{ maxHeight: 250 }} contentContainerStyle={{ gap: 8 }}>
              {habits.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: 16 }}>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 12 }}>
                    You haven't created any habits yet. Routines are built by stacking existing habits.
                  </Text>
                  <Pressable 
                    onPress={() => { setShowRoutineModal(false); setShowAdd(true); }}
                    style={[dynamicStyles.button, { paddingVertical: 8 }]}
                  >
                    <Text style={[dynamicStyles.buttonText, { fontSize: 12 }]}>+ Create Habit First</Text>
                  </Pressable>
                </View>
              ) : (
                habits.map(h => (
                  <Pressable
                    key={h.id}
                    onPress={() => toggleHabitInRoutine(h.id)}
                    style={[
                      styles.habitSelectRow,
                      { 
                        borderColor: routineHabitIds.includes(h.id) ? colors.accent : colors.border,
                        backgroundColor: routineHabitIds.includes(h.id) ? colors.accentMuted : 'transparent'
                      }
                    ]}
                  >
                    <Text style={{ fontSize: 20 }}>{h.icon}</Text>
                    <Text style={{ flex: 1, color: colors.textPrimary, fontWeight: routineHabitIds.includes(h.id) ? '600' : '400' }}>{h.name}</Text>
                    {routineHabitIds.includes(h.id) && (
                      <View style={{ backgroundColor: colors.accent, borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable 
                onPress={handleSaveRoutine}
                style={[
                  dynamicStyles.button, 
                  (!routineName.trim() || routineHabitIds.length === 0) && { opacity: 0.3 }
                ]}
              >
                <Text style={dynamicStyles.buttonText}>Save Routine</Text>
              </Pressable>
              <Pressable onPress={() => setShowRoutineModal(false)} style={dynamicStyles.buttonGhost}>
                <Text style={dynamicStyles.buttonGhostText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <HabitDetailModal
        habitId={selectedHabitId}
        onClose={() => setSelectedHabitId(null)}
      />

      <VaultModal 
        visible={showVault}
        onClose={() => setShowVault(false)}
      />

      <OnboardingOverlay
        visible={!hasSeenOnboarding}
        onFinish={() => updateSettings({ hasSeenOnboarding: true })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 52,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    position: 'relative',
  },
  headerArtifactGlow: {
    // shadow logic handled by aura view
  },
  artifactAura: {
    position: 'absolute',
    top: 10,
    left: -10,
    right: -10,
    bottom: 0,
    borderRadius: 30,
    opacity: 0.15,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
    zIndex: -1,
  },
  vaultBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    position: 'relative',
    zIndex: 10,
  },
  vaultIcon: {
    fontSize: 24,
  },
  vaultActiveDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  greeting: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  quote: {
    fontStyle: 'italic',
    lineHeight: 18,
  },
  quoteAuthor: {
    marginTop: 4,
    fontWeight: '500',
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  streakFire: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  fireIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  streakText: {
    fontWeight: '600',
  },
  completionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  completionText: {
  },
  listContent: {
    paddingBottom: 120,
  },
  emptyState: {
    marginTop: 80,
    alignItems: 'center',
  },
  emptyTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtitle: {
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  focusSection: {
    marginBottom: 20,
  },
  focusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  focusTitle: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  focusToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  focusList: {
    paddingHorizontal: 4,
    gap: 10,
  },
  focusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  focusChipText: {
    fontWeight: '600',
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabIcon: {
    color: '#f9fafb',
    fontSize: 28,
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#020617dd',
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  rowChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: {
  },
  chipText: {
  },
  modalActions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#f9fafb',
    fontWeight: '600',
  },
  buttonGhost: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonGhostText: {
  },
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationCard: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  celebrationEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  celebrationTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  celebrationBody: {
  },
  habitSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  addLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  routinesScroll: {
    marginBottom: 20,
  },
  routineCard: {
    width: 130,
    height: 120,
    borderRadius: 24,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  routineName: {
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  routineCount: {
    marginTop: 2,
    fontWeight: '500',
  },
  activeIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyRoutinesText: {
    paddingLeft: 4,
    fontStyle: 'italic',
    opacity: 0.6,
  },
  activeRoutineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  activeRoutineLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  activeHabitName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  stopRoutineBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  stopRoutineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  syncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  syncText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default HomeScreen;

