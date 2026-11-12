import { useRef, useState } from 'react';
import { verdict } from '@pdl/shared';
import { useKeyDown } from '../utils/useKeyDown';
import { feedbackClass, StepHeader, useFrame, useSafeTimeout, type StepProps } from './common';

const TIME_LIMIT = 8;
const DECAY = 11;
const PUSH = 7;

/** Nhấn liên tục cho thanh lên tới vùng vàng rồi chốt. */
export function MashGame({ recipe, level, onDone }: StepProps) {
  const lo = 60 - (level - 1) * 2.5;
  const hi = 80 + (level - 1) * 2.5;
  const state = useRef({ m: 0, time: TIME_LIMIT, done: false });
  const fill = useRef<HTMLDivElement>(null);
  const timer = useRef<HTMLDivElement>(null);
  const [zoneState, setZoneState] = useState<'low' | 'in' | 'over'>('low');
  const [result, setResult] = useState<number | null>(null);
  const [bump, setBump] = useState(0);
  const later = useSafeTimeout();

  const stop = () => {
    const s = state.current;
    if (s.done) return;
    s.done = true;
    const mid = (lo + hi) / 2;
    const half = (hi - lo) / 2;
    const dist = s.m < lo ? lo - s.m : s.m > hi ? s.m - hi : 0;
    const score = dist === 0 ? 1 - (Math.abs(s.m - mid) / half) * 0.25 : Math.max(0, 0.6 - dist * 0.04);
    setResult(score);
    later(() => onDone(score), 600);
  };

  useFrame((dt) => {
    const s = state.current;
    if (s.done) return;
    s.m = Math.max(0, s.m - dt * DECAY);
    s.time -= dt;
    const zs = s.m < lo ? 'low' : s.m <= hi ? 'in' : 'over';
    if (fill.current) {
      fill.current.style.height = `${s.m}%`;
      fill.current.className = `fill ${zs}`;
    }
    if (timer.current) timer.current.textContent = `⏳ ${Math.max(0, s.time).toFixed(1)}s`;
    setZoneState((prev) => (prev === zs ? prev : zs));
    if (s.time <= 0) stop();
  });

  const beat = () => {
    const s = state.current;
    if (s.done) return;
    s.m = Math.min(100, s.m + PUSH);
    setBump((b) => b + 1);
  };

  useKeyDown({ Space: beat, Enter: stop, NumpadEnter: stop });

  const fb =
    result !== null
      ? { text: verdict(result), cls: feedbackClass(result) }
      : zoneState === 'low'
        ? { text: 'Chưa đủ…', cls: '' }
        : zoneState === 'in'
          ? { text: 'Vừa rồi! Chốt ngay!', cls: 'ok' }
          : { text: 'Quá tay rồi!', cls: 'bad' };

  return (
    <>
      <StepHeader
        recipe={recipe}
        step="Bước 2/2:"
        title={recipe.technique.label}
        hint={
          <>
            nhấn liên tục <kbd>Space</kbd> cho thanh lên tới vùng vàng, rồi bấm <kbd>Enter</kbd> để chốt.
          </>
        }
      />
      <div className="mash">
        <div className="meter">
          <div className="mzone" style={{ bottom: `${lo}%`, height: `${hi - lo}%` }} />
          <div className="fill" ref={fill} />
        </div>
        <div className="mash-side">
          <div key={bump} className={`tool ${bump ? 'bump' : ''}`}>
            {recipe.icon}
          </div>
          <div className="timer" ref={timer} />
          <div className={`mg-fb ${fb.cls}`}>{fb.text}</div>
        </div>
      </div>
      <div className="mg-actions">
        <button
          className="btn big"
          onPointerDown={(e) => {
            e.preventDefault();
            beat();
          }}
        >
          💪 Nhấn <kbd>Space</kbd>
        </button>
        <button className="btn primary big" onClick={stop}>
          ✅ Chốt <kbd>Enter</kbd>
        </button>
      </div>
    </>
  );
}
