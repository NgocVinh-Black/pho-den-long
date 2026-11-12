import { useReducer, useRef } from 'react';
import { verdict } from '@pdl/shared';
import { useGame } from '../store/game';
import { useKeyDown } from '../utils/useKeyDown';
import { feedbackClass, StepHeader, useFrame, useSafeTimeout, type StepProps } from './common';

interface Item {
  icon: string;
  progress: number;
  speed: number;
  delay: number;
  state: 'cooking' | 'done' | 'burnt';
  score: number;
}

/** Nướng / chiên / lật: 3 món trên bếp, nhấc từng món khi vừa chín tới. */
export function GrillGame({ recipe, level, onDone }: StepProps) {
  const ingredients = useGame((s) => s.ingredients);
  const lo = 62 - (level - 1) * 2;
  const hi = 82 + (level - 1) * 2;
  const st = useRef({
    items: [0, 1, 2].map<Item>((i) => ({
      icon: ingredients.get(recipe.ingredients[i % recipe.ingredients.length]!.id)?.icon ?? recipe.icon,
      progress: 0,
      speed: 15 + Math.random() * 9,
      delay: i * 0.9 + Math.random() * 0.4,
      state: 'cooking',
      score: 0,
    })),
    finished: false,
  });
  const [, render] = useReducer((x: number) => x + 1, 0);
  const later = useSafeTimeout();

  const checkDone = () => {
    const s = st.current;
    if (s.finished || s.items.some((i) => i.state === 'cooking')) return;
    s.finished = true;
    later(() => onDone(s.items.reduce((a, i) => a + i.score, 0) / s.items.length), 800);
  };

  useFrame((dt) => {
    const s = st.current;
    for (const it of s.items) {
      if (it.state !== 'cooking') continue;
      if (it.delay > 0) {
        it.delay -= dt;
        continue;
      }
      it.progress += it.speed * dt;
      if (it.progress >= 100) {
        it.progress = 100;
        it.state = 'burnt';
        it.score = 0;
        checkDone();
      }
    }
    render();
  });

  const take = (i: number) => {
    const it = st.current.items[i];
    if (!it || it.state !== 'cooking' || it.delay > 0) return;
    const mid = (lo + hi) / 2;
    const half = (hi - lo) / 2;
    const p = it.progress;
    it.score =
      p >= lo && p <= hi ? 1 - (Math.abs(p - mid) / half) * 0.2 : p < lo ? Math.max(0, (p / lo) * 0.55) : 0.3;
    it.state = 'done';
    checkDone();
  };

  useKeyDown({ Digit1: () => take(0), Digit2: () => take(1), Digit3: () => take(2) });

  const s = st.current;
  const avg = s.items.reduce((a, i) => a + i.score, 0) / s.items.length;
  return (
    <>
      <StepHeader
        recipe={recipe}
        step="Bước 2/2:"
        title={recipe.technique.label}
        hint={
          <>
            3 món đang trên bếp. Khi thanh vào vùng <b>chín vàng</b> thì nhấc ra (phím <kbd>1</kbd>{' '}
            <kbd>2</kbd> <kbd>3</kbd> hoặc bấm). Để quá là cháy!
          </>
        }
      />
      <div className="grill">
        {s.items.map((it, i) => (
          <button
            key={i}
            className={`grill-slot ${it.state} ${it.progress > hi && it.state === 'cooking' ? 'smoke' : ''}`}
            onClick={() => take(i)}
            disabled={it.state !== 'cooking'}
          >
            <span
              className="grill-icon"
              style={{ filter: `sepia(${it.progress / 100}) brightness(${1.1 - it.progress / 300})` }}
            >
              {it.state === 'burnt' ? '💥' : it.icon}
            </span>
            <span className="grill-bar">
              <i className="grill-zone" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
              <i className="grill-fill" style={{ width: `${it.progress}%` }} />
            </span>
            <small>
              {it.delay > 0
                ? 'Chờ lên bếp…'
                : it.state === 'done'
                  ? verdict(it.score)
                  : it.state === 'burnt'
                    ? 'Cháy rồi!'
                    : `Phím ${i + 1}`}
            </small>
          </button>
        ))}
      </div>
      <div className={`mg-fb ${s.finished ? feedbackClass(avg) : ''}`}>
        {s.finished ? verdict(avg) : '🔥 Canh lửa…'}
      </div>
    </>
  );
}
