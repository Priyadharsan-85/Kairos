import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useHabits } from '@/context/HabitsContext';

interface Props {
  habitId: string;
  targetMinutes?: number;
}

const RADIUS = 34;
const STROKE = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const HabitTimerRing: React.FC<Props> = ({ habitId, targetMinutes }) => {
  const { timers } = useHabits();
  const timer = timers[habitId];
  const [elapsed, setElapsed] = useState(timer?.elapsedMs ?? 0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (timer?.isRunning && timer.startedAt != null) {
      interval = setInterval(() => {
        const now = Date.now();
        setElapsed(timer.elapsedMs + (now - timer.startedAt!));
      }, 200);
    } else {
      setElapsed(timer?.elapsedMs ?? 0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer?.isRunning, timer?.startedAt, timer?.elapsedMs]);

  const totalMs = (targetMinutes ?? 0) * 60 * 1000;
  const progress = totalMs > 0 ? Math.min(1, elapsed / totalMs) : 0;
  const strokeDashoffset = CIRCUMFERENCE - CIRCUMFERENCE * progress;

  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000)
    .toString()
    .padStart(2, '0');

  return (
    <View style={styles.container}>
      <Svg width={RADIUS * 2 + STROKE} height={RADIUS * 2 + STROKE}>
        <Circle
          stroke="#1f2937"
          fill="none"
          cx={RADIUS + STROKE / 2}
          cy={RADIUS + STROKE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
        />
        <Circle
          stroke="#f97316"
          fill="none"
          cx={RADIUS + STROKE / 2}
          cy={RADIUS + STROKE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${RADIUS + STROKE / 2} ${RADIUS + STROKE / 2})`}
        />
      </Svg>
      <View style={styles.labelWrapper}>
        <Text style={styles.timeText}>
          {minutes}:{seconds}
        </Text>
        {targetMinutes ? <Text style={styles.subText}>{targetMinutes} min</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    color: '#e5e7eb',
    fontWeight: '600',
    fontSize: 14,
  },
  subText: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 2,
  },
});

export default HabitTimerRing;

