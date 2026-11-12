import type { MarketSection } from '../types';

/** Các khu trong chợ đầu mối, theo thứ tự từ cổng chợ đi vào. */
export const MARKET_SECTIONS: MarketSection[] = [
  { id: 'rau', name: 'Khu rau củ, lá', icon: '🥬', call: 'Rau mới hái sáng nay đây!', color: '#2a9d8f' },
  { id: 'thit', name: 'Khu thịt & trứng', icon: '🥩', call: 'Thịt tươi, mới mổ đây!', color: '#c0392b' },
  { id: 'ca', name: 'Khu cá & hải sản', icon: '🐟', call: 'Tôm cá còn nhảy tanh tách!', color: '#3a86ff' },
  {
    id: 'traicay',
    name: 'Khu trái cây & nước đá',
    icon: '🥭',
    call: 'Xoài cát ngọt lịm nè!',
    color: '#f4a261',
  },
  { id: 'bot', name: 'Khu gạo, bún, bánh', icon: '🍚', call: 'Bún phở tráng mới ra lò!', color: '#d4a017' },
  { id: 'kho', name: 'Khu đồ khô & gia vị', icon: '🧂', call: 'Mắm muối, gia vị đủ cả!', color: '#8c5a2b' },
  {
    id: 'thucong',
    name: 'Khu vải vóc & thủ công',
    icon: '🧵',
    call: 'Lụa Vạn Phúc, gốm Bát Tràng đây!',
    color: '#7b4fa0',
  },
  {
    id: 'noithat',
    name: 'Khu đồ quán xá',
    icon: '🪑',
    call: 'Bàn ghế, quạt, đèn lồng giao tận quán!',
    color: '#5c3d2e',
  },
];
