import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  adPlanMap,
  CATALOG,
  MAX_TABLES,
  RULES,
  STAFF_NAMES,
  STAFF_ROLES,
  furnitureEffects,
  furnitureFor,
  furnitureMap,
  furnitureName,
  interiorStyle,
  migrateFurnitureId,
  starterFurniture,
  clamp,
  deliveryFee,
  shipmentUnits,
  ingredientMap,
  portionsAvailable,
  priceMultiplier,
  shopMap,
  starsForQuality,
  type AdPlanId,
  type Avatar,
  type BuyResult,
  type CustomerTypeId,
  type EndDayResult,
  type InteriorKind,
  type LeaderboardEntry,
  type Market,
  type Note,
  type NoteItem,
  type MissResult,
  type PlayerResult,
  type PlayerState,
  type ReceiveResult,
  type RecipeIngredient,
  type ServeResult,
  type Shipment,
  type ShipmentMode,
  type Shop,
  type StaffMember,
  type StaffRole,
} from '@pdl/shared';
import { GameError, notFound } from '../lib/errors';

type Tx = Prisma.TransactionClient;
const PLAYER_INCLUDE = {
  learned: true,
  pantry: true,
  furniture: true,
  staff: { orderBy: { hiredAt: 'asc' } },
  shipments: { where: { status: 'pending' }, include: { items: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PlayerInclude;
type PlayerRow = Prisma.PlayerGetPayload<{ include: typeof PLAYER_INCLUDE }>;
type ShipmentRow = PlayerRow['shipments'][number];

const toStaff = (s: { id: string; role: string; name: string; hiredDay: number }): StaffMember => ({
  id: s.id,
  role: s.role as StaffRole,
  name: s.name,
  hiredDay: s.hiredDay,
});

const toShipment = (s: ShipmentRow): Shipment => ({
  id: s.id,
  mode: s.mode as ShipmentMode,
  fee: s.fee,
  items: s.items.map((i) => ({ id: i.ingredientId, qty: i.qty })),
  createdAt: s.createdAt.toISOString(),
});

const customerTypes = new Map(CATALOG.customerTypes.map((c) => [c.id, c]));

/** Nguyên liệu → tên các quán dùng nó */
const USED_BY = new Map<string, string[]>();
for (const shop of CATALOG.shops) {
  for (const ingId of shop.ingredientIds) USED_BY.set(ingId, [...(USED_BY.get(ingId) ?? []), shop.name]);
}

/** Số ngẫu nhiên 0..1 ổn định theo chuỗi (giá chợ mỗi ngày). */
function hash01(input: string): number {
  return createHash('sha1').update(input).digest().readUInt32BE(0) / 0xffffffff;
}

export function marketPrice(ingredientId: string, day: number): number {
  const base = ingredientMap.get(ingredientId)?.price ?? 1;
  return Math.max(1, Math.round(base * (0.8 + 0.4 * hash01(`${day}:${ingredientId}`))));
}

const TODAY_RESET = {
  adPlan: null,
  todayServed: 0,
  todayPerfect: 0,
  todayMissed: 0,
  todayRevenue: 0,
  todaySpent: 0,
} satisfies Prisma.PlayerUpdateInput;

export class GameService {
  constructor(private readonly db: PrismaClient) {}

  // ---------- Đọc dữ liệu ----------
  private async loadRow(tx: Tx, id: string): Promise<PlayerRow> {
    const row = await tx.player.findUnique({ where: { id }, include: PLAYER_INCLUDE });
    if (!row) throw notFound('người chơi');
    const interior = this.shopOf(row).interior;
    if (row.furniture.length === 0) {
      // bản lưu cũ chưa có bàn ghế: tặng bộ khởi đầu theo kiểu quán
      await tx.playerFurniture.createMany({
        data: Object.entries(starterFurniture(interior)).map(([itemId, qty]) => ({
          playerId: id,
          itemId,
          qty,
        })),
      });
      return this.loadRow(tx, id);
    }
    if (row.furniture.some((f) => furnitureMap.get(f.itemId)?.interior !== interior)) {
      await this.migrateFurniture(tx, id, interior, row.furniture);
      return this.loadRow(tx, id);
    }
    return row;
  }

  /**
   * Bản lưu từ trước khi tách danh mục theo kiểu quán: đổi từng món sang món cùng vai của kiểu quán,
   * gộp số lượng, giữ giới hạn từng món và tổng số cụm chỗ ngồi. Món không đổi được thì bỏ.
   */
  private async migrateFurniture(
    tx: Tx,
    playerId: string,
    interior: InteriorKind,
    rows: { itemId: string; qty: number }[],
  ) {
    const merged = new Map<string, number>();
    for (const r of rows) {
      const to = migrateFurnitureId(r.itemId, interior);
      if (to) merged.set(to, (merged.get(to) ?? 0) + r.qty);
    }
    let tables = 0;
    const data: { playerId: string; itemId: string; qty: number }[] = [];
    // chỗ sang trước để người chơi không mất phần đã đầu tư nhiều hơn
    const order = [...merged].sort(
      ([a], [b]) => (furnitureMap.get(b)?.price ?? 0) - (furnitureMap.get(a)?.price ?? 0),
    );
    for (const [itemId, qty] of order) {
      const item = furnitureMap.get(itemId);
      if (!item) continue;
      let keep = Math.min(qty, item.max);
      if (item.kind === 'table') {
        keep = Math.min(keep, MAX_TABLES - tables);
        tables += keep;
      }
      if (keep > 0) data.push({ playerId, itemId, qty: keep });
    }
    if (data.length === 0)
      data.push(
        ...Object.entries(starterFurniture(interior)).map(([itemId, qty]) => ({ playerId, itemId, qty })),
      );
    await tx.playerFurniture.deleteMany({ where: { playerId } });
    await tx.playerFurniture.createMany({ data });
  }

  /** Danh mục đồ quán xá của quán người chơi. */
  private catalogOf(row: { shopId: string }) {
    return furnitureFor(this.shopOf(row).interior);
  }

  private shopOf(row: { shopId: string }): Shop {
    const shop = shopMap.get(row.shopId);
    if (!shop) throw new GameError(`Quán ${row.shopId} không còn tồn tại`, 500);
    return shop;
  }

  private async toState(tx: Tx, row: PlayerRow): Promise<PlayerState> {
    const sales = await tx.dishSale.findMany({ where: { playerId: row.id, day: row.day } });
    return {
      id: row.id,
      name: row.name,
      avatar: { skin: row.avatarSkin, shirt: row.avatarShirt, hat: row.avatarHat as Avatar['hat'] },
      shopId: row.shopId,
      day: row.day,
      money: row.money,
      rep: row.rep,
      decor: row.decor,
      shopLevel: row.shopLevel,
      learned: row.learned.map((l) => l.recipeId),
      pantry: Object.fromEntries(row.pantry.filter((p) => p.qty > 0).map((p) => [p.ingredientId, p.qty])),
      shipments: row.shipments.map(toShipment),
      furniture: Object.fromEntries(row.furniture.filter((f) => f.qty > 0).map((f) => [f.itemId, f.qty])),
      staff: row.staff.map(toStaff),
      adPlan: adPlanMap.has(row.adPlan ?? '') ? (row.adPlan as AdPlanId) : null,
      today: {
        served: row.todayServed,
        perfect: row.todayPerfect,
        missed: row.todayMissed,
        revenue: row.todayRevenue,
        spent: row.todaySpent,
        dishes: Object.fromEntries(sales.map((s) => [s.recipeId, s.count])),
      },
      totals: {
        served: row.totalServed,
        revenue: row.totalRevenue,
        perfect: row.totalPerfect,
        bestDay: row.bestDay,
      },
    };
  }

  private async state(tx: Tx, id: string): Promise<PlayerState> {
    return this.toState(tx, await this.loadRow(tx, id));
  }

  // ---------- Người chơi ----------
  async createPlayer(input: {
    name: string;
    shopId: string;
    avatar?: Avatar;
    userId?: string | null;
  }): Promise<PlayerState> {
    const shop = shopMap.get(input.shopId);
    if (!shop) throw new GameError('Quán không tồn tại');
    return this.db.$transaction(async (tx) => {
      const row = await tx.player.create({
        data: {
          name: input.name,
          shopId: shop.id,
          userId: input.userId ?? null,
          money: RULES.startMoney,
          ...(input.avatar && {
            avatarSkin: input.avatar.skin,
            avatarShirt: input.avatar.shirt,
            avatarHat: input.avatar.hat,
          }),
          learned: { create: shop.recipes.filter((r) => r.starter).map((r) => ({ recipeId: r.id })) },
          furniture: {
            create: Object.entries(starterFurniture(shop.interior)).map(([itemId, qty]) => ({ itemId, qty })),
          },
        },
        include: PLAYER_INCLUDE,
      });
      return this.toState(tx, row);
    });
  }

  getPlayer(id: string): Promise<PlayerState> {
    return this.db.$transaction((tx) => this.state(tx, id));
  }

  // ---------- Chợ ----------
  /** Chợ đầu mối bán nguyên liệu của cả 20 quán. */
  async getMarket(id: string): Promise<Market> {
    const p = await this.getPlayer(id);
    const shop = this.shopOf(p);
    const learnedIngredients = new Set(
      shop.recipes.filter((r) => p.learned.includes(r.id)).flatMap((r) => r.ingredients.map((i) => i.id)),
    );
    return {
      day: p.day,
      items: CATALOG.ingredients.map((ingr) => {
        const price = marketPrice(ingr.id, p.day);
        return {
          id: ingr.id,
          forMyShop: shop.ingredientIds.includes(ingr.id),
          usedBy: USED_BY.get(ingr.id) ?? [],
          price,
          basePrice: ingr.price,
          trend: price > ingr.price ? 'up' : price < ingr.price ? 'down' : 'flat',
          stock: p.pantry[ingr.id] ?? 0,
          neededNow: learnedIngredients.has(ingr.id),
        };
      }),
    };
  }

  /**
   * Mua hàng ở chợ. Hàng chưa vào kho ngay mà thành một đơn:
   * - carry: chủ quán tự gánh về, miễn phí nhưng giới hạn số phần
   * - delivery: xe ba gác chở tới quán, tốn phí giao
   */
  buy(id: string, items: RecipeIngredient[], mode: ShipmentMode): Promise<BuyResult> {
    return this.db.$transaction(async (tx) => {
      const row = await this.loadRow(tx, id);
      const merged = new Map<string, number>();
      for (const { id: ingId, qty } of items) {
        if (!ingredientMap.has(ingId)) throw new GameError(`Chợ không bán "${ingId}"`);
        merged.set(ingId, (merged.get(ingId) ?? 0) + qty);
      }

      if (mode === 'carry') {
        const capacity = RULES.carryCapacity(row.shopLevel);
        const carrying = shipmentUnits(row.shipments.map(toShipment), 'carry');
        const adding = [...merged.values()].reduce((a, b) => a + b, 0);
        if (carrying + adding > capacity) {
          throw new GameError(
            `Gánh không nổi! Tối đa ${capacity} phần (đang gánh ${carrying}). Hãy gọi xe giao hàng.`,
          );
        }
      }

      let goods = 0;
      for (const [ingId, qty] of merged) goods += marketPrice(ingId, row.day) * qty;
      const fee = mode === 'delivery' ? deliveryFee(goods) : 0;
      const total = goods + fee;
      if (total > row.money) throw new GameError(`Không đủ tiền (cần ${total}k, còn ${row.money}k)`);

      await tx.player.update({
        where: { id },
        data: { money: { decrement: total }, todaySpent: { increment: total } },
      });
      const created = await tx.shipment.create({
        data: {
          playerId: id,
          mode,
          fee,
          items: { create: [...merged].map(([ingredientId, qty]) => ({ ingredientId, qty })) },
        },
        include: { items: true },
      });
      return { spent: total, shipment: toShipment(created), player: await this.state(tx, id) };
    });
  }

  /** Đưa hàng của các đơn đang chờ vào kho. */
  private async stockShipments(tx: Tx, playerId: string, shipments: ShipmentRow[]) {
    const received = new Map<string, number>();
    for (const sh of shipments) {
      for (const it of sh.items) {
        received.set(it.ingredientId, (received.get(it.ingredientId) ?? 0) + it.qty);
        await tx.pantryItem.upsert({
          where: { playerId_ingredientId: { playerId, ingredientId: it.ingredientId } },
          create: { playerId, ingredientId: it.ingredientId, qty: it.qty },
          update: { qty: { increment: it.qty } },
        });
      }
      await tx.shipment.update({
        where: { id: sh.id },
        data: { status: 'received', receivedAt: new Date() },
      });
    }
    return [...received].map(([ingId, qty]) => ({ id: ingId, qty }));
  }

  /**
   * Nhận hàng vào kho.
   * - shipmentId: nhận một đơn cụ thể (xe giao tới nơi)
   * - mode = "carry": cất toàn bộ hàng đang gánh lên kệ
   */
  receive(id: string, input: { shipmentId?: string; mode?: ShipmentMode }): Promise<ReceiveResult> {
    return this.db.$transaction(async (tx) => {
      const row = await this.loadRow(tx, id);
      const targets = row.shipments.filter((s) =>
        input.shipmentId ? s.id === input.shipmentId : s.mode === (input.mode ?? 'carry'),
      );
      if (input.shipmentId && targets.length === 0) throw notFound('đơn hàng');
      const received = await this.stockShipments(tx, id, targets);
      return { received, player: await this.state(tx, id) };
    });
  }

  setAvatar(id: string, avatar: Avatar): Promise<PlayerResult> {
    return this.db.$transaction(async (tx) => {
      await this.loadRow(tx, id);
      await tx.player.update({
        where: { id },
        data: { avatarSkin: avatar.skin, avatarShirt: avatar.shirt, avatarHat: avatar.hat },
      });
      return { player: await this.state(tx, id) };
    });
  }

  // ---------- Phục vụ ----------
  serve(
    id: string,
    input: { recipeId: string; quality: number; customerType: CustomerTypeId; cookedBy?: 'player' | 'staff' },
  ): Promise<ServeResult> {
    return this.db.$transaction(async (tx) => {
      const row = await this.loadRow(tx, id);
      const recipe = this.shopOf(row).recipes.find((r) => r.id === input.recipeId);
      if (!recipe) throw new GameError('Món không có trong quán');
      if (!row.learned.some((l) => l.recipeId === recipe.id))
        throw new GameError('Chưa học công thức món này');

      const pantry = Object.fromEntries(row.pantry.map((p) => [p.ingredientId, p.qty]));
      if (portionsAvailable(recipe, pantry) < 1) {
        const missing = recipe.ingredients.find(({ id: ingId, qty }) => (pantry[ingId] ?? 0) < qty);
        throw new GameError(`Thiếu ${ingredientMap.get(missing?.id ?? '')?.name ?? 'nguyên liệu'}`, 409);
      }
      for (const { id: ingId, qty } of recipe.ingredients) {
        await tx.pantryItem.update({
          where: { playerId_ingredientId: { playerId: id, ingredientId: ingId } },
          data: { qty: { decrement: qty } },
        });
      }

      let q = clamp(input.quality, 0, 1);
      if (input.cookedBy === 'staff') {
        // Món do phụ bếp nấu: chất lượng không vượt tay nghề phụ bếp
        if (!row.staff.some((s) => s.role === 'cook')) throw new GameError('Quán chưa thuê phụ bếp');
        q = Math.min(q, (STAFF_ROLES.cook.skill ?? 0.6) + 0.1);
      }
      const ctype = customerTypes.get(input.customerType) ?? customerTypes.get('local')!;
      const owned = Object.fromEntries(row.furniture.map((f) => [f.itemId, f.qty]));
      const bonus = 1 + furnitureEffects(owned, this.catalogOf(row)).payBonus;
      const pay = Math.max(
        1,
        Math.round(recipe.price * priceMultiplier(row.shopLevel) * (0.5 + 0.7 * q) * ctype.pay * bonus),
      );
      const perfect = q >= 0.85;
      const repDelta = perfect ? ctype.repMul : q < 0.4 ? -1 : 0;

      await tx.player.update({
        where: { id },
        data: {
          money: { increment: pay },
          rep: Math.max(0, row.rep + repDelta),
          todayServed: { increment: 1 },
          todayRevenue: { increment: pay },
          todayPerfect: { increment: perfect ? 1 : 0 },
        },
      });
      await tx.dishSale.upsert({
        where: { playerId_day_recipeId: { playerId: id, day: row.day, recipeId: recipe.id } },
        create: { playerId: id, day: row.day, recipeId: recipe.id, count: 1 },
        update: { count: { increment: 1 } },
      });
      return { pay, repDelta, stars: starsForQuality(q), player: await this.state(tx, id) };
    });
  }

  miss(id: string): Promise<MissResult> {
    return this.db.$transaction(async (tx) => {
      const row = await this.loadRow(tx, id);
      await tx.player.update({
        where: { id },
        data: { rep: Math.max(0, row.rep - 1), todayMissed: { increment: 1 } },
      });
      return { repDelta: -1, player: await this.state(tx, id) };
    });
  }

  // ---------- Kết thúc ngày ----------
  endDay(id: string): Promise<EndDayResult> {
    return this.db.$transaction(async (tx) => {
      // Cuối ngày: hàng còn đang gánh / đang giao được cất hết vào kho
      const pending = (await this.loadRow(tx, id)).shipments;
      const autoStocked = await this.stockShipments(tx, id, pending);
      // Trả lương nhân viên; không đủ tiền thì người vào sau nghỉ trước
      const staffRows = (await this.loadRow(tx, id)).staff;
      let cash = (await this.loadRow(tx, id)).money;
      let wagesPaid = 0;
      const staffQuit: StaffMember[] = [];
      for (const st of staffRows) {
        const wage = STAFF_ROLES[st.role as StaffRole]?.wage ?? 0;
        if (cash >= wage) {
          cash -= wage;
          wagesPaid += wage;
        } else {
          staffQuit.push(toStaff(st));
          await tx.staff.delete({ where: { id: st.id } });
        }
      }
      if (wagesPaid) {
        await tx.player.update({
          where: { id },
          data: { money: { decrement: wagesPaid }, todaySpent: { increment: wagesPaid } },
        });
      }
      const before = await this.state(tx, id);
      const spoiled: RecipeIngredient[] = [];
      const pantryAfter = { ...before.pantry };

      for (const [ingId, qty] of Object.entries(before.pantry)) {
        if (!ingredientMap.get(ingId)?.perishable) continue;
        const lost = Math.ceil(qty * RULES.spoilRate);
        if (lost <= 0) continue;
        spoiled.push({ id: ingId, qty: lost });
        pantryAfter[ingId] = qty - lost;
        await tx.pantryItem.update({
          where: { playerId_ingredientId: { playerId: id, ingredientId: ingId } },
          data: { qty: { decrement: lost } },
        });
      }

      const shop = this.shopOf(before);
      const canCook = shop.recipes
        .filter((r) => before.learned.includes(r.id))
        .some((r) => portionsAvailable(r, pantryAfter) > 0);
      const rescued = before.money < RULES.rescueThreshold && !canCook ? RULES.rescueMoney : 0;

      await tx.player.update({
        where: { id },
        data: {
          ...TODAY_RESET,
          day: { increment: 1 },
          money: { increment: rescued },
          totalServed: { increment: before.today.served },
          totalRevenue: { increment: before.today.revenue },
          totalPerfect: { increment: before.today.perfect },
          bestDay: Math.max(before.totals.bestDay, before.today.revenue),
        },
      });

      return {
        summary: {
          day: before.day,
          ...before.today,
          profit: before.today.revenue - before.today.spent,
          spoiled,
          rescued,
          autoStocked,
          wagesPaid,
          staffQuit,
        },
        player: await this.state(tx, id),
      };
    });
  }

  // ---------- Nâng cấp ----------
  learn(id: string, recipeId: string): Promise<PlayerResult> {
    return this.db.$transaction(async (tx) => {
      const row = await this.loadRow(tx, id);
      const recipe = this.shopOf(row).recipes.find((r) => r.id === recipeId);
      if (!recipe) throw new GameError('Món không có trong quán');
      if (row.learned.some((l) => l.recipeId === recipeId)) throw new GameError('Đã học món này rồi');
      if (row.rep < recipe.learnRep) throw new GameError(`Cần ${recipe.learnRep}⭐ danh tiếng`);
      if (row.money < recipe.learnCost) throw new GameError('Không đủ tiền');
      await tx.player.update({
        where: { id },
        data: { money: { decrement: recipe.learnCost }, learned: { create: { recipeId } } },
      });
      return { player: await this.state(tx, id) };
    });
  }

  upgrade(id: string, type: 'shop' | 'decor'): Promise<PlayerResult> {
    return this.db.$transaction(async (tx) => {
      const row = await this.loadRow(tx, id);
      let cost: number;
      let data: Prisma.PlayerUpdateInput;
      if (type === 'decor') {
        if (row.decor >= RULES.maxDecor) throw new GameError('Đèn lồng đã treo kín phố');
        cost = RULES.decorCost(row.decor);
        data = { decor: { increment: 1 } };
      } else {
        if (row.shopLevel >= RULES.maxShopLevel) throw new GameError('Quán đã đạt cấp tối đa');
        cost = RULES.shopUpgradeCost(row.shopLevel);
        data = { shopLevel: { increment: 1 } };
      }
      if (row.money < cost) throw new GameError('Không đủ tiền');
      await tx.player.update({ where: { id }, data: { ...data, money: { decrement: cost } } });
      return { player: await this.state(tx, id) };
    });
  }

  // ---------- Đồ nội thất ----------
  buyFurniture(id: string, itemId: string): Promise<PlayerResult> {
    return this.db.$transaction(async (tx) => {
      const row = await this.loadRow(tx, id);
      const item = furnitureMap.get(itemId);
      if (!item) throw new GameError('Không có món đồ này');
      const shop = this.shopOf(row);
      if (item.interior !== shop.interior) throw new GameError(`${item.name} không hợp với ${shop.name}`);
      const name = furnitureName(item, shop.id);
      const style = interiorStyle(shop.interior);
      const owned = Object.fromEntries(row.furniture.map((f) => [f.itemId, f.qty]));
      if ((owned[itemId] ?? 0) >= item.max) throw new GameError(`Quán đã có đủ ${item.max} ${name}`);
      if (item.kind === 'table' && furnitureEffects(owned, this.catalogOf(row)).tables >= MAX_TABLES) {
        throw new GameError(`Quán chỉ kê được tối đa ${MAX_TABLES} ${style.seat}`);
      }
      if (row.money < item.price) throw new GameError('Không đủ tiền');
      await tx.player.update({
        where: { id },
        data: { money: { decrement: item.price }, todaySpent: { increment: item.price } },
      });
      await tx.playerFurniture.upsert({
        where: { playerId_itemId: { playerId: id, itemId } },
        create: { playerId: id, itemId, qty: 1 },
        update: { qty: { increment: 1 } },
      });
      return { player: await this.state(tx, id) };
    });
  }

  // ---------- Máy bay quảng cáo ----------
  /** Thuê một gói máy bay kéo băng rôn cho hôm nay. Mỗi ngày tối đa một gói. */
  buyAd(id: string, planId: string): Promise<PlayerResult> {
    return this.db.$transaction(async (tx) => {
      const row = await this.loadRow(tx, id);
      const plan = adPlanMap.get(planId);
      if (!plan) throw new GameError('Không có gói quảng cáo này');
      if (row.adPlan) throw new GameError('Hôm nay đã thuê máy bay quảng cáo rồi');
      if (row.money < plan.price) throw new GameError(`Không đủ tiền (cần ${plan.price}k)`);
      await tx.player.update({
        where: { id },
        data: {
          adPlan: plan.id,
          money: { decrement: plan.price },
          todaySpent: { increment: plan.price },
        },
      });
      return { player: await this.state(tx, id) };
    });
  }

  // ---------- Nhân viên ----------
  hireStaff(id: string, role: StaffRole): Promise<PlayerResult> {
    return this.db.$transaction(async (tx) => {
      const row = await this.loadRow(tx, id);
      const def = STAFF_ROLES[role];
      if (!def) throw new GameError('Không có vị trí này');
      if (row.staff.filter((s) => s.role === role).length >= def.max) {
        throw new GameError(`Quán chỉ cần tối đa ${def.max} ${def.title.toLowerCase()}`);
      }
      // Tiền nhận việc = 1 ngày lương trả trước
      if (row.money < def.wage) throw new GameError(`Cần ${def.wage}k trả trước một ngày lương`);
      const used = new Set(row.staff.map((s) => s.name));
      const name = STAFF_NAMES.find((n) => !used.has(n)) ?? `Bé ${row.staff.length + 1}`;
      await tx.player.update({
        where: { id },
        data: { money: { decrement: def.wage }, todaySpent: { increment: def.wage } },
      });
      await tx.staff.create({ data: { playerId: id, role, name, hiredDay: row.day } });
      return { player: await this.state(tx, id) };
    });
  }

  fireStaff(id: string, staffId: string): Promise<PlayerResult> {
    return this.db.$transaction(async (tx) => {
      const res = await tx.staff.deleteMany({ where: { id: staffId, playerId: id } });
      if (res.count === 0) throw notFound('nhân viên');
      return { player: await this.state(tx, id) };
    });
  }

  // ---------- Sổ ghi chú ----------
  private toNote(n: { id: string; title: string; items: string; pinned: boolean; updatedAt: Date }): Note {
    let items: NoteItem[] = [];
    try {
      items = JSON.parse(n.items) as NoteItem[];
    } catch {
      items = [];
    }
    return { id: n.id, title: n.title, items, pinned: n.pinned, updatedAt: n.updatedAt.toISOString() };
  }

  async listNotes(playerId: string): Promise<Note[]> {
    const rows = await this.db.note.findMany({ where: { playerId }, orderBy: { updatedAt: 'desc' } });
    return rows.map((n) => this.toNote(n));
  }

  async createNote(playerId: string, input: { title: string; items: NoteItem[]; pinned?: boolean }) {
    const count = await this.db.note.count({ where: { playerId } });
    if (count >= 30) throw new GameError('Sổ đã đầy (tối đa 30 trang), hãy xóa bớt');
    return this.db.$transaction(async (tx) => {
      if (input.pinned) await tx.note.updateMany({ where: { playerId }, data: { pinned: false } });
      const n = await tx.note.create({
        data: {
          playerId,
          title: input.title,
          items: JSON.stringify(input.items),
          pinned: input.pinned ?? false,
        },
      });
      return this.toNote(n);
    });
  }

  async updateNote(
    playerId: string,
    noteId: string,
    input: { title?: string; items?: NoteItem[]; pinned?: boolean },
  ): Promise<Note> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.note.findFirst({ where: { id: noteId, playerId } });
      if (!existing) throw notFound('ghi chú');
      // chỉ ghim một trang tại một thời điểm
      if (input.pinned)
        await tx.note.updateMany({ where: { playerId, NOT: { id: noteId } }, data: { pinned: false } });
      const n = await tx.note.update({
        where: { id: noteId },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.items !== undefined && { items: JSON.stringify(input.items) }),
          ...(input.pinned !== undefined && { pinned: input.pinned }),
        },
      });
      return this.toNote(n);
    });
  }

  async deleteNote(playerId: string, noteId: string) {
    const res = await this.db.note.deleteMany({ where: { id: noteId, playerId } });
    if (res.count === 0) throw notFound('ghi chú');
    return { ok: true };
  }

  async leaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    const rows = await this.db.player.findMany({
      orderBy: [{ totalRevenue: 'desc' }, { rep: 'desc' }],
      take: limit,
    });
    return rows.map((p) => ({
      name: p.name,
      shop: shopMap.get(p.shopId)?.name ?? p.shopId,
      shopIcon: shopMap.get(p.shopId)?.icon ?? '🏮',
      day: p.day,
      rep: p.rep,
      revenue: p.totalRevenue,
    }));
  }
}
