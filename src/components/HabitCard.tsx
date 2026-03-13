import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Alert } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Habit, useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import HabitTimerRing from './HabitTimerRing';
import dayjs from 'dayjs';
import { Audio } from 'expo-av';

interface Props {
  habit: Habit;
  onOpenDetail?: () => void;
  onCompleted?: (payload: { habit: Habit; newStreak: number }) => void;
}

const HabitCard: React.FC<Props> = ({ habit, onOpenDetail, onCompleted }) => {
  const {
    startTimer,
    pauseTimer,
    resetTimer,
    timers,
    dailyCounts,
    completeHabitForToday,
    incrementCount,
    decrementCount,
    deleteHabit,
  } = useHabits();
  const { colors, fontSizeScale, soundsEnabled, focusSoundsEnabled } = useSettings();
  const timer = timers[habit.id];
  const isRunning = timer?.isRunning ?? false;

  // Compute live elapsed so Done can be gated on progress
  const elapsedMs = timer?.elapsedMs ?? 0;
  const targetMs = (habit.targetMinutes ?? 0) * 60 * 1000;
  // Timer is "done" if no target set OR elapsed has reached target
  const timerReachedTarget = targetMs === 0 || elapsedMs >= targetMs;

  const today = dayjs().format('YYYY-MM-DD');
  const isCompletedToday = habit.lastCompletedDate === today;
  const currentHour = new Date().getHours();
  const isAtRisk = !isCompletedToday && currentHour >= 18;

  // Count habit state
  const countKey = `${today}::${habit.id}`;
  const currentCount = dailyCounts[countKey] ?? 0;
  const targetCount = habit.targetCount ?? 1;

  const pulseAnim = useRef(new Animated.Value(0)).current;

  const playChime = async () => {
    if (!soundsEnabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
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

  useEffect(() => {
    if (isAtRisk) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [isAtRisk]);

  const handleToggle = () => {
    if (isRunning) {
      pauseTimer(habit.id);
    } else {
      startTimer(habit.id);
    }
  };

  const handleComplete = () => {
    const elapsedMinutes = timer ? Math.round((timer.elapsedMs || 0) / 60000) : habit.targetMinutes ?? 0;
    completeHabitForToday(habit.id, elapsedMinutes);
    resetTimer(habit.id);
    playChime();

    if (onCompleted) {
      const yesterday = dayjs(today).subtract(1, 'day').format('YYYY-MM-DD');
      let newStreak = habit.streak;
      if (habit.lastCompletedDate === today) {
        newStreak = habit.streak;
      } else if (habit.lastCompletedDate === yesterday) {
        newStreak = habit.streak + 1;
      } else {
        newStreak = 1;
      }
      onCompleted({ habit, newStreak });
    }
  };

  const handleIncrement = () => {
    // Fire onCompleted callback when we first reach the target
    const wasNotDone = !isCompletedToday;
    incrementCount(habit.id);
    if (wasNotDone && currentCount + 1 >= targetCount) {
      playChime();
      if (onCompleted) {
        const yesterday = dayjs(today).subtract(1, 'day').format('YYYY-MM-DD');
        let newStreak = habit.streak;
        if (habit.lastCompletedDate === yesterday) {
          newStreak = habit.streak + 1;
        } else if (habit.lastCompletedDate !== today) {
          newStreak = 1;
        }
        onCompleted({ habit, newStreak });
      }
    }
  };

  const handleLongPress = () => {
    Alert.alert(
      'Delete Habit',
      `Are you sure you want to delete "${habit.name}"? This will erase its streak and history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(habit.id) },
      ]
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, -40, 0],
      outputRange: [1, 0.5, 0],
      extrapolate: 'clamp',
    });

    return (
      <Pressable
        style={styles.deleteAction}
        onPress={() => deleteHabit(habit.id)}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Text style={styles.deleteIcon}>🗑️</Text>
        </Animated.View>
      </Pressable>
    );
  };

  const streakLabel = habit.streak > 0 ? `${habit.streak}🔥` : 'No streak yet';

  const dynamicStyles = {
    card: [styles.card, { backgroundColor: habit.color + '22' }],
    iconWrapper: [styles.iconWrapper, { backgroundColor: habit.color + '33' }],
    title: [styles.title, { color: colors.textPrimary, fontSize: 16 * fontSizeScale }],
    subtitle: [styles.subtitle, { color: colors.textSecondary, fontSize: 12 * fontSizeScale }],
    chip: [styles.chip, { borderColor: colors.border }],
    chipActive: [styles.chipActive, { borderColor: colors.accent, backgroundColor: colors.accentMuted }],
    completeChip: [styles.completeChip, { backgroundColor: colors.accentMuted, borderColor: colors.accent }],
    chipTextActive: [styles.chipText, { color: colors.accent, fontSize: 11 * fontSizeScale }],
    chipTextDefault: [styles.chipText, { color: colors.textPrimary, fontSize: 11 * fontSizeScale }],
    countBtn: [styles.countBtn, { borderColor: colors.accent, backgroundColor: colors.accentMuted }],
    countBtnText: [styles.countBtnText, { color: colors.accent, fontSize: 18 * fontSizeScale }],
    countDisplay: [styles.countDisplay, { color: colors.textPrimary, fontSize: 14 * fontSizeScale }],
    countDone: [styles.countDone, { color: colors.accent, fontSize: 11 * fontSizeScale }],
  };

  const glowScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });

  const isCountHabit = habit.habitType === 'count';

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
      containerStyle={styles.swipeableContainer}
    >
      <Pressable
        onPress={onOpenDetail}
        onLongPress={handleLongPress}
        delayLongPress={500}
        style={({ pressed }) => [
          dynamicStyles.card,
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
      >
        {isAtRisk && (
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              styles.glowBorder,
              {
                top: -4,
                left: -4,
                right: -4,
                bottom: -4,
                borderColor: habit.color,
                transform: [{ scale: glowScale }],
                opacity: glowOpacity,
                zIndex: -1,
              },
            ]}
            pointerEvents="none"
          />
        )}
        <View style={styles.left}>
          <View style={dynamicStyles.iconWrapper}>
            <Text style={styles.icon}>{habit.icon}</Text>
          </View>
          <View>
            <Text style={dynamicStyles.title}>{habit.name}</Text>
            <Text style={dynamicStyles.subtitle}>{streakLabel}</Text>
          </View>
        </View>

        {isCountHabit ? (
          /* ── Counter widget ─────────────────────────── */
          <View style={styles.counterWidget}>
            {isCompletedToday && (
              <Text style={dynamicStyles.countDone}>✓ Done</Text>
            )}
            <View style={styles.counterRow}>
              <Pressable
                onPress={() => decrementCount(habit.id)}
                style={dynamicStyles.countBtn}
                disabled={currentCount <= 0}
              >
                <Text style={dynamicStyles.countBtnText}>−</Text>
              </Pressable>
              <Text style={dynamicStyles.countDisplay}>
                {currentCount}/{targetCount}
              </Text>
              <Pressable
                onPress={handleIncrement}
                style={dynamicStyles.countBtn}
                disabled={isCompletedToday && currentCount >= targetCount}
              >
                <Text style={dynamicStyles.countBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* ── Timer widget ───────────────────────────── */
          <View style={styles.right}>
            <View style={styles.ringWrapper}>
              <HabitTimerRing habitId={habit.id} targetMinutes={habit.targetMinutes} />
              {isRunning && focusSoundsEnabled && (
                <Animated.View style={[styles.focusIndicator, { opacity: pulseAnim }]}>
                  <Text style={{ fontSize: 10 }}>🎧</Text>
                </Animated.View>
              )}
            </View>
            <View style={styles.actions}>
              <Pressable onPress={handleToggle} style={isRunning ? dynamicStyles.chipActive : dynamicStyles.chip}>
                <Text style={isRunning ? dynamicStyles.chipTextActive : dynamicStyles.chipTextDefault}>
                  {isRunning ? 'Pause' : 'Start'}
                </Text>
              </Pressable>
              <Pressable
                onPress={timerReachedTarget ? handleComplete : undefined}
                style={[
                  dynamicStyles.completeChip,
                  !timerReachedTarget && { opacity: 0.35 },
                ]}
                disabled={!timerReachedTarget}
              >
                <Text style={dynamicStyles.chipTextActive}>
                  {timerReachedTarget ? 'Done' : '⏳'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  swipeableContainer: {
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  deleteAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 20,
    marginLeft: 8,
  },
  deleteIcon: {
    fontSize: 28,
  },
  glowBorder: {
    borderWidth: 2,
    borderRadius: 24,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
  title: {
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 2,
  },
  right: {
    alignItems: 'center',
  },
  ringWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusIndicator: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: '#00000044',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  completeChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: {
    fontWeight: '500',
  },
  /* Counter styles */
  counterWidget: {
    alignItems: 'center',
    gap: 4,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBtnText: {
    fontWeight: '700',
    lineHeight: 20,
  },
  countDisplay: {
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'center',
  },
  countDone: {
    fontWeight: '600',
  },
});

export default HabitCard;
