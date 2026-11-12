import { useEffect, useReducer, useRef, useState } from 'react';
import { clamp, verdict } from '@pdl/shared';
import { feedbackClass, StepHeader, useFrame, useSafeTimeout, type StepProps } from './common';

const ROUNDS = 2;
const RATE = 42; // % mỗi giây

const newTarget = () => 52 + Math.random() * 26;

/** Giữ để rót / chan, thả tay đúng vạch. */
export function PourGame({ recipe, level, onDone }: StepProps) {
  const half = 6 + level;
  const s = useRef({ fill: 0, pouring: false, locked: false, target: newTarget() });
  const [scores, setScores] = useState<number[]>([]);
  const [feedback, setFeedback] = useState({ text: `Lượt 1/${ROUNDS}: giữ để rót`, cls: '' });
  const [, render] = useReducer((x: number) => x + 1, 0);
  const later = useSafeTimeout();
  const scoresRef = useRef<number[]>([]);

  const finishRound = () => {
    const st = s.current;
    if (st.locked) return;
    st.locked = true;
    st.pouring = false;
    st.fill = Math.min(100, st.fill + 1.5); // giọt cuối
    const dist = Math.abs(st.fill - st.target);
    const score =
      st.fill >= 100 ? 0 : dist <= half ? 1 - (dist / half) * 0.25 : Math.max(0, 0.6 - (dist - half) * 0.05);
    scoresRef.current = [...scoresRef.current, score];
    setScores(scoresRef.current);
    setFeedback({ text: st.fill >= 100 ? 'Tràn rồi! 💦' : verdict(score), cls: feedbackClass(score) });
    later(() => {
      if (scoresRef.current.length >= ROUNDS) {
        onDone(scoresRef.current.reduce((a, b) => a + b, 0) / ROUNDS);
        return;
      }
      Object.assign(st, { fill: 0, pouring: false, locked: false, target: newTarget() });
      setFeedback({ text: `Lượt ${scoresRef.current.length + 1}/${ROUNDS}: giữ để rót`, cls: '' });
    }, 750);
  };

  const start = () => {
    if (!s.current.locked) s.current.pouring = true;
  };
  const stop = () => {
    if (s.current.pouring) finishRound();
  };

  useFrame((dt) => {
    const st = s.current;
    if (st.pouring && !st.locked) {
      st.fill = clamp(st.fill + RATE * dt * (0.8 + st.fill / 250), 0, 100);
      if (st.fill >= 100) finishRound();
    }
    render();
  });

  // giữ phím Space
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (!e.repeat) start();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') stop();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const st = s.current;
  return (
    <>
      <StepHeader
        recipe={recipe}
        step="Bước 2/2:"
        title={recipe.technique.label}
        hint={
          <>
            <b>giữ</b> <kbd>Space</kbd> (hoặc giữ nút) để rót, thả tay khi chạm vùng vàng. Có {ROUNDS} lượt.
          </>
        }
      />
      <div className="pour">
        <div className={`pour-stream ${st.pouring ? 'on' : ''}`} />
        <div className="bowl">
          <div className="bowl-target" style={{ bottom: `${st.target - half}%`, height: `${half * 2}%` }} />
          <div className="bowl-fill" style={{ height: `${st.fill}%` }} />
          <span className="bowl-icon">{recipe.icon}</span>
        </div>
      </div>
      <div className={`mg-fb ${feedback.cls}`}>{feedback.text}</div>
      <div className="dots">
        {Array.from({ length: ROUNDS }, (_, k) => (
          <span key={k} className={`dot ${k < scores.length ? feedbackClass(scores[k]!) : ''}`}>
            {k + 1}
          </span>
        ))}
      </div>
      <button
        className="btn primary big hold"
        onPointerDown={(e) => {
          e.preventDefault();
          start();
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
      >
        🫗 Giữ để rót <kbd>Space</kbd>
      </button>
    </>
  );
}
