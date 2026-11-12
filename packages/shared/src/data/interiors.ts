import type { InteriorKind, InteriorStyle } from '../types';

/**
 * Cách gọi theo nghề cho 5 kiểu bên trong quán. Vòng chơi chung (nhận → làm → mang ra → khách dùng)
 * giữ nguyên; chỉ chữ và hình đổi theo nghề. Thiết kế: design/gdd/interiors.md
 */
export const INTERIORS: InteriorStyle[] = [
  {
    id: 'an',
    name: 'Quán ăn',
    seat: 'bàn',
    station: '🔥 Bếp',
    takeOrder: 'Nhận order',
    order: 'order',
    make: 'Nấu',
    serve: 'Bưng',
    enjoy: 'đang ăn',
    board: 'THỰC ĐƠN',
    pass: '🍽️ Quầy ra món',
  },
  {
    id: 'nuoc',
    name: 'Quán nước & chè',
    seat: 'bàn',
    station: '🍹 Quầy pha chế',
    takeOrder: 'Nhận order',
    order: 'order',
    make: 'Pha',
    serve: 'Bưng',
    enjoy: 'đang thưởng thức',
    board: 'THỰC ĐƠN',
    pass: '🥤 Khay ra món',
  },
  {
    id: 'ghe',
    name: 'Ghe nổi',
    seat: 'chỗ',
    station: '🔥 Bếp ghe',
    takeOrder: 'Nhận order',
    order: 'order',
    make: 'Nấu',
    serve: 'Bưng',
    enjoy: 'đang ăn',
    board: 'THỰC ĐƠN',
    pass: '🍜 Khay ra tô',
  },
  {
    id: 'nghe',
    name: 'Xưởng nghề & tiệm quà',
    seat: 'chỗ',
    station: '🛠️ Bàn nghề',
    takeOrder: 'Nhận yêu cầu',
    order: 'yêu cầu',
    make: 'Làm',
    serve: 'Mang',
    enjoy: 'đang trải nghiệm',
    board: 'BẢNG GIÁ',
    pass: '🎁 Bàn giao hàng',
  },
  {
    id: 'sankhau',
    name: 'Sân khấu',
    seat: 'hàng ghế',
    station: '🎭 Buồng trò',
    takeOrder: 'Soát vé',
    order: 'vé',
    make: 'Diễn',
    serve: 'Mời',
    enjoy: 'đang xem diễn',
    board: 'LỊCH DIỄN',
    pass: '🎟️ Bàn vé',
  },
];

export const interiorMap: ReadonlyMap<InteriorKind, InteriorStyle> = new Map(INTERIORS.map((s) => [s.id, s]));

/** Tên một cụm chỗ theo số thứ tự: "Bàn 2", "Chỗ 2", "Hàng ghế 2". */
export const seatName = (style: Pick<InteriorStyle, 'seat'>, n: number): string =>
  `${style.seat.charAt(0).toUpperCase()}${style.seat.slice(1)} ${n}`;

/** Cách gọi của một kiểu quán (mặc định quán ăn). */
export const interiorStyle = (kind: InteriorKind | undefined): InteriorStyle =>
  interiorMap.get(kind ?? 'an') ?? INTERIORS[0]!;
