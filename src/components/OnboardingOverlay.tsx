import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '@/context/SettingsContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Welcome to Kairos',
    description: 'Transform your life one tiny habit at a time. The journey of a thousand miles begins with a single step.',
    icon: '✨',
    colors: ['#a855f7', '#6366f1'],
  },
  {
    title: 'Stack your Habits',
    description: 'Group habits into routines. Complete them in order to create powerful momentum.',
    icon: '🚀',
    colors: ['#f97316', '#ef4444'],
  },
  {
    title: 'Unlock the Vault',
    description: 'Gain XP, level up, and unlock mystical artifacts that boost your progress.',
    icon: '🏛️',
    colors: ['#eab308', '#f59e0b'],
  },
  {
    title: 'Focus Mode',
    description: 'Immerse yourself in concentration with ambient sounds and focus timers.',
    icon: '🎧',
    colors: ['#3b82f6', '#2563eb'],
  },
];

interface Props {
  visible: boolean;
  onFinish: () => void;
}

const OnboardingOverlay: React.FC<Props> = ({ visible, onFinish }) => {
  const { colors, isDark } = useSettings();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(prev => prev + 1);
      Animated.timing(scrollX, {
        toValue: (currentSlide + 1) * width,
        duration: 300,
        useNativeDriver: true,
      }).start();
      if (Platform.OS !== 'web') Haptics.selectionAsync();
    } else {
      onFinish();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.container}>
        <LinearGradient
          colors={SLIDES[currentSlide].colors as any}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        
        <View style={styles.card}>
          <Text style={styles.icon}>{SLIDES[currentSlide].icon}</Text>
          <Text style={styles.title}>{SLIDES[currentSlide].title}</Text>
          <Text style={styles.description}>{SLIDES[currentSlide].description}</Text>
          
          <View style={styles.pagination}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === currentSlide ? '#fff' : 'rgba(255,255,255,0.3)' }
                ]}
              />
            ))}
          </View>

          <Pressable style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>
              {currentSlide === SLIDES.length - 1 ? 'Start Journey' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: width * 0.85,
    padding: 32,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  icon: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  button: {
    width: '100%',
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
});

export default OnboardingOverlay;
