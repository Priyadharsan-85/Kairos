import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import dayjs from 'dayjs';
import * as Haptics from 'expo-haptics';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';

interface Props {
  habitId: string | null;
  onClose: () => void;
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const HabitDetailModal: React.FC<Props> = ({ habitId, onClose }) => {
  const { habits, history, updateHabit, deleteHabit, dailyCounts } = useHabits();
  const { colors, fontSizeScale, isDark } = useSettings();

  const habit = habits.find((h) => h.id === habitId) ?? null;

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (habit) {
      setEditName(habit.name);
      setEditIcon(habit.icon);
      setEditColor(habit.color);
      setEditTarget(
        habit.habitType === 'count'
          ? String(habit.targetCount ?? 1)
          : String(habit.targetMinutes ?? '')
      );
      setDirty(false);
    }
  }, [habitId]);

  // ── Slide-up animation ────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (habitId) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 20,
        tension: 160,
      }).start();
    } else {
      slideAnim.setValue(600);
    }
  }, [habitId]);

  // ── Monthly calendar ──────────────────────────────────────────────────────
  const today = dayjs().format('YYYY-MM-DD');
  const year = dayjs().year();
  const monthIndex = dayjs().month();
  const firstOfMonth = dayjs().year(year).month(monthIndex).date(1);
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  const startWeekday = firstOfMonth.day(); // 0 = Sun

  const completedDaysThisMonth = useMemo(() => {
    if (!habit) return new Set<string>();
    const set = new Set<string>();
    // From history
    history.forEach((r) => {
      if (r.habitId === habit.id && r.date.startsWith(dayjs().format('YYYY-MM'))) {
        set.add(r.date);
      }
    });
    // Always include lastCompletedDate if it's this month
    if (habit.lastCompletedDate?.startsWith(dayjs().format('YYYY-MM'))) {
      set.add(habit.lastCompletedDate);
    }
    return set;
  }, [habit, history]);

  // Build calendar rows
  type CalCell = { day: number | null; date: string | null };
  const calendarRows = useMemo(() => {
    const rows: CalCell[][] = [];
    let row: CalCell[] = [];

    for (let s = 0; s < startWeekday; s++) row.push({ day: null, date: null });

    for (let d = 1; d <= dim; d++) {
      const date = dayjs().year(year).month(monthIndex).date(d).format('YYYY-MM-DD');
      row.push({ day: d, date });
      if (row.length === 7) {
        rows.push(row);
        row = [];
      }
    }
    if (row.length > 0) rows.push(row);
    return rows;
  }, [startWeekday, dim, year, monthIndex]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalSessions = useMemo(() => {
    if (!habit) return 0;
    const fromHistory = history.filter((r) => r.habitId === habit.id).length;
    // If completed today and no history entry (e.g. count habit with 0 minutes), count it
    const completedToday = habit.lastCompletedDate === today ? 1 : 0;
    const todayInHistory = history.some((r) => r.habitId === habit.id && r.date === today);
    return fromHistory + (completedToday && !todayInHistory ? 1 : 0);
  }, [habit, history, today]);

  // For count habits, today's count
  const countKey = `${today}::${habitId}`;
  const todayCount = dailyCounts[countKey] ?? 0;

  if (!habit) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSave = () => {
    const patch: Record<string, any> = {
      name: editName.trim() || habit.name,
      icon: editIcon.trim() || habit.icon,
      color: editColor.trim() || habit.color,
    };
    if (habit.habitType === 'count') {
      patch.targetCount = Number(editTarget) || 1;
    } else {
      patch.targetMinutes = editTarget ? Number(editTarget) : undefined;
    }
    updateHabit(habit.id, patch);
    setDirty(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Habit',
      `Delete "${habit.name}" and all its history? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteHabit(habit.id);
            onClose();
          },
        },
      ]
    );
  };

  const handleClose = () => {
    if (dirty) {
      Alert.alert('Unsaved changes', 'Save your edits before closing?', [
        { text: 'Discard', style: 'destructive', onPress: onClose },
        { text: 'Save & close', onPress: () => { handleSave(); onClose(); } },
      ]);
    } else {
      onClose();
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const accentColor = editColor || habit.color;
  const cardBg = colors.cardPrimary;
  const textPrimary = colors.textPrimary;
  const textSecondary = colors.textSecondary;
  const bg = colors.background;

  return (
    <Modal
      visible={!!habitId}
      animationType="none"
      transparent
      onRequestClose={handleClose}
    >
      {/* Dim backdrop */}
      <Pressable style={styles.backdrop} onPress={handleClose} />

      {/* Slide-up sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: bg, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Colored top accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        {/* Handle pill */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
            <Text style={[styles.closeBtnText, { color: textSecondary }]}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero ─────────────────────────────────────────────── */}
          <View style={styles.heroRow}>
            <View style={[styles.heroIcon, { backgroundColor: accentColor + '30' }]}>
              <Text style={styles.heroEmoji}>{editIcon || habit.icon}</Text>
            </View>
            <View style={styles.heroText}>
              <Text
                style={[styles.heroName, { color: textPrimary, fontSize: 20 * fontSizeScale }]}
                numberOfLines={2}
              >
                {editName || habit.name}
              </Text>
              <Text style={[styles.heroMeta, { color: textSecondary, fontSize: 12 * fontSizeScale }]}>
                {habit.category} · {habit.group} · {habit.priority} priority
              </Text>
            </View>
          </View>

          {/* ── Quick stats ──────────────────────────────────────── */}
          <View style={[styles.statsRow]}>
            {[
              { label: 'Streak', value: `${habit.streak}🔥` },
              { label: 'Best', value: `${habit.bestStreak}🏆` },
              { label: 'Sessions', value: String(totalSessions) },
              {
                label: habit.habitType === 'count' ? 'Today' : 'Minutes',
                value: habit.habitType === 'count' ? `${todayCount}/${habit.targetCount ?? 1}` : String(habit.totalMinutes),
              },
            ].map((s) => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: cardBg }]}>
                <Text style={[styles.statValue, { color: textPrimary, fontSize: 15 * fontSizeScale }]}>
                  {s.value}
                </Text>
                <Text style={[styles.statLabel, { color: textSecondary, fontSize: 10 * fontSizeScale }]}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Monthly calendar ─────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: textPrimary, fontSize: 14 * fontSizeScale }]}>
            {dayjs().format('MMMM YYYY')}
          </Text>
          <View style={[styles.calendarCard, { backgroundColor: cardBg }]}>
            {/* Day-of-week headers */}
            <View style={styles.calRow}>
              {DAYS_OF_WEEK.map((d) => (
                <Text key={d} style={[styles.dowLabel, { color: textSecondary, fontSize: 10 * fontSizeScale }]}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Calendar rows */}
            {calendarRows.map((row, ri) => (
              <View key={ri} style={styles.calRow}>
                {row.map((cell, ci) => {
                  const isToday = cell.date === today;
                  const isDone = cell.date ? completedDaysThisMonth.has(cell.date) : false;
                  const isFuture = cell.date ? cell.date > today : false;

                  return (
                    <View
                      key={`${ri}-${ci}`}
                      style={[
                        styles.calCell,
                        isDone && { backgroundColor: accentColor },
                        isToday && !isDone && { borderWidth: 1.5, borderColor: accentColor },
                      ]}
                    >
                      {cell.day !== null && (
                        <Text
                          style={[
                            styles.calCellText,
                            {
                              color: isDone
                                ? '#fff'
                                : isFuture
                                ? colors.border
                                : textPrimary,
                              fontSize: 11 * fontSizeScale,
                            },
                          ]}
                        >
                          {cell.day}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {/* ── Edit panel ───────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: textPrimary, fontSize: 14 * fontSizeScale }]}>
            Edit
          </Text>
          <View style={[styles.editCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.fieldLabel, { color: textSecondary, fontSize: 11 * fontSizeScale }]}>
              Name
            </Text>
            <TextInput
              value={editName}
              onChangeText={(v) => { setEditName(v); setDirty(true); }}
              style={[styles.input, { color: textPrimary, borderColor: colors.border, backgroundColor: bg, fontSize: 14 * fontSizeScale }]}
              placeholderTextColor={textSecondary}
            />

            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: textSecondary, fontSize: 11 * fontSizeScale }]}>
                  Icon
                </Text>
                <TextInput
                  value={editIcon}
                  onChangeText={(v) => { setEditIcon(v); setDirty(true); }}
                  style={[styles.input, { color: textPrimary, borderColor: colors.border, backgroundColor: bg, fontSize: 14 * fontSizeScale }]}
                  placeholderTextColor={textSecondary}
                  maxLength={4}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 2 }}>
                <Text style={[styles.fieldLabel, { color: textSecondary, fontSize: 11 * fontSizeScale }]}>
                  Color (hex)
                </Text>
                <View style={styles.colorRow}>
                  <View style={[styles.colorSwatch, { backgroundColor: accentColor }]} />
                  <TextInput
                    value={editColor}
                    onChangeText={(v) => { setEditColor(v); setDirty(true); }}
                    style={[styles.input, { flex: 1, color: textPrimary, borderColor: colors.border, backgroundColor: bg, fontSize: 14 * fontSizeScale }]}
                    placeholderTextColor={textSecondary}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: textSecondary, fontSize: 11 * fontSizeScale }]}>
              {habit.habitType === 'count' ? 'Target Count' : 'Target Minutes'}
            </Text>
            <TextInput
              value={editTarget}
              onChangeText={(v) => { setEditTarget(v); setDirty(true); }}
              keyboardType="numeric"
              style={[styles.input, { color: textPrimary, borderColor: colors.border, backgroundColor: bg, fontSize: 14 * fontSizeScale }]}
              placeholderTextColor={textSecondary}
              placeholder={habit.habitType === 'count' ? 'e.g. 8' : 'Optional'}
            />

            {dirty && (
              <Pressable
                onPress={handleSave}
                style={[styles.saveBtn, { backgroundColor: accentColor }]}
              >
                <Text style={styles.saveBtnText}>Save changes</Text>
              </Pressable>
            )}
          </View>

          {/* ── Streak info ──────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: textPrimary, fontSize: 14 * fontSizeScale }]}>
            History
          </Text>
          <View style={[styles.editCard, { backgroundColor: cardBg }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoKey, { color: textSecondary, fontSize: 12 * fontSizeScale }]}>Created</Text>
              <Text style={[styles.infoVal, { color: textPrimary, fontSize: 12 * fontSizeScale }]}>
                {dayjs(habit.createdAt).format('MMM D, YYYY')}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoKey, { color: textSecondary, fontSize: 12 * fontSizeScale }]}>Last completed</Text>
              <Text style={[styles.infoVal, { color: textPrimary, fontSize: 12 * fontSizeScale }]}>
                {habit.lastCompletedDate ? dayjs(habit.lastCompletedDate).format('MMM D, YYYY') : '—'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoKey, { color: textSecondary, fontSize: 12 * fontSizeScale }]}>Total sessions</Text>
              <Text style={[styles.infoVal, { color: textPrimary, fontSize: 12 * fontSizeScale }]}>{totalSessions}</Text>
            </View>
            {habit.habitType === 'timer' && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoKey, { color: textSecondary, fontSize: 12 * fontSizeScale }]}>Total time</Text>
                <Text style={[styles.infoVal, { color: textPrimary, fontSize: 12 * fontSizeScale }]}>
                  {habit.totalMinutes} min{habit.totalMinutes >= 60 ? ` (${Math.round(habit.totalMinutes / 60 * 10) / 10} hrs)` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* ── Danger zone ──────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: '#ef4444', fontSize: 14 * fontSizeScale }]}>
            Danger zone
          </Text>
          <Pressable onPress={handleDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>🗑️  Delete this habit</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '93%',
    overflow: 'hidden',
  },
  accentBar: {
    height: 5,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    flex: 1,
    maxWidth: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    top: 8,
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
    marginTop: 6,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 30,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    fontWeight: '700',
    lineHeight: 26,
  },
  heroMeta: {
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontWeight: '700',
  },
  statLabel: {
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionLabel: {
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  calendarCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 22,
    gap: 6,
  },
  calRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dowLabel: {
    width: 34,
    textAlign: 'center',
    fontWeight: '600',
  },
  calCell: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellText: {
    fontWeight: '600',
  },
  editCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 22,
    gap: 8,
  },
  fieldLabel: {
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  saveBtn: {
    marginTop: 6,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  infoKey: {
    fontWeight: '500',
  },
  infoVal: {
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: '#ef444420',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default HabitDetailModal;
