import { useRef, useState } from 'react';
import { clamp, verdict, type Recipe, type Shop } from '@pdl/shared';
import { useGame } from '../store/game';
import { feedbackClass, StepHeader, useSafeTimeout } from './common';

interface Props {
  recipe: Recipe;
  shop: Shop;
  customerName: string;
  onDone: (score: number) => void;
}

/** Bước 1: lấy đúng nguyên liệu trên kệ theo công thức. */
export function PrepStep({ recipe, shop, customerName, onDone }: Props) {
  const ingredients = useGame((s) => s.ingredients);
  const [shelf] = useState(() => [...shop.ingredientIds].sort(() => Math.random() - 0.5));
  const [added, setAdded] = useState<Record<string, number>>({});
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState<{ id: string; n: number } | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; cls: string }>({ text: ' ', cls: '' });
  const [finished, setFinished] = useState(false);
  const startedAt = useRef(0);
  const later = useSafeTimeout();

  const need = (id: string) => recipe.ingredients.find((i) => i.id === id)?.qty ?? 0;

  const pick = (id: string) => {
    if (finished) return;
    if (!startedAt.current) startedAt.current = performance.now();
    const have = added[id] ?? 0;
    if (have >= need(id)) {
      setMistakes((m) => m + 1);
      setShake({ id, n: Date.now() });
      setFeedback({ text: `Sai rồi! ${ingredients.get(id)?.name} không có trong công thức`, cls: 'bad' });
      return;
    }
    const next = { ...added, [id]: have + 1 };
    setAdded(next);
    setFeedback({ text: '👍', cls: 'ok' });
    if (recipe.ingredients.every((i) => (next[i.id] ?? 0) >= i.qty)) {
      const secs = (performance.now() - startedAt.current) / 1000;
      const score = clamp(
        1 - mistakes * 0.2 - Math.max(0, secs - 4 - recipe.ingredients.length) * 0.05,
        0,
        1,
      );
      setFinished(true);
      setFeedback({ text: `Đủ nguyên liệu! ${verdict(score)}`, cls: feedbackClass(score) });
      later(() => onDone(score), 550);
    }
  };

  return (
    <>
      <StepHeader
        recipe={recipe}
        step="Bước 1/2:"
        title={recipe.name}
        hint={`${customerName} gọi món. Lấy đúng nguyên liệu theo công thức.`}
      />
      <div className="prep">
        <div className="recipe-card">
          <div className="rc-title">📖 Công thức</div>
          <ul>
            {recipe.ingredients.map((i) => {
              const done = (added[i.id] ?? 0) >= i.qty;
              return (
                <li key={i.id} className={done ? 'done' : ''}>
                  <span className="chk">{done ? '✔' : '○'}</span> {ingredients.get(i.id)?.name}
                  {i.qty > 1 ? ` ×${i.qty}` : ''}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="shelf">
          {shelf.map((id) => {
            const ig = ingredients.get(id);
            const used = need(id) > 0 && (added[id] ?? 0) >= need(id);
            return (
              <button
                key={shake?.id === id ? `${id}-${shake.n}` : id}
                className={`ing ${used ? 'used' : ''} ${shake?.id === id ? 'shake' : ''}`}
                disabled={used || finished}
                title={ig?.name}
                onClick={() => pick(id)}
              >
                <span>{ig?.icon}</span>
                <small>{ig?.name}</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className={`mg-fb ${feedback.cls}`}>{feedback.text}</div>
    </>
  );
}
