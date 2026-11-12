// Kiểu dữ liệu dùng chung giữa API và Web.

export type RegionId = 'bac' | 'trung' | 'nam' | 'nghe';
export type ShopKind = 'food' | 'craft' | 'show';
/**
 * Kiểu bên trong quán (bố cục, đồ đạc, cách gọi):
 * an: quán ăn · nuoc: quán nước & chè · ghe: ghe nổi · nghe: xưởng nghề & tiệm quà · sankhau: sân khấu
 * Thiết kế: design/gdd/interiors.md
 */
export type InteriorKind = 'an' | 'nuoc' | 'ghe' | 'nghe' | 'sankhau';

/**
 * Vai của một món đồ quán xá. Mỗi kiểu quán có đúng một món cho mỗi vai, nên bản lưu cũ
 * chuyển được 1:1 khi đổi danh mục (xem `migrateFurnitureId`).
 */
export type FurnitureRole = 'seat' | 'seat_plus' | 'cool' | 'plant' | 'art' | 'light' | 'music';

/** Cách gọi các thứ trong quán theo nghề (quán ăn nói "bàn", sân khấu nói "hàng ghế"…). */
export interface InteriorStyle {
  id: InteriorKind;
  name: string;
  /** Một cụm 2 chỗ, viết thường: "bàn", "chỗ", "hàng ghế" */
  seat: string;
  /** Nơi làm món/sản phẩm, có biểu tượng: "🔥 Bếp" */
  station: string;
  /** Hành động nhận yêu cầu ở chỗ khách: "Nhận order" */
  takeOrder: string;
  /** Tên phiếu yêu cầu, viết thường: "order", "yêu cầu", "vé" */
  order: string;
  /** Động từ làm: "Nấu", "Pha", "Làm", "Diễn" */
  make: string;
  /** Động từ mang ra cho khách: "Bưng", "Mang", "Mời" */
  serve: string;
  /** Khách đang làm gì khi đã được phục vụ: "đang ăn" */
  enjoy: string;
  /** Tiêu đề bảng treo tường */
  board: string;
  /** Nơi để món làm xong chờ mang ra */
  pass: string;
}
/**
 * Kiểu trò chơi khi làm món:
 * timing: dừng kim · mash: nhấn liên tục · memory: nhớ hoa văn · pour: giữ để rót/chan
 * chop: thái/cắt theo làn · grill: nướng/lật nhiều món cùng lúc · rhythm: bấm theo nhịp
 */
export type TechniqueType = 'timing' | 'mash' | 'memory' | 'pour' | 'chop' | 'grill' | 'rhythm';
export type CustomerTypeId = 'local' | 'student' | 'tourist' | 'critic' | 'reviewer';

export type MarketSectionId = 'rau' | 'thit' | 'ca' | 'traicay' | 'bot' | 'kho' | 'thucong' | 'noithat';

export interface MarketSection {
  id: MarketSectionId;
  name: string;
  icon: string;
  /** Câu rao của người bán */
  call: string;
  color: string;
}

export interface Ingredient {
  id: string;
  /** Khu trong chợ đầu mối bán nguyên liệu này */
  section: MarketSectionId;
  name: string;
  icon: string;
  /** Giá gốc, nghìn đồng / phần */
  price: number;
  /** Hàng tươi: hư một phần sau mỗi đêm */
  perishable: boolean;
}

export interface RecipeIngredient {
  id: string;
  qty: number;
}

export interface Technique {
  type: TechniqueType;
  label: string;
  motifs?: string[];
}

export interface RecipeDef {
  id: string;
  name: string;
  icon: string;
  ingredients: RecipeIngredient[];
  technique: Technique;
}

export interface Recipe extends RecipeDef {
  cost: number;
  price: number;
  learnCost: number;
  learnRep: number;
  starter: boolean;
}

export interface ShopColors {
  wall: string;
  roof: string;
  awning: string;
}

export interface ShopDef {
  id: string;
  region: RegionId;
  name: string;
  icon: string;
  kind: ShopKind;
  /** Kiểu bên trong quán (bố cục, đồ quán xá, cách gọi) */
  interior: InteriorKind;
  desc: string;
  colors: ShopColors;
  recipes: RecipeDef[];
}

export interface Shop extends Omit<ShopDef, 'recipes'> {
  recipes: Recipe[];
  ingredientIds: string[];
}

export interface Region {
  id: RegionId;
  name: string;
  area: string;
  color: string;
}

export interface CustomerType {
  id: CustomerTypeId;
  name: string;
  weight: number;
  patience: number;
  pay: number;
  repMul: number;
  favors?: ShopKind[];
}

export interface PublicRules {
  startMoney: number;
  dayLengthSec: number;
  maxQueue: number;
  spoilRate: number;
  levelPriceBonus: number;
  maxShopLevel: number;
  maxDecor: number;
  deliverySeconds: number;
  deliveryFeeRate: number;
  deliveryMinFee: number;
  carryCapacities: number[];
  shopUpgradeCosts: number[];
  decorCosts: number[];
  qualityWeights: { prep: number; technique: number };
}

export type AdPlanId = 'nho' | 'vua' | 'lon';

/** Gói thuê máy bay kéo băng rôn quảng cáo (tác dụng trong một ngày). */
export interface AdPlan {
  id: AdPlanId;
  name: string;
  icon: string;
  /** Giá thuê, nghìn đồng */
  price: number;
  /** +% lượng khách ghé, ví dụ 0.3 = +30% */
  traffic: number;
  /** Số vòng máy bay bay ngang phố trong giờ bán */
  flights: number;
  /** Nhân trọng số khách Tây */
  touristMul: number;
  desc: string;
}

export interface FurnitureItem {
  id: string;
  /** Kiểu quán dùng món này (mỗi kiểu một danh mục riêng) */
  interior: InteriorKind;
  /** Vai của món trong danh mục: dùng để vẽ và để chuyển bản lưu cũ */
  role: FurnitureRole;
  name: string;
  /** Tên riêng theo từng quán (ví dụ chỗ ngồi ở tiệm áo dài là "Phòng thử áo") */
  names?: Partial<Record<string, string>>;
  icon: string;
  kind: 'table' | 'decor';
  price: number;
  max: number;
  seats?: number;
  payBonus?: number;
  patienceBonus?: number;
  trafficBonus?: number;
  desc: string;
}

export interface Catalog {
  regions: Region[];
  marketSections: MarketSection[];
  furniture: FurnitureItem[];
  interiors: InteriorStyle[];
  adPlans: AdPlan[];
  shops: Shop[];
  ingredients: Ingredient[];
  customerTypes: CustomerType[];
  rules: PublicRules;
}

// ----- Trạng thái người chơi -----
export interface DayStats {
  served: number;
  perfect: number;
  missed: number;
  revenue: number;
  spent: number;
  dishes: Record<string, number>;
}

export interface Totals {
  served: number;
  revenue: number;
  perfect: number;
  bestDay: number;
}

export type HatStyle = 'nonla' | 'none' | 'cap' | 'khan';

export interface Avatar {
  skin: string;
  shirt: string;
  hat: HatStyle;
}

export type ShipmentMode = 'carry' | 'delivery';

/** Đơn hàng đã mua ở chợ nhưng chưa cất vào kho (đang gánh hoặc đang giao). */
export interface Shipment {
  id: string;
  mode: ShipmentMode;
  fee: number;
  items: RecipeIngredient[];
  createdAt: string;
}

export interface StaffMember {
  id: string;
  role: 'waiter' | 'cook';
  name: string;
  hiredDay: number;
}

export interface PlayerState {
  id: string;
  name: string;
  avatar: Avatar;
  shopId: string;
  day: number;
  money: number;
  rep: number;
  decor: number;
  shopLevel: number;
  learned: string[];
  pantry: Record<string, number>;
  /** Hàng đang gánh trên vai hoặc đang được xe chở tới */
  shipments: Shipment[];
  /** Đồ nội thất trong quán: id → số lượng */
  furniture: Record<string, number>;
  /** Nhân viên đang thuê */
  staff: StaffMember[];
  /** Gói máy bay quảng cáo đã thuê hôm nay (null = chưa thuê) */
  adPlan: AdPlanId | null;
  today: DayStats;
  totals: Totals;
}

export interface MarketItem {
  id: string;
  /** Nguyên liệu có trong công thức của quán mình */
  forMyShop: boolean;
  /** Các quán dùng nguyên liệu này */
  usedBy: string[];
  price: number;
  basePrice: number;
  trend: 'up' | 'down' | 'flat';
  stock: number;
  neededNow: boolean;
}

export interface Market {
  day: number;
  items: MarketItem[];
}

export interface BuyResult {
  spent: number;
  shipment: Shipment;
  player: PlayerState;
}

export interface ReceiveResult {
  received: RecipeIngredient[];
  player: PlayerState;
}

export interface ServeResult {
  pay: number;
  repDelta: number;
  stars: number;
  player: PlayerState;
}

export interface MissResult {
  repDelta: number;
  player: PlayerState;
}

export interface DaySummary extends DayStats {
  day: number;
  profit: number;
  spoiled: RecipeIngredient[];
  rescued: number;
  /** Hàng còn gánh / đang giao được tự cất vào kho cuối ngày */
  autoStocked: RecipeIngredient[];
  /** Tiền lương đã trả nhân viên */
  wagesPaid: number;
  /** Nhân viên nghỉ việc vì không được trả lương */
  staffQuit: StaffMember[];
}

export interface EndDayResult {
  summary: DaySummary;
  player: PlayerState;
}

export interface PlayerResult {
  player: PlayerState;
}

export interface LeaderboardEntry {
  name: string;
  shop: string;
  shopIcon: string;
  day: number;
  rep: number;
  revenue: number;
}

// ----- Sổ ghi chú đi chợ -----
export interface NoteItem {
  text: string;
  ingredientId?: string;
  qty?: number;
  done: boolean;
}

export interface Note {
  id: string;
  title: string;
  items: NoteItem[];
  pinned: boolean;
  updatedAt: string;
}

// ----- Tài khoản -----
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  picture: string | null;
}

export interface AuthConfig {
  /** null = máy chủ chưa cấu hình đăng nhập Google */
  googleClientId: string | null;
}

export interface MeResult {
  user: AuthUser | null;
}

/** Tóm tắt một bản lưu (quán) để hiển thị danh sách */
export interface PlayerSummary {
  id: string;
  name: string;
  shopId: string;
  day: number;
  money: number;
  rep: number;
  avatar: Avatar;
  updatedAt: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
