import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useHabits, ARTIFACT_REGISTRY, Artifact } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

const VaultModal: React.FC<Props> = ({ visible, onClose }) => {
  const { colors, isDark } = useSettings();
  const { unlockedArtifactIds, equippedArtifactId, equipArtifact, level } = useHabits();

  const renderArtifact = (artifact: Artifact) => {
    const isUnlocked = unlockedArtifactIds.includes(artifact.id);
    const isEquipped = equippedArtifactId === artifact.id;

    return (
      <Pressable
        key={artifact.id}
        onPress={() => isUnlocked && equipArtifact(isEquipped ? null : artifact.id)}
        style={[
          styles.artifactCard,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            borderColor: isEquipped ? colors.accent : colors.border,
          }
        ]}
      >
        {!isUnlocked && (
          <View style={styles.lockedOverlay}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={[styles.unlockText, { color: colors.textSecondary }]}>
              Level {artifact.requiredLevel}
            </Text>
          </View>
        )}
        
        <View style={styles.iconContainer}>
          <Text style={[styles.artifactIcon, !isUnlocked && { opacity: 0.2, grayscale: 1 } as any]}>
            {artifact.icon}
          </Text>
          {isEquipped && (
            <View style={[styles.equippedBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.equippedText}>EQUIPPED</Text>
            </View>
          )}
        </View>

        <Text style={[styles.artifactName, { color: isUnlocked ? colors.textPrimary : colors.textSecondary }]}>
          {artifact.name}
        </Text>
        
        <Text style={[styles.artifactDesc, { color: colors.textSecondary }]}>
          {artifact.description}
        </Text>

        {isUnlocked && (
          <View style={[styles.equipIndicator, { backgroundColor: isEquipped ? colors.accent : 'transparent', borderColor: colors.accent }]}>
             <Text style={[styles.equipIndicatorText, { color: isEquipped ? '#fff' : colors.accent }]}>
               {isEquipped ? 'Active' : 'Equip'}
             </Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint={isDark ? 'dark' : 'light'} style={styles.modalContent}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>The Vault</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Level {level} Explorer</Text>
            </View>
            <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.grid}>
              {ARTIFACT_REGISTRY.map(renderArtifact)}
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
             <Text style={[styles.footerText, { color: colors.textSecondary }]}>
               Equip artifacts to gain mystical XP bonuses.
             </Text>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    height: height * 0.7,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  artifactCard: {
    width: '47%',
    padding: 16,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  iconContainer: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artifactIcon: {
    fontSize: 42,
  },
  artifactName: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  artifactDesc: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 16,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  unlockText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  equippedBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  equippedText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  equipIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  equipIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  }
});

export default VaultModal;
