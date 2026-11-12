// Thế giới game: con phố dài với đủ 20 quán chia 4 khu (camera đi theo nhân vật), chợ đầu mối,
// bên trong từng quán (quán mình & quán hàng xóm), khách hàng, bàn ghế và xe ba gác giao hàng.
import {
  clamp,
  interiorStyle,
  priceMultiplier,
  seatName,
  type Avatar,
  type FurnitureRole,
  type InteriorKind,
  type InteriorStyle,
  type CustomerTypeId,
  type Ingredient,
  type MarketSection,
  type Recipe,
  type Region,
  type Shop,
} from '@pdl/shared';
import { drawAvatar, mix, rr } from './draw';
import {
  drawDecor,
  drawRoom,
  drawSeat,
  drawSeatTable,
  drawStation,
  drawWaterStage,
  type Room,
} from './interiorArt';
import { DineService, type Diner, type Order } from './service';

/**
 * Kích thước khung nhìn logic. H cố định 540; W co giãn theo tỉ lệ màn hình
 * (màn rộng thấy thêm phố). Đổi qua `World.resize()`; mọi module import W đều thấy giá trị mới.
 */
export let W = 960;
export const H = 540;
/** Giới hạn bề rộng logic: hẹp hơn thì vừa theo chiều ngang (viền trên/dưới), rộng hơn thì viền hai bên. */
export const MIN_W = 720;
export const MAX_W = 1500;

// ----- Bố cục con phố -----
const SIDEWALK_Y = 380;
const ROAD_Y = 450;
const CUSTOMER_FEET = 428;
const HERO_FEET_STREET = 440;
export const MARKET_X = 300;
const FIRST_X = 760;
const GATE_GAP = 220;
const SHOP_SPACING = 330;
const SHOP_W = 300;

// ----- Bố cục bên trong quán (rộng hơn màn hình, camera đi theo) -----
export const INSIDE_W = 1500;
const HERO_FEET_INSIDE = 482;
const FLOOR_Y = 400;
export const INSIDE = {
  door: 90,
  shelf: 300,
  stove: 540,
  tablesStart: 760,
  tableSpacing: 150,
  pass: 680,
  board: 1040,
  counter: 1330,
} as const;
// ----- Bên trong chợ đầu mối -----
export const MARKET_W = 2500;
const MARKET_FLOOR = 400;
const MARKET_GATE_X = 90;
const MARKET_CHECKOUT_X = 290;
const MARKET_FIRST_STALL = 560;
const MARKET_STALL_SPACING = 260;

const NEIGHBOR_INSIDE = { tablesStart: 330, board: 1010, counter: 1300 } as const;
const ROOM: Room = { w: INSIDE_W, floor: FLOOR_Y, h: H };

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#ffdbac', '#8d5524'];
const SHIRTS = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#8338ec', '#ff006e', '#3a86ff', '#6a994e'];
const HAIR = ['#2b2118', '#3d2b1f', '#111111', '#5a3825'];
const BIKES = ['#e63946', '#1d3557', '#f1faee', '#ffb703', '#2a9d8f', '#8d99ae'];
const MARKET_GOODS = ['🥬', '🥩', '🐟', '🍋', '🌶️', '🥚', '🧅', '🥥', '🍚', '🦐', '🧵', '🎨'];
const EAT_SECONDS = 10;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

/** Số ngẫu nhiên ổn định theo chuỗi (để quán hàng xóm lúc nào cũng giống nhau). */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export type SceneId = 'street' | 'inside' | 'market';
export type DayPhase = 'morning' | 'open' | 'closing' | 'night';
export type InteractId =
  | 'market'
  | 'market-exit'
  | 'checkout'
  | 'door-out'
  | 'shelf'
  | 'stove'
  | 'counter'
  | 'owner'
  | `enter:${string}`
  | `stall:${string}`
  | `seat:${number}`;

export interface CustomerInfo {
  type: CustomerTypeId;
  typeName: string;
  recipe: Recipe;
  patience: number;
}

interface Person {
  x: number;
  y: number;
  bob: number;
  skin: string;
  shirt: string;
  hair: string;
  walking: boolean;
}

/** Khách trên phố: đang đi tới cửa quán hoặc đang ra về. */
export interface Customer extends CustomerInfo, Person {
  id: number;
  state: 'walking' | 'leaving';
  speed: number;
  dir: number;
  mood?: string;
}

interface Walker extends Person {
  dir: number;
  speed: number;
}

interface Bike {
  x: number;
  y: number;
  dir: number;
  speed: number;
  color: string;
  helmet: string;
}

/** Máy bay kéo băng rôn bay ngang trời trên phố. */
interface Plane {
  /** Toạ độ trong "không gian trời" (cuộn chậm hơn phố: hiện ra ở x − camX × PLANE_PARALLAX) */
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  text: string;
  kind: 'own' | 'neighbor' | 'news';
  phase: number;
}

/** Nội dung bầu trời: quảng cáo quán mình + tin chợ trong ngày. */
export interface SkyInfo {
  /** Gói quảng cáo hôm nay: số vòng bay (0 = không thuê) */
  adFlights: number;
  /** Các câu tin chợ, ví dụ "🛒 Chợ hôm nay: Thịt bò giảm 15%!" */
  news: string[];
}

const PLANE_PARALLAX = 0.2;
/** Độ cao bay (toạ độ logic): băng rôn không đè lên dây đèn lồng và mái quán */
const PLANE_Y_OWN = 52;
const PLANE_Y_AMBIENT: [number, number] = [22, 28];
/** Máy bay trang trí (hàng xóm / tin chợ): mỗi chiếc cách nhau 25–40 giây */
const AMBIENT_PLANE_GAP: [number, number] = [25, 40];
const NEIGHBOR_SLOGANS = [
  '{icon} {shop}: {dish} ngon khó cưỡng!',
  '{icon} Ghé {shop} thử {dish} nhé!',
  '{icon} {shop} mời cả phố: {dish}!',
  '{icon} {dish} nóng hổi tại {shop}',
];

interface FloatText {
  where: string;
  text: string;
  color: string;
  x: number;
  y: number;
  life: number;
}

interface Delivery {
  id: string;
  t: number;
  dur: number;
  arrived: boolean;
}

interface Interactable {
  id: InteractId;
  x: number;
  range: number;
  label: string;
}

interface ShopSlot {
  shop: Shop;
  x: number;
  own: boolean;
}

interface GateSlot {
  region: Region;
  x: number;
}

interface NpcDiner extends Person {
  seat: number;
  icon: string;
}

export interface WorldHooks {
  onInteract?: (id: InteractId) => void;
  /** Khách bỏ về (trừ danh tiếng) */
  onAngry?: (message: string) => void;
  /** Kệ còn đủ nguyên liệu cho món (đã trừ các order đang làm) */
  canAccept?: (recipe: Recipe) => boolean;
  /** Chủ quán đứng bếp nấu một order */
  onRequestCook?: (order: Order, diner: Diner) => void;
  /** Món đã tới bàn khách: tính tiền */
  onDeliver?: (order: Order, diner: Diner) => void;
  onEvent?: (text: string) => void;
  onDayOver?: () => void;
  onDeliveryArrived?: (shipmentId: string) => void;
}

export interface SceneInfo {
  shops: Shop[];
  regions: Region[];
  ownShopId: string;
  decor: number;
  shopLevel: number;
  avatar: Avatar;
  name: string;
  /** Số phần hàng đang gánh */
  carrying: number;
  /** Kho hàng để vẽ lên kệ */
  pantry: { ingredient: Ingredient; qty: number }[];
  /** Món đã học, để ghi lên bảng thực đơn */
  menu: Recipe[];
  /** Các khu trong chợ + biểu tượng hàng bày ở mỗi khu */
  marketSections: (MarketSection & { goods: string[] })[];
  /** Cụm chỗ ngồi theo thứ tự: chỗ thường / chỗ sang */
  tables: ('basic' | 'plus')[];
  /** Số đồ trang trí theo vai (mát, cây, tranh, đèn, nhạc) */
  decorRoles: Partial<Record<FurnitureRole, number>>;
  /** Kiểu bên trong quán của người chơi */
  interior: InteriorKind;
  furniture: Record<string, number>;
  /** Mục ghi chú ghim theo khu (để hiện dấu ⭐ trên sạp) */
  noteSections?: string[];
  /** Nhân viên đang thuê */
  staff: { id: string; role: 'waiter' | 'cook'; name: string }[];
  cookSkill: number;
  /** Máy bay quảng cáo & tin chợ */
  sky?: SkyInfo;
}

export interface DayOptions {
  dayLen: number;
  spawnInterval: number;
  maxQueue: number;
  makeCustomer: () => CustomerInfo | null;
}

export interface HeroStatus {
  scene: SceneId;
  /** Quán đang đứng bên trong (nếu có) */
  insideShop: Shop | null;
  insideOwn: boolean;
  inMarket: boolean;
  near: InteractId | null;
  atCounter: boolean;
  /** Có khách đang cần phục vụ (chờ chỗ, chờ gọi món, chờ món) */
  frontWaiting: boolean;
  queueLength: number;
  freeSeats: number;
  /** Khách ngồi giơ tay chờ gọi món */
  wantOrder: number;
  /** Order chưa ai nấu */
  toCook: number;
  /** Món đã nấu xong chờ bưng */
  readyDishes: number;
  /** Món chủ quán đang bưng */
  carryingDish: { icon: string; name: string; table: number } | null;
  atStove: boolean;
  /** Quán xa chợ: nên đi xe buýt. Luôn false cho tới khi có xe buýt (design/gdd/bus.md, chưa làm) */
  farFromMarket: boolean;
  /** Đang ở xa quán mình (ở chợ hoặc cuối phố bên kia). Luôn false cho tới khi có xe buýt */
  farFromShop: boolean;
}

export class World {
  private ctx: CanvasRenderingContext2D;
  private info: SceneInfo | null = null;
  private slots: ShopSlot[] = [];
  private gates: GateSlot[] = [];
  private worldW = 2000;
  private ownX = 1480;
  phase: DayPhase = 'night';
  paused = false;
  private inputEnabled = false;
  private time = 0;
  private t = 0;
  private day: DayOptions | null = null;
  private spawnIn = 0;
  /** Khách trên phố (đi tới cửa quán / ra về) */
  private customers: Customer[] = [];
  /** Phục vụ trong quán */
  readonly service: DineService;
  private walkers: Walker[] = [];
  private bikes: Bike[] = [];
  private floats: FloatText[] = [];
  private deliveries: Delivery[] = [];
  private diners = new Map<string, NpcDiner[]>();
  private bikeIn = 1;
  private walkerIn = 1;
  private uid = 0;
  private raf = 0;
  private fade = 0;
  private camX = 0;
  /** Pixel thật / đơn vị logic (gồm devicePixelRatio) */
  private pxScale = 1;

  // máy bay trên trời
  private planes: Plane[] = [];
  private planeIn = 6;
  /** Số vòng máy bay quảng cáo của quán mình đã bay hôm nay */
  private adFlown = 0;
  private newsIdx = 0;

  // nhân vật
  private scene: SceneId = 'street';
  private insideShopId: string | null = null;
  private heroX = 1480;
  private facing: 1 | -1 = 1;
  private heroWalking = false;
  private stepPhase = 0;
  private keys = new Set<string>();
  private virtualMove = 0;
  private targetX: number | null = null;
  private pendingInteract: InteractId | null = null;

  private readonly skyline = Array.from({ length: 40 }, (_, i) => ({
    x: i * 58 - 20,
    w: rand(50, 90),
    h: rand(60, 150),
  }));
  /** x là tỉ lệ 0..1 theo bề rộng khung nhìn (W thay đổi khi đổi cỡ màn hình) */
  private readonly stars = Array.from({ length: 110 }, () => ({
    x: rand(0, 1),
    y: rand(0, 200),
    r: rand(0.5, 1.6),
    p: rand(0, 6),
  }));
  private readonly vendors = [
    { x: 150, shirt: '#6a994e', skin: '#e0ac69' },
    { x: 300, shirt: '#bc6c25', skin: '#c68642' },
    { x: 450, shirt: '#9b2226', skin: '#f1c27d' },
  ];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hooks: WorldHooks = {},
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D không khả dụng');
    this.ctx = ctx;
    this.service = new DineService(
      {
        doorX: INSIDE.door + 30,
        stoveX: INSIDE.stove,
        passX: INSIDE.pass,
        homeX: INSIDE.pass + 60,
        seatX: (seat) =>
          INSIDE.tablesStart + Math.floor(seat / 2) * INSIDE.tableSpacing + (seat % 2 ? 34 : -34),
        queueX: (i) => INSIDE.door + 90 + i * 34,
      },
      {
        canAccept: (r) => this.hooks.canAccept?.(r) ?? true,
        onAngry: (_d, msg) => this.hooks.onAngry?.(msg),
        onDeliver: (o, d) => this.hooks.onDeliver?.(o, d),
        onExit: (d) => this.customerExits(d),
        onEvent: (t) => this.hooks.onEvent?.(t),
      },
      {
        seats: 2,
        maxQueue: 5,
        eatSeconds: EAT_SECONDS,
        cookSkill: 0.68,
        cookSeconds: 7,
        style: interiorStyle('an'),
      },
    );
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearKeys);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.time += dt;
      if (!this.paused) this.update(dt);
      this.ctx.setTransform(this.pxScale, 0, 0, this.pxScale, 0, 0);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearKeys);
  }

  /**
   * Co giãn theo khung chứa (px CSS). Chiều cao logic giữ 540, bề rộng logic theo tỉ lệ khung,
   * kẹp trong [MIN_W, MAX_W]. Trả về kích thước CSS canvas nên hiển thị (vừa khít, giữ tỉ lệ).
   */
  resize(boxW: number, boxH: number, dpr = window.devicePixelRatio || 1): { width: number; height: number } {
    if (boxW <= 0 || boxH <= 0) return { width: boxW, height: boxH };
    W = Math.round(clamp((H * boxW) / boxH, MIN_W, MAX_W));
    const fit = Math.min(boxW / W, boxH / H);
    const width = Math.floor(W * fit);
    const height = Math.floor(H * fit);
    const ratio = Math.min(dpr, 2.5);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.pxScale = this.canvas.width / W;
    this.camX = clamp(this.camX, 0, Math.max(0, this.sceneWidth() - W));
    return { width, height };
  }

  // ================= Điều khiển =================
  setInputEnabled(enabled: boolean) {
    this.inputEnabled = enabled;
    if (!enabled) this.clearKeys();
  }

  private clearKeys = () => {
    this.keys.clear();
    this.virtualMove = 0;
  };

  /** Nút ◀ ▶ trên màn hình: -1, 0, 1 */
  setVirtualMove(dir: number) {
    this.virtualMove = this.inputEnabled ? dir : 0;
    if (dir !== 0) this.targetX = null;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.inputEnabled || e.target instanceof HTMLInputElement) return;
    const k = e.code;
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(k)) {
      e.preventDefault();
      this.keys.add(k);
      if (!k.startsWith('Shift')) {
        this.targetX = null;
        this.pendingInteract = null;
      }
    } else if (['KeyE', 'ArrowUp', 'KeyW', 'Space', 'Enter'].includes(k)) {
      e.preventDefault();
      if (!e.repeat) this.interact();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private toWorld(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const sy = ((e.clientY - r.top) / r.height) * H;
    return { x: sx + this.camX, y: sy };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.inputEnabled) return;
    const p = this.toWorld(e);
    const hit = this.interactables().find(
      (it) => Math.abs(p.x - it.x) < Math.min(it.range, 150) && p.y < 470,
    );
    this.targetX = hit ? hit.x : p.x;
    this.pendingInteract = hit ? hit.id : null;
  };

  /** Tương tác với điểm gần nhất (phím E / nút E). */
  interact() {
    if (!this.inputEnabled) return;
    const near = this.nearest();
    if (near) this.hooks.onInteract?.(near.id);
  }

  // ================= Bố cục & cảnh =================
  setInfo(info: SceneInfo | null) {
    const relayout = !this.info || !info || this.info.ownShopId !== info.ownShopId || this.slots.length === 0;
    this.info = info;
    if (info && relayout) this.layout(info);
    if (info) {
      this.service.config.seats = Math.max(1, info.tables.length) * 2;
      this.service.config.cookSkill = info.cookSkill;
      this.service.config.style = interiorStyle(info.interior);
      this.service.setStaff(info.staff, (i) => ({
        bob: i,
        skin: SKIN[(i + 2) % SKIN.length]!,
        shirt: '#264653',
        hair: HAIR[i % HAIR.length]!,
      }));
    }
  }

  /** Xếp 20 quán dọc phố theo 4 khu, mỗi khu có cổng chào. */
  private layout(info: SceneInfo) {
    this.slots = [];
    this.gates = [];
    let cursor = FIRST_X;
    for (const region of info.regions) {
      const shops = info.shops.filter((s) => s.region === region.id);
      if (shops.length === 0) continue;
      this.gates.push({ region, x: cursor + GATE_GAP / 2 - 20 });
      cursor += GATE_GAP;
      for (const shop of shops) {
        const x = cursor + SHOP_SPACING / 2;
        this.slots.push({ shop, x, own: shop.id === info.ownShopId });
        cursor += SHOP_SPACING;
      }
    }
    this.worldW = cursor + 120;
    this.ownX = this.slots.find((s) => s.own)?.x ?? FIRST_X;
  }

  private sceneWidth() {
    return this.scene === 'street' ? this.worldW : this.scene === 'market' ? MARKET_W : INSIDE_W;
  }

  private get insideShop(): Shop | null {
    return this.slots.find((s) => s.shop.id === this.insideShopId)?.shop ?? null;
  }

  private get insideOwn() {
    return this.scene === 'inside' && this.insideShopId === this.info?.ownShopId;
  }

  /** Ra phố, đứng trước cửa quán vừa ra (hoặc vị trí x). */
  goStreet(x?: number) {
    const from = this.slots.find((s) => s.shop.id === this.insideShopId);
    const fromMarket = this.scene === 'market';
    this.scene = 'street';
    this.insideShopId = null;
    this.heroX = x ?? (fromMarket ? MARKET_X : (from?.x ?? this.ownX));
    this.afterSceneChange();
  }

  /** Vào bên trong chợ đầu mối. */
  enterMarket() {
    this.scene = 'market';
    this.insideShopId = null;
    this.heroX = MARKET_GATE_X + 70;
    this.facing = 1;
    this.walkers = [];
    this.afterSceneChange();
  }

  /** Vào bên trong một quán (của mình hoặc hàng xóm). */
  enterShop(shopId: string, x: number = INSIDE.door + 50) {
    this.scene = 'inside';
    this.insideShopId = shopId;
    this.heroX = x;
    this.facing = 1;
    if (shopId !== this.info?.ownShopId) this.ensureDiners(shopId);
    this.afterSceneChange();
  }

  private afterSceneChange() {
    this.targetX = null;
    this.pendingInteract = null;
    this.fade = 1;
    this.camX = clamp(this.heroX - W / 2, 0, this.sceneWidth() - W);
  }

  heroStatus(): HeroStatus {
    const near = this.nearest();
    return {
      scene: this.scene,
      insideShop: this.scene === 'inside' ? this.insideShop : null,
      insideOwn: this.insideOwn,
      near: near?.id ?? null,
      atCounter: this.insideOwn && Math.abs(this.heroX - INSIDE.counter) < 130,
      frontWaiting: this.needsAttention(),
      queueLength: this.service.queueCount(),
      freeSeats: this.service.freeSeats().length,
      inMarket: this.scene === 'market',
      wantOrder: this.service.diners.filter((d) => d.state === 'seated').length,
      toCook: this.service.orders.filter((o) => o.status === 'queued').length,
      readyDishes: this.service.readyOnPass().length,
      carryingDish: (() => {
        const o = this.service.carriedOrder();
        return o ? { icon: o.recipe.icon, name: o.recipe.name, table: Math.floor(o.seat / 2) + 1 } : null;
      })(),
      atStove: this.insideOwn && Math.abs(this.heroX - INSIDE.stove) < 110,
      // TODO(xe buýt): bật khi đã có trạm xe buýt, để gợi ý không chỉ tới trạm chưa tồn tại
      farFromMarket: false,
      farFromShop: false,
    };
  }

  /** Buổi sáng: dọn khách, bắt đầu trong quán mình. */
  startMorning() {
    this.phase = 'morning';
    this.day = null;
    this.customers = [];
    this.service.reset();
    this.paused = false;
    this.diners.clear();
    if (this.info) this.enterShop(this.info.ownShopId, INSIDE.shelf);
  }

  startDay(opts: DayOptions) {
    this.phase = 'open';
    this.day = opts;
    this.t = 0;
    this.adFlown = 0;
    this.spawnIn = 1.5;
    this.customers = [];
    this.service.reset();
    this.service.config.maxQueue = opts.maxQueue;
    this.paused = false;
    this.diners.clear();
    if (this.insideShopId && !this.insideOwn) this.ensureDiners(this.insideShopId);
  }

  setNight() {
    this.phase = 'night';
    this.day = null;
  }

  clockText(): string {
    if (this.phase === 'morning') return '07:00';
    if (this.phase === 'night' || !this.day) return '23:00';
    const mins = 17 * 60 + Math.min(1, this.t / this.day.dayLen) * 6 * 60;
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
  }

  /** Có khách trong quán cần chủ quán/nhân viên để ý */
  needsAttention() {
    return this.service.diners.some(
      (d) => d.state === 'queue' || d.state === 'seated' || d.state === 'ordered',
    );
  }

  private leave(c: Customer, mood: string) {
    c.state = 'leaving';
    c.mood = mood;
    c.dir = c.x < this.ownX ? -1 : 1;
    c.speed = 120;
  }

  /** Khách đi ra khỏi cửa quán: hiện lại trên phố rồi đi về. */
  private customerExits(d: Diner) {
    this.customers.push({
      ...d,
      id: d.id,
      x: this.ownX,
      y: CUSTOMER_FEET + rand(-3, 3),
      state: 'leaving',
      speed: 120,
      dir: Math.random() < 0.5 ? -1 : 1,
      mood: d.mood,
      walking: true,
    });
  }

  private tableCount() {
    return Math.max(1, this.info?.tables.length ?? 1);
  }

  /** Bấm E ở bếp: lấy món đã nấu xong, hoặc nấu order tiếp theo. */
  kitchenAction(): 'picked' | 'cook' | 'carrying' | 'none' {
    const sv = this.service;
    if (sv.heroCarrying !== null) return 'carrying';
    const ready = sv.readyOnPass()[0];
    if (ready && sv.heroPickUp(ready.id)) {
      const st = this.service.config.style;
      this.addFloat(
        `${ready.recipe.icon} ${st.serve} ra ${seatName(st, Math.floor(ready.seat / 2) + 1).toLowerCase()}`,
        '#ffd166',
      );
      return 'picked';
    }
    const next = sv.nextToCook();
    if (next) {
      const diner = sv.diners.find((d) => d.id === next.dinerId);
      if (diner && sv.heroStartCook(next.id)) {
        this.hooks.onRequestCook?.(next, diner);
        return 'cook';
      }
    }
    return 'none';
  }

  /** Bấm E ở bàn: nhận order hoặc đưa món. */
  seatAction(seat: number): 'took' | 'served' | 'out' | 'none' {
    const sv = this.service;
    const carried = sv.carriedOrder();
    if (carried && carried.seat === seat) return sv.deliver(seat, 'hero') ? 'served' : 'none';
    const r = sv.takeOrder(seat, 'hero');
    return r === 'ok' ? 'took' : r === 'out' ? 'out' : 'none';
  }

  addFloat(text: string, color: string, where: 'hero' | 'shop' = 'hero') {
    const inOwn = this.insideOwn;
    const x =
      where === 'hero' ? this.heroX : inOwn ? this.heroX : this.scene === 'street' ? this.ownX : this.heroX;
    const y = (this.scene === 'street' ? HERO_FEET_STREET : HERO_FEET_INSIDE) - 120;
    this.floats.push({ where: this.whereKey(), text, color, x, y, life: 1.5 });
  }

  private whereKey() {
    return this.scene === 'inside' ? `inside:${this.insideShopId}` : this.scene;
  }

  addDelivery(id: string, dur: number) {
    if (this.deliveries.some((d) => d.id === id)) return;
    this.deliveries.push({ id, t: 0, dur, arrived: false });
  }

  // ================= Điểm tương tác =================
  private interactables(): Interactable[] {
    const info = this.info;
    if (!info) return [];
    if (this.scene === 'street') {
      return [
        { id: 'market', x: MARKET_X, range: 260, label: 'Vào chợ đầu mối' },
        ...this.slots.map((s) => ({
          id: `enter:${s.shop.id}` as InteractId,
          x: s.x,
          range: 120,
          label: s.own ? `Vào quán của bạn` : `Ghé ${s.shop.name}`,
        })),
      ];
    }
    if (this.scene === 'market') {
      return [
        { id: 'market-exit', x: MARKET_GATE_X, range: 80, label: 'Ra khỏi chợ' },
        { id: 'checkout', x: MARKET_CHECKOUT_X, range: 110, label: 'Tính tiền & chọn gánh / gọi xe' },
        ...info.marketSections.map((sec, i) => ({
          id: `stall:${sec.id}` as InteractId,
          x: MARKET_FIRST_STALL + i * MARKET_STALL_SPACING,
          range: 120,
          label: `Xem ${sec.name.toLowerCase()}`,
        })),
      ];
    }
    if (!this.insideOwn) {
      return [
        { id: 'door-out', x: INSIDE.door, range: 90, label: 'Ra phố' },
        { id: 'owner', x: NEIGHBOR_INSIDE.counter, range: 150, label: 'Trò chuyện với chủ quán' },
      ];
    }
    const st = this.service.config.style;
    const counterLabel =
      this.phase === 'morning' ? 'Mở cửa đón khách' : st.id === 'sankhau' ? 'Quầy vé' : 'Quầy thu ngân';
    const sv = this.service;
    const seatOf = (seat: number) => seatName(st, Math.floor(seat / 2) + 1).toLowerCase();
    const carried = sv.carriedOrder();
    const ready = sv.readyOnPass()[0];
    const next = sv.nextToCook();
    const stoveLabel = carried
      ? `Đang ${st.serve.toLowerCase()} ${carried.recipe.name}: mang ra ${seatOf(carried.seat)}`
      : ready
        ? `${st.serve} ${ready.recipe.name} ra ${seatOf(ready.seat)}`
        : next
          ? `${st.make} ${next.recipe.name} (${seatOf(next.seat)})`
          : `${st.station}: chưa có ${st.order} · xem sổ công thức`;
    const seatSpots: Interactable[] = [];
    for (const d of sv.diners) {
      if (d.seat === undefined) continue;
      if (d.state === 'seated') {
        seatSpots.push({
          id: `seat:${d.seat}`,
          x: d.x,
          range: 34,
          label: `${st.takeOrder} ${seatOf(d.seat)}`,
        });
      } else if (d.state === 'ordered' && carried && carried.seat === d.seat) {
        seatSpots.push({
          id: `seat:${d.seat}`,
          x: d.x,
          range: 34,
          label: `${st.serve} ${carried.recipe.name} cho khách`,
        });
      }
    }
    return [
      ...seatSpots,
      { id: 'door-out', x: INSIDE.door, range: 90, label: 'Ra phố' },
      {
        id: 'shelf',
        x: INSIDE.shelf,
        range: 110,
        label: info.carrying > 0 ? `Cất ${info.carrying} phần hàng lên kệ` : 'Xem kho hàng',
      },
      { id: 'stove', x: INSIDE.stove, range: 110, label: stoveLabel },
      { id: 'counter', x: INSIDE.counter, range: 130, label: counterLabel },
    ];
  }

  private nearest(): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables()) {
      const d = Math.abs(it.x - this.heroX);
      if (d < it.range && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  // ================= Cập nhật =================
  private spawn() {
    if (!this.day) return;
    const arriving = this.customers.filter((c) => c.state === 'walking').length;
    if (arriving + this.service.queueCount() >= this.day.maxQueue) return;
    const info = this.day.makeCustomer();
    if (!info) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    this.customers.push({
      ...info,
      id: ++this.uid,
      x: this.ownX + side * rand(520, 680),
      y: CUSTOMER_FEET + rand(-3, 3),
      state: 'walking',
      speed: rand(95, 125),
      dir: 0,
      bob: rand(0, 6),
      skin: pick(SKIN),
      shirt: pick(SHIRTS),
      hair: info.type === 'tourist' ? pick(['#e6c35c', '#b5651d', '#d9a066']) : pick(HAIR),
      walking: true,
    });
  }

  /** Khách ngồi ăn ở quán hàng xóm (cố định theo quán, đông hơn khi tối). */
  private ensureDiners(shopId: string) {
    const shop = this.slots.find((s) => s.shop.id === shopId)?.shop;
    if (!shop) return;
    const rnd = seeded(`${shopId}:${this.phase}`);
    const count = (this.phase === 'open' ? 4 : 1) + Math.floor(rnd() * 3);
    const seats = Array.from({ length: 8 }, (_, i) => i).sort(() => rnd() - 0.5);
    this.diners.set(
      shopId,
      seats.slice(0, count).map((seat) => ({
        seat,
        x: 0,
        y: 0,
        bob: rnd() * 6,
        skin: SKIN[Math.floor(rnd() * SKIN.length)]!,
        shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)]!,
        hair: HAIR[Math.floor(rnd() * HAIR.length)]!,
        walking: false,
        icon: shop.recipes[Math.floor(rnd() * shop.recipes.length)]!.icon,
      })),
    );
  }

  private updateHero(dt: number) {
    let dir = 0;
    if (this.inputEnabled) {
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dir -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dir += 1;
      if (dir === 0) dir = this.virtualMove;
    }
    if (dir === 0 && this.targetX !== null) {
      const dx = this.targetX - this.heroX;
      if (Math.abs(dx) < 6) {
        this.targetX = null;
        const pending = this.pendingInteract;
        this.pendingInteract = null;
        if (pending && this.inputEnabled) this.hooks.onInteract?.(pending);
      } else dir = Math.sign(dx);
    }
    const running =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      (this.targetX !== null && Math.abs(this.targetX - this.heroX) > 600);
    let speed = this.scene === 'inside' ? 220 : this.info?.carrying ? 190 : 250;
    if (running) speed *= 1.8;
    const minX = 60;
    const maxX = this.sceneWidth() - 60;
    if (dir !== 0) {
      this.heroX = clamp(this.heroX + dir * speed * dt, minX, maxX);
      this.facing = dir > 0 ? 1 : -1;
      this.heroWalking = true;
      this.stepPhase += dt * (running ? 18 : 12);
    } else {
      this.heroWalking = false;
    }
    const target = clamp(this.heroX - W / 2, 0, this.sceneWidth() - W);
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
  }

  private update(dt: number) {
    this.fade = Math.max(0, this.fade - dt * 3);
    this.updateHero(dt);

    if (this.scene === 'street') {
      this.bikeIn -= dt;
      if (this.bikeIn <= 0) {
        this.bikeIn = rand(1.2, 3);
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.bikes.push({
          x: dir > 0 ? this.camX - 80 : this.camX + W + 80,
          dir,
          y: dir > 0 ? 516 : 482,
          speed: rand(160, 240),
          color: pick(BIKES),
          helmet: pick(SHIRTS),
        });
      }
      this.walkerIn -= dt;
      if (this.walkerIn <= 0) {
        this.walkerIn = rand(1.5, 4) / (1 + (this.info?.decor ?? 0) * 0.15);
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.walkers.push({
          x: dir > 0 ? this.camX - 30 : this.camX + W + 30,
          dir,
          y: CUSTOMER_FEET - 8 + rand(-2, 2),
          speed: rand(40, 70),
          bob: rand(0, 6),
          skin: pick(SKIN),
          shirt: pick(SHIRTS),
          hair: pick(HAIR),
          walking: true,
        });
      }
    }
    if (this.scene === 'market') {
      this.walkerIn -= dt;
      if (this.walkerIn <= 0) {
        this.walkerIn = rand(0.8, 2);
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.walkers.push({
          x: dir > 0 ? this.camX - 30 : this.camX + W + 30,
          dir,
          y: HERO_FEET_INSIDE - rand(2, 30),
          speed: rand(35, 60),
          bob: rand(0, 6),
          skin: pick(SKIN),
          shirt: pick(SHIRTS),
          hair: pick(HAIR),
          walking: true,
        });
      }
    }
    for (const b of this.bikes) b.x += b.dir * b.speed * dt;
    this.bikes = this.bikes.filter((b) => b.x > this.camX - 300 && b.x < this.camX + W + 300);
    for (const w of this.walkers) w.x += w.dir * w.speed * dt;
    this.walkers = this.walkers.filter((w) => w.x > this.camX - 200 && w.x < this.camX + W + 200);

    for (const d of this.deliveries) {
      d.t += dt;
      if (!d.arrived && d.t >= d.dur) {
        d.arrived = true;
        this.hooks.onDeliveryArrived?.(d.id);
      }
    }
    this.deliveries = this.deliveries.filter((d) => d.t < d.dur + 2.5);
    this.updatePlanes(dt);

    if (this.phase === 'open' && this.day) {
      this.t += dt;
      this.spawnIn -= dt;
      if (this.t < this.day.dayLen * 0.92 && this.spawnIn <= 0) {
        this.spawn();
        this.spawnIn = this.day.spawnInterval * rand(0.7, 1.3);
      }
      if (this.t >= this.day.dayLen) {
        this.phase = 'closing';
        for (const c of [...this.customers]) if (c.state === 'walking') this.leave(c, '🌙');
        this.service.closing();
      }
    }

    // khách trên phố: tới cửa thì vào quán
    const admitted = new Set<Customer>();
    for (const c of this.customers) {
      if (c.state === 'leaving') {
        c.walking = true;
        c.x += c.dir * c.speed * dt;
        continue;
      }
      const dx = this.ownX - c.x;
      c.walking = Math.abs(dx) > 3;
      if (c.walking) c.x += Math.sign(dx) * Math.min(Math.abs(dx), c.speed * dt);
      else if (this.service.admit(c)) admitted.add(c);
      else this.leave(c, '😕');
    }
    this.customers = this.customers.filter(
      (c) => !admitted.has(c) && !(c.state === 'leaving' && Math.abs(c.x - this.ownX) > 760),
    );
    if (this.phase === 'open' || this.phase === 'closing') this.service.update(dt);

    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 30 * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);

    if (this.phase === 'closing' && this.customers.length === 0 && !this.service.busy()) {
      this.phase = 'night';
      this.hooks.onDayOver?.();
    }
  }

  // ================= Vẽ chung =================
  private nightFactor(): number {
    if (this.phase === 'morning') return 0;
    if ((this.phase === 'open' || this.phase === 'closing') && this.day) {
      return clamp((this.t / this.day.dayLen) * 1.15, 0, 1);
    }
    return 0.92;
  }

  private draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.scene === 'street') this.drawStreet();
    else if (this.scene === 'market') this.drawMarketInside();
    else this.drawInterior();
    ctx.restore();

    if (this.phase === 'open' && this.needsAttention() && !this.insideOwn) {
      const p = 0.6 + 0.4 * Math.sin(this.time * 6);
      const n = this.service.diners.filter(
        (d) => d.state === 'queue' || d.state === 'seated' || d.state === 'ordered',
      ).length;
      const label = `🔔 Có ${n} khách đang chờ trong quán bạn!`;
      ctx.font = '800 15px "Be Vietnam Pro", sans-serif';
      const tw = ctx.measureText(label).width + 28;
      ctx.globalAlpha = p;
      ctx.fillStyle = '#ffd166';
      rr(ctx, W / 2 - tw / 2, 12, tw, 30, 15);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#3b2416';
      ctx.textAlign = 'center';
      ctx.fillText(label, W / 2, 32);
    }

    if (this.fade > 0) {
      ctx.fillStyle = `rgba(10,6,14,${this.fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private skyGradient(y0: number, y1: number, nf: number) {
    const g = this.ctx.createLinearGradient(0, y0, 0, y1);
    const morning = this.phase === 'morning';
    g.addColorStop(0, morning ? '#8ec9f5' : mix('#f4a261', '#0f1535', nf));
    g.addColorStop(1, morning ? '#fbefd2' : mix('#ffd8a8', '#3a2a5c', nf));
    return g;
  }

  private drawSky(nf: number) {
    const ctx = this.ctx;
    const morning = this.phase === 'morning';
    ctx.fillStyle = this.skyGradient(0, SIDEWALK_Y, nf);
    ctx.fillRect(0, 0, W, SIDEWALK_Y);
    if (nf > 0.5) {
      ctx.fillStyle = '#fff';
      for (const s of this.stars) {
        ctx.globalAlpha = (nf - 0.5) * 2 * (0.5 + 0.5 * Math.sin(this.time * 2 + s.p));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = morning ? '#ffe680' : mix('#ffb36b', '#f6f1d3', nf);
    ctx.beginPath();
    ctx.arc(W - 140, morning ? 60 : 60 + (1 - nf) * 50, morning ? 28 : 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = morning ? '#c9b8a6' : mix('#c98d6b', '#1d1b38', nf);
    const off = -((this.camX * 0.3) % 58);
    for (const b of this.skyline) {
      if (b.x + off > W + 60) continue;
      ctx.fillRect(b.x + off, SIDEWALK_Y - 230 - b.h * 0.4, b.w, 260);
    }
  }

  private drawLabel(text: string, x: number, y: number) {
    const ctx = this.ctx;
    ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
    const tw = ctx.measureText(text).width + 14;
    ctx.fillStyle = 'rgba(40,24,16,.78)';
    rr(ctx, x - tw / 2, y - 10, tw, 20, 10);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.textBaseline = 'alphabetic';
  }

  private drawLantern(lx: number, ly: number, color: string, nf: number) {
    const ctx = this.ctx;
    if (nf > 0.2) {
      const gl = ctx.createRadialGradient(lx, ly + 14, 2, lx, ly + 14, 34);
      gl.addColorStop(0, `rgba(255,150,60,${0.55 * nf})`);
      gl.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(lx - 40, ly - 20, 80, 80);
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(lx, ly + 14, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e9c46a';
    ctx.fillRect(lx - 5, ly, 10, 3);
    ctx.fillRect(lx - 5, ly + 25, 10, 3);
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, ly + 28);
    ctx.lineTo(lx, ly + 36);
    ctx.stroke();
  }

  // ================= Con phố =================
  private drawStreet() {
    const ctx = this.ctx;
    const nf = this.nightFactor();
    const morning = this.phase === 'morning';
    this.drawSky(nf);
    for (const p of this.planes) this.drawPlane(p, nf);

    ctx.save();
    ctx.translate(-Math.round(this.camX), 0);
    const L = this.camX - 20;
    const R = this.camX + W + 20;

    ctx.fillStyle = morning ? '#d8c3a5' : mix('#d8c3a5', '#5b4a52', nf);
    ctx.fillRect(L, SIDEWALK_Y, R - L, ROAD_Y - SIDEWALK_Y);
    ctx.strokeStyle = 'rgba(0,0,0,.08)';
    ctx.lineWidth = 1;
    for (let x = Math.floor(L / 40) * 40; x < R; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, SIDEWALK_Y);
      ctx.lineTo(x, ROAD_Y);
      ctx.stroke();
    }
    ctx.fillStyle = morning ? '#6b6b6b' : mix('#6b6b6b', '#2b2b38', nf);
    ctx.fillRect(L, ROAD_Y, R - L, H - ROAD_Y);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let x = Math.floor(L / 60) * 60; x < R; x += 60) ctx.fillRect(x, 497, 30, 3);

    this.drawMarket(nf);
    for (const s of this.slots) {
      if (s.x > L - 200 && s.x < R + 200) this.drawShopFront(s, nf);
    }
    for (const g of this.gates) {
      if (g.x > L - 150 && g.x < R + 150) this.drawGate(g, nf);
    }
    this.drawLanterns(nf, L, R);

    for (const d of this.deliveries) this.drawDelivery(d, nf);
    for (const b of this.bikes) this.drawBike(b, nf);

    const drawables: { y: number; draw: () => void }[] = [
      ...this.walkers.map((p) => ({ y: p.y, draw: () => this.drawPerson(p, 0.85) })),
      ...this.customers.map((c) => ({
        y: c.y,
        draw: () => this.drawCustomer(c, c.x, c.y, { mood: c.state === 'leaving' ? c.mood : undefined }),
      })),
      { y: HERO_FEET_STREET, draw: () => this.drawHero(HERO_FEET_STREET, 1.05) },
    ].sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    this.drawFloats();
    this.drawPrompt(HERO_FEET_STREET, 1.05);
    ctx.restore();

    this.drawMinimap();
  }

  private drawMarket(nf: number) {
    const ctx = this.ctx;
    const x0 = 40;
    const x1 = 560;
    if (this.camX > x1 + 40) return;
    ctx.fillStyle = mix('#7f5539', '#2a1d22', nf * 0.5);
    ctx.fillRect(x0, 170, x1 - x0, SIDEWALK_Y - 170);
    ctx.fillStyle = mix('#9c2a1e', '#2b1420', nf * 0.5);
    ctx.beginPath();
    ctx.moveTo(x0 - 24, 176);
    ctx.lineTo(x1 + 24, 176);
    ctx.lineTo(x1 - 20, 120);
    ctx.lineTo(x0 + 20, 120);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a1f1a';
    rr(ctx, MARKET_X - 140, 132, 280, 38, 8);
    ctx.fill();
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f9e2a2';
    ctx.font = '800 20px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHỢ ĐẦU MỐI', MARKET_X, 152);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#5c3d2e';
    for (const cx of [x0 + 6, MARKET_X - 85, MARKET_X + 85, x1 - 18])
      ctx.fillRect(cx, 176, 12, SIDEWALK_Y - 176);
    [150, 300, 450].forEach((sx, i) => {
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k % 2 ? '#f6ecd8' : ['#2a9d8f', '#e9a03b', '#e76f51'][i]!;
        ctx.fillRect(sx - 60 + k * 24, 200, 24, 16);
      }
      const v = this.vendors[i]!;
      this.drawPerson(
        { x: v.x, y: 330, bob: 0, skin: v.skin, shirt: v.shirt, hair: '#222', walking: false },
        0.9,
      );
      ctx.fillStyle = '#a0763a';
      ctx.fillRect(sx - 58, 330, 116, 46);
      ctx.fillStyle = '#7f5539';
      ctx.fillRect(sx - 58, 330, 116, 6);
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      for (let k = 0; k < 4; k++)
        ctx.fillText(MARKET_GOODS[(i * 4 + k) % MARKET_GOODS.length]!, sx - 42 + k * 28, 358);
    });
    ctx.font = '22px sans-serif';
    ctx.fillText('🧺', x0 + 30, SIDEWALK_Y + 30);
    ctx.fillText('📦', x1 - 60, SIDEWALK_Y + 34);
  }

  /** Cổng chào của mỗi khu phố. */
  private drawGate(g: GateSlot, nf: number) {
    const ctx = this.ctx;
    const x = g.x;
    const color = mix(g.region.color, '#1f1622', nf * 0.4);
    ctx.fillStyle = mix('#7a3b2e', '#2b1420', nf * 0.4);
    ctx.fillRect(x - 78, 150, 16, SIDEWALK_Y + 40 - 150);
    ctx.fillRect(x + 62, 150, 16, SIDEWALK_Y + 40 - 150);
    // mái cổng
    ctx.fillStyle = mix('#5c2a1e', '#1f1622', nf * 0.4);
    ctx.beginPath();
    ctx.moveTo(x - 110, 132);
    ctx.quadraticCurveTo(x, 104, x + 110, 132);
    ctx.lineTo(x + 96, 142);
    ctx.lineTo(x - 96, 142);
    ctx.closePath();
    ctx.fill();
    // biển tên khu
    ctx.fillStyle = color;
    rr(ctx, x - 92, 142, 184, 48, 6);
    ctx.fill();
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff8ec';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 15px "Be Vietnam Pro", sans-serif';
    ctx.fillText(g.region.name.toUpperCase(), x, 160, 176);
    ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
    ctx.fillText(g.region.area, x, 178, 176);
    ctx.textBaseline = 'alphabetic';
    this.drawLantern(x - 70, 192, '#d62828', Math.max(0.4, nf));
    this.drawLantern(x + 70, 192, '#d62828', Math.max(0.4, nf));
  }

  private drawShopFront(slot: ShopSlot, nf: number) {
    const ctx = this.ctx;
    const { shop, x, own } = slot;
    const w = SHOP_W;
    const L = x - w / 2;
    const roofY = own ? 118 : 132;
    const wallTop = roofY + 34;

    ctx.fillStyle = mix(shop.colors.wall, '#3d3350', Math.min(0.75, nf * 0.55));
    ctx.fillRect(L, wallTop, w, SIDEWALK_Y - wallTop);
    ctx.fillStyle = mix(shop.colors.roof, '#1f1622', nf * 0.5);
    ctx.beginPath();
    ctx.moveTo(L - 16, wallTop + 2);
    ctx.lineTo(L + w + 16, wallTop + 2);
    ctx.lineTo(L + w - 10, roofY);
    ctx.lineTo(L + 10, roofY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 1;
    for (let i = L; i < L + w; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, roofY + 2);
      ctx.lineTo(i - 6, wallTop);
      ctx.stroke();
    }

    const signW = w - 36;
    ctx.fillStyle = '#7a1f1a';
    rr(ctx, x - signW / 2, wallTop + 10, signW, 32, 6);
    ctx.fill();
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f9e2a2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 15px "Be Vietnam Pro", sans-serif';
    ctx.fillText(shop.name, x, wallTop + 26, signW - 10);

    const winY = wallTop + 52;
    for (const wx of [x - w * 0.28, x + w * 0.28]) {
      ctx.fillStyle = nf > 0.4 ? `rgba(255,210,122,${0.4 + nf * 0.5})` : '#5a7a8c';
      ctx.fillRect(wx - 18, winY, 36, 28);
      ctx.fillStyle = '#2a7a5a';
      ctx.fillRect(wx - 28, winY, 9, 28);
      ctx.fillRect(wx + 19, winY, 9, 28);
    }
    const awY = winY + 40;
    for (let i = 0, ax = L + 10; ax < L + w - 10; ax += 22, i++) {
      ctx.fillStyle = i % 2 ? '#f6ecd8' : shop.colors.awning;
      ctx.fillRect(ax, awY, 22, 16);
      ctx.beginPath();
      ctx.arc(ax + 11, awY + 16, 11, 0, Math.PI);
      ctx.fill();
    }

    // cửa vào ở giữa + 2 gian bày hàng
    const openY = awY + 28;
    const oH = SIDEWALK_Y - openY;
    ctx.fillStyle = '#3b2416';
    ctx.fillRect(L + 18, openY, w - 36, oH);
    const glow = ctx.createRadialGradient(x, openY + oH * 0.6, 10, x, openY + oH * 0.6, w * 0.5);
    glow.addColorStop(0, `rgba(255,190,90,${0.35 + 0.45 * nf})`);
    glow.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(L + 18, openY, w - 36, oH);
    // khung cửa
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x - 40, openY, 6, oH);
    ctx.fillRect(x + 34, openY, 6, oH);
    // bàn ghế nhựa đỏ trên vỉa hè (đặc trưng quán Việt)
    if (shop.kind === 'food') {
      for (const tx of [L + 50, L + w - 50]) {
        ctx.fillStyle = '#b8c0c8';
        ctx.fillRect(tx - 18, SIDEWALK_Y - 6, 36, 5);
        ctx.fillRect(tx - 2, SIDEWALK_Y - 1, 4, 14);
        ctx.fillStyle = '#d62828';
        ctx.fillRect(tx - 30, SIDEWALK_Y + 4, 10, 9);
        ctx.fillRect(tx + 20, SIDEWALK_Y + 4, 10, 9);
      }
    } else {
      ctx.font = '22px sans-serif';
      ctx.fillText(shop.recipes[0]?.icon ?? '', L + 48, SIDEWALK_Y - 18);
      ctx.fillText(shop.recipes[1]?.icon ?? '', L + w - 48, SIDEWALK_Y - 18);
    }
    ctx.font = '30px sans-serif';
    ctx.fillText(shop.icon, x, openY + 30);

    if (!own) {
      this.drawPerson(
        {
          x: x + 60,
          y: SIDEWALK_Y - 6,
          bob: 0,
          skin: '#e0ac69',
          shirt: shop.colors.awning,
          hair: '#222',
          walking: false,
        },
        0.8,
      );
    } else {
      // biển "Quán của bạn" + trạng thái
      ctx.fillStyle = '#ffd166';
      rr(ctx, x - 62, roofY - 30, 124, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#3b2416';
      ctx.font = '800 12px "Be Vietnam Pro", sans-serif';
      ctx.fillText('⭐ QUÁN CỦA BẠN', x, roofY - 19);
      const status =
        this.phase === 'open' ? 'ĐANG MỞ CỬA' : this.phase === 'morning' ? 'CHUẨN BỊ' : 'ĐÃ ĐÓNG';
      ctx.font = '800 11px "Be Vietnam Pro", sans-serif';
      const tw = ctx.measureText(status).width + 16;
      rr(ctx, L + w - tw - 22, openY + 8, tw, 20, 10);
      ctx.fillStyle = this.phase === 'open' ? '#2a9d8f' : this.phase === 'morning' ? '#e9a03b' : '#6c757d';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(status, L + w - tw / 2 - 22, openY + 18);
    }
    ctx.textBaseline = 'alphabetic';
  }

  private drawLanterns(nf: number, L: number, R: number) {
    const ctx = this.ctx;
    const perSpan = 2 + (this.info?.decor ?? 0);
    const sag = 22;
    for (let a = 0; a < this.worldW; a += 320) {
      const b = a + 320;
      if (b < L || a > R) continue;
      const yAt = (u: number) => 52 + sag * 4 * u * (1 - u);
      ctx.strokeStyle = 'rgba(40,20,10,.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = a; x <= b; x += 8) {
        const y = yAt((x - a) / (b - a));
        if (x === a) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let k = 1; k <= perSpan; k++) {
        const u = k / (perSpan + 1);
        const lx = a + (b - a) * u + Math.sin(this.time * 1.5 + a + k) * 2;
        this.drawLantern(lx, yAt(u) + 4, (k + a / 320) % 3 === 0 ? '#f4a261' : '#d62828', nf);
      }
    }
  }

  private drawDelivery(d: Delivery, nf: number) {
    const ctx = this.ctx;
    const startX = MARKET_X + 140;
    const endX = this.ownX - 130;
    const u = clamp(d.t / d.dur, 0, 1);
    const ease = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    const x = startX + (endX - startX) * ease;
    if (x < this.camX - 200 || x > this.camX + W + 200) return;
    const y = 470;
    if (nf > 0.3) {
      ctx.fillStyle = `rgba(255,240,180,${0.25 * nf})`;
      ctx.beginPath();
      ctx.moveTo(x + 40, y - 8);
      ctx.lineTo(x + 150, y - 24);
      ctx.lineTo(x + 150, y + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x - 34, y + 6, 9, 0, Math.PI * 2);
    ctx.arc(x - 6, y + 6, 9, 0, Math.PI * 2);
    ctx.arc(x + 34, y + 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a6f97';
    ctx.fillRect(x - 50, y - 18, 58, 20);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x - 46, y - 40, 22, 22);
    ctx.fillRect(x - 22, y - 34, 24, 16);
    ctx.fillStyle = '#c99a5b';
    ctx.fillRect(x - 40, y - 52, 20, 12);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 8);
    ctx.lineTo(x + 34, y + 2);
    ctx.stroke();
    this.drawPerson(
      { x: x + 22, y: y - 6, bob: 0, skin: '#c68642', shirt: '#e9a03b', hair: '#222', walking: false },
      0.75,
    );
    ctx.font = '700 11px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    rr(ctx, x - 52, y - 76, 84, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(d.arrived ? '📦 Đã giao!' : '🛵 Giao hàng', x - 10, y - 63);
  }

  // ================= Máy bay kéo băng rôn =================
  /**
   * Máy bay quảng cáo của quán mình bay đúng số vòng đã thuê, rải đều trong giờ bán.
   * Máy bay trang trí (quảng cáo hàng xóm / tin chợ) bay mỗi 25–40 giây vào buổi sáng và giờ bán.
   */
  private updatePlanes(dt: number) {
    for (const p of this.planes) {
      p.x += p.dir * p.speed * dt;
      p.phase += dt;
    }
    const view = this.camX * PLANE_PARALLAX;
    this.planes = this.planes.filter((p) => p.x > view - 900 && p.x < view + W + 900);

    const sky = this.info?.sky;
    if (this.phase === 'open' && this.day && sky && this.adFlown < sky.adFlights) {
      const due = (this.day.dayLen * 0.9 * (this.adFlown + 0.25)) / sky.adFlights;
      if (this.t >= due) {
        this.adFlown++;
        this.spawnPlane('own');
        if (this.scene !== 'street') this.hooks.onEvent?.('✈️ Máy bay quảng cáo của quán đang bay qua phố!');
      }
    }

    if (this.phase !== 'morning' && this.phase !== 'open') return;
    this.planeIn -= dt;
    if (this.planeIn > 0) return;
    this.planeIn = rand(...AMBIENT_PLANE_GAP);
    if (this.planes.some((p) => p.kind !== 'own')) return;
    const news = sky?.news ?? [];
    this.spawnPlane(news.length > 0 && Math.random() < 0.5 ? 'news' : 'neighbor');
  }

  private spawnPlane(kind: Plane['kind']) {
    const info = this.info;
    if (!info) return;
    let text: string;
    if (kind === 'own') {
      const shop = info.shops.find((s) => s.id === info.ownShopId);
      const dish = info.menu[Math.floor(Math.random() * info.menu.length)];
      text = `${shop?.icon ?? '🏮'} ${shop?.name ?? 'Quán'}${dish ? ` · ${dish.name}` : ''} · Ghé ngay!`;
    } else if (kind === 'news') {
      const news = info.sky?.news ?? [];
      text = news[this.newsIdx++ % Math.max(1, news.length)] ?? '';
    } else {
      const others = info.shops.filter((s) => s.id !== info.ownShopId);
      const shop = pick(others);
      const dish = pick(shop.recipes);
      text = pick(NEIGHBOR_SLOGANS)
        .replace('{icon}', shop.icon)
        .replace('{shop}', shop.name)
        .replace('{dish}', dish.name);
    }
    if (!text) return;
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const view = this.camX * PLANE_PARALLAX;
    this.planes.push({
      x: dir > 0 ? view - 120 : view + W + 120,
      // bay trên dây đèn lồng (dây võng từ y ≈ 80): quảng cáo của mình thấp hơn, máy bay trang trí cao hơn
      y: kind === 'own' ? PLANE_Y_OWN : rand(...PLANE_Y_AMBIENT),
      dir,
      speed: kind === 'own' ? 95 : rand(80, 110),
      text,
      kind,
      phase: rand(0, 6),
    });
  }

  private drawPlane(p: Plane, nf: number) {
    const ctx = this.ctx;
    const x = p.x - this.camX * PLANE_PARALLAX;
    const y = p.y + Math.sin(p.phase * 1.3) * 3;
    const d = p.dir;

    // băng rôn kéo phía sau (ngược hướng bay)
    ctx.font = `800 ${p.kind === 'own' ? 15 : 13}px "Be Vietnam Pro", sans-serif`;
    const tw = ctx.measureText(p.text).width + 26;
    const bh = p.kind === 'own' ? 28 : 24;
    const gap = 34;
    const bx = d > 0 ? x - 30 - gap - tw : x + 30 + gap;
    const by = y - bh / 2 + 4;
    const fill = p.kind === 'own' ? '#ffd166' : p.kind === 'news' ? '#d8f3dc' : '#fff8ec';
    const edge = p.kind === 'own' ? '#c0392b' : p.kind === 'news' ? '#2a9d8f' : '#8c5a2b';

    ctx.strokeStyle = nf > 0.5 ? 'rgba(255,255,255,.45)' : 'rgba(60,40,30,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - d * 26, y + 2);
    ctx.lineTo(d > 0 ? bx + tw : bx, by + bh / 2);
    ctx.stroke();

    // vải băng rôn gợn sóng: vẽ thành từng dải dọc lệch nhau
    const strips = Math.ceil(tw / 12);
    for (let i = 0; i < strips; i++) {
      const sx = bx + i * 12;
      const wave = Math.sin(p.phase * 5 + i * 0.6 * d) * 2.2;
      ctx.fillStyle = fill;
      ctx.fillRect(sx, by + wave, Math.min(12.5, bx + tw - sx), bh);
      ctx.fillStyle = edge;
      ctx.fillRect(sx, by + wave, Math.min(12.5, bx + tw - sx), 3);
      ctx.fillRect(sx, by + wave + bh - 3, Math.min(12.5, bx + tw - sx), 3);
    }
    if (nf > 0.3) {
      ctx.fillStyle = `rgba(255,236,170,${(nf - 0.3) * 0.35})`;
      ctx.fillRect(bx - 4, by - 4, tw + 8, bh + 8);
    }
    ctx.fillStyle = '#3b2416';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, bx + tw / 2, by + bh / 2 + Math.sin(p.phase * 5 + strips * 0.3 * d) * 1.5);
    ctx.textBaseline = 'alphabetic';

    // thân máy bay
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(d, 1);
    const body = p.kind === 'own' ? '#c0392b' : p.kind === 'news' ? '#2a9d8f' : '#3a86ff';
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); // đuôi
    ctx.moveTo(-22, -2);
    ctx.lineTo(-32, -15);
    ctx.lineTo(-25, -15);
    ctx.lineTo(-14, -3);
    ctx.fill();
    ctx.fillStyle = mix(body, '#000000', 0.25);
    rr(ctx, -8, -2, 18, 5, 2); // cánh
    ctx.fill();
    ctx.fillStyle = '#bde0fe';
    ctx.beginPath(); // buồng lái
    ctx.ellipse(10, -5, 7, 4, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,30,30,.7)'; // cánh quạt quay
    ctx.fillRect(28, -9 + Math.abs(Math.sin(p.phase * 40)) * 2, 2, 18 - Math.abs(Math.sin(p.phase * 40)) * 4);
    if (nf > 0.4 && Math.sin(this.time * 6 + p.phase) > 0) {
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(-30, -15, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBike(b: Bike, nf: number) {
    const ctx = this.ctx;
    if (nf > 0.3) {
      ctx.fillStyle = `rgba(255,240,180,${0.25 * nf})`;
      ctx.beginPath();
      ctx.moveTo(b.x + b.dir * 22, b.y - 10);
      ctx.lineTo(b.x + b.dir * 120, b.y - 24);
      ctx.lineTo(b.x + b.dir * 120, b.y + 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(b.x - 15, b.y, 7, 0, Math.PI * 2);
    ctx.arc(b.x + 15, b.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.color;
    rr(ctx, b.x - 20, b.y - 16, 40, 12, 5);
    ctx.fill();
    ctx.fillStyle = '#334';
    ctx.fillRect(b.x - 4, b.y - 34, 10, 20);
    ctx.fillStyle = b.helmet;
    ctx.beginPath();
    ctx.arc(b.x + 1, b.y - 40, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMinimap() {
    const ctx = this.ctx;
    const mw = 400;
    const mx = W - mw - 18;
    const my = H - 22;
    const sx = (wx: number) => mx + (wx / this.worldW) * mw;
    ctx.fillStyle = 'rgba(20,12,26,.7)';
    rr(ctx, mx - 10, my - 16, mw + 20, 30, 15);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(mx, my - 1, mw, 2);
    // khung đang nhìn
    ctx.strokeStyle = 'rgba(255,209,102,.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx(this.camX), my - 12, (W / this.worldW) * mw, 22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const g of this.gates) {
      ctx.fillStyle = g.region.color;
      ctx.fillRect(sx(g.x) - 1, my - 10, 2, 18);
    }
    ctx.font = '11px sans-serif';
    ctx.fillText('🏪', sx(MARKET_X), my);
    for (const s of this.slots) {
      ctx.font = s.own ? '15px sans-serif' : '10px sans-serif';
      ctx.fillText(s.own ? '🏮' : s.shop.icon, sx(s.x), my);
    }
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(sx(this.heroX) - 5, my - 16);
    ctx.lineTo(sx(this.heroX) + 5, my - 16);
    ctx.lineTo(sx(this.heroX), my - 9);
    ctx.fill();
    ctx.textBaseline = 'alphabetic';
  }

  // ================= Bên trong quán =================
  private drawInterior() {
    const ctx = this.ctx;
    const info = this.info;
    const shop = this.insideShop;
    if (!info || !shop) return;
    const own = this.insideOwn;
    const nf = this.nightFactor();

    ctx.save();
    ctx.translate(-Math.round(this.camX), 0);

    // tường, sàn, khung cảnh theo kiểu quán (quán ăn, quán nước, ghe, xưởng nghề, sân khấu)
    const kind = shop.interior;
    const style = interiorStyle(kind);
    drawRoom(ctx, kind, shop, ROOM, nf, this.time);
    const tablesStart = own ? INSIDE.tablesStart : NEIGHBOR_INSIDE.tablesStart;
    if (kind === 'sankhau') {
      // sân khấu nước phía sau hàng ghế khán giả; con rối diễn khi có người xem
      const watching = own ? this.service.diners.some((d) => d.state === 'eating') : true;
      drawWaterStage(
        ctx,
        tablesStart - 70,
        tablesStart + 3 * INSIDE.tableSpacing + 70,
        nf,
        this.time,
        watching,
      );
    }

    // biển tên + đèn lồng + tranh treo tường
    const bannerX = own ? 760 : 700;
    ctx.fillStyle = '#7a1f1a';
    rr(ctx, bannerX - 190, 38, 380, 40, 8);
    ctx.fill();
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f9e2a2';
    ctx.font = '800 19px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${shop.icon} ${shop.name}`, bannerX, 59, 360);
    ctx.textBaseline = 'alphabetic';
    if (kind !== 'ghe')
      for (let lx = 200; lx < INSIDE_W; lx += 260)
        this.drawLantern(lx, 26, lx % 520 === 200 ? '#d62828' : '#f4a261', Math.max(0.5, nf));
    if (kind !== 'sankhau') this.drawWallArt(own ? 760 : 220, 120, shop);

    this.drawDoor(nf);

    if (own) {
      this.drawShelf(info);
      this.drawStove(shop, INSIDE.stove, style);
      drawDecor(ctx, kind, info.decorRoles, ROOM, nf, this.time, {
        lantern: (x, y, c) => this.drawLantern(x, y, c, Math.max(0.6, nf)),
      });
      this.drawTables(INSIDE.tablesStart, this.tableCount(), shop, style);
      this.drawKitchenPass(style);
      if (kind !== 'sankhau') this.drawMenuBoard(INSIDE.board, shop, info.menu, info.shopLevel, style);
      this.drawCounter(INSIDE.counter, nf, true, shop);
    } else {
      this.drawTables(NEIGHBOR_INSIDE.tablesStart, 4, shop, style);
      if (kind !== 'sankhau') this.drawMenuBoard(NEIGHBOR_INSIDE.board, shop, shop.recipes, 1, style);
      this.drawCounter(NEIGHBOR_INSIDE.counter, nf, false, shop);
    }

    // ánh đèn ấm
    const g = ctx.createRadialGradient(this.camX + W / 2, 200, 50, this.camX + W / 2, 260, 650);
    g.addColorStop(0, 'rgba(255,200,120,0.08)');
    g.addColorStop(1, `rgba(20,10,30,${0.1 + nf * 0.22})`);
    ctx.fillStyle = g;
    ctx.fillRect(this.camX, 0, W, H);

    if (own) this.drawInsidePeople();
    this.drawHero(HERO_FEET_INSIDE, 1.3);
    this.drawFloats();
    this.drawPrompt(HERO_FEET_INSIDE, 1.3);
    ctx.restore();

    if (!own) {
      this.drawLabel(`Bạn đang ghé ${shop.name}`, W / 2, H - 16);
    }
  }

  private drawWallArt(x: number, y: number, shop: Shop) {
    const ctx = this.ctx;
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x - 46, y - 6, 92, 82);
    ctx.fillStyle = '#f5ebe0';
    ctx.fillRect(x - 40, y, 80, 70);
    ctx.font = '34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      shop.region === 'nam' ? '🛶' : shop.region === 'trung' ? '🏯' : shop.region === 'bac' ? '🌾' : '🎎',
      x,
      y + 48,
    );
  }

  private drawDoor(nf: number) {
    const ctx = this.ctx;
    const x = INSIDE.door;
    ctx.fillStyle = '#4a2f1d';
    ctx.fillRect(x - 58, 150, 116, FLOOR_Y - 148);
    ctx.fillStyle = this.skyGradient(160, FLOOR_Y, nf);
    ctx.fillRect(x - 48, 160, 96, FLOOR_Y - 158);
    ctx.fillStyle = '#7f5539';
    ctx.fillRect(x - 48, 160, 18, FLOOR_Y - 158);
    ctx.fillRect(x + 30, 160, 18, FLOOR_Y - 158);
    this.drawLabel('🚪 Cửa ra phố', x, 136);
  }

  private drawShelf(info: SceneInfo) {
    const ctx = this.ctx;
    const x = INSIDE.shelf;
    const left = x - 95;
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(left, 140, 190, FLOOR_Y - 138);
    ctx.fillStyle = '#8b5a2b';
    for (let i = 0; i < 4; i++) ctx.fillRect(left - 4, 160 + i * 62, 198, 8);
    const items = info.pantry.slice(0, 12);
    ctx.textAlign = 'center';
    items.forEach((it, i) => {
      const ix = left + 26 + (i % 4) * 46;
      const iy = 152 + (Math.floor(i / 4) + 1) * 62 - 14;
      ctx.font = '24px sans-serif';
      ctx.fillText(it.ingredient.icon, ix, iy);
      ctx.font = '800 11px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(it.qty), ix + 14, iy + 2);
      ctx.fillStyle = '#000';
    });
    if (items.length === 0) {
      ctx.font = '600 13px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#f6ecd8';
      ctx.fillText('(kệ trống)', x, 260);
    }
    this.drawLabel(info.carrying > 0 ? '📦 Kệ hàng: cất hàng!' : '📦 Kệ hàng', x, 126);
  }

  /** Nơi làm món theo nghề (bếp, quầy pha, bàn nghề, buồng trò) + sổ công thức. */
  private drawStove(shop: Shop, x: number, style: InteriorStyle, label = true) {
    const ctx = this.ctx;
    drawStation(ctx, shop.interior, shop, x, this.time);
    if (!label) return;
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📖', x + 70, 296);
    this.drawLabel(`${style.station} & sổ công thức`, x, 180);
  }

  /** Các cụm 2 chỗ của khách: bàn ăn, bàn nước, mạn ghe, chỗ làm nghề hay hàng ghế khán giả. */
  private drawTables(startX: number, count: number, shop: Shop, style: InteriorStyle) {
    const ctx = this.ctx;
    const own = this.insideOwn;
    const kind = shop.interior;
    const seated = new Map<number, { person: Person; icon: string; diner?: Diner }>();
    if (own) {
      for (const d of this.service.diners) {
        if (d.seat === undefined || d.walking) continue;
        if (d.state === 'seated' || d.state === 'ordered' || d.state === 'eating') {
          seated.set(d.seat, { person: { ...d, y: 0 }, icon: d.recipe.icon, diner: d });
        }
      }
    } else if (this.insideShopId) {
      for (const d of this.diners.get(this.insideShopId) ?? []) {
        if (d.seat < count * 2) seated.set(d.seat, { person: d, icon: d.icon });
      }
    }
    const tableTop = 392;
    for (let i = 0; i < count; i++) {
      const tx = startX + i * INSIDE.tableSpacing;
      const variant = own ? (this.info?.tables[i] ?? 'basic') : i % 2 ? 'plus' : 'basic';
      for (const side of [0, 1]) {
        const seat = i * 2 + side;
        const sxp = tx + (side === 0 ? -34 : 34);
        const s = seated.get(seat);
        drawSeat(ctx, kind, variant, shop.id, sxp, tableTop);
        if (s) {
          // khán giả quay mặt về sân khấu, các kiểu khác ngồi đối diện nhau
          const facing: 1 | -1 = kind === 'sankhau' ? 1 : side === 0 ? 1 : -1;
          this.drawSitting({ ...s.person, x: sxp, y: tableTop + 8 }, facing, s.diner?.state === 'eating');
          const d = s.diner;
          if (d) this.drawDinerBubble(d, sxp, tableTop - 50, Math.floor(seat / 2) + 1);
        }
      }
      drawSeatTable(ctx, kind, variant, shop.id, tx, tableTop, this.time);
      // món / sản phẩm khách đang dùng
      for (const side of [0, 1]) {
        const s = seated.get(i * 2 + side);
        if (s && (!s.diner || s.diner.state === 'eating') && kind !== 'sankhau') {
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(s.icon, tx + (side === 0 ? -16 : 16), tableTop - 15);
        }
      }
      if (own) {
        ctx.font = '700 11px "Be Vietnam Pro", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(40,24,16,.7)';
        ctx.fillText(seatName(style, i + 1), tx, tableTop + 46);
      }
    }
    if (own) {
      const free = this.service.freeSeats().length;
      this.drawLabel(
        `🪑 ${count} ${style.seat} · còn ${free} chỗ`,
        startX + ((count - 1) * INSIDE.tableSpacing) / 2,
        kind === 'sankhau' ? 84 : 300,
      );
    }
  }

  private drawSitting(p: Person, facing: 1 | -1, eating = true) {
    const ctx = this.ctx;
    const x = p.x;
    const y = p.y; // mặt ghế
    const bob = Math.sin(this.time * 3 + p.bob) * 1.2;
    ctx.fillStyle = '#2b2b38';
    ctx.fillRect(x - 6, y - 4, 14, 6);
    ctx.fillStyle = p.shirt;
    rr(ctx, x - 10, y - 32 + bob, 20, 28, 7);
    ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(x, y - 42 + bob, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.hair;
    ctx.beginPath();
    ctx.arc(x, y - 44 + bob, 9.5, Math.PI, 0);
    ctx.fill();
    // tay cầm đũa đưa lên miệng
    ctx.strokeStyle = p.skin;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + facing * 8, y - 24 + bob);
    ctx.lineTo(x + facing * 18, y - 30 + (eating ? Math.sin(this.time * 4 + p.bob) * 4 : 6));
    ctx.stroke();
  }

  /** Bảng thực đơn treo tường. */
  private drawMenuBoard(x: number, shop: Shop, menu: Recipe[], level: number, style: InteriorStyle) {
    const ctx = this.ctx;
    const w = 220;
    const lines = menu.slice(0, 4);
    const h = 54 + lines.length * 26;
    const y = 100;
    ctx.fillStyle = '#6b4226';
    rr(ctx, x - w / 2 - 6, y - 6, w + 12, h + 12, 6);
    ctx.fill();
    ctx.fillStyle = '#23372b';
    ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = '#f6ecd8';
    ctx.textAlign = 'center';
    ctx.font = '800 15px "Be Vietnam Pro", sans-serif';
    ctx.fillText(style.board, x, y + 24);
    void shop;
    ctx.font = '600 13px "Be Vietnam Pro", sans-serif';
    lines.forEach((r, i) => {
      const ly = y + 50 + i * 26;
      ctx.textAlign = 'left';
      ctx.fillText(`${r.icon} ${r.name}`, x - w / 2 + 10, ly, 140);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`${Math.round(r.price * priceMultiplier(level))}k`, x + w / 2 - 10, ly);
      ctx.fillStyle = '#f6ecd8';
    });
  }

  private drawCounter(x: number, nf: number, own: boolean, shop: Shop) {
    const ctx = this.ctx;
    const wx0 = x - 140;
    const wx1 = INSIDE_W - 14;
    const wy0 = 120;
    const wy1 = 320;
    if (own) {
      // cửa sổ bán hàng nhìn ra phố, khách xếp hàng
      ctx.fillStyle = '#4a2f1d';
      ctx.fillRect(wx0 - 10, wy0 - 10, wx1 - wx0 + 20, wy1 - wy0 + 20);
      ctx.fillStyle = this.skyGradient(wy0, wy1, nf);
      ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx0, wy0, wx1 - wx0, wy1 - wy0);
      ctx.clip();
      for (const c of this.customers.slice(0, 6)) {
        const rel = (c.x - this.ownX) / 6;
        this.drawCustomer(c, wx0 + (wx1 - wx0) / 2 + rel, wy1 + 30, {}, 0.9);
      }
      ctx.restore();
      for (let i = 0, ax = wx0 - 10; ax < wx1 + 10; ax += 22, i++) {
        ctx.fillStyle = i % 2 ? '#f6ecd8' : shop.colors.awning;
        ctx.fillRect(ax, wy0 - 14, 22, 12);
      }
    } else {
      // bếp phía sau quầy + chủ quán
      this.drawStove(shop, x + 20, interiorStyle(shop.interior), false);
      this.drawPerson(
        {
          x: x - 40,
          y: 330,
          bob: 0,
          skin: '#e0ac69',
          shirt: shop.colors.awning,
          hair: '#222',
          walking: false,
        },
        1.25,
      );
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👋', x - 18, 240 + Math.sin(this.time * 4) * 3);
    }
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x - 150, 318, INSIDE_W - (x - 150) - 6, FLOOR_Y - 316);
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(x - 156, 310, INSIDE_W - (x - 156), 12);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let i = 0; i < 6; i++) ctx.fillRect(x - 140 + i * 40, 330, 2, FLOOR_Y - 332);
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛎️', x - 110, 306);
    ctx.fillText('🧧', x + 110, 306);
    this.drawLabel(own ? '🛎️ Quầy bán hàng' : '🧑‍🍳 Chủ quán', x, 100);
  }

  // ================= Nhân vật & người =================
  private drawHero(feetY: number, scale: number) {
    if (!this.info) return;
    const dish = this.service.carriedOrder();
    if (dish && this.scene === 'inside') {
      const ctx = this.ctx;
      const tx = this.heroX + this.facing * 26 * scale;
      const ty = feetY - 62 * scale;
      ctx.fillStyle = '#9aa5b1';
      ctx.fillRect(tx - 18, ty, 36, 5);
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dish.recipe.icon, tx, ty - 2);
    }
    drawAvatar(this.ctx, this.heroX, feetY, this.info.avatar, {
      phase: this.stepPhase,
      walking: this.heroWalking,
      facing: this.facing,
      carrying: this.info.carrying > 0,
      scale,
      name: this.info.name,
    });
  }

  private drawPrompt(feetY: number, scale: number) {
    if (!this.inputEnabled) return;
    const near = this.nearest();
    if (!near) return;
    const ctx = this.ctx;
    ctx.font = '800 14px "Be Vietnam Pro", sans-serif';
    const tw = ctx.measureText(near.label).width + 40;
    const x = clamp(this.heroX, this.camX + tw / 2 + 8, this.camX + W - tw / 2 - 8);
    const y = feetY - 120 * scale - 26 + Math.sin(this.time * 5) * 2;
    ctx.fillStyle = '#fff8ec';
    rr(ctx, x - tw / 2, y, tw, 28, 14);
    ctx.fill();
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    rr(ctx, x - tw / 2 + 6, y + 5, 18, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 12px "Be Vietnam Pro", sans-serif';
    ctx.fillText('E', x - tw / 2 + 15, y + 14);
    ctx.fillStyle = '#3b2416';
    ctx.font = '800 14px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(near.label, x - tw / 2 + 32, y + 14);
    ctx.textBaseline = 'alphabetic';
  }

  private drawFloats() {
    const ctx = this.ctx;
    const where = this.whereKey();
    for (const f of this.floats) {
      if (f.where !== where) continue;
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.font = '800 22px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  private drawPerson(c: Person, scale = 1) {
    const ctx = this.ctx;
    const phase = this.time * 12 + c.bob;
    const bob = c.walking ? Math.abs(Math.sin(phase)) * 3 : 0;
    const sw = c.walking ? Math.sin(phase) * 5 : 0;
    const x = c.x;
    const y = c.y - bob;
    ctx.save();
    ctx.translate(x, c.y);
    ctx.scale(scale, scale);
    ctx.translate(-x, -c.y);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(x, c.y + 2, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 18);
    ctx.lineTo(x - 4 + sw, y);
    ctx.moveTo(x + 4, y - 18);
    ctx.lineTo(x + 4 - sw, y);
    ctx.stroke();
    ctx.fillStyle = c.shirt;
    rr(ctx, x - 11, y - 44, 22, 28, 7);
    ctx.fill();
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(x, y - 54, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.arc(x, y - 56, 10, Math.PI, 0);
    ctx.fill();
    ctx.restore();
  }

  /** Vẽ một khách (trên phố hoặc đứng trong quán). */
  private drawCustomer(
    c: Person & { type: CustomerTypeId },
    x: number,
    feetY: number,
    opts: { mood?: string } = {},
    scale = 1,
  ) {
    const ctx = this.ctx;
    if (c.type === 'student') {
      ctx.fillStyle = '#2a6f97';
      rr(ctx, x - 16 * scale, feetY - 42 * scale, 7 * scale, 20 * scale, 3);
      ctx.fill();
    }
    this.drawPerson({ ...c, x, y: feetY }, scale);
    const bob = c.walking ? Math.abs(Math.sin(this.time * 12 + c.bob)) * 3 : 0;
    const y = feetY - bob * scale;
    const s = (v: number) => v * scale;
    if (c.type === 'tourist') {
      ctx.fillStyle = '#f1e3a0';
      ctx.beginPath();
      ctx.ellipse(x, y - s(62), s(16), s(4), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - s(8), y - s(72), s(16), s(10));
    }
    if (c.type === 'critic' || c.type === 'reviewer') {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x - s(4), y - s(54), s(3), 0, Math.PI * 2);
      ctx.moveTo(x + s(7), y - s(54));
      ctx.arc(x + s(4), y - s(54), s(3), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (c.type === 'reviewer') {
      ctx.font = `${Math.round(s(14))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('📱', x + s(14), y - s(30));
    }
    if (opts.mood) {
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opts.mood, x, y - s(74));
    }
  }

  /** Bong bóng trên đầu khách ngồi bàn: ✋ gọi món / món đang chờ / cảm xúc khi ăn. */
  private drawDinerBubble(d: Diner, x: number, y: number, table: number) {
    const ctx = this.ctx;
    if (d.state === 'eating') {
      if (d.mood && d.moodT > 0) {
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.mood, x, y - 4);
      }
      return;
    }
    // thanh kiên nhẫn
    const r = clamp(d.patience / d.maxPatience, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(x - 15, y + 2, 30, 5);
    ctx.fillStyle = r > 0.5 ? '#52b788' : r > 0.25 ? '#f4a261' : '#e63946';
    ctx.fillRect(x - 15, y + 2, 30 * r, 5);
    const by = y - 34;
    const wave = d.state === 'seated';
    ctx.fillStyle = wave ? '#fff' : 'rgba(255,255,255,.85)';
    rr(ctx, x - 19, by, 38, 30, 9);
    ctx.fill();
    if (wave) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2 + Math.sin(this.time * 6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 5, by + 30);
    ctx.lineTo(x + 5, by + 30);
    ctx.lineTo(x, by + 36);
    ctx.fill();
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wave ? (Math.sin(this.time * 8) > 0 ? '✋' : '🙋') : d.recipe.icon, x, by + 15);
    if (!wave) {
      ctx.font = '11px sans-serif';
      ctx.fillText('⏳', x + 16, by + 4);
    }
    ctx.textBaseline = 'alphabetic';
    void table;
  }

  /** Nơi để món xong chờ mang ra (món phụ bếp làm) + phiếu yêu cầu ghim trên tường. */
  private drawKitchenPass(style: InteriorStyle) {
    const ctx = this.ctx;
    const x = INSIDE.pass;
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x - 46, 300, 92, 10);
    ctx.fillRect(x - 40, 310, 6, FLOOR_Y - 310);
    ctx.fillRect(x + 34, 310, 6, FLOOR_Y - 310);
    const ready = this.service.readyOnPass();
    ctx.textAlign = 'center';
    const hot = style.id === 'an' || style.id === 'ghe';
    ready.slice(0, 4).forEach((o, i) => {
      ctx.font = '20px sans-serif';
      ctx.fillText(o.recipe.icon, x - 30 + i * 20, 296);
      if (!hot) return;
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 30 + i * 20, 278);
      ctx.quadraticCurveTo(x - 26 + i * 20 + Math.sin(this.time * 3 + i) * 4, 268, x - 30 + i * 20, 258);
      ctx.stroke();
    });
    this.drawLabel(ready.length ? `${style.pass} (${ready.length})` : style.pass, x, 240);

    // phiếu ghim tường
    const orders = this.service.orders;
    orders.slice(0, 6).forEach((o, i) => {
      const tx = INSIDE.stove - 120 + i * 48;
      const ty = 92 + (i % 2) * 6;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate((i % 2 ? 1 : -1) * 0.05);
      ctx.fillStyle = o.status === 'queued' ? '#fffdf0' : o.status === 'cooking' ? '#ffe8a3' : '#d8f3dc';
      ctx.fillRect(-20, 0, 40, 46);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(0, 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(o.recipe.icon, 0, 24);
      ctx.font = '700 9px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#3b2416';
      ctx.fillText(seatName(style, Math.floor(o.seat / 2) + 1), 0, 38, 38);
      ctx.restore();
    });
    if (orders.length)
      this.drawLabel(
        `📝 ${orders.length} phiếu ${style.order}`,
        INSIDE.stove - 120 + Math.min(5, orders.length - 1) * 24,
        84,
      );
  }

  /** Khách đứng chờ chỗ / đang đi trong quán, và nhân viên. */
  private drawInsidePeople() {
    const feet = HERO_FEET_INSIDE - 10;
    for (const d of this.service.diners) {
      const standing = d.state === 'queue' || d.walking;
      if (!standing) continue;
      this.drawCustomer(
        { ...d, y: feet },
        d.x,
        feet,
        { mood: d.state === 'toDoor' ? d.mood : d.state === 'queue' ? '⏳' : undefined },
        1.2,
      );
    }
    for (const st of this.service.staff) {
      const x = st.x;
      const y = st.role === 'cook' ? 410 : feet + 4;
      this.drawPerson(
        {
          x,
          y,
          bob: st.bob,
          skin: st.skin,
          shirt: st.role === 'cook' ? '#f8f9fa' : st.shirt,
          hair: st.hair,
          walking: st.walking,
        },
        1.2,
      );
      const ctx = this.ctx;
      ctx.textAlign = 'center';
      if (st.role === 'cook') {
        // mũ đầu bếp
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y - 82, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - 9, y - 80, 18, 10);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        rr(ctx, x - 8, y - 44, 16, 22, 3);
        ctx.fill();
        if (st.carrying !== undefined) {
          const o = this.service.orders.find((q) => q.id === st.carrying);
          if (o) {
            ctx.fillStyle = '#9aa5b1';
            ctx.fillRect(x + 4, y - 58, 30, 4);
            ctx.font = '18px sans-serif';
            ctx.fillText(o.recipe.icon, x + 19, y - 60);
          }
        }
      }
      ctx.font = '700 11px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = 'rgba(20,12,26,.7)';
      const label = `${st.role === 'cook' ? '🧑‍🍳' : '🧑‍💼'} ${st.name}`;
      const tw = ctx.measureText(label).width + 12;
      rr(ctx, x - tw / 2, y - (st.role === 'cook' ? 112 : 98), tw, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, y - (st.role === 'cook' ? 100 : 86));
    }
  }

  // ================= Bên trong chợ đầu mối =================
  private drawMarketInside() {
    const ctx = this.ctx;
    const info = this.info;
    if (!info) return;
    const nf = this.nightFactor();
    ctx.save();
    ctx.translate(-Math.round(this.camX), 0);
    const L = this.camX - 20;
    const R = this.camX + W + 20;

    // mái tôn, kèo sắt, ánh sáng lọt xuống
    ctx.fillStyle = mix('#8a7560', '#2a2230', nf * 0.6);
    ctx.fillRect(L, 0, R - L, MARKET_FLOOR);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let x = Math.floor(L / 120) * 120; x < R; x += 120) {
      ctx.fillRect(x, 0, 6, MARKET_FLOOR);
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x + 60, 0);
      ctx.lineTo(x + 66, 0);
      ctx.lineTo(x + 6, 46);
      ctx.fill();
    }
    ctx.fillStyle = mix('#5c4a3a', '#1a1420', nf * 0.6);
    ctx.fillRect(L, 0, R - L, 30);
    if (nf < 0.6) {
      ctx.fillStyle = 'rgba(255,240,200,.08)';
      for (let x = Math.floor(L / 360) * 360 + 100; x < R; x += 360) {
        ctx.beginPath();
        ctx.moveTo(x, 30);
        ctx.lineTo(x + 50, 30);
        ctx.lineTo(x + 140, MARKET_FLOOR);
        ctx.lineTo(x - 40, MARKET_FLOOR);
        ctx.fill();
      }
    }
    // nền xi măng ướt
    ctx.fillStyle = mix('#9e9a92', '#3a3640', nf * 0.5);
    ctx.fillRect(L, MARKET_FLOOR, R - L, H - MARKET_FLOOR);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let x = Math.floor(L / 90) * 90; x < R; x += 90)
      ctx.fillRect(x, MARKET_FLOOR + 30 + (x % 3) * 18, 50, 4);

    // biển chợ
    ctx.fillStyle = '#7a1f1a';
    rr(ctx, 420, 44, 380, 42, 8);
    ctx.fill();
    ctx.strokeStyle = '#e9c46a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f9e2a2';
    ctx.font = '800 20px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏪 CHỢ ĐẦU MỐI · ' + info.marketSections.length + ' KHU', 610, 65);
    ctx.textBaseline = 'alphabetic';

    // cổng chợ (lối ra)
    ctx.fillStyle = '#4a2f1d';
    ctx.fillRect(MARKET_GATE_X - 58, 150, 116, MARKET_FLOOR - 148);
    ctx.fillStyle = this.skyGradient(160, MARKET_FLOOR, nf);
    ctx.fillRect(MARKET_GATE_X - 48, 160, 96, MARKET_FLOOR - 158);
    this.drawLabel('🚪 Cổng chợ (ra phố)', MARKET_GATE_X, 136);

    // quầy tính tiền + xe ba gác chờ
    const cx = MARKET_CHECKOUT_X;
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(cx - 70, 320, 140, MARKET_FLOOR - 318);
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(cx - 76, 312, 152, 10);
    ctx.font = '26px sans-serif';
    ctx.fillText('🧾', cx - 40, 306);
    ctx.fillText('⚖️', cx + 10, 306);
    ctx.fillText('🛵', cx + 46, 306);
    this.drawPerson(
      { x: cx, y: 316, bob: 0, skin: '#c68642', shirt: '#2a6f97', hair: '#222', walking: false },
      1.1,
    );
    this.drawLabel('🧾 Tính tiền · gánh về / gọi xe', cx, 220);

    // các sạp theo khu
    info.marketSections.forEach((sec, i) => {
      const x = MARKET_FIRST_STALL + i * MARKET_STALL_SPACING;
      if (x < L - 200 || x > R + 200) return;
      this.drawStall(sec, x, nf, info.noteSections?.includes(sec.id) ?? false, i);
    });

    // người đi chợ + chủ quán
    const drawables: { y: number; draw: () => void }[] = [
      ...this.walkers.map((p) => ({ y: p.y, draw: () => this.drawShopper(p) })),
      { y: HERO_FEET_INSIDE, draw: () => this.drawHero(HERO_FEET_INSIDE, 1.2) },
    ].sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    this.drawFloats();
    this.drawPrompt(HERO_FEET_INSIDE, 1.2);
    ctx.restore();

    // bản đồ khu chợ
    this.drawMarketMap();
  }

  private drawStall(
    sec: MarketSection & { goods: string[] },
    x: number,
    nf: number,
    noted: boolean,
    index: number,
  ) {
    const ctx = this.ctx;
    const w = 220;
    const L = x - w / 2;
    // bạt che sạp
    for (let k = 0, ax = L - 6; ax < L + w + 6; ax += 24, k++) {
      ctx.fillStyle = k % 2 ? '#f6ecd8' : sec.color;
      ctx.beginPath();
      ctx.moveTo(ax, 150);
      ctx.lineTo(ax + 24, 150);
      ctx.lineTo(ax + 24, 182);
      ctx.quadraticCurveTo(ax + 12, 192, ax, 182);
      ctx.fill();
    }
    ctx.fillStyle = '#5c3d2e';
    ctx.fillRect(L - 4, 150, 6, MARKET_FLOOR - 150);
    ctx.fillRect(L + w - 2, 150, 6, MARKET_FLOOR - 150);
    // biển khu
    ctx.fillStyle = mix(sec.color, '#111', 0.25);
    rr(ctx, L + 8, 104, w - 16, 38, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 14px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${sec.icon} ${sec.name}`, x, 123, w - 26);
    ctx.textBaseline = 'alphabetic';
    if (noted) {
      ctx.font = '22px sans-serif';
      ctx.fillText('📌', L + w - 8, 108 + Math.sin(this.time * 4) * 3);
    }

    // người bán + câu rao
    this.drawPerson(
      {
        x: x + 60,
        y: 318,
        bob: index,
        skin: SKIN[index % SKIN.length]!,
        shirt: sec.color,
        hair: '#222',
        walking: false,
      },
      1.05,
    );
    const callOn = Math.sin(this.time * 0.9 + index * 1.7) > 0.55;
    if (callOn) {
      ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
      const tw = ctx.measureText(sec.call).width + 16;
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      rr(ctx, x + 60 - tw / 2, 214, tw, 24, 10);
      ctx.fill();
      ctx.fillStyle = '#3b2416';
      ctx.fillText(sec.call, x + 60, 230);
    }

    // sạp hàng: mẹt, thúng bày hàng
    ctx.fillStyle = '#a0763a';
    ctx.fillRect(L + 6, 318, w - 12, 50);
    ctx.fillStyle = '#7f5539';
    ctx.fillRect(L + 6, 318, w - 12, 6);
    ctx.fillRect(L + 14, 368, 8, MARKET_FLOOR - 368);
    ctx.fillRect(L + w - 22, 368, 8, MARKET_FLOOR - 368);
    const goods = sec.goods.slice(0, 10);
    ctx.font = '20px sans-serif';
    goods.forEach((g, k) => {
      const row = Math.floor(k / 5);
      const gx = L + 30 + (k % 5) * 40;
      const gy = 316 - row * 26;
      if (row === 0) {
        ctx.fillStyle = '#c99a5b';
        ctx.beginPath();
        ctx.ellipse(gx, gy + 2, 17, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillText(g, gx, gy);
    });
    // thúng dưới đất
    ctx.font = '26px sans-serif';
    ctx.fillText('🧺', L + 30, MARKET_FLOOR + 22);
    if (nf > 0.4) {
      const g = ctx.createRadialGradient(x, 200, 5, x, 220, 160);
      g.addColorStop(0, `rgba(255,220,140,${0.25 * nf})`);
      g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(L - 40, 150, w + 80, 250);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(x, 196, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawShopper(p: Person) {
    this.drawPerson(p, 1.15);
    // giỏ đi chợ
    const ctx = this.ctx;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧺', p.x + 12, p.y - 22);
  }

  private drawMarketMap() {
    const info = this.info;
    if (!info) return;
    const ctx = this.ctx;
    const mw = 440;
    const mx = W - mw - 18;
    const my = H - 22;
    const sx = (wx: number) => mx + (wx / MARKET_W) * mw;
    ctx.fillStyle = 'rgba(20,12,26,.72)';
    rr(ctx, mx - 10, my - 16, mw + 20, 30, 15);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '13px sans-serif';
    ctx.fillText('🚪', sx(MARKET_GATE_X), my);
    ctx.fillText('🧾', sx(MARKET_CHECKOUT_X), my);
    info.marketSections.forEach((sec, i) =>
      ctx.fillText(sec.icon, sx(MARKET_FIRST_STALL + i * MARKET_STALL_SPACING), my),
    );
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(sx(this.heroX) - 5, my - 16);
    ctx.lineTo(sx(this.heroX) + 5, my - 16);
    ctx.lineTo(sx(this.heroX), my - 9);
    ctx.fill();
    ctx.textBaseline = 'alphabetic';
  }
}
