import { useReducer, useRef } from 'react';
import { verdict } from '@pdl/shared';
import { useKeyDown } from '../utils/useKeyDown';
import { feedbackClass, StepHeader, useFrame, useSafeTimeout, type StepProps } from './common';

const TRAVEL = 1.6; // giây nốt chạy từ phải sang vạch
const HIT_X = 14; // % vị trí vạch
const PATTERNS = [
  [0, 0.55, 1.1, 1.65, 2.2, 2.475, 2.75, 3.3],
  [0, 0.55, 0.825, 1.1, 1.65, 2.2, 2.75, 3.025],
  [0, 0.4, 0.8, 1.4, 1.8, 2.2, 2.8, 3.2],
];

interface NoteState {
  at: number;
  result?: 'perfect' | 'good' | 'miss';
}

/** Bấm theo nhịp: nốt chạy tới vạch thì nhấn. */
export function RhythmGame({ recipe, level, onDone }: StepProps) {
  const perfectWin = 0.075 + level * 0.008;
  const goodWin = 0.15 + level * 0.01;
  const st = useRef({
    t: -0.6,
    notes: PATTERNS[Math.floor(Math.random() * PATTERNS.length)]!.map<NoteState>((x) => ({ at: x + TRAVEL })),
    finished: false,
    flash: '',
    flashT: 0,
  });
  const [, render] = useReducer((x: number) => x + 1, 0);
  const later = useSafeTimeout();

  const scoreOf = (n: NoteState) => (n.result === 'perfect' ? 1 : n.result === 'good' ? 0.7 : 0);

  useFrame((dt) => {
    const s = st.current;
    s.t += dt;
    s.flashT -= dt;
    for (const n of s.notes) {
      if (!n.result && s.t - n.at > goodWin) {
        n.result = 'miss';
        s.flash = 'Trượt nhịp';
        s.flashT = 0.4;
      }
    }
    if (!s.finished && s.notes.every((n) => n.result)) {
      s.finished = true;
      later(() => onDone(s.notes.reduce((a, n) => a + scoreOf(n), 0) / s.notes.length), 700);
    }
    render();
  });

  const hit = () => {
    const s = st.current;
    const n = s.notes.find((x) => !x.result && Math.abs(s.t - x.at) <= goodWin);
    if (!n) {
      s.flash = 'Lệch nhịp!';
      s.flashT = 0.4;
      return;
    }
    const d = Math.abs(s.t - n.at);
    n.result = d <= perfectWin ? 'perfect' : 'good';
    s.flash = n.result === 'perfect' ? 'Chuẩn! ✨' : 'Được!';
    s.flashT = 0.4;
  };

  useKeyDown({ Space: hit, Enter: hit });

  const s = st.current;
  const avg = s.notes.reduce((a, n) => a + scoreOf(n), 0) / s.notes.length;
  return (
    <>
      <StepHeader
        recipe={recipe}
        step="Bước 2/2:"
        title={recipe.technique.label}
        hint={
          <>
            nhấn <kbd>Space</kbd> đúng lúc nốt chạm vạch đỏ. Giữ đều tay theo nhịp!
          </>
        }
      />
      <div className="rhythm">
        <div className="rhythm-line" style={{ left: `${HIT_X}%` }} />
        {s.notes.map((n, i) => {
          if (n.result) return null;
          const x = HIT_X + ((n.at - s.t) / TRAVEL) * (100 - HIT_X);
          if (x > 104) return null;
          return (
            <span key={i} className="rhythm-note" style={{ left: `${x}%` }}>
              {recipe.icon}
            </span>
          );
        })}
        <span className="rhythm-drum">🥁</span>
      </div>
      <div className="dots">
        {s.notes.map((n, i) => (
          <span
            key={i}
            className={`dot small ${n.result === 'perfect' ? 'ok' : n.result === 'good' ? 'mid' : n.result === 'miss' ? 'bad' : ''}`}
          />
        ))}
      </div>
      <div className={`mg-fb ${s.finished ? feedbackClass(avg) : s.flashT > 0 ? 'mid' : ''}`}>
        {s.finished ? verdict(avg) : s.flashT > 0 ? s.flash : '🎵'}
      </div>
      <button
        className="btn primary big"
        onPointerDown={(e) => {
          e.preventDefault();
          hit();
        }}
      >
        🥁 Gõ <kbd>Space</kbd>
      </button>
    </>
  );
}
