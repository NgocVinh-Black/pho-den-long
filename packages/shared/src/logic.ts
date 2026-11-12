// Các hàm tính toán thuần, dùng chung cho API và Web.
import { RULES } from './rules';
import type { Recipe } from './types';

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const priceMultiplier = (level: number) => 1 + RULES.levelPriceBonus * (level - 1);

/** Số phần có thể làm từ kho (cộng thêm giỏ hàng nếu có). */
export function portionsAvailable(
  recipe: Pick<Recipe, 'ingredients'>,
  pantry: Record<string, number>,
  extra: ReadonlyMap<string, number> = new Map(),
): number {
  return Math.min(
    ...recipe.ingredients.map(({ id, qty }) => Math.floor(((pantry[id] ?? 0) + (extra.get(id) ?? 0)) / qty)),
  );
}

export function starsForQuality(q: number): 0 | 1 | 2 | 3 {
  if (q >= 0.85) return 3;
  if (q >= 0.6) return 2;
  if (q >= 0.35) return 1;
  return 0;
}

export function verdict(q: number): string {
  if (q >= 0.9) return 'Hoàn hảo! ✨';
  if (q >= 0.7) return 'Ngon lành!';
  if (q >= 0.4) return 'Tạm được';
  return 'Hỏng rồi 😵';
}

/** Tổng số phần hàng của các đơn theo hình thức (gánh / giao). */
export const shipmentUnits = (shipments: { mode: string; items: { qty: number }[] }[], mode: string) =>
  shipments
    .filter((s) => s.mode === mode)
    .reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0), 0);

/** Tổng hợp hiệu ứng của đồ nội thất trong quán. */
export function furnitureEffects(
  owned: Record<string, number>,
  catalog: readonly {
    id: string;
    kind: string;
    seats?: number;
    payBonus?: number;
    patienceBonus?: number;
    trafficBonus?: number;
  }[],
) {
  let tables = 0;
  let seats = 0;
  let payBonus = 0;
  let patienceBonus = 0;
  let trafficBonus = 0;
  for (const f of catalog) {
    const n = owned[f.id] ?? 0;
    if (!n) continue;
    if (f.kind === 'table') tables += n;
    seats += (f.seats ?? 0) * n;
    payBonus += (f.payBonus ?? 0) * n;
    patienceBonus += (f.patienceBonus ?? 0) * n;
    trafficBonus += (f.trafficBonus ?? 0) * n;
  }
  return { tables, seats, payBonus, patienceBonus, trafficBonus };
}

export const formatMoney = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}k`;
