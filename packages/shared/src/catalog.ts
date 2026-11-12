import { AD_PLANS } from './data/ads';
import { FURNITURE } from './data/furniture';
import { INTERIORS } from './data/interiors';
import { INGREDIENTS } from './data/ingredients';
import { MARKET_SECTIONS } from './data/market';
import { REGIONS, SHOPS } from './data/shops';
import { CUSTOMER_TYPES, RULES } from './rules';
import type { Catalog, Ingredient, Recipe, RecipeDef, Shop } from './types';

export const ingredientMap: ReadonlyMap<string, Ingredient> = new Map(INGREDIENTS.map((i) => [i.id, i]));

function getIngredient(id: string): Ingredient {
  const ing = ingredientMap.get(id);
  if (!ing) throw new Error(`Unknown ingredient: ${id}`);
  return ing;
}

export function recipeCost(recipe: RecipeDef): number {
  return recipe.ingredients.reduce((sum, { id, qty }) => sum + getIngredient(id).price * qty, 0);
}

/** Ghép dữ liệu thô thành catalog: tính giá bán, giá học, bộ nguyên liệu của từng quán. */
export function buildCatalog(): Catalog {
  const ids = new Set<string>();
  const shops: Shop[] = SHOPS.map((shop) => {
    if (ids.has(shop.id)) throw new Error(`Duplicate shop id ${shop.id}`);
    ids.add(shop.id);
    const margin = RULES.priceMargin[shop.kind];
    const recipes: Recipe[] = shop.recipes.map((r, idx) => {
      const cost = recipeCost(r);
      return {
        ...r,
        cost,
        price: Math.ceil((cost * margin) / 5) * 5,
        learnCost: RULES.learnCost[idx] ?? 500,
        learnRep: RULES.learnRep[idx] ?? 25,
        starter: idx === 0,
      };
    });
    const ingredientIds = [...new Set(recipes.flatMap((r) => r.ingredients.map((i) => i.id)))];
    return { ...shop, recipes, ingredientIds };
  });

  return {
    regions: REGIONS,
    marketSections: MARKET_SECTIONS,
    furniture: FURNITURE,
    interiors: INTERIORS,
    adPlans: AD_PLANS,
    shops,
    ingredients: INGREDIENTS,
    customerTypes: CUSTOMER_TYPES,
    rules: {
      startMoney: RULES.startMoney,
      dayLengthSec: RULES.dayLengthSec,
      maxQueue: RULES.maxQueue,
      spoilRate: RULES.spoilRate,
      levelPriceBonus: RULES.levelPriceBonus,
      maxShopLevel: RULES.maxShopLevel,
      maxDecor: RULES.maxDecor,
      deliverySeconds: RULES.deliverySeconds,
      deliveryFeeRate: RULES.deliveryFeeRate,
      deliveryMinFee: RULES.deliveryMinFee,
      carryCapacities: Array.from({ length: RULES.maxShopLevel }, (_, i) => RULES.carryCapacity(i + 1)),
      shopUpgradeCosts: Array.from({ length: RULES.maxShopLevel }, (_, i) => RULES.shopUpgradeCost(i + 1)),
      decorCosts: Array.from({ length: RULES.maxDecor }, (_, i) => RULES.decorCost(i)),
      qualityWeights: { ...RULES.qualityWeights },
    },
  };
}

export const CATALOG: Catalog = buildCatalog();
export const furnitureMap: ReadonlyMap<string, (typeof FURNITURE)[number]> = new Map(
  FURNITURE.map((f) => [f.id, f]),
);
export const shopMap: ReadonlyMap<string, Shop> = new Map(CATALOG.shops.map((s) => [s.id, s]));
