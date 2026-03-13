import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, ScrollView, Pressable, Platform } from 'react-native';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import { LinearGradient } from 'expo-linear-gradient';
import AmbientParticles from '@/components/AmbientParticles';

const RewardsScreen: React.FC = () => {
  const { 
    xp, 
    level, 
    bestOverallStreak, 
    habits, 
    inventory, 
    purchaseItem, 
    activateXpBooster 
  } = useHabits();
  const { colors, fontSizeScale, backgroundType, isDark } = useSettings();

  const progressValue = useRef(new Animated.Value(0)).current;
  
  // Calculate relative XP for this level (every 100 XP is a level)
  const xpCurrentLevel = xp % 100;
  const progressPercent = xpCurrentLevel / 100;

  useEffect(() => {
    Animated.timing(progressValue, {
      toValue: progressPercent,
      duration: 1200,
      useNativeDriver: false, // width interpolation doesn't support native driver
    }).start();
  }, [progressPercent]);

  const progressWidth = progressValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const animatedXp = useAnimatedCounter(xp);
  const animatedLevel = useAnimatedCounter(level);

  let rankName = 'Novice';
  if (level >= 5) rankName = 'Apprentice';
  if (level >= 10) rankName = 'Warrior';
  if (level >= 25) rankName = 'Master';
  if (level >= 50) rankName = 'Grandmaster';

  // Badge logic
  const hasIronWill = bestOverallStreak >= 30;
  
  // A bit more complex: user has completed a habit designated as 'morning' before 8 AM today?
  // We'll simplify for now: have they ever completed 5 habits total?
  const totalCompletedCount = habits.reduce((acc, h) => acc + h.streak, 0);
  const hasDedication = totalCompletedCount >= 10;

  const getGradientColors = (): readonly [string, string] => {
    if (backgroundType !== 'gradient') return ['transparent', 'transparent'];
    const c1 = isDark ? '#000000' : '#ffffff';
    const c2 = colors.accentMuted;
    return [c1, c2];
  };

  const dynamicStyles = {
    container: [styles.container, { backgroundColor: colors.background }],
    title: [styles.title, { color: colors.textPrimary, fontSize: 22 * fontSizeScale }],
    levelCard: [styles.levelCard, { backgroundColor: colors.cardPrimary }],
    levelLabel: [styles.levelLabel, { color: colors.textSecondary, fontSize: 13 * fontSizeScale }],
    levelValue: [styles.levelValue, { color: colors.textPrimary, fontSize: 28 * fontSizeScale }],
    rankName: [styles.rankName, { color: colors.accent, fontSize: 16 * fontSizeScale }],
    xpText: [styles.xpText, { color: colors.textSecondary, fontSize: 13 * fontSizeScale }],
    progressBarBg: [styles.progressBarBg, { backgroundColor: colors.border }],
    progressBarFill: [styles.progressBarFill, { backgroundColor: colors.accent }],
    badgeCardBase: [styles.badgeCard, { backgroundColor: colors.cardSecondary }],
    badgeCardLocked: [styles.badgeCard, { backgroundColor: colors.cardSecondary, opacity: 0.5 }],
    badgeCardUnlocked: [styles.badgeCard, { backgroundColor: colors.cardPrimary, borderColor: colors.accent, borderWidth: 1 }],
    badgeTitle: [styles.badgeTitle, { color: colors.textPrimary, fontSize: 14 * fontSizeScale }],
    badgeSub: [styles.badgeSub, { color: colors.textSecondary, fontSize: 12 * fontSizeScale }],
    caption: [styles.caption, { color: colors.textSecondary, fontSize: 13 * fontSizeScale }],
    emporiumTitle: [styles.emporiumTitle, { color: colors.textPrimary, fontSize: 18 * fontSizeScale }],
    storeItemCard: [styles.storeItemCard, { backgroundColor: colors.cardPrimary }],
    inventoryPill: [styles.inventoryPill, { backgroundColor: colors.cardSecondary, borderColor: colors.border }],
    boosterActivePill: [styles.inventoryPill, { backgroundColor: colors.accentMuted, borderColor: colors.accent }],
  };

  const isBoosterActive = inventory.activeBoosterUntil && Date.now() < inventory.activeBoosterUntil;
  const boosterRemainingHrs = isBoosterActive 
    ? Math.max(0, Math.ceil((inventory.activeBoosterUntil! - Date.now()) / (1000 * 60 * 60))) 
    : 0;

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={dynamicStyles.title}>Rewards & XP</Text>

      <View style={dynamicStyles.levelCard}>
        <View style={styles.rankRow}>
          <View>
            <Text style={dynamicStyles.levelLabel}>Current Level</Text>
            <Text style={dynamicStyles.levelValue}>Lv. {animatedLevel}</Text>
          </View>
          <Text style={dynamicStyles.rankName}>{rankName}</Text>
        </View>

        <View style={dynamicStyles.progressBarBg}>
          <Animated.View style={[dynamicStyles.progressBarFill, { width: progressWidth }]} />
        </View>
        <View style={styles.statsFooter}>
          <Text style={dynamicStyles.xpText}>{xpCurrentLevel} / 100 XP to next level</Text>
          <View style={styles.inventoryRow}>
            {inventory.streakFreezes > 0 && (
              <View style={dynamicStyles.inventoryPill}>
                <Text style={styles.inventoryText}>❄️ {inventory.streakFreezes}</Text>
              </View>
            )}
            {inventory.xpBoosters > 0 && (
              <Pressable onPress={activateXpBooster} style={dynamicStyles.inventoryPill}>
                <Text style={styles.inventoryText}>⚡ {inventory.xpBoosters}</Text>
              </Pressable>
            )}
            {isBoosterActive && (
              <View style={dynamicStyles.boosterActivePill}>
                <Text style={[styles.inventoryText, { color: colors.accent }]}>🚀 {boosterRemainingHrs}h</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.emporiumSection}>
        <Text style={dynamicStyles.emporiumTitle}>XP Emporium</Text>
        <View style={styles.storeGrid}>
          {/* Streak Freeze */}
          <View style={dynamicStyles.storeItemCard}>
            <Text style={styles.storeEmoji}>❄️</Text>
            <View style={styles.storeInfo}>
              <Text style={dynamicStyles.badgeTitle}>Streak Freeze</Text>
              <Text style={dynamicStyles.badgeSub}>Auto-protect any streak if you miss a day.</Text>
            </View>
            <Pressable 
              onPress={() => purchaseItem('streak_freeze')}
              disabled={xp < 500}
              style={[
                styles.buyButton, 
                { backgroundColor: xp >= 500 ? colors.accent : colors.border }
              ]}
            >
              <Text style={styles.buyButtonText}>500 XP</Text>
            </Pressable>
          </View>

          {/* XP Booster */}
          <View style={dynamicStyles.storeItemCard}>
            <Text style={styles.storeEmoji}>⚡</Text>
            <View style={styles.storeInfo}>
              <Text style={dynamicStyles.badgeTitle}>Double XP</Text>
              <Text style={dynamicStyles.badgeSub}>Earn 2x XP on all habit completions for 24h.</Text>
            </View>
            <Pressable 
              onPress={() => purchaseItem('xp_booster')}
              disabled={xp < 1000}
              style={[
                styles.buyButton, 
                { backgroundColor: xp >= 1000 ? colors.accent : colors.border }
              ]}
            >
              <Text style={styles.buyButtonText}>1000 XP</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.badgesSection}>
        <Text style={dynamicStyles.emporiumTitle}>Badges</Text>
        <View style={styles.badgesRow}>
          <View style={hasIronWill ? dynamicStyles.badgeCardUnlocked : dynamicStyles.badgeCardLocked}>
            <Text style={styles.badgeIcon}>{hasIronWill ? '🏅' : '🔒'}</Text>
            <Text style={dynamicStyles.badgeTitle}>Iron Will</Text>
            <Text style={dynamicStyles.badgeSub}>Hit a 30-day overall streak.</Text>
          </View>
          <View style={hasDedication ? dynamicStyles.badgeCardUnlocked : dynamicStyles.badgeCardLocked}>
            <Text style={styles.badgeIcon}>{hasDedication ? '🔥' : '🔒'}</Text>
            <Text style={dynamicStyles.badgeTitle}>Dedication</Text>
            <Text style={dynamicStyles.badgeSub}>Complete 10 total habits.</Text>
          </View>
        </View>
      </View>

      <View style={styles.captionBox}>
        <Text style={dynamicStyles.caption}>
          More badges, daily challenges, and streak freeze tokens can be layered on top of this XP system as you evolve
          the app.
        </Text>
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
  title: {
    fontWeight: '700',
    marginBottom: 16,
  },
  levelCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  levelLabel: {
    fontWeight: '500',
    marginBottom: 2,
  },
  levelValue: {
    fontWeight: '800',
  },
  rankName: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  xpText: {
  },
  statsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  inventoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inventoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  inventoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgesSection: {
    marginTop: 32,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  badgeCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
  },
  badgeIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  badgeTitle: {
    fontWeight: '600',
  },
  badgeSub: {
    marginTop: 4,
  },
  captionBox: {
    marginTop: 24,
    paddingBottom: 40,
  },
  caption: {
  },
  emporiumSection: {
    marginTop: 32,
  },
  emporiumTitle: {
    fontWeight: '700',
    marginBottom: 16,
  },
  storeGrid: {
    gap: 12,
  },
  storeItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    gap: 12,
  },
  storeEmoji: {
    fontSize: 26,
  },
  storeInfo: {
    flex: 1,
  },
  buyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default RewardsScreen;

