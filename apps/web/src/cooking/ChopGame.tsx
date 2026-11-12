import { useReducer, useRef } from 'react';
import { clamp, verdict } from '@pdl/shared';
import { useGame } from '../store/game';
import { useKeyDown } from '../utils/useKeyDown';
import { feedbackClass, StepHeader, useFrame, useSafeTimeout, type StepProps } from './common';

const LANES = ['KeyA', 'KeyS', 'KeyD', 'KeyF'] as const;
const LANE_LABELS = ['A', 'S', 'D', 'F'];
const TOTAL = 8;

interface Target {
  lane: number;
  icon: string;
  life: number;
  maxLife: number;
  state: 'up' | 'hit' | 'miss';
  fade: number;
}

/** Thái / cắt: nguyên liệu nhô lên ở ô nào thì chặt ô đó (A S D F hoặc bấm). */
export function ChopGame({ recipe, level, onDone }: StepProps) {
  const ingredients = useGame((s) => s.ingredients);
  const icons = recipe.ingredients.map((i) => ingredients.get(i.id)?.icon ?? recipe.icon);
  const st = useRef({ spawned: 0, hits: 0, wrong: 0, next: 0.6, targets: [] as Target[], done: false });
  const [, render] = useReducer((x: number) => x + 1, 0);
  const later = useSafeTimeout();

  useFrame((dt) => {
    const s = st.current;
    if (s.done) return;
    s.next -= dt;
    const busy = new Set(s.targets.filter((t) => t.state === 'up').map((t) => t.lane));
    if (s.next <= 0 && s.spawned < TOTAL && busy.size < 3) {
      const free = [0, 1, 2, 3].filter((l) => !busy.has(l));
      const lane = free[Math.floor(Math.random() * free.length)]!;
      const maxLife = 1.25 + 0.12 * (level - 1) - s.spawned * 0.04;
      s.targets.push({
        lane,
        icon: icons[s.spawned % icons.length]!,
        life: maxLife,
        maxLife,
        state: 'up',
        fade: 0.4,
      });
      s.spawned += 1;
      s.next = 0.55 - s.spawned * 0.02;
    }
    for (const t of s.targets) {
      if (t.state === 'up') {
        t.life -= dt;
        if (t.life <= 0) t.state = 'miss';
      } else t.fade -= dt;
    }
    s.targets = s.targets.filter((t) => t.state === 'up' || t.fade > 0);
    if (s.spawned >= TOTAL && s.targets.every((t) => t.state !== 'up')) {
      s.done = true;
      const score = clamp(s.hits / TOTAL - s.wrong * 0.08, 0, 1);
      later(() => onDone(score), 700);
    }
    render();
  });

  const chop = (lane: number) => {
    const s = st.current;
    if (s.done) return;
    const t = s.targets.find((x) => x.lane === lane && x.state === 'up');
    if (t) {
      t.state = 'hit';
      s.hits += 1;
    } else s.wrong += 1;
  };

  useKeyDown(Object.fromEntries(LANES.map((k, i) => [k, () => chop(i)])));

  const s = st.current;
  const finalScore = clamp(s.hits / TOTAL - s.wrong * 0.08, 0, 1);
  return (
    <>
      <StepHeader
        recipe={recipe}
        step="Bước 2/2:"
        title={recipe.technique.label}
        hint={
          <>
            nguyên liệu nhô lên ở ô nào thì bấm phím ô đó (<kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>F</kbd>
            ) hoặc bấm thẳng vào. Bấm trượt bị trừ điểm!
          </>
        }
      />
      <div className="board-chop">
        {[0, 1, 2, 3].map((lane) => {
          const t = s.targets.find((x) => x.lane === lane);
          return (
            <button key={lane} className="chop-cell" onPointerDown={() => chop(lane)}>
              {t && (
                <span className={`chop-item ${t.state}`}>
                  {t.state === 'hit' ? '🔪' : t.state === 'miss' ? '💨' : t.icon}
                  {t.state === 'up' && (
                    <i className="chop-timer" style={{ width: `${(t.life / t.maxLife) * 100}%` }} />
                  )}
                </span>
              )}
              <kbd>{LANE_LABELS[lane]}</kbd>
            </button>
          );
        })}
      </div>
      <div className={`mg-fb ${s.done ? feedbackClass(finalScore) : ''}`}>
        {s.done ? verdict(finalScore) : `Đã thái ${s.hits}/${TOTAL}${s.wrong ? ` · trượt ${s.wrong}` : ''}`}
      </div>
    </>
  );
}
