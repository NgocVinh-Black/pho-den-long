import { useRef, useState } from 'react';
import { verdict } from '@pdl/shared';
import { useKeyDown } from '../utils/useKeyDown';
import { feedbackClass, StepHeader, useFrame, useSafeTimeout, type StepProps } from './common';

const ROUNDS = 3;
const newZone = () => 0.2 + Math.random() * 0.6;

/** Kim chạy qua lại: dừng trong vùng xanh, 3 lượt. */
export function TimingGame({ recipe, level, onDone }: StepProps) {
  const zoneW = Math.min(0.34, 0.15 + 0.04 * (level - 1));
  const [zone, setZone] = useState(newZone);
  const [scores, setScores] = useState<number[]>([]);
  const [feedback, setFeedback] = useState({ text: `Lượt 1/${ROUNDS}`, cls: '' });
  const needle = useRef<HTMLDivElement>(null);
  const motion = useRef({ pos: Math.random(), dir: 1, speed: 0.8, locked: false });
  const later = useSafeTimeout();

  useFrame((dt) => {
    const m = motion.current;
    if (!m.locked) {
      m.pos += m.dir * m.speed * dt;
      if (m.pos >= 1) [m.pos, m.dir] = [1, -1];
      if (m.pos <= 0) [m.pos, m.dir] = [0, 1];
    }
    if (needle.current) needle.current.style.left = `${m.pos * 100}%`;
  });

  const press = () => {
    const m = motion.current;
    if (m.locked) return;
    m.locked = true;
    const half = zoneW / 2;
    const d = Math.abs(m.pos - zone);
    const s = d <= half ? 1 - (d / half) * 0.25 : Math.max(0, 0.6 - (d - half) * 2.5);
    const next = [...scores, s];
    setScores(next);
    setFeedback({ text: verdict(s), cls: feedbackClass(s) });
    later(() => {
      if (next.length >= ROUNDS) {
        onDone(next.reduce((a, b) => a + b, 0) / next.length);
        return;
      }
      setZone(newZone());
      setFeedback({ text: `Lượt ${next.length + 1}/${ROUNDS}`, cls: '' });
      Object.assign(m, {
        pos: Math.random(),
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: 0.8 + next.length * 0.3,
        locked: false,
      });
    }, 600);
  };

  useKeyDown({ Space: press, Enter: press });

  return (
    <>
      <StepHeader
        recipe={recipe}
        step="Bước 2/2:"
        title={recipe.technique.label}
        hint={
          <>
            bấm <kbd>Space</kbd> hoặc nút khi kim nằm trong vùng xanh. Có {ROUNDS} lượt.
          </>
        }
      />
      <div className="bar">
        <div className="zone" style={{ left: `${(zone - zoneW / 2) * 100}%`, width: `${zoneW * 100}%` }} />
        <div className="needle" ref={needle} />
      </div>
      <div className={`mg-fb ${feedback.cls}`}>{feedback.text}</div>
      <div className="dots">
        {Array.from({ length: ROUNDS }, (_, k) => (
          <span key={k} className={`dot ${k < scores.length ? feedbackClass(scores[k]!) : ''}`}>
            {k + 1}
          </span>
        ))}
      </div>
      <button className="btn primary big" onClick={press}>
        Dừng! <kbd>Space</kbd>
      </button>
    </>
  );
}
