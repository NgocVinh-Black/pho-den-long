import type { AdPlan } from '../types';

/**
 * Gói thuê máy bay kéo băng rôn quảng cáo cho quán. Thuê buổi sáng, có tác dụng trong ngày đó.
 * - traffic: +% lượng khách ghé (nhân vào nhịp sinh khách)
 * - flights: số vòng máy bay bay ngang phố trong giờ bán
 * - touristMul: nhân trọng số khách Tây (máy bay to, khách du lịch chú ý)
 * Thiết kế: design/gdd/ads.md
 */
export const AD_PLANS: AdPlan[] = [
  {
    id: 'nho',
    name: 'Máy bay nhỏ',
    icon: '🛩️',
    price: 60,
    traffic: 0.15,
    flights: 2,
    touristMul: 1,
    desc: 'Bay 2 vòng qua phố, khách ghé thêm 15%.',
  },
  {
    id: 'vua',
    name: 'Máy bay vừa',
    icon: '✈️',
    price: 120,
    traffic: 0.3,
    flights: 4,
    touristMul: 1,
    desc: 'Bay 4 vòng, khách ghé thêm 30%.',
  },
  {
    id: 'lon',
    name: 'Máy bay lớn',
    icon: '🛫',
    price: 200,
    traffic: 0.5,
    flights: 6,
    touristMul: 2,
    desc: 'Bay 6 vòng, khách ghé thêm 50%, khách Tây gấp đôi.',
  },
];

export const adPlanMap: ReadonlyMap<string, AdPlan> = new Map(AD_PLANS.map((p) => [p.id, p]));
