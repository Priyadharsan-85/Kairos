import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

interface TypewriterTextProps {
  text: string;
  fadeInDuration?: number;
  typewriterSpeed?: number;
  style?: any;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  fadeInDuration = 600,
  typewriterSpeed = 40,
  style,
}) => {
  const [displayed, setDisplayed] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      const char = text[i];
      if (char !== undefined) {
        setDisplayed((prev) => prev + char);
      }
      i++;
      if (i >= text.length) {
        clearInterval(interval);
      }
    }, typewriterSpeed);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: fadeInDuration,
      useNativeDriver: true,
    }).start();
    return () => clearInterval(interval);
  }, [text, fadeInDuration, typewriterSpeed]);

  return (
    <Animated.Text style={[style, { opacity: fadeAnim }]}>{displayed}</Animated.Text>
  );
};

export default TypewriterText;
