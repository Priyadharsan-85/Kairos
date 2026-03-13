import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Pressable } from 'react-native';
import { useSettings, AccentColor, ThemeMode, BackgroundType } from '@/context/SettingsContext';
import { useHabits } from '@/context/HabitsContext';

const SettingsScreen: React.FC = () => {
  const { signOut } = useHabits();
  const {
    themeMode,
    accentColor,
    backgroundType,
    fontSizeScale,
    soundsEnabled,
    updateSettings,
    colors,
  } = useSettings();

  const handleToggleTheme = () => {
    const next: ThemeMode = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'auto' : 'light';
    updateSettings({ themeMode: next });
  };

  const handleToggleSound = (val: boolean) => {
    updateSettings({ soundsEnabled: val });
  };

  const accentOptions: { id: AccentColor; label: string; hex: string }[] = [
    { id: 'purple', label: 'Purple', hex: '#a855f7' },
    { id: 'blue', label: 'Blue', hex: '#3b82f6' },
    { id: 'green', label: 'Green', hex: '#22c55e' },
    { id: 'orange', label: 'Orange', hex: '#f97316' },
    { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  ];

  const backgroundOptions: { id: BackgroundType; label: string }[] = [
    { id: 'solid', label: 'Solid' },
    { id: 'gradient', label: 'Gradient Mesh' },
    { id: 'pattern', label: 'Animated Particles' },
  ];

  const fontOptions = [
    { id: 0.9, label: 'Small' },
    { id: 1.0, label: 'Default' },
    { id: 1.15, label: 'Large' },
  ];

  const dynamicStyles = {
    container: [styles.container, { backgroundColor: colors.background }],
    title: [styles.title, { color: colors.textPrimary, fontSize: 22 * fontSizeScale }],
    sectionTitle: [styles.sectionTitle, { color: colors.textPrimary, fontSize: 18 * fontSizeScale }],
    label: [styles.label, { color: colors.textPrimary, fontSize: 15 * fontSizeScale }],
    subLabel: [styles.subLabel, { color: colors.textSecondary, fontSize: 12 * fontSizeScale }],
    row: [styles.row, { borderBottomColor: colors.border }],
    footerText: [styles.footerText, { color: colors.textSecondary, fontSize: 13 * fontSizeScale }],
  };

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={styles.content}>
      <Text style={dynamicStyles.title}>Personalization</Text>

      <View style={dynamicStyles.row}>
        <View style={styles.textStack}>
          <Text style={dynamicStyles.label}>Theme Mode</Text>
          <Text style={dynamicStyles.subLabel}>Current: {themeMode.toUpperCase()}</Text>
        </View>
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.accentMuted }]}
          onPress={handleToggleTheme}
        >
          <Text style={[styles.actionButtonText, { color: colors.accent, fontSize: 13 * fontSizeScale }]}>
            Toggle
          </Text>
        </Pressable>
      </View>

      <View style={dynamicStyles.row}>
        <View style={styles.textStack}>
          <Text style={dynamicStyles.label}>Sound Effects</Text>
          <Text style={dynamicStyles.subLabel}>Completion chimes and rewards.</Text>
        </View>
        <Switch
          value={soundsEnabled}
          onValueChange={handleToggleSound}
          trackColor={{ true: colors.accent }}
        />
      </View>

      <View style={styles.section}>
        <Text style={dynamicStyles.sectionTitle}>Accent Color</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchRow}>
          {accentOptions.map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => updateSettings({ accentColor: opt.id })}
              style={[
                styles.swatch,
                { backgroundColor: opt.hex },
                accentColor === opt.id && styles.swatchActive,
                accentColor === opt.id && { borderColor: colors.textPrimary },
              ]}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={dynamicStyles.sectionTitle}>Background Style</Text>
        <View style={styles.chipRow}>
          {backgroundOptions.map((bg) => (
            <Pressable
              key={bg.id}
              onPress={() => updateSettings({ backgroundType: bg.id })}
              style={[
                styles.chip,
                { borderColor: colors.border },
                backgroundType === bg.id && { borderColor: colors.accent, backgroundColor: colors.accentMuted },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.textPrimary, fontSize: 13 * fontSizeScale }]}>
                {bg.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={dynamicStyles.sectionTitle}>Font Size</Text>
        <View style={styles.chipRow}>
          {fontOptions.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => updateSettings({ fontSizeScale: f.id })}
              style={[
                styles.chip,
                { borderColor: colors.border },
                fontSizeScale === f.id && { borderColor: colors.accent, backgroundColor: colors.accentMuted },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.textPrimary, fontSize: 13 * fontSizeScale }]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[dynamicStyles.sectionTitle, { color: '#ef4444' }]}>Danger Zone</Text>
        <View style={dynamicStyles.row}>
          <View style={styles.textStack}>
            <Text style={dynamicStyles.label}>Account</Text>
            <Text style={dynamicStyles.subLabel}>Sign out of your cloud account.</Text>
          </View>
          <Pressable
            style={[styles.actionButton, { backgroundColor: '#fee2e2' }]}
            onPress={signOut}
          >
            <Text style={[styles.actionButtonText, { color: '#ef4444', fontSize: 13 * fontSizeScale }]}>
              Sign Out
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={dynamicStyles.footerText}>
          Your habits are now synced to the cloud! ☁️
        </Text>
      </View>
    </ScrollView>
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
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  textStack: {
    flex: 1,
    paddingRight: 16,
  },
  label: {
    fontWeight: '500',
  },
  subLabel: {
    marginTop: 3,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    fontWeight: '600',
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderWidth: 3,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '500',
  },
  footer: {
    marginTop: 40,
  },
  footerText: {
  },
});

export default SettingsScreen;

