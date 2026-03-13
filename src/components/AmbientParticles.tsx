import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { useSettings } from '@/context/SettingsContext';

const PARTICLE_COUNT = 15;
const { width, height } = Dimensions.get('window');

const random = (min: number, max: number) => Math.random() * (max - min) + min;

const AmbientParticles: React.FC = () => {
  const { colors, isDark } = useSettings();
  
  const particleColors = [
    colors.accent,
    colors.accentMuted,
    isDark ? '#334155' : '#cbd5e1',
    isDark ? '#1e293b' : '#e2e8f0',
  ];

  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    x: useRef(new Animated.Value(random(0, width))).current,
    y: useRef(new Animated.Value(random(0, height / 2))).current,
    size: random(16, 36),
    color: particleColors[i % particleColors.length],
    delay: random(0, 1000),
    duration: random(3000, 6000),
  }));

  useEffect(() => {
    particles.forEach((p) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(p.y, {
            toValue: random(height / 2, height - 60),
            duration: p.duration,
            delay: p.delay,
            useNativeDriver: false,
          }),
          Animated.timing(p.y, {
            toValue: random(0, height / 2),
            duration: p.duration,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    });
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              backgroundColor: p.color,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              opacity: isDark ? 0.3 : 0.6,
              left: p.x,
              top: p.y,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
  },
});

export default AmbientParticles;
