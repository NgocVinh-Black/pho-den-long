import { create } from 'zustand';
import {
  adPlanMap,
  furnitureFor,
  furnitureName,
  interiorStyle,
  STAFF_ROLES,
  formatMoney,
  furnitureEffects,
  portionsAvailable,
  shipmentUnits,
  type AuthUser,
  type Avatar,
  type Catalog,
  type DaySummary,
  type FurnitureRole,
  type Ingredient,
  type LeaderboardEntry,
  type Market,
  type MarketSectionId,
  type Note,
  type NoteItem,
  type PlayerState,
  type PlayerSummary,
  type Recipe,
  type ShipmentMode,
  type Shop,
} from '@pdl/shared';
import { api, ApiError } from '../api/client';
import type { CustomerInfo, InteractId } from '../game/World';
import type { Diner, Order } from '../game/service';
import { worldHost } from '../game/worldHost';
import { KEYS, storage } from '../utils/storage';

export type Screen = 'loading' | 'offline' | 'title' | 'choose' | 'play' | 'night';
export type DayPhase = 'morning' | 'open';
export type Panel =
  | { type: 'stall'; section: MarketSectionId }
  | { type: 'checkout' }
  | { type: 'notes' }
  | { type: 'pantry' }
  | { type: 'recipes' }
  | { type: 'open-confirm' }
  | { type: 'neighbor'; shopId: string };

export interface Toast {
  id: number;
  text: string;
  kind?: 'bad' | 'good';
}

/** Đang đứng bếp nấu một order */
export interface CookingSession {
  key: number;
  orderId: number;
  recipe: Recipe;
  customerName: string;
  table: number;
  /** Nấu xong: chất lượng */
  done?: { quality: number };
}

interface GameState {
  screen: Screen;
  dayPhase: DayPhase;
  panel: Panel | null;
  catalog: Catalog | null;
  ingredients: Map<string, Ingredient>;
  player: PlayerState | null;
  shop: Shop | null;
  savedPlayer: PlayerState | null;
  /** Tài khoản Google đang đăng nhập */
  user: AuthUser | null;
  googleClientId: string | null;
  /** Các quán của tài khoản */
  myPlayers: PlayerSummary[];
  leaderboard: LeaderboardEntry[];
  market: Market | null;
  summary: DaySummary | null;
  cooking: CookingSession | null;
  toasts: Toast[];
  /** Giỏ chợ: nguyên liệu → số phần (chưa thanh toán) */
  cart: Map<string, number>;
  /** Sổ ghi chú đi chợ */
  notes: Note[];

  boot: () => Promise<void>;
  toast: (text: string, kind?: Toast['kind']) => void;
  goTitle: () => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  continuePlayer: (playerId: string) => Promise<void>;
  goChoose: () => void;
  createPlayer: (name: string, shopId: string, avatar: Avatar) => Promise<void>;
  goMorning: () => Promise<void>;
  interact: (id: InteractId) => void;
  closePanel: () => void;
  cartAdd: (ingredientId: string, n: number) => void;
  cartClear: () => void;
  buy: (mode: ShipmentMode) => Promise<boolean>;
  buyFurniture: (itemId: string) => Promise<void>;
  /** Thuê máy bay kéo băng rôn quảng cáo cho hôm nay */
  buyAd: (planId: string) => Promise<void>;
  openNotes: () => void;
  loadNotes: () => Promise<void>;
  createNote: (title: string, items: NoteItem[], pinned?: boolean) => Promise<Note | null>;
  updateNote: (
    noteId: string,
    patch: { title?: string; items?: NoteItem[]; pinned?: boolean },
  ) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  toggleNoteItem: (noteId: string, index: number) => void;
  fillCartFromNote: (noteId: string, section?: MarketSectionId) => number;
  stockCarried: () => Promise<void>;
  deliveryArrived: (shipmentId: string) => Promise<void>;
  openShop: () => void;
  startCooking: (order: Order, diner: Diner) => void;
  finishCooking: (quality: number) => Promise<void>;
  deliverDish: (order: Order, diner: Diner) => Promise<void>;
  canAccept: (recipe: Recipe) => boolean;
  customerLeft: (message: string) => Promise<void>;
  hireStaff: (role: 'waiter' | 'cook') => Promise<void>;
  fireStaff: (staffId: string) => Promise<void>;
  endDay: () => Promise<void>;
  learn: (recipeId: string) => Promise<void>;
  upgrade: (type: 'shop' | 'decor') => Promise<void>;
  menu: () => void;
}

let toastId = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gói máy bay quảng cáo đang thuê hôm nay (nếu có). */
export const adPlanOf = (player: PlayerState) => (player.adPlan ? adPlanMap.get(player.adPlan) : undefined);

export const learnedRecipes = (player: PlayerState, shop: Shop) =>
  shop.recipes.filter((r) => player.learned.includes(r.id));

export const canMake = (recipe: Recipe, player: PlayerState) => portionsAvailable(recipe, player.pantry) > 0;

function pickWeighted<T>(items: readonly T[], weight: (it: T) => number): T {
  const total = items.reduce((a, it) => a + weight(it), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= weight(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1]!;
}

export const useGame = create<GameState>()((set, get) => {
  /** Chạy thao tác gọi API: lỗi thì báo, mất kết nối thì chuyển màn offline. */
  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(String(e), 0);
      get().toast(err.message, 'bad');
      if (err.offline) set({ screen: 'offline' });
      return null;
    }
  }

  function setPlayer(player: PlayerState) {
    const { catalog } = get();
    if (!catalog) return;
    const shop = catalog.shops.find((s) => s.id === player.shopId) ?? null;
    set({ player, shop });
    syncWorld();
  }

  /** Cách gọi theo nghề của quán người chơi ("bàn"/"chỗ"/"hàng ghế", "bếp"/"bàn nghề"…). */
  const style = () => interiorStyle(get().shop?.interior);

  function makeCustomer(): CustomerInfo | null {
    const { catalog, player, shop } = get();
    if (!catalog || !player || !shop) return null;
    const ad = adPlanOf(player);
    const type = pickWeighted(
      catalog.customerTypes,
      (t) =>
        t.weight * (t.favors?.includes(shop.kind) ? 2 : 1) * (t.id === 'tourist' ? (ad?.touristMul ?? 1) : 1),
    );
    const recipe = pickWeighted(learnedRecipes(player, shop), (r) => (canMake(r, player) ? 4 : 1));
    const fx = furnitureEffects(player.furniture, furnitureFor(shop.interior));
    return {
      type: type.id,
      typeName: type.name,
      recipe,
      patience: type.patience + player.shopLevel * 2 + fx.patienceBonus,
    };
  }

  function spawnInterval(player: PlayerState, shop: Shop): number {
    const learned = learnedRecipes(player, shop);
    const avgPrice = learned.reduce((a, r) => a + r.price, 0) / learned.length;
    const priceFactor = Math.min(1.5, Math.max(0.55, avgPrice / 40));
    const boost = 1 + player.decor * 0.12 + Math.min(player.rep, 60) * 0.01 + (learned.length - 1) * 0.1;
    const traffic = 1 + furnitureEffects(player.furniture, furnitureFor(shop.interior)).trafficBonus;
    const ad = 1 + (adPlanOf(player)?.traffic ?? 0);
    return Math.max(1.6, (5.6 * priceFactor) / (boost * traffic * ad));
  }

  return {
    screen: 'loading',
    dayPhase: 'morning',
    panel: null,
    catalog: null,
    ingredients: new Map(),
    player: null,
    shop: null,
    savedPlayer: null,
    user: null,
    googleClientId: null,
    myPlayers: [],
    leaderboard: [],
    market: null,
    summary: null,
    cooking: null,
    toasts: [],
    cart: new Map(),
    notes: [],

    async boot() {
      set({ screen: 'loading' });
      try {
        const [catalog, config, me] = await Promise.all([
          api.catalog(),
          api.authConfig().catch(() => ({ googleClientId: null })),
          api.me().catch(() => ({ user: null })),
        ]);
        set({
          catalog,
          ingredients: new Map(catalog.ingredients.map((i) => [i.id, i])),
          googleClientId: config.googleClientId,
          user: me.user,
        });
      } catch {
        set({ screen: 'offline' });
        return;
      }
      await get().goTitle();
    },

    toast(text, kind) {
      const id = ++toastId;
      set((s) => ({ toasts: [...s.toasts, { id, text, kind }].slice(-4) }));
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2800);
    },

    async goTitle() {
      worldHost.get()?.setNight();
      const { user } = get();
      // Đăng nhập: lấy danh sách quán của tài khoản. Khách: quán lưu trên máy này.
      const myPlayers = user ? await api.myPlayers().catch(() => []) : [];
      const savedId = user ? myPlayers[0]?.id : storage.get(KEYS.playerId);
      const saved = savedId ? await api.getPlayer(savedId).catch(() => null) : null;
      if (saved) setPlayer(saved);
      else {
        set({ player: null, shop: null });
        syncWorld();
      }
      worldHost.get()?.goStreet();
      const leaderboard = await api.leaderboard().catch(() => []);
      set({ screen: 'title', panel: null, savedPlayer: saved, myPlayers, leaderboard });
    },

    async loginWithGoogle(credential) {
      const res = await run(() => api.loginGoogle(credential));
      if (!res?.user) return;
      set({ user: res.user });
      // Quán đang chơi khách trên máy này → gắn vào tài khoản
      const guestId = storage.get(KEYS.playerId);
      if (guestId) {
        const claimed = await api.claim(guestId).then(
          () => true,
          () => false,
        );
        if (claimed) get().toast('Đã lưu quán đang chơi vào tài khoản của bạn ☁️', 'good');
        storage.remove(KEYS.playerId);
      }
      get().toast(`Xin chào ${res.user.displayName}! 👋`, 'good');
      await get().goTitle();
    },

    async logout() {
      await api.logout().catch(() => undefined);
      storage.remove(KEYS.playerId);
      set({ user: null, myPlayers: [], player: null, shop: null, savedPlayer: null });
      get().toast('Đã đăng xuất');
      await get().goTitle();
    },

    async continuePlayer(playerId) {
      const p = await run(() => api.getPlayer(playerId));
      if (!p) return;
      setPlayer(p);
      await get().goMorning();
    },

    goChoose() {
      set({ screen: 'choose' });
    },

    async createPlayer(name, shopId, avatar) {
      storage.set(KEYS.name, name);
      const player = await run(() => api.createPlayer(name, shopId, avatar));
      if (!player) return;
      // Khách: nhớ quán trên máy này. Đã đăng nhập: quán lưu theo tài khoản.
      if (!get().user) storage.set(KEYS.playerId, player.id);
      setPlayer(player);
      get().toast(`Chúc mừng khai trương ${get().shop?.name ?? ''}! 🎉`, 'good');
      await get().goMorning();
    },

    async goMorning() {
      const { player } = get();
      if (!player) return;
      const fresh = await run(() => api.getPlayer(player.id));
      if (fresh) setPlayer(fresh);
      worldHost.get()?.startMorning();
      set({ screen: 'play', dayPhase: 'morning', panel: null, summary: null, cart: new Map() });
      void get().loadNotes();
      // giá chợ hôm nay: dùng cho bảng chợ và máy bay chở tin chợ
      void (async () => {
        const market = await run(() => api.market(player.id));
        if (market) {
          set({ market });
          syncWorld();
        }
      })();
    },

    interact(id) {
      const world = worldHost.get();
      const { player, dayPhase } = get();
      if (!world || !player) return;
      if (id === 'market') {
        world.enterMarket();
        void (async () => {
          const market = await run(() => api.market(player.id));
          if (market) set({ market });
        })();
      } else if (id === 'market-exit') {
        if (get().cart.size > 0)
          get().toast('Giỏ còn hàng chưa tính tiền. Ra quầy 🧾 trả tiền trước nhé!', 'bad');
        else world.goStreet();
      } else if (id === 'checkout') {
        set({ panel: { type: 'checkout' } });
      } else if (id.startsWith('stall:')) {
        set({ panel: { type: 'stall', section: id.slice('stall:'.length) as MarketSectionId } });
      } else if (id.startsWith('enter:')) {
        world.enterShop(id.slice('enter:'.length));
      } else if (id === 'door-out') {
        world.goStreet();
      } else if (id === 'owner') {
        const visiting = world.heroStatus().insideShop;
        if (visiting) set({ panel: { type: 'neighbor', shopId: visiting.id } });
      } else if (id === 'shelf') {
        if (shipmentUnits(player.shipments, 'carry') > 0) void get().stockCarried();
        else set({ panel: { type: 'pantry' } });
      } else if (id === 'stove') {
        if (dayPhase !== 'open') return set({ panel: { type: 'recipes' } });
        const r = world.kitchenAction();
        if (r === 'carrying')
          get().toast(`Tay đang cầm đồ rồi, mang ra ${style().seat} cho khách trước nhé!`);
        else if (r === 'none') set({ panel: { type: 'recipes' } });
      } else if (id === 'counter') {
        if (dayPhase === 'morning') set({ panel: { type: 'open-confirm' } });
        else
          get().toast(
            `Khách ngồi vào ${style().seat} sẽ giơ tay ✋: tới đó bấm E để ${style().takeOrder.toLowerCase()}!`,
          );
      } else if (id.startsWith('seat:')) {
        const r = world.seatAction(Number(id.slice('seat:'.length)));
        if (r === 'took') {
          const st = style();
          get().toast(
            `📝 Đã ${st.takeOrder.toLowerCase()}! Tới ${st.station} để ${st.make.toLowerCase()}.`,
            'good',
          );
        }
      }
    },

    closePanel() {
      set({ panel: null });
    },

    cartAdd(ingredientId, n) {
      set((st) => {
        const cart = new Map(st.cart);
        const v = Math.max(0, (cart.get(ingredientId) ?? 0) + n);
        if (v) cart.set(ingredientId, v);
        else cart.delete(ingredientId);
        return { cart };
      });
    },

    cartClear() {
      set({ cart: new Map() });
    },

    async buy(mode) {
      const { player, catalog, cart } = get();
      if (!player || !catalog || cart.size === 0) return false;
      const res = await run(() =>
        api.buy(
          player.id,
          [...cart].map(([id, qty]) => ({ id, qty })),
          mode,
        ),
      );
      if (!res) return false;
      setPlayer(res.player);
      if (mode === 'carry') {
        get().toast(`🧺 Đã mua ${formatMoney(res.spent)}. Gánh về quán và cất lên kệ nhé!`, 'good');
      } else {
        get().toast(
          `🛵 Đã đặt giao ${formatMoney(res.spent)} (phí ${formatMoney(res.shipment.fee)}). Xe đang chạy tới quán!`,
          'good',
        );
      }
      // Đánh dấu đã mua trên ghi chú đang ghim
      const pinned = get().notes.find((n) => n.pinned);
      if (pinned) {
        const items = pinned.items.map((it) =>
          it.ingredientId && (cart.get(it.ingredientId) ?? 0) >= (it.qty ?? 1) ? { ...it, done: true } : it,
        );
        if (items.some((it, i) => it.done !== pinned.items[i]?.done))
          void get().updateNote(pinned.id, { items });
      }
      set({ panel: null, cart: new Map() });
      return true;
    },

    async buyFurniture(itemId) {
      const { player, catalog } = get();
      if (!player || !catalog) return;
      const res = await run(() => api.buyFurniture(player.id, itemId));
      if (!res) return;
      setPlayer(res.player);
      const item = catalog.furniture.find((f) => f.id === itemId);
      const shopId = res.player.shopId;
      get().toast(`🪑 Thợ đã khiêng ${item ? furnitureName(item, shopId) : 'đồ'} về quán!`, 'good');
    },

    async buyAd(planId) {
      const { player, catalog } = get();
      if (!player || !catalog) return;
      const res = await run(() => api.buyAd(player.id, planId));
      if (!res) return;
      setPlayer(res.player);
      const plan = catalog.adPlans.find((p) => p.id === planId);
      get().toast(
        `${plan?.icon ?? '✈️'} Đã thuê ${plan?.name.toLowerCase() ?? 'máy bay'}: lên đèn là bay!`,
        'good',
      );
    },

    openNotes() {
      const { screen, cooking } = get();
      if (screen !== 'play' || cooking) return;
      set({ panel: { type: 'notes' } });
    },

    async loadNotes() {
      const { player } = get();
      if (!player) return;
      const notes = await api.notes(player.id).catch(() => null);
      if (notes) {
        set({ notes });
        syncWorld();
      }
    },

    async createNote(title, items, pinned) {
      const { player } = get();
      if (!player) return null;
      const note = await run(() => api.createNote(player.id, { title, items, pinned }));
      if (note) await get().loadNotes();
      return note;
    },

    async updateNote(noteId, patch) {
      const { player } = get();
      if (!player) return;
      // cập nhật ngay trên giao diện, rồi lưu lên server
      set((st) => ({
        notes: st.notes.map((n) =>
          n.id === noteId ? { ...n, ...patch } : patch.pinned ? { ...n, pinned: false } : n,
        ),
      }));
      syncWorld();
      const saved = await run(() => api.updateNote(player.id, noteId, patch));
      if (!saved) await get().loadNotes();
    },

    async deleteNote(noteId) {
      const { player } = get();
      if (!player) return;
      set((st) => ({ notes: st.notes.filter((n) => n.id !== noteId) }));
      await run(() => api.deleteNote(player.id, noteId));
      syncWorld();
    },

    toggleNoteItem(noteId, index) {
      const note = get().notes.find((n) => n.id === noteId);
      if (!note) return;
      const items = note.items.map((it, i) => (i === index ? { ...it, done: !it.done } : it));
      void get().updateNote(noteId, { items });
    },

    fillCartFromNote(noteId, section) {
      const { notes, ingredients } = get();
      const note = notes.find((n) => n.id === noteId);
      if (!note) return 0;
      let added = 0;
      for (const it of note.items) {
        if (it.done || !it.ingredientId) continue;
        if (section && ingredients.get(it.ingredientId)?.section !== section) continue;
        const have = get().cart.get(it.ingredientId) ?? 0;
        const want = it.qty ?? 1;
        if (have < want) {
          get().cartAdd(it.ingredientId, want - have);
          added += 1;
        }
      }
      return added;
    },

    async stockCarried() {
      const { player } = get();
      if (!player) return;
      const res = await run(() => api.receive(player.id, { mode: 'carry' }));
      if (!res) return;
      setPlayer(res.player);
      const units = res.received.reduce((a, i) => a + i.qty, 0);
      worldHost.get()?.addFloat(`📦 +${units} phần`, '#9ef0c0');
      get().toast(`Đã cất ${units} phần hàng lên kệ 📦`, 'good');
    },

    async deliveryArrived(shipmentId) {
      const { player } = get();
      if (!player || !player.shipments.some((s) => s.id === shipmentId)) return;
      const res = await run(() => api.receive(player.id, { shipmentId }));
      if (!res) return;
      setPlayer(res.player);
      get().toast('🛵 Xe ba gác đã giao hàng tới quán, hàng đã lên kệ!', 'good');
    },

    openShop() {
      const { player, shop, catalog } = get();
      const world = worldHost.get();
      if (!player || !shop || !catalog || !world) return;
      if (!learnedRecipes(player, shop).some((r) => canMake(r, player))) {
        get().toast('Kệ chưa đủ nguyên liệu cho món nào cả! Ra chợ mua và cất lên kệ trước.', 'bad');
        return;
      }
      world.startDay({
        dayLen: catalog.rules.dayLengthSec,
        spawnInterval: spawnInterval(player, shop),
        maxQueue: catalog.rules.maxQueue,
        makeCustomer,
      });
      set({ dayPhase: 'open', panel: null });
      const st = style();
      get().toast(
        `🏮 Lên đèn! Khách vào ${st.seat} thì ${st.takeOrder.toLowerCase()}, ${st.make.toLowerCase()} ở ${st.station}, rồi ${st.serve.toLowerCase()} ra.`,
        'good',
      );
    },

    canAccept(recipe) {
      const { player } = get();
      const world = worldHost.get();
      if (!player) return false;
      // trừ nguyên liệu của các order đang làm dở
      const left: Record<string, number> = { ...player.pantry };
      for (const o of world?.service.activeOrders() ?? []) {
        for (const i of o.recipe.ingredients) left[i.id] = (left[i.id] ?? 0) - i.qty;
      }
      return portionsAvailable(recipe, left) > 0;
    },

    startCooking(order, diner) {
      const world = worldHost.get();
      if (!world || get().cooking) return;
      world.paused = true;
      set({
        cooking: {
          key: order.id,
          orderId: order.id,
          recipe: order.recipe,
          customerName: diner.typeName,
          table: Math.floor(order.seat / 2) + 1,
        },
      });
    },

    async finishCooking(quality) {
      const { cooking } = get();
      const world = worldHost.get();
      if (!cooking) return;
      world?.service.heroCookDone(cooking.orderId, quality);
      set({ cooking: { ...cooking, done: { quality } } });
      await sleep(1000);
      set({ cooking: null });
      if (world) world.paused = false;
    },

    async deliverDish(order, diner) {
      const { player } = get();
      const world = worldHost.get();
      if (!player) return;
      try {
        const res = await api.serve(player.id, {
          recipeId: order.recipe.id,
          quality: order.quality ?? 0.5,
          customerType: diner.type,
          cookedBy: order.cookedBy ?? 'player',
        });
        setPlayer(res.player);
        world?.service.setMood(diner.id, res.stars >= 3 ? '😍' : res.stars >= 2 ? '🙂' : '😕');
        world?.addFloat(
          `+${formatMoney(res.pay)}${res.repDelta > 0 ? ` +${res.repDelta}⭐` : ''}`,
          '#ffd166',
          'shop',
        );
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(String(e), 0);
        get().toast(err.message, 'bad');
        world?.service.setMood(diner.id, '😕');
        if (err.offline) set({ screen: 'offline' });
      }
    },

    async customerLeft(message) {
      const { player } = get();
      if (!player) return;
      get().toast(message, 'bad');
      worldHost.get()?.addFloat('-1⭐', '#ff6b6b', 'shop');
      const res = await run(() => api.miss(player.id));
      if (res) setPlayer(res.player);
    },

    async hireStaff(role) {
      const { player } = get();
      if (!player) return;
      const res = await run(() => api.hireStaff(player.id, role));
      if (!res) return;
      setPlayer(res.player);
      const hired = res.player.staff[res.player.staff.length - 1];
      get().toast(
        `${STAFF_ROLES[role].icon} ${hired?.name ?? ''} đã vào làm ${STAFF_ROLES[role].title.toLowerCase()}!`,
        'good',
      );
    },

    async fireStaff(staffId) {
      const { player } = get();
      if (!player) return;
      const res = await run(() => api.fireStaff(player.id, staffId));
      if (res) setPlayer(res.player);
    },

    async endDay() {
      const { player } = get();
      if (!player) return;
      worldHost.get()?.setNight();
      const res = await run(() => api.endDay(player.id));
      if (!res) return;
      setPlayer(res.player);
      set({ summary: res.summary, screen: 'night', panel: null });
    },

    async learn(recipeId) {
      const { player, shop } = get();
      if (!player) return;
      const res = await run(() => api.learn(player.id, recipeId));
      if (!res) return;
      setPlayer(res.player);
      get().toast(`Đã học món ${shop?.recipes.find((r) => r.id === recipeId)?.name ?? ''}! 📖`, 'good');
    },

    async upgrade(type) {
      const { player } = get();
      if (!player) return;
      const res = await run(() => api.upgrade(player.id, type));
      if (!res) return;
      setPlayer(res.player);
      get().toast('Nâng cấp xong! 🔨', 'good');
    },

    menu() {
      const { screen, cooking, dayPhase } = get();
      if (cooking) return;
      if (screen === 'play' && dayPhase === 'open') {
        get().toast('Đang bán hàng, đợi đóng cửa rồi hãy về menu nhé!');
        return;
      }
      void get().goTitle();
    },
  };
});

/**
 * Tin cho máy bay băng rôn: món giảm / tăng giá mạnh nhất ở chợ hôm nay (lệch ≥ 10% so với giá gốc)
 * cùng lời rao của các khu trong chợ.
 */
export function skyNews(
  market: Market | null,
  ingredients: ReadonlyMap<string, Ingredient>,
  sections: readonly { icon: string; name: string; call: string }[],
): string[] {
  const news: string[] = [];
  if (market && market.day > 0) {
    const moves = market.items
      .map((it) => ({ it, pct: Math.round(((it.price - it.basePrice) / it.basePrice) * 100) }))
      .filter((m) => Math.abs(m.pct) >= 10)
      .sort((a, b) => a.pct - b.pct);
    for (const { it, pct } of moves.slice(0, 3)) {
      const ing = ingredients.get(it.id);
      if (ing && pct < 0) news.push(`🛒 Chợ hôm nay: ${ing.icon} ${ing.name} giảm ${-pct}%!`);
    }
    const up = moves.at(-1);
    const upIng = up && up.pct > 0 ? ingredients.get(up.it.id) : undefined;
    if (up && upIng) news.push(`📈 ${upIng.icon} ${upIng.name} lên giá ${up.pct}%, mua vừa thôi!`);
  }
  for (const s of sections) news.push(`${s.icon} ${s.name}: ${s.call}`);
  return news;
}

/** Đồng bộ dữ liệu người chơi sang thế giới canvas (gọi sau mỗi thay đổi & khi canvas mount). */
export function syncWorld() {
  const world = worldHost.get();
  if (!world) return;
  const { player, shop, ingredients, catalog } = useGame.getState();
  if (!player || !shop || !catalog) {
    world.setInfo(null);
    return;
  }
  const { notes } = useGame.getState();
  const pinned = notes.find((n) => n.pinned);
  const noteSections = pinned
    ? [
        ...new Set(
          pinned.items
            .filter((it) => !it.done && it.ingredientId)
            .map((it) => ingredients.get(it.ingredientId!)?.section)
            .filter((x): x is MarketSectionId => !!x),
        ),
      ]
    : [];
  // cụm chỗ ngồi theo thứ tự: chỗ thường trước, chỗ sang sau; đồ trang trí đếm theo vai để World vẽ
  const own = furnitureFor(shop.interior);
  const countRole = (role: FurnitureRole) =>
    own.filter((f) => f.role === role).reduce((a, f) => a + (player.furniture[f.id] ?? 0), 0);
  const tables: ('basic' | 'plus')[] = [
    ...Array<'basic'>(countRole('seat')).fill('basic'),
    ...Array<'plus'>(countRole('seat_plus')).fill('plus'),
  ];
  const decorRoles: Partial<Record<FurnitureRole, number>> = {};
  for (const role of ['cool', 'plant', 'art', 'light', 'music'] as const) decorRoles[role] = countRole(role);
  world.setInfo({
    marketSections: catalog.marketSections.map((sec) => ({
      ...sec,
      goods:
        sec.id === 'noithat'
          ? own.map((f) => f.icon)
          : catalog.ingredients.filter((i) => i.section === sec.id).map((i) => i.icon),
    })),
    tables,
    decorRoles,
    interior: shop.interior,
    furniture: player.furniture,
    noteSections,
    staff: player.staff,
    cookSkill: STAFF_ROLES.cook.skill ?? 0.68,
    shops: catalog.shops,
    regions: catalog.regions,
    ownShopId: shop.id,
    menu: learnedRecipes(player, shop),
    sky: {
      adFlights: adPlanOf(player)?.flights ?? 0,
      news: skyNews(useGame.getState().market, ingredients, catalog.marketSections),
    },
    decor: player.decor,
    shopLevel: player.shopLevel,
    avatar: player.avatar,
    name: player.name,
    carrying: shipmentUnits(player.shipments, 'carry'),
    pantry: Object.entries(player.pantry)
      .filter(([, q]) => q > 0)
      .sort((a, b) => b[1] - a[1])
      .flatMap(([id, qty]) => {
        const ingredient = ingredients.get(id);
        return ingredient ? [{ ingredient, qty }] : [];
      }),
  });
  for (const sh of player.shipments) {
    if (sh.mode === 'delivery') world.addDelivery(sh.id, catalog.rules.deliverySeconds);
  }
}
