import type { CustomerType, ShopKind } from './types';

/** Luật chơi & cân bằng kinh tế. Mọi số tiền tính bằng nghìn đồng (k). */
export const RULES = {
  startMoney: 300,
  dayLengthSec: 90,
  maxQueue: 5,
  /** Hàng tươi hư 50% mỗi đêm */
  spoilRate: 0.5,
  priceMargin: { food: 2.0, craft: 1.9, show: 2.2 } satisfies Record<ShopKind, number>,
  /** +20% giá bán mỗi cấp quán */
  levelPriceBonus: 0.2,
  maxShopLevel: 5,
  shopUpgradeCost: (level: number) => 250 * level,
  maxDecor: 5,
  decorCost: (level: number) => 200 * (level + 1),
  /** Món thứ i (0-based) của quán: giá học công thức & danh tiếng yêu cầu */
  learnCost: [0, 180, 380],
  learnRep: [0, 5, 15],
  qualityWeights: { prep: 0.35, technique: 0.65 },
  /** Bà nội gửi vốn khi trắng tay */
  rescueMoney: 150,
  rescueThreshold: 40,
  maxNameLength: 24,
  /** Số phần hàng tự gánh được cùng lúc: 20 + 5 mỗi cấp quán */
  carryCapacity: (shopLevel: number) => 20 + 5 * (shopLevel - 1),
  /** Phí giao hàng: 10% giá trị đơn, tối thiểu 5k */
  deliveryFeeRate: 0.1,
  deliveryMinFee: 5,
  /** Thời gian xe ba gác chở hàng từ chợ tới quán (giây) */
  deliverySeconds: 12,
} as const;

export type StaffRole = 'waiter' | 'cook';

/** Nhân viên có thể thuê. Lương trả cuối mỗi ngày. */
export const STAFF_ROLES: Record<
  StaffRole,
  { title: string; icon: string; wage: number; max: number; desc: string; skill?: number }
> = {
  waiter: {
    title: 'Nhân viên phục vụ',
    icon: '🧑‍💼',
    wage: 40,
    max: 2,
    desc: 'Tự nhận order ở bàn và bưng món từ bếp ra cho khách.',
  },
  cook: {
    title: 'Phụ bếp',
    icon: '🧑‍🍳',
    wage: 60,
    max: 1,
    skill: 0.68,
    desc: 'Tự nấu các phiếu order (chậm hơn bạn, món đạt khoảng 68%).',
  },
};

export const STAFF_NAMES = [
  'Tí',
  'Tèo',
  'Mận',
  'Đào',
  'Bông',
  'Sửu',
  'Lan',
  'Cúc',
  'Tâm',
  'Hùng',
  'Na',
  'Út',
];

export const deliveryFee = (goodsTotal: number) =>
  Math.max(RULES.deliveryMinFee, Math.round(goodsTotal * RULES.deliveryFeeRate));

/** Lựa chọn ngoại hình nhân vật chủ quán. */
export const AVATAR_OPTIONS = {
  skin: ['#f1c27d', '#e0ac69', '#c68642', '#ffdbac', '#8d5524'],
  shirt: ['#c0392b', '#2a9d8f', '#3a86ff', '#f4a261', '#8338ec', '#2b2d42', '#ffffff'],
  hat: ['nonla', 'none', 'cap', 'khan'],
} as const;

export const HAT_LABELS: Record<(typeof AVATAR_OPTIONS.hat)[number], string> = {
  nonla: 'Nón lá',
  none: 'Đầu trần',
  cap: 'Mũ lưỡi trai',
  khan: 'Khăn rằn',
};

export const CUSTOMER_TYPES: CustomerType[] = [
  { id: 'local', name: 'Người dân phố', weight: 5, patience: 26, pay: 1.0, repMul: 1 },
  { id: 'student', name: 'Sinh viên', weight: 4, patience: 22, pay: 0.85, repMul: 1, favors: ['food'] },
  {
    id: 'tourist',
    name: 'Khách Tây',
    weight: 2,
    patience: 30,
    pay: 1.5,
    repMul: 1,
    favors: ['craft', 'show'],
  },
  { id: 'critic', name: 'Dân sành ăn', weight: 1, patience: 18, pay: 1.2, repMul: 2 },
  { id: 'reviewer', name: 'Food reviewer', weight: 0.6, patience: 20, pay: 1.0, repMul: 3 },
];
