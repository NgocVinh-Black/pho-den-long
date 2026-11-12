import { useEffect, useRef, useState } from 'react';
import { clamp, verdict } from '@pdl/shared';
import { useKeyDown } from '../utils/useKeyDown';
import { feedbackClass, StepHeader, useSafeTimeout, type StepProps } from './common';

const DEFAULT_MOTIFS = ['🌸', '🪷', '🎋', '🐟', '🌙', '⭐'];
const LENGTH = 4;

/** Ghi nhớ thứ tự hoa văn rồi làm lại. */
export function MemoryGame({ recipe, level, onDone }: StepProps) {
  const motifs = recipe.technique.motifs ?? DEFAULT_MOTIFS;
  const showSec = 2.2 + 0.5 * (level - 1);
  const [order] = useState(() =>
    Array.from({ length: LENGTH }, () => motifs[Math.floor(Math.random() * motifs.length)]!),
  );
  const [phase, setPhase] = useState<'show' | 'pick' | 'done'>('show');
  const [picks, setPicks] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [barGone, setBarGone] = useState(false);
  const pickStart = useRef(0);
  const later = useSafeTimeout();

  useEffect(() => {
    const raf = requestAnimationFrame(() => setBarGone(true));
    const t = setTimeout(() => {
      pickStart.current = performance.now();
      setPhase('pick');
    }, showSec * 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [showSec]);

  const pick = (k: number) => {
    const m = motifs[k];
    if (phase !== 'pick' || !m) return;
    const next = [...picks, m];
    setPicks(next);
    if (next.length < LENGTH) return;
    const correct = next.filter((x, i) => x === order[i]).length;
    const secs = (performance.now() - pickStart.current) / 1000;
    const s = clamp(correct / LENGTH - Math.max(0, secs - 5) * 0.03, 0, 1);
    setScore(s);
    setPhase('done');
    later(() => onDone(s), correct < LENGTH ? 1300 : 700);
  };

  const keys: Record<string, () => void> = {};
  motifs.forEach((_, k) => {
    keys[`Digit${k + 1}`] = () => pick(k);
    keys[`Numpad${k + 1}`] = () => pick(k);
  });
  useKeyDown(keys);

  const correctCount = picks.filter((x, i) => x === order[i]).length;

  return (
    <>
      <StepHeader
        recipe={recipe}
        step="Bước 2/2:"
        title={recipe.technique.label}
        hint={
          <>
            ghi nhớ thứ tự mẫu rồi làm lại đúng như vậy (phím <kbd>1</kbd>–<kbd>{motifs.length}</kbd>).
          </>
        }
      />
      <div className="pattern">
        {order.map((m, i) => {
          const picked = picks[i];
          if (phase === 'show')
            return (
              <div key={i} className="slot">
                {m}
              </div>
            );
          if (!picked)
            return (
              <div key={i} className="slot hidden-slot">
                ?
              </div>
            );
          return (
            <div key={i} className={`slot ${picked === m ? 'ok' : 'bad'}`}>
              {picked}
            </div>
          );
        })}
      </div>
      <div className="showbar">
        <div style={{ width: barGone ? '0%' : '100%', transition: `width ${showSec}s linear` }} />
      </div>
      <div className={`mg-fb ${score !== null ? feedbackClass(score) : ''}`}>
        {score !== null ? (
          <>
            {verdict(score)}
            {correctCount < LENGTH && <small>Mẫu đúng: {order.join(' ')}</small>}
          </>
        ) : phase === 'show' ? (
          'Ghi nhớ mẫu…'
        ) : (
          'Đến lượt bạn!'
        )}
      </div>
      <div className="opts" style={{ gridTemplateColumns: `repeat(${Math.min(6, motifs.length)}, 1fr)` }}>
        {motifs.map((m, k) => (
          <button key={k} className="opt" disabled={phase !== 'pick'} onClick={() => pick(k)}>
            {m}
            <small>{k + 1}</small>
          </button>
        ))}
      </div>
    </>
  );
}
