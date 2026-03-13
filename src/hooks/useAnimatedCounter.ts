import { useEffect, useRef, useState } from 'react';

export const useAnimatedCounter = (value: number, durationMs = 600) => {
  const [display, setDisplay] = useState(value);
  const startValue = useRef(value);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    let frame: number;
    startValue.current = display;
    startTime.current = null;

    const step = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min(1, (timestamp - startTime.current) / durationMs);
      const next = startValue.current + (value - startValue.current) * progress;
      setDisplay(Number(next.toFixed(0)));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return display;
};

