import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { HabitDayRecord, useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import { LinearGradient } from 'expo-linear-gradient';
import AmbientParticles from '@/components/AmbientParticles';

dayjs.extend(isBetween);

const daysInMonth = (year: number, monthIndex: number) => {
  return new Date(year, monthIndex + 1, 0).getDate();
};

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getHeatColor = (ratio: number, accentHex: string, emptyBg: string) => {
  if (ratio === 0) return emptyBg;
  if (ratio < 0.25) return hexToRgba(accentHex, 0.55);
  if (ratio < 0.5) return hexToRgba(accentHex, 0.72);
  if (ratio < 0.75) return hexToRgba(accentHex, 0.88);
  return accentHex;
};

const StatsScreen: React.FC = () => {
  const { habits, history, today, overallStreak, bestOverallStreak } = useHabits();
  const { colors, fontSizeScale, backgroundType, isDark } = useSettings();
  const [yearOffset, setYearOffset] = useState<0 | -1>(0);

  const totalMinutes = habits.reduce((acc, h) => acc + h.totalMinutes, 0);
  const bestStreak = habits.reduce((acc, h) => Math.max(acc, h.bestStreak), 0);

  const last7 = useMemo(() => {
    const days: { label: string; percent: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayjs(today).subtract(i, 'day');
      const dateKey = d.format('YYYY-MM-DD');
      
      // Count unique habits completed on this specific day from history
      const dayHistory = history.filter(h => h.date === dateKey);
      const uniqueCompletedCount = new Set(dayHistory.map(h => h.habitId)).size;
      
      const total = habits.length || 1;
      days.push({
        label: d.format('dd'),
        percent: Math.round((uniqueCompletedCount / total) * 100),
      });
    }
    return days;
  }, [habits, today]);

  const baseYear = dayjs(today).year();
  const selectedYear = (baseYear + yearOffset) as number;

  const yearlyHeatmap = useMemo(() => {
    const totalHabits = habits.length || 1;

    return Array.from({ length: 12 }, (_, monthIndex) => {
      const firstOfMonth = dayjs().year(selectedYear).month(monthIndex).date(1);
      const dim = daysInMonth(selectedYear, monthIndex);
      const startWeekday = firstOfMonth.day(); // 0=Sun … 6=Sat

      // Build rows of exactly 7 slots; only real days get a date+ratio
      type Cell = { date?: string; ratio: number; empty?: boolean };
      const rows: Cell[][] = [];
      let row: Cell[] = [];

      // Leading spacers for the first row
      for (let s = 0; s < startWeekday; s++) {
        row.push({ ratio: 0, empty: true });
      }

      for (let d = 1; d <= dim; d++) {
        const date = dayjs().year(selectedYear).month(monthIndex).date(d);
        const dateKey = date.format('YYYY-MM-DD');
        
        // Count unique habits completed on this specific day from history
        const dayHistory = history.filter(h => h.date === dateKey);
        const uniqueCompletedCount = new Set(dayHistory.map(h => h.habitId)).size;
        
        row.push({ date: dateKey, ratio: uniqueCompletedCount / totalHabits });
        if (row.length === 7) {
          rows.push(row);
          row = [];
        }
      }
      // Push the last incomplete row (no trailing spacers)
      if (row.length > 0) rows.push(row);

      return {
        monthIndex,
        label: firstOfMonth.format('MMM'),
        rows,
        dim,
      };
    });
  }, [habits, selectedYear]);

  const {
    sevenDayMinutesByHabit,
    thirtyDayMinutesByHabit,
    consistencyScore,
    mostProductiveDay,
    fastestCompletion,
  } = useMemo<{
    sevenDayMinutesByHabit: Record<string, number>;
    thirtyDayMinutesByHabit: Record<string, number>;
    consistencyScore: number;
    mostProductiveDay: { date: string; minutes: number } | null;
    fastestCompletion: { minutes: number; habitId: string } | null;
  }>(() => {
      const end = dayjs(today);
      const sevenStart = end.subtract(6, 'day');
      const thirtyStart = end.subtract(29, 'day');
      const seven: Record<string, number> = {};
      const thirty: Record<string, number> = {};
      const perDayTotal: Record<string, number> = {};

      history.forEach((r: HabitDayRecord) => {
        const d = dayjs(r.date);
        if (d.isBetween(sevenStart, end, 'day', '[]')) {
          seven[r.habitId] = (seven[r.habitId] ?? 0) + r.minutes;
        }
        if (d.isBetween(thirtyStart, end, 'day', '[]')) {
          thirty[r.habitId] = (thirty[r.habitId] ?? 0) + r.minutes;
        }
        if (d.isBetween(thirtyStart, end, 'day', '[]')) {
          perDayTotal[r.date] = (perDayTotal[r.date] ?? 0) + r.minutes;
        }
      });

      const daysForConsistency: string[] = [];
      for (let i = 0; i < 30; i++) {
        daysForConsistency.push(end.subtract(i, 'day').format('YYYY-MM-DD'));
      }

      let consistencySum = 0;
      const totalHabits = habits.length || 1;
      daysForConsistency.forEach((dateKey) => {
        // Count unique habits completed on this specific day from history
        const dayHistory = history.filter(h => h.date === dateKey);
        const uniqueCompletedCount = new Set(dayHistory.map(h => h.habitId)).size;
        
        consistencySum += uniqueCompletedCount / totalHabits;
      });
      const consistencyScore = Math.round((consistencySum / 30) * 100);

      let bestDay: { date: string; minutes: number } | null = null;
      Object.entries(perDayTotal).forEach(([date, minutes]) => {
        if (!bestDay || minutes > bestDay.minutes) {
          bestDay = { date, minutes };
        }
      });

      let fastest: { minutes: number; habitId: string } | null = null;
      history.forEach((record: HabitDayRecord) => {
        if (record.minutes <= 0) return;
        if (!fastest || record.minutes < fastest.minutes) {
          fastest = { minutes: record.minutes, habitId: record.habitId };
        }
      });

      return {
        sevenDayMinutesByHabit: seven,
        thirtyDayMinutesByHabit: thirty,
        consistencyScore,
        mostProductiveDay: bestDay,
        fastestCompletion: fastest,
      };
    }, [habits, history, today]);

  const animatedMinutes = useAnimatedCounter(totalMinutes);
  const animatedBest = useAnimatedCounter(bestStreak);
  const animatedConsistency = useAnimatedCounter(consistencyScore);

  const fastestHabitName =
    fastestCompletion && habits.find((h) => h.id === fastestCompletion.habitId)?.name;

  const getGradientColors = (): readonly [string, string] => {
    if (backgroundType !== 'gradient') return ['transparent', 'transparent'];
    const c1 = isDark ? '#000000' : '#ffffff';
    const c2 = colors.accentMuted;
    return [c1, c2];
  };

  const dynamicStyles = {
    container: [styles.container, { backgroundColor: colors.background }],
    title: [styles.title, { color: colors.textPrimary, fontSize: 22 * fontSizeScale }],
    sectionTitle: [styles.sectionTitle, { color: colors.textPrimary, fontSize: 16 * fontSizeScale }],
    card: [styles.card, { backgroundColor: colors.cardPrimary }],
    cardLabel: [styles.cardLabel, { color: colors.textSecondary, fontSize: 12 * fontSizeScale }],
    cardValue: [styles.cardValue, { color: colors.textPrimary, fontSize: 18 * fontSizeScale }],
    barTrack: [styles.barTrack, { backgroundColor: colors.cardSecondary }],
    barFill: [styles.barFill, { backgroundColor: colors.accent }],
    barLabel: [styles.barLabel, { color: colors.textSecondary, fontSize: 11 * fontSizeScale }],
    tipBox: [styles.tipBox, { backgroundColor: colors.cardSecondary }],
    tipTitle: [styles.tipTitle, { color: colors.textPrimary, fontSize: 14 * fontSizeScale }],
    tipBody: [styles.tipBody, { color: colors.textSecondary, fontSize: 13 * fontSizeScale }],
    yearToggleChip: [styles.yearToggleChip, { borderColor: colors.border }],
    yearToggleChipActive: [styles.yearToggleChipActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
    yearToggleText: [styles.yearToggleText, { color: colors.textPrimary, fontSize: 11 * fontSizeScale }],
    monthLabel: [styles.monthLabel, { color: colors.textSecondary, fontSize: 11 * fontSizeScale }],
    gaugeWrapper: [styles.gaugeWrapper, { backgroundColor: colors.background }],
    gaugeBackground: [styles.gaugeBackground, { backgroundColor: colors.cardSecondary }],
    gaugeFill: [styles.gaugeFill, { backgroundColor: colors.accent }],
    consistencyValue: [styles.consistencyValue, { color: colors.textPrimary, fontSize: 18 * fontSizeScale }],
    consistencyLabel: [styles.consistencyLabel, { color: colors.textSecondary, fontSize: 12 * fontSizeScale }],
    streakName: [styles.streakName, { color: colors.textPrimary, fontSize: 13 * fontSizeScale }],
    streakBarBackground: [styles.streakBarBackground, { backgroundColor: colors.cardSecondary }],
    streakBarCurrent: [styles.streakBarCurrent, { backgroundColor: colors.accent }],
    streakMeta: [styles.streakMeta, { color: colors.textSecondary, fontSize: 11 * fontSizeScale }],
    timeName: [styles.timeName, { color: colors.textPrimary, fontSize: 13 * fontSizeScale }],
    timeValue: [styles.timeValue, { color: colors.textPrimary, fontSize: 12 * fontSizeScale }],
    timeValueMuted: [styles.timeValueMuted, { color: colors.textSecondary, fontSize: 11 * fontSizeScale }],
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={dynamicStyles.title}>Your stats</Text>
        <View style={styles.cardsRow}>
          <View style={dynamicStyles.card}>
            <Text style={dynamicStyles.cardLabel}>Time invested</Text>
            <Text style={dynamicStyles.cardValue}>{animatedMinutes} min</Text>
          </View>
          <View style={dynamicStyles.card}>
            <Text style={dynamicStyles.cardLabel}>Per-habit best streak</Text>
            <Text style={dynamicStyles.cardValue}>{animatedBest} days</Text>
          </View>
          <View style={dynamicStyles.card}>
            <Text style={dynamicStyles.cardLabel}>Overall streak</Text>
            <Text style={dynamicStyles.cardValue}>
              {overallStreak} days (best {bestOverallStreak})
            </Text>
          </View>
        </View>

        <Text style={dynamicStyles.sectionTitle}>Last 7 days</Text>
        <View style={styles.barsRow}>
          {last7.map((d) => (
            <View key={d.label} style={styles.barItem}>
              <View style={dynamicStyles.barTrack}>
                <View style={[dynamicStyles.barFill, { height: `${d.percent}%` }]} />
              </View>
              <Text style={dynamicStyles.barLabel}>{d.label}</Text>
            </View>
          ))}
        </View>

        <Text style={dynamicStyles.sectionTitle}>Year heatmap</Text>
        <View style={styles.yearToggleRow}>
          <Pressable
            onPress={() => setYearOffset(0)}
            style={[dynamicStyles.yearToggleChip, yearOffset === 0 && dynamicStyles.yearToggleChipActive]}
          >
            <Text style={dynamicStyles.yearToggleText}>Current year</Text>
          </Pressable>
          <Pressable
            onPress={() => setYearOffset(-1)}
            style={[dynamicStyles.yearToggleChip, yearOffset === -1 && dynamicStyles.yearToggleChipActive]}
          >
            <Text style={dynamicStyles.yearToggleText}>Previous year</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthsScrollContent}
        >
          {yearlyHeatmap.map((month) => (
            <View key={month.monthIndex} style={styles.monthCard}>
              <Text style={dynamicStyles.monthLabel}>{month.label}</Text>
              <View style={styles.heatGrid}>
                {month.rows.map((row, rowIdx) => (
                  <View key={rowIdx} style={styles.heatRow}>
                    {row.map((cell, cellIdx) =>
                      cell.empty ? (
                        <View key={`sp-${rowIdx}-${cellIdx}`} style={styles.heatCell} />
                      ) : (
                        <View
                          key={cell.date ?? `${rowIdx}-${cellIdx}`}
                          style={[
                            styles.heatCell,
                            { backgroundColor: getHeatColor(cell.ratio, colors.accent, colors.cardSecondary) },
                          ]}
                        />
                      )
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        <Text style={dynamicStyles.sectionTitle}>Consistency</Text>
        <View style={styles.consistencyRow}>
          <View style={dynamicStyles.gaugeWrapper}>
            <View style={dynamicStyles.gaugeBackground} />
            <View style={[dynamicStyles.gaugeFill, { width: `${Math.min(100, Math.max(0, animatedConsistency))}%` }]} />
          </View>
          <View style={styles.consistencyTextBlock}>
            <Text style={dynamicStyles.consistencyValue}>{animatedConsistency}</Text>
            <Text style={dynamicStyles.consistencyLabel}>Consistency score (30 days)</Text>
          </View>
        </View>

        <Text style={dynamicStyles.sectionTitle}>Best vs current streaks</Text>
        {habits.map((h) => (
          <View key={h.id} style={styles.streakRow}>
            <Text style={dynamicStyles.streakName}>{h.name}</Text>
            <View style={styles.streakBars}>
              <View style={dynamicStyles.streakBarBackground}>
                <View
                  style={[
                    dynamicStyles.streakBarCurrent,
                    {
                      width: `${h.bestStreak > 0 ? Math.min(100, (h.streak / h.bestStreak) * 100) : 0}%`,
                    },
                  ]}
                />
              </View>
              <Text style={dynamicStyles.streakMeta}>
                {h.streak} current / {h.bestStreak} best
              </Text>
            </View>
          </View>
        ))}

        <Text style={dynamicStyles.sectionTitle}>Time spent per habit</Text>
        {habits.map((h) => (
          <View key={h.id} style={styles.timeRow}>
            <Text style={dynamicStyles.timeName}>{h.name}</Text>
            <View style={styles.timeValues}>
              <Text style={dynamicStyles.timeValue}>{sevenDayMinutesByHabit[h.id] ?? 0} min (7d)</Text>
              <Text style={dynamicStyles.timeValueMuted}>{thirtyDayMinutesByHabit[h.id] ?? 0} min (30d)</Text>
            </View>
          </View>
        ))}

        <Text style={dynamicStyles.sectionTitle}>Personal records</Text>
        <View style={dynamicStyles.tipBox}>
          <Text style={dynamicStyles.tipTitle}>Longest streak</Text>
          <Text style={dynamicStyles.tipBody}>{animatedBest} days on your top habit.</Text>
          {mostProductiveDay ? (
            <>
              <Text style={[dynamicStyles.tipTitle, { marginTop: 10 }]}>Most productive day</Text>
              <Text style={dynamicStyles.tipBody}>
                {mostProductiveDay.minutes} min on {dayjs(mostProductiveDay.date).format('MMM D, YYYY')}.
              </Text>
            </>
          ) : null}
          {fastestCompletion && fastestHabitName ? (
            <>
              <Text style={[dynamicStyles.tipTitle, { marginTop: 10 }]}>Fastest focused session</Text>
              <Text style={dynamicStyles.tipBody}>
                {(fastestCompletion as { minutes: number }).minutes} min on {fastestHabitName}.
              </Text>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 52,
    paddingHorizontal: 16,
  },
  content: {
    paddingBottom: 100,
  },
  title: {
    fontWeight: '700',
    marginBottom: 16,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
  },
  cardLabel: {
    marginBottom: 6,
  },
  cardValue: {
    fontWeight: '600',
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  barItem: {
    alignItems: 'center',
    width: 32,
  },
  barTrack: {
    width: 18,
    height: 80,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 999,
  },
  barLabel: {
    marginTop: 4,
  },
  tipBox: {
    borderRadius: 18,
    padding: 14,
  },
  tipTitle: {
    fontWeight: '600',
    marginBottom: 6,
  },
  tipBody: {
  },
  yearToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  yearToggleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  yearToggleChipActive: {
  },
  yearToggleText: {
  },
  monthsScrollContent: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  monthCard: {
    marginRight: 12,
    alignItems: 'flex-start',
  },
  monthLabel: {
    marginBottom: 4,
  },
  heatGrid: {
    flexDirection: 'column',
    marginBottom: 20,
  },
  heatRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  heatmap: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  heatColumn: {
    flexDirection: 'column',
    marginRight: 4,
  },
  heatCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 3,
  },
  consistencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  gaugeWrapper: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  gaugeBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  gaugeFill: {
    height: '100%',
  },
  consistencyTextBlock: {
    marginLeft: 12,
  },
  consistencyValue: {
    fontWeight: '600',
  },
  consistencyLabel: {
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  streakName: {
    flex: 0.5,
  },
  streakBars: {
    flex: 1,
  },
  streakBarBackground: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 4,
  },
  streakBarCurrent: {
    height: '100%',
  },
  streakMeta: {
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeName: {
    flex: 0.6,
  },
  timeValues: {
    flex: 0.4,
    alignItems: 'flex-end',
  },
  timeValue: {
  },
  timeValueMuted: {
  },
});

export default StatsScreen;

