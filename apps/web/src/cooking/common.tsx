import { useCallback, useEffect, useRef } from 'react';
import type { Recipe } from '@pdl/shared';

export const feedbackClass = (s: number) => (s >= 0.7 ? 'ok' : s >= 0.4 ? 'mid' : 'bad');

export interface StepProps {
  recipe: Recipe;
  level: number;
  onDone: (score: number) => void;
}

/** setTimeout tự hủy khi component unmount. */
export function useSafeTimeout() {
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => clearTimeout(t));
  }, []);
  return useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
}

/** Vòng lặp requestAnimationFrame với dt (giây). */
export function useFrame(cb: (dt: number) => void) {
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  });
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
      last = ts;
      ref.current(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export function StepHeader({
  recipe,
  step,
  title,
  hint,
}: {
  recipe: Recipe;
  step: string;
  title: string;
  hint: React.ReactNode;
}) {
  return (
    <div className="mg-head">
      <span className="mg-icon">{recipe.icon}</span>
      <div>
        <h3>{title}</h3>
        <p>
          <b>{step}</b> {hint}
        </p>
      </div>
    </div>
  );
}
