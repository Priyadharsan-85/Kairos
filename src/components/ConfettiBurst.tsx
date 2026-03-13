import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

interface ConfettiBurstProps {
  colors: string[];
  count?: number;
  duration?: number;
}

const ConfettiParticle = ({
  color,
  fadeAnim,
  translateY,
  translateX,
  rotation,
  scale,
}: any) => {
  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: color,
          opacity: fadeAnim,
          transform: [
            { translateX },
            { translateY },
            { rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
            { scale },
          ],
        },
      ]}
    />
  );
};

const ConfettiBurst: React.FC<ConfettiBurstProps> = ({
  colors,
  count = 60,
  duration = 2500,
}) => {
  // We compute random properties for each particle only once per mount
  const particles = useMemo(() => {
    return Array.from({ length: count }).map(() => {
      const isCircle = Math.random() > 0.5;
      const size = Math.random() * 8 + 6; // random size between 6 and 14
      const color = colors[Math.floor(Math.random() * colors.length)];

      // Random burst velocity/angle
      const angle = (Math.random() * Math.PI) + Math.PI; // point upwards (between Pi and 2*Pi)
      const velocity = Math.random() * windowHeight * 0.4 + 100; // random power

      const destX = Math.cos(angle) * velocity;
      let destY = Math.sin(angle) * velocity;
      
      // We want it to fall down eventually (gravity)
      const finalY = destY + windowHeight * 0.8;
      const finalX = destX + (Math.random() - 0.5) * 100; // drift

      return {
        id: Math.random().toString(),
        color,
        isCircle,
        size,
        destX,
        destY,
        finalX,
        finalY,
        anim: new Animated.Value(0), // drives everything (0 -> 1)
        rot: Math.random() > 0.5 ? 2 : -2, // random rotation direction
      };
    });
  }, [count, colors]);

  useEffect(() => {
    // Start all animations simultaneously
    const animations = particles.map((p) =>
      Animated.timing(p.anim, {
        toValue: 1,
        duration: duration + Math.random() * 500, // slightly offset endings
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );

    Animated.parallel(animations).start();
  }, [particles, duration]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.origin}>
        {particles.map((p) => {
          const translateX = p.anim.interpolate({
            inputRange: [0, 0.4, 1],
            outputRange: [0, p.destX, p.finalX],
          });
          const translateY = p.anim.interpolate({
            inputRange: [0, 0.4, 1],
            outputRange: [0, p.destY, p.finalY], // bursts up, falls down
          });
          const fadeAnim = p.anim.interpolate({
            inputRange: [0, 0.7, 1],
            outputRange: [1, 1, 0], // fades out at the end
          });
          const rotation = p.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, p.rot], 
          });

          return (
            <Animated.View
              key={p.id}
              style={[
                {
                  position: 'absolute',
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  borderRadius: p.isCircle ? p.size / 2 : 2,
                  opacity: fadeAnim,
                  transform: [
                    { translateX },
                    { translateY },
                    { rotate: rotation.interpolate({ inputRange: [-5, 5], outputRange: ['-1800deg', '1800deg'] }) },
                  ],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  origin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    // origin point for all particles
    width: 0,
    height: 0,
  },
  particle: {
    position: 'absolute',
  },
});

export default ConfettiBurst;
