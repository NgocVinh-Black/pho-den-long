// Phục vụ tại bàn: khách vào quán ngồi → nhận order → nấu ở bếp → bưng ra bàn → khách ăn → về.
// Có nhân viên phục vụ (nhận order, bưng món) và phụ bếp (tự nấu). Chỉ là logic, không vẽ.
import { seatName, type CustomerTypeId, type InteriorStyle, type Recipe } from '@pdl/shared';

export interface Look {
  bob: number;
  skin: string;
  shirt: string;
  hair: string;
}

export interface DinerInfo extends Look {
  type: CustomerTypeId;
  typeName: string;
  recipe: Recipe;
  patience: number;
}

export type DinerState = 'queue' | 'toSeat' | 'seated' | 'ordered' | 'eating' | 'toDoor';

export interface Diner extends DinerInfo {
  id: number;
  /** Vị trí x trong quán */
  x: number;
  state: DinerState;
  seat?: number;
  maxPatience: number;
  eatT: number;
  mood?: string;
  moodT: number;
  orderId?: number;
  walking: boolean;
}

export type OrderStatus = 'queued' | 'cooking' | 'ready' | 'carried';

export interface Order {
  id: number;
  dinerId: number;
  seat: number;
  recipe: Recipe;
  status: OrderStatus;
  cookedBy?: 'player' | 'staff';
  quality?: number;
  /** ai đang nấu / đang bưng */
  by?: 'hero' | 'cook' | `waiter:${string}`;
  cookT?: number;
}

export interface StaffNpc extends Look {
  id: string;
  role: 'waiter' | 'cook';
  name: string;
  x: number;
  walking: boolean;
  facing: 1 | -1;
  /** việc đang làm */
  task?: { kind: 'take' | 'deliver' | 'pickup'; seat?: number; orderId?: number };
  timer: number;
  carrying?: number;
}

export interface ServiceLayout {
  doorX: number;
  stoveX: number;
  passX: number;
  homeX: number;
  seatX: (seat: number) => number;
  queueX: (i: number) => number;
}

export interface ServiceHooks {
  /** Kệ còn đủ nguyên liệu cho món này không (đã trừ các order đang làm) */
  canAccept: (recipe: Recipe) => boolean;
  onAngry: (d: Diner, reason: string) => void;
  /** Món tới bàn: tính tiền (gọi API). Trả về biểu cảm của khách. */
  onDeliver: (order: Order, diner: Diner) => void;
  /** Khách ra khỏi quán ở cửa */
  onExit: (d: Diner) => void;
  onEvent?: (text: string) => void;
}

export interface ServiceConfig {
  seats: number;
  maxQueue: number;
  eatSeconds: number;
  cookSkill: number;
  cookSeconds: number;
  /** Cách gọi theo nghề của quán (bàn/chỗ/hàng ghế, nấu/làm/diễn…) cho các thông báo */
  style: InteriorStyle;
}

const WALK = 110;
const STAFF_WALK = 170;

export class DineService {
  diners: Diner[] = [];
  orders: Order[] = [];
  staff: StaffNpc[] = [];
  /** order chủ quán đang bưng */
  heroCarrying: number | null = null;
  private uid = 0;
  private oid = 0;

  constructor(
    private layout: ServiceLayout,
    private hooks: ServiceHooks,
    public config: ServiceConfig,
  ) {}

  reset() {
    this.diners = [];
    this.orders = [];
    this.heroCarrying = null;
    for (const s of this.staff) {
      s.task = undefined;
      s.carrying = undefined;
      s.x = s.role === 'cook' ? this.layout.stoveX + 40 : this.layout.homeX;
    }
  }

  /** Đồng bộ danh sách nhân viên đang thuê. */
  setStaff(list: { id: string; role: 'waiter' | 'cook'; name: string }[], looks: (i: number) => Look) {
    const keep = this.staff.filter((s) => list.some((l) => l.id === s.id));
    for (const [i, l] of list.entries()) {
      if (keep.some((s) => s.id === l.id)) continue;
      keep.push({
        ...looks(i),
        id: l.id,
        role: l.role,
        name: l.name,
        x: l.role === 'cook' ? this.layout.stoveX + 40 : this.layout.homeX + i * 30,
        walking: false,
        facing: -1,
        timer: 0,
      });
    }
    // việc của nhân viên đã nghỉ được trả lại
    for (const o of this.orders) {
      if (
        o.by &&
        o.by !== 'hero' &&
        !keep.some((s) => o.by === (s.role === 'cook' ? 'cook' : `waiter:${s.id}`))
      ) {
        if (o.status === 'cooking') o.status = 'queued';
        if (o.status === 'carried') o.status = 'ready';
        o.by = undefined;
      }
    }
    this.staff = keep;
  }

  get hasCook() {
    return this.staff.some((s) => s.role === 'cook');
  }

  // ---------- truy vấn ----------
  seatOf(seat: number) {
    return this.diners.find((d) => d.seat === seat && d.state !== 'toDoor');
  }

  freeSeats(): number[] {
    const taken = new Set(
      this.diners.filter((d) => d.seat !== undefined && d.state !== 'toDoor').map((d) => d.seat),
    );
    const out: number[] = [];
    for (let s = 0; s < this.config.seats; s++) if (!taken.has(s)) out.push(s);
    return out;
  }

  queueCount() {
    return this.diners.filter((d) => d.state === 'queue').length;
  }

  /** Số khách chưa xong việc (để đóng cửa) */
  busy() {
    return this.diners.length > 0;
  }

  activeOrders() {
    return this.orders;
  }

  carriedOrder() {
    return this.orders.find((o) => o.id === this.heroCarrying) ?? null;
  }

  readyOnPass() {
    return this.orders.filter((o) => o.status === 'ready');
  }

  nextToCook() {
    return this.orders.find((o) => o.status === 'queued') ?? null;
  }

  // ---------- khách vào quán ----------
  admit(info: DinerInfo): boolean {
    if (this.queueCount() >= this.config.maxQueue) return false;
    const d: Diner = {
      ...info,
      id: ++this.uid,
      x: this.layout.doorX,
      state: 'queue',
      maxPatience: info.patience,
      eatT: 0,
      moodT: 0,
      walking: true,
    };
    this.diners.push(d);
    this.seatWaiting();
    return true;
  }

  private seatWaiting() {
    for (const d of this.diners) {
      if (d.state !== 'queue') continue;
      const seat = this.freeSeats()[0];
      if (seat === undefined) return;
      d.seat = seat;
      d.state = 'toSeat';
      d.patience = Math.max(d.patience, d.maxPatience * 0.8); // ngồi xuống thấy dễ chịu hơn
    }
  }

  // ---------- thao tác (chủ quán hoặc nhân viên) ----------
  /** Nhận order ở bàn. */
  takeOrder(seat: number, by: 'hero' | `waiter:${string}` = 'hero'): 'ok' | 'none' | 'out' {
    const d = this.seatOf(seat);
    if (!d || d.state !== 'seated') return 'none';
    if (!this.hooks.canAccept(d.recipe)) {
      this.hooks.onAngry(d, `Hết nguyên liệu làm ${d.recipe.name}! Khách bỏ về.`);
      this.sendHome(d, '😞');
      return 'out';
    }
    const order: Order = { id: ++this.oid, dinerId: d.id, seat, recipe: d.recipe, status: 'queued' };
    this.orders.push(order);
    d.state = 'ordered';
    d.orderId = order.id;
    d.patience = Math.max(d.patience, d.maxPatience * 0.9);
    this.hooks.onEvent?.(
      `📝 ${by === 'hero' ? 'Đã' : 'Phục vụ đã'} ${this.config.style.takeOrder.toLowerCase()} ${seatName(this.config.style, Math.floor(seat / 2) + 1).toLowerCase()}: ${d.recipe.name}`,
    );
    return 'ok';
  }

  /** Chủ quán bắt đầu nấu order. */
  heroStartCook(orderId: number) {
    const o = this.orders.find((x) => x.id === orderId);
    if (!o || o.status !== 'queued') return false;
    o.status = 'cooking';
    o.by = 'hero';
    return true;
  }

  /** Chủ quán nấu xong: tự bưng luôn. */
  heroCookDone(orderId: number, quality: number) {
    const o = this.orders.find((x) => x.id === orderId);
    if (!o) return;
    o.quality = quality;
    o.cookedBy = 'player';
    o.status = 'carried';
    o.by = 'hero';
    this.heroCarrying = o.id;
  }

  heroCancelCook(orderId: number) {
    const o = this.orders.find((x) => x.id === orderId);
    if (o && o.status === 'cooking' && o.by === 'hero') {
      o.status = 'queued';
      o.by = undefined;
    }
  }

  /** Chủ quán lấy món phụ bếp đã nấu ở quầy ra món. */
  heroPickUp(orderId: number) {
    if (this.heroCarrying !== null) return false;
    const o = this.orders.find((x) => x.id === orderId && x.status === 'ready');
    if (!o) return false;
    o.status = 'carried';
    o.by = 'hero';
    this.heroCarrying = o.id;
    return true;
  }

  /** Đưa món tới bàn. */
  deliver(seat: number, by: 'hero' | `waiter:${string}`): boolean {
    const d = this.seatOf(seat);
    const o = this.orders.find((x) => x.status === 'carried' && x.by === by && x.seat === seat);
    if (!d || !o || d.orderId !== o.id) return false;
    this.orders = this.orders.filter((x) => x !== o);
    if (by === 'hero') this.heroCarrying = null;
    d.state = 'eating';
    d.eatT = this.config.eatSeconds;
    this.hooks.onDeliver(o, d);
    return true;
  }

  setMood(dinerId: number, mood: string) {
    const d = this.diners.find((x) => x.id === dinerId);
    if (d) {
      d.mood = mood;
      d.moodT = 2.5;
    }
  }

  /** Đóng cửa: khách chưa được phục vụ ra về (không trừ danh tiếng). */
  closing() {
    for (const d of this.diners) {
      if (d.state === 'queue' || d.state === 'toSeat' || d.state === 'seated' || d.state === 'ordered') {
        this.sendHome(d, '🌙');
      }
    }
  }

  private sendHome(d: Diner, mood: string) {
    if (d.orderId !== undefined) {
      const o = this.orders.find((x) => x.id === d.orderId);
      if (o) {
        if (o.id === this.heroCarrying) this.heroCarrying = null;
        this.orders = this.orders.filter((x) => x !== o);
      }
    }
    d.state = 'toDoor';
    d.seat = undefined;
    d.mood = mood;
    d.moodT = 3;
    this.seatWaiting();
  }

  // ---------- mô phỏng ----------
  update(dt: number) {
    const L = this.layout;
    for (const d of [...this.diners]) {
      if (d.moodT > 0) d.moodT -= dt;
      const target =
        d.state === 'queue'
          ? L.queueX(this.diners.filter((x) => x.state === 'queue').indexOf(d))
          : d.state === 'toDoor'
            ? L.doorX
            : d.seat !== undefined
              ? L.seatX(d.seat)
              : d.x;
      const dx = target - d.x;
      d.walking = Math.abs(dx) > 2;
      if (d.walking) d.x += Math.sign(dx) * Math.min(Math.abs(dx), WALK * dt);
      if (d.state === 'toSeat' && !d.walking) d.state = 'seated';
      if (d.state === 'toDoor' && !d.walking) {
        this.diners = this.diners.filter((x) => x !== d);
        this.hooks.onExit(d);
        continue;
      }
      // kiên nhẫn: đứng chờ chỗ / chờ gọi món tụt nhanh, chờ món tụt chậm hơn
      if (d.state === 'queue' || d.state === 'seated' || d.state === 'ordered') {
        d.patience -= dt * (d.state === 'ordered' ? 0.6 : 1);
        if (d.patience <= 0) {
          this.hooks.onAngry(d, `${d.typeName} chờ lâu quá nên bỏ về!`);
          this.sendHome(d, '😠');
        }
      }
      if (d.state === 'eating') {
        d.eatT -= dt;
        if (d.eatT <= 0) this.sendHome(d, d.mood && d.moodT > 0 ? d.mood : '😋');
      }
    }
    this.updateStaff(dt);
  }

  private updateStaff(dt: number) {
    const L = this.layout;
    for (const s of this.staff) {
      if (s.role === 'cook') {
        // phụ bếp: nấu lần lượt các order chưa ai nấu
        let o = this.orders.find((x) => x.status === 'cooking' && x.by === 'cook');
        if (!o) {
          o = this.orders.find((x) => x.status === 'queued');
          if (o) {
            o.status = 'cooking';
            o.by = 'cook';
            o.cookT = this.config.cookSeconds;
          }
        }
        s.walking = false;
        s.x = L.stoveX + 40 + (o ? Math.sin(Date.now() / 160) * 6 : 0);
        if (o) {
          o.cookT = (o.cookT ?? 0) - dt;
          if (o.cookT <= 0) {
            o.status = 'ready';
            o.by = undefined;
            o.cookedBy = 'staff';
            o.quality = Math.max(0.3, Math.min(1, this.config.cookSkill + (Math.random() - 0.5) * 0.16));
            this.hooks.onEvent?.(
              `🧑‍🍳 ${s.name} ${this.config.style.make.toLowerCase()} xong ${o.recipe.name} (${seatName(this.config.style, Math.floor(o.seat / 2) + 1).toLowerCase()})`,
            );
          }
        }
        continue;
      }
      // phục vụ: ưu tiên bưng món đã xong, rồi nhận order
      const me = `waiter:${s.id}` as const;
      if (!s.task) {
        const carried = this.orders.find((o) => o.status === 'carried' && o.by === me);
        const ready = this.orders.find((o) => o.status === 'ready' && !o.by);
        const reserved = new Set(this.staff.map((x) => x.task?.seat).filter((x) => x !== undefined));
        const wants = this.diners.find(
          (d) => d.state === 'seated' && d.seat !== undefined && !reserved.has(d.seat),
        );
        if (carried) s.task = { kind: 'deliver', seat: carried.seat, orderId: carried.id };
        else if (ready) {
          ready.by = me;
          s.task = { kind: 'pickup', orderId: ready.id };
        } else if (wants) s.task = { kind: 'take', seat: wants.seat };
      }
      const t = s.task;
      const tx = !t ? L.homeX : t.kind === 'pickup' ? L.passX : L.seatX(t.seat ?? 0);
      const dx = tx - s.x;
      s.walking = Math.abs(dx) > 3;
      if (s.walking) {
        s.x += Math.sign(dx) * Math.min(Math.abs(dx), STAFF_WALK * dt);
        s.facing = dx > 0 ? 1 : -1;
        continue;
      }
      if (!t) continue;
      s.timer += dt;
      if (s.timer < 0.6) continue;
      s.timer = 0;
      if (t.kind === 'take') {
        this.takeOrder(t.seat ?? -1, me);
        s.task = undefined;
      } else if (t.kind === 'pickup') {
        const o = this.orders.find((x) => x.id === t.orderId);
        if (o && o.status === 'ready' && o.by === me) {
          o.status = 'carried';
          s.carrying = o.id;
          s.task = { kind: 'deliver', seat: o.seat, orderId: o.id };
        } else s.task = undefined;
      } else {
        this.deliver(t.seat ?? -1, me);
        s.carrying = undefined;
        s.task = undefined;
      }
      // đơn bị hủy giữa chừng (khách bỏ về)
      if (s.carrying !== undefined && !this.orders.some((o) => o.id === s.carrying)) s.carrying = undefined;
    }
  }
}
