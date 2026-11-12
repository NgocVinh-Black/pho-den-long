// Hình vẽ bên trong quán theo 5 kiểu nghề (quán ăn, quán nước, ghe nổi, xưởng nghề, sân khấu).
// Chỉ vẽ đồ đạc tĩnh/động nhẹ; người, bong bóng gọi món và nhân viên do World vẽ.
// Thiết kế: design/gdd/interiors.md
import type { FurnitureRole, InteriorKind, Shop } from '@pdl/shared';
import { mix, rr } from './draw';

export interface Room {
  /** Bề rộng bên trong quán */
  w: number;
  /** Mép sàn */
  floor: number;
  h: number;
}

type Ctx = CanvasRenderingContext2D;
export type SeatVariant = 'basic' | 'plus';

/** Đồ "trên bàn" ở xưởng nghề, theo từng quán. */
const CRAFT_PROP: Record<string, string> = {
  aodai: '👗',
  gom: '🏺',
  tranh: '📜',
  nonla: '👒',
  com: '🍵',
};

// ====================== Tường, sàn, khung cảnh ======================
export function drawRoom(ctx: Ctx, kind: InteriorKind, shop: Shop, room: Room, nf: number, time: number) {
  const { w, floor, h } = room;
  if (kind === 'ghe') {
    // trời + sông phía sau, mạn ghe, sàn ván
    const g = ctx.createLinearGradient(0, 0, 0, floor);
    g.addColorStop(0, mix('#9ad1f5', '#14193a', nf));
    g.addColorStop(1, mix('#ffe3b3', '#3a2a5c', nf));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, floor - 120);
    ctx.fillStyle = mix('#5aa9a0', '#1c3440', nf);
    ctx.fillRect(0, floor - 150, w, 150);
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const x = ((i * 97 + time * 18) % (w + 80)) - 40;
      const y = floor - 130 + (i % 5) * 22;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 14, y - 4, x + 28, y);
      ctx.stroke();
    }
    // ghe khác trôi xa xa
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛶', ((time * 22) % (w + 200)) - 100, floor - 118);
    // mái ghe (mui) phía trên
    ctx.fillStyle = mix('#7a4b2a', '#3a2418', nf * 0.5);
    ctx.fillRect(0, 0, w, 30);
    for (let x = 0; x < w; x += 60) {
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      ctx.fillRect(x, 0, 4, 30);
    }
    // mạn ghe (thành gỗ) + sàn ván
    ctx.fillStyle = '#6b3f22';
    ctx.fillRect(0, floor - 26, w, 30);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(0, floor - 26, w, 5);
    ctx.fillStyle = '#9c6b3f';
    ctx.fillRect(0, floor + 4, w, h - floor);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let y = floor + 20; y < h; y += 24) ctx.fillRect(0, y, w, 2);
    return;
  }
  if (kind === 'sankhau') {
    // khán phòng tối, tường đỏ son, sàn gỗ
    ctx.fillStyle = mix('#5a1b1b', '#2a0d12', 0.3 + nf * 0.4);
    ctx.fillRect(0, 0, w, floor);
    ctx.fillStyle = 'rgba(255,215,0,.08)';
    for (let x = 30; x < w; x += 90) ctx.fillRect(x, 0, 3, floor);
    ctx.fillStyle = '#3b1f12';
    ctx.fillRect(0, 0, w, 26);
    ctx.fillRect(0, floor - 8, w, 10);
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(0, floor, w, h - floor);
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    for (let x = 0; x < w; x += 70) ctx.fillRect(x, floor, 2, h - floor);
    return;
  }
  // các kiểu còn lại: tường màu quán + sàn riêng
  const wall =
    kind === 'nuoc'
      ? mix('#b5654a', '#3a2620', 0.2 + nf * 0.3) // tường gạch
      : kind === 'nghe'
        ? mix('#efe2c8', '#4a3b2e', 0.15 + nf * 0.3) // vách vôi sáng
        : mix(shop.colors.wall, '#4a3b2e', 0.25 + nf * 0.25);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, floor);
  if (kind === 'nuoc') {
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    for (let y = 30; y < floor; y += 22) {
      ctx.fillRect(0, y, w, 2);
      for (let x = (y / 22) % 2 ? 0 : 22; x < w; x += 44) ctx.fillRect(x, y, 2, 22);
    }
  } else {
    ctx.fillStyle = 'rgba(0,0,0,.06)';
    for (let x = 0; x < w; x += 48) ctx.fillRect(x, 0, 2, floor);
  }
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(0, floor - 70, w, 4);
  ctx.fillStyle = kind === 'nghe' ? '#7f5539' : '#5c3d2e';
  ctx.fillRect(0, 0, w, 26);
  ctx.fillRect(0, floor - 8, w, 10);
  if (kind === 'an') {
    // gạch bông
    for (let y = floor; y < h; y += 35) {
      for (let x = 0; x < w; x += 35) {
        ctx.fillStyle = (x / 35 + y / 35) % 2 < 1 ? '#c9a27e' : '#b5835a';
        ctx.fillRect(x, y, 35, 35);
      }
    }
  } else if (kind === 'nuoc') {
    // gạch tàu đỏ
    for (let y = floor; y < h; y += 30) {
      for (let x = (y / 30) % 2 ? 0 : 15; x < w; x += 30) {
        ctx.fillStyle = (x + y) % 60 < 30 ? '#b5543c' : '#a24a34';
        ctx.fillRect(x, y, 29, 29);
      }
    }
  } else {
    // sàn gỗ
    ctx.fillStyle = '#b08156';
    ctx.fillRect(0, floor, w, h - floor);
    ctx.fillStyle = 'rgba(0,0,0,.1)';
    for (let y = floor + 18; y < h; y += 26) ctx.fillRect(0, y, w, 2);
  }
}

// ====================== Sân khấu rối nước (phông sau hàng ghế) ======================
export function drawWaterStage(ctx: Ctx, x0: number, x1: number, nf: number, time: number, playing: boolean) {
  const top = 110;
  const pool = 290;
  // thủy đình: mái cong, cột, rèm tre
  const cx = (x0 + x1) / 2;
  ctx.fillStyle = '#8c1c13';
  ctx.beginPath();
  ctx.moveTo(cx - 230, top + 40);
  ctx.quadraticCurveTo(cx, top - 30, cx + 230, top + 40);
  ctx.lineTo(cx + 200, top + 54);
  ctx.lineTo(cx - 200, top + 54);
  ctx.fill();
  ctx.fillStyle = '#e9c46a';
  ctx.fillRect(cx - 200, top + 54, 400, 6);
  ctx.fillStyle = '#5c2a12';
  for (const dx of [-180, -60, 60, 180]) ctx.fillRect(cx + dx - 6, top + 60, 12, pool - top - 60);
  // rèm tre buông (buồng trò phía sau)
  ctx.fillStyle = mix('#d9b26f', '#6b5530', nf * 0.5);
  ctx.fillRect(cx - 174, top + 60, 348, 120);
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  for (let x = cx - 170; x < cx + 174; x += 8) ctx.fillRect(x, top + 60, 2, 120);
  // ao nước
  const g = ctx.createLinearGradient(0, pool - 20, 0, pool + 30);
  g.addColorStop(0, mix('#3a86a8', '#173040', nf));
  g.addColorStop(1, mix('#1f5d75', '#0c1c28', nf));
  ctx.fillStyle = g;
  ctx.fillRect(x0, pool - 20, x1 - x0, 50);
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    const wx = x0 + ((i * 61 + time * 30) % (x1 - x0));
    ctx.beginPath();
    ctx.moveTo(wx, pool + (i % 3) * 8);
    ctx.quadraticCurveTo(wx + 10, pool - 3 + (i % 3) * 8, wx + 20, pool + (i % 3) * 8);
    ctx.stroke();
  }
  // con rối: chú Tễu + rồng, nhún nhảy khi có khán giả
  ctx.font = '30px sans-serif';
  ctx.textAlign = 'center';
  const bob = playing ? Math.sin(time * 5) * 8 : 0;
  const drift = playing ? Math.sin(time * 0.8) * 120 : 0;
  ctx.fillText('🎎', cx - 60 + drift, pool - 2 + bob);
  ctx.fillText('🐉', cx + 80 - drift, pool + 2 - bob);
  if (playing && Math.sin(time * 3) > 0.3) {
    ctx.font = '18px sans-serif';
    ctx.fillText('💦', cx + 110 - drift, pool - 30 - bob);
  }
  // đèn sân khấu
  ctx.fillStyle = `rgba(255,220,140,${0.12 + (playing ? 0.12 : 0) + nf * 0.08})`;
  ctx.beginPath();
  ctx.moveTo(cx - 40, top + 60);
  ctx.lineTo(cx - 260, pool + 30);
  ctx.lineTo(cx + 260, pool + 30);
  ctx.lineTo(cx + 40, top + 60);
  ctx.fill();
}

// ====================== Nơi làm (thay bếp) ======================
export function drawStation(ctx: Ctx, kind: InteriorKind, shop: Shop, x: number, time: number) {
  ctx.textAlign = 'center';
  if (kind === 'an' || kind === 'ghe') {
    const deck = kind === 'ghe';
    // bếp gạch (quán ăn) hoặc lò đất trên ghe
    ctx.fillStyle = deck ? '#8a5a3c' : '#8d3b2b';
    ctx.fillRect(x - (deck ? 60 : 80), 300, deck ? 120 : 160, 100);
    ctx.fillStyle = deck ? '#6b4226' : '#5b2418';
    for (let i = 0; i < 4; i++) ctx.fillRect(x - (deck ? 60 : 80), 316 + i * 22, deck ? 120 : 160, 2);
    const flame = 0.6 + 0.4 * Math.sin(time * 14);
    ctx.fillStyle = `rgba(255,${120 + flame * 60},40,0.9)`;
    ctx.beginPath();
    ctx.ellipse(x, 352, 26, 12 * flame, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = deck ? '#5c5c5c' : '#333';
    rr(ctx, x - 44, 250, 88, 52, 10);
    ctx.fill();
    steam(ctx, x, 248, time);
    if (deck) {
      ctx.font = '22px sans-serif';
      ctx.fillText('🥢', x + 80, 296);
    }
    return;
  }
  if (kind === 'nuoc') {
    // quầy pha chế: mặt quầy gỗ, phin cà phê / ly / máy xay
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x - 90, 310, 180, 90);
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(x - 96, 302, 192, 10);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let i = 0; i < 5; i++) ctx.fillRect(x - 86 + i * 40, 318, 2, 80);
    ctx.font = '26px sans-serif';
    const props =
      shop.id === 'caphe'
        ? ['☕', '🥚', '🫖']
        : shop.id === 'traicay'
          ? ['🍹', '🥭', '🥥']
          : ['🍧', '🫘', '🍮'];
    props.forEach((p, i) => ctx.fillText(p, x - 50 + i * 50, 298));
    // kệ ly trên tường
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x - 80, 220, 160, 6);
    ctx.font = '18px sans-serif';
    for (let i = 0; i < 5; i++) ctx.fillText('🥛', x - 64 + i * 32, 216);
    if (shop.id === 'caphe') steam(ctx, x - 50, 270, time);
    return;
  }
  if (kind === 'sankhau') {
    // buồng trò: rèm, sào điều khiển rối, trống
    ctx.fillStyle = '#3b1f12';
    ctx.fillRect(x - 85, 170, 170, 230);
    ctx.fillStyle = '#8c1c13';
    ctx.fillRect(x - 78, 178, 72, 222);
    ctx.fillRect(x + 6, 178, 72, 222);
    ctx.fillStyle = '#e9c46a';
    ctx.fillRect(x - 85, 170, 170, 8);
    ctx.font = '30px sans-serif';
    ctx.fillText('🥁', x - 40, 396);
    ctx.fillText('🎎', x + 40, 300 + Math.sin(time * 3) * 3);
    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 40, 306);
    ctx.lineTo(x + 70, 380);
    ctx.stroke();
    return;
  }
  // xưởng nghề: bàn gỗ + dụng cụ theo từng quán
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x - 90, 320, 180, 14);
  ctx.fillRect(x - 80, 334, 12, 66);
  ctx.fillRect(x + 68, 334, 12, 66);
  ctx.font = '30px sans-serif';
  if (shop.id === 'gom') {
    // bàn xoay + lò nung
    ctx.fillStyle = '#5c5c5c';
    ctx.beginPath();
    ctx.ellipse(x - 30, 314, 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x - 30, 298);
    ctx.scale(1 + Math.sin(time * 9) * 0.04, 1);
    ctx.fillText('🏺', 0, 6);
    ctx.restore();
    ctx.fillStyle = '#7f3b22';
    rr(ctx, x + 40, 250, 56, 70, 26);
    ctx.fill();
    ctx.fillStyle = `rgba(255,140,40,${0.6 + 0.3 * Math.sin(time * 6)})`;
    ctx.fillRect(x + 56, 290, 24, 18);
  } else if (shop.id === 'aodai') {
    // máy may + cây vải
    ctx.fillText('🧵', x - 56, 314);
    ctx.fillText('✂️', x + 10, 314);
    ctx.fillStyle = '#2b2d42';
    rr(ctx, x - 30, 280, 50, 34, 6);
    ctx.fill();
    ctx.fillStyle = '#c9d1d9';
    ctx.fillRect(x - 6, 300 + Math.abs(Math.sin(time * 18)) * 6, 3, 12);
    const rolls = ['#e63946', '#f4a261', '#2a9d8f', '#8338ec'];
    rolls.forEach((c, i) => {
      ctx.fillStyle = c;
      rr(ctx, x + 40 + i * 12, 236, 10, 82, 4);
      ctx.fill();
    });
  } else if (shop.id === 'tranh') {
    ctx.fillText('🖌️', x - 54, 314);
    ctx.fillText('🪵', x, 314);
    ctx.fillStyle = '#f5ebe0';
    ctx.fillRect(x + 28, 286, 52, 30);
    ctx.fillStyle = '#1d1d1d';
    ctx.font = '700 18px serif';
    ctx.fillText('福', x + 54, 308);
  } else if (shop.id === 'nonla') {
    ctx.fillText('👒', x - 50, 314);
    ctx.fillText('🎨', x + 4, 314);
    ctx.fillText('🏮', x + 56, 312 + Math.sin(time * 2) * 2);
  } else {
    // tiệm quà (cốm): lá sen, lạt, hộp quà
    ctx.fillText('🪷', x - 50, 314);
    ctx.fillText('🌾', x + 4, 314);
    ctx.fillText('🎁', x + 56, 314);
  }
}

function steam(ctx: Ctx, x: number, y: number, time: number) {
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.lineWidth = 2;
  for (let k = -1; k <= 1; k++) {
    const sx = x + k * 18;
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.bezierCurveTo(
      sx + 8 * Math.sin(time * 3 + k),
      y - 18,
      sx - 8,
      y - 34,
      sx + 4 * Math.sin(time * 2 + k),
      y - 52,
    );
    ctx.stroke();
  }
}

// ====================== Chỗ ngồi của khách ======================
/** Ghế/chỗ cho một khách (vẽ trước người). top = mặt bàn. */
export function drawSeat(
  ctx: Ctx,
  kind: InteriorKind,
  variant: SeatVariant,
  shopId: string,
  sx: number,
  top: number,
) {
  const plus = variant === 'plus';
  switch (kind) {
    case 'an':
      if (plus) {
        // đôn sứ men lam
        ctx.fillStyle = '#e8eef7';
        rr(ctx, sx - 11, top + 6, 22, 26, 8);
        ctx.fill();
        ctx.fillStyle = '#3d5a80';
        ctx.fillRect(sx - 9, top + 16, 18, 3);
      } else {
        // ghế nhựa đỏ
        ctx.fillStyle = '#d62828';
        ctx.fillRect(sx - 12, top + 6, 24, 6);
        ctx.fillStyle = '#b71c1c';
        ctx.fillRect(sx - 11, top + 12, 4, 20);
        ctx.fillRect(sx + 7, top + 12, 4, 20);
      }
      return;
    case 'nuoc':
      if (plus) {
        // ghế mây
        ctx.fillStyle = '#c8a26b';
        rr(ctx, sx - 13, top - 14, 26, 46, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,60,30,.5)';
        ctx.lineWidth = 1;
        for (let y = top - 10; y < top + 30; y += 5) {
          ctx.beginPath();
          ctx.moveTo(sx - 11, y);
          ctx.lineTo(sx + 11, y);
          ctx.stroke();
        }
      } else {
        // ghế đẩu nhựa xanh thấp
        ctx.fillStyle = '#3a86ff';
        ctx.fillRect(sx - 11, top + 14, 22, 5);
        ctx.fillStyle = '#2f6fd6';
        ctx.fillRect(sx - 10, top + 19, 4, 13);
        ctx.fillRect(sx + 6, top + 19, 4, 13);
      }
      return;
    case 'ghe':
      // ghế nhựa (thường) hoặc ghế gỗ xếp (sang) dọc mạn
      ctx.fillStyle = plus ? '#8b5a2b' : '#2a9d8f';
      ctx.fillRect(sx - 12, top + 6, 24, 6);
      ctx.fillStyle = plus ? '#6b4226' : '#21867a';
      ctx.fillRect(sx - 11, top + 12, 4, 20);
      ctx.fillRect(sx + 7, top + 12, 4, 20);
      return;
    case 'sankhau':
      // ghế gỗ (thường) hoặc ghế đệm đỏ (sang), quay về phía sân khấu
      ctx.fillStyle = plus ? '#9b2226' : '#7f5539';
      rr(ctx, sx - 13, top + 2, 26, 10, 3);
      ctx.fill();
      ctx.fillRect(sx - 13, top - 22, 5, 30);
      ctx.fillStyle = plus ? '#6a040f' : '#5c3d2e';
      ctx.fillRect(sx - 11, top + 12, 4, 20);
      ctx.fillRect(sx + 7, top + 12, 4, 20);
      return;
    case 'nghe':
      if (shopId === 'aodai') {
        // phòng thử: khung rèm phía sau khách
        ctx.fillStyle = plus ? '#c9a227' : '#8b5a2b';
        ctx.fillRect(sx - 20, top - 70, 40, 4);
        ctx.fillStyle = plus ? 'rgba(233,196,106,.55)' : 'rgba(181,131,141,.55)';
        ctx.fillRect(sx - 20, top - 66, 8, 98);
        ctx.fillRect(sx + 12, top - 66, 8, 98);
        if (plus) {
          ctx.fillStyle = '#bde0fe';
          rr(ctx, sx - 6, top - 60, 12, 30, 4);
          ctx.fill();
        }
      }
      // ghế đôn gỗ / chiếu
      ctx.fillStyle = plus ? '#6b4226' : '#a47148';
      rr(ctx, sx - 11, top + 8, 22, 24, 5);
      ctx.fill();
      return;
  }
}

/** Mặt bàn / bàn xoay / án thư giữa 2 chỗ. icons: đồ khách đang dùng (nếu có). */
export function drawSeatTable(
  ctx: Ctx,
  kind: InteriorKind,
  variant: SeatVariant,
  shopId: string,
  tx: number,
  top: number,
  time: number,
) {
  const plus = variant === 'plus';
  ctx.textAlign = 'center';
  switch (kind) {
    case 'an': {
      ctx.fillStyle = plus ? '#8b5a2b' : '#c9d1d9';
      rr(ctx, tx - 36, top - 15, 72, 9, 3);
      ctx.fill();
      ctx.fillStyle = plus ? '#6b4226' : '#9aa5b1';
      ctx.fillRect(tx - 30, top - 6, plus ? 6 : 4, 38);
      ctx.fillRect(tx + 26, top - 6, plus ? 6 : 4, 38);
      ctx.font = '13px sans-serif';
      ctx.fillText('🥢', tx, top - 16);
      return;
    }
    case 'nuoc': {
      // bàn thấp
      ctx.fillStyle = plus ? '#b08156' : '#e9edf0';
      rr(ctx, tx - 30, top + 4, 60, 8, 3);
      ctx.fill();
      ctx.fillStyle = plus ? '#8b5a2b' : '#adb5bd';
      ctx.fillRect(tx - 24, top + 12, 4, 20);
      ctx.fillRect(tx + 20, top + 12, 4, 20);
      ctx.font = '12px sans-serif';
      ctx.fillText('🌼', tx, top + 3);
      return;
    }
    case 'ghe': {
      if (plus) {
        ctx.fillStyle = '#a0522d';
        rr(ctx, tx - 34, top - 13, 68, 8, 3);
        ctx.fill();
        ctx.strokeStyle = '#6b4226';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tx - 26, top - 5);
        ctx.lineTo(tx + 22, top + 30);
        ctx.moveTo(tx + 26, top - 5);
        ctx.lineTo(tx - 22, top + 30);
        ctx.stroke();
      } else {
        // khay nhựa nhỏ đặt trên thùng gỗ
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(tx - 18, top - 4, 36, 36);
        ctx.fillStyle = '#ffb703';
        rr(ctx, tx - 22, top - 10, 44, 7, 3);
        ctx.fill();
      }
      ctx.font = '13px sans-serif';
      ctx.fillText('🥢', tx, top - 12);
      return;
    }
    case 'sankhau': {
      // không có bàn: biển số hàng ghế nhỏ
      ctx.fillStyle = plus ? '#e9c46a' : '#d4a373';
      rr(ctx, tx - 14, top + 14, 28, 14, 4);
      ctx.fill();
      return;
    }
    case 'nghe': {
      if (shopId === 'gom') {
        // bàn xoay gốm: mâm quay + cục đất
        ctx.fillStyle = plus ? '#495057' : '#7f5539';
        ctx.fillRect(tx - 18, top - 4, 36, 36);
        ctx.fillStyle = '#9aa5b1';
        ctx.beginPath();
        ctx.ellipse(tx, top - 6, 26, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b5651d';
        ctx.save();
        ctx.translate(tx, top - 14);
        ctx.scale(1 + Math.sin(time * 10) * 0.05, 1);
        rr(ctx, -9, -10, 18, 14, 6);
        ctx.fill();
        ctx.restore();
        return;
      }
      if (shopId === 'aodai') {
        // gương đứng giữa hai phòng thử
        ctx.fillStyle = plus ? '#c9a227' : '#8b5a2b';
        rr(ctx, tx - 9, top - 60, 18, 92, 6);
        ctx.fill();
        ctx.fillStyle = '#d7ecff';
        rr(ctx, tx - 6, top - 56, 12, 80, 4);
        ctx.fill();
        return;
      }
      // án thư thấp (tranh), bàn vẽ (nón), bàn trà (cốm)
      ctx.fillStyle = plus ? '#5c2e12' : '#a47148';
      rr(ctx, tx - 34, top + 2, 68, 9, 3);
      ctx.fill();
      ctx.fillRect(tx - 28, top + 11, 5, 21);
      ctx.fillRect(tx + 23, top + 11, 5, 21);
      ctx.font = '14px sans-serif';
      ctx.fillText(CRAFT_PROP[shopId] ?? '🎁', tx, top);
      return;
    }
  }
}

// ====================== Đồ trang trí theo vai ======================
export interface DecorHooks {
  lantern: (x: number, y: number, color: string) => void;
}

export function drawDecor(
  ctx: Ctx,
  kind: InteriorKind,
  roles: Partial<Record<FurnitureRole, number>>,
  room: Room,
  nf: number,
  time: number,
  hooks: DecorHooks,
) {
  const n = (r: FurnitureRole) => roles[r] ?? 0;
  ctx.textAlign = 'center';

  // ---- mát: quạt treo tường / quạt trần / mái bạt / quạt cây
  for (let i = 0; i < n('cool'); i++) {
    const x = 420 + i * 560;
    if (kind === 'ghe') {
      ctx.fillStyle = i % 2 ? '#2a9d8f' : '#e9c46a';
      ctx.beginPath();
      ctx.moveTo(x - 160, 30);
      ctx.lineTo(x + 160, 30);
      ctx.lineTo(x + 140, 64);
      ctx.lineTo(x - 140, 64);
      ctx.fill();
      continue;
    }
    if (kind === 'nuoc') {
      fanBlades(ctx, x, 40, time, 26, true);
      continue;
    }
    if (kind === 'sankhau') {
      ctx.fillStyle = '#5c6b73';
      ctx.fillRect(x - 3, 300, 6, 100);
      fanBlades(ctx, x, 290, time, 20, false);
      continue;
    }
    ctx.fillStyle = '#5c6b73';
    ctx.fillRect(x - 3, 120, 6, 22);
    fanBlades(ctx, x, 120, time, 14, false);
  }

  // ---- cây
  const plantIcon =
    kind === 'nuoc'
      ? '🌺'
      : kind === 'ghe'
        ? '🪷'
        : kind === 'nghe'
          ? '🌸'
          : kind === 'sankhau'
            ? '🫖'
            : '🪴';
  for (let i = 0; i < n('plant'); i++) {
    const x = [180, 690, 1235][i] ?? 180;
    ctx.font = kind === 'sankhau' ? '30px sans-serif' : '46px sans-serif';
    ctx.fillText(plantIcon, x, kind === 'sankhau' ? 392 : room.floor + 8);
  }
  if (kind === 'nuoc' && n('plant') > 0) {
    // giàn hoa giấy rủ trên mép mái
    ctx.font = '16px sans-serif';
    for (let x = 40; x < room.w; x += 46) ctx.fillText('🌺', x, 44 + Math.sin(x) * 6);
  }

  // ---- tranh / ảnh / cờ / kệ / phông màn
  for (let i = 0; i < n('art'); i++) {
    const x = [640, 900, 1150][i] ?? 640;
    if (kind === 'ghe') {
      ctx.strokeStyle = '#6b4226';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 120, 40);
      ctx.lineTo(x + 120, 40);
      ctx.stroke();
      const colors = ['#e63946', '#ffb703', '#2a9d8f', '#3a86ff'];
      for (let k = 0; k < 10; k++) {
        ctx.fillStyle = colors[k % colors.length]!;
        const fx = x - 112 + k * 24;
        ctx.beginPath();
        ctx.moveTo(fx, 41);
        ctx.lineTo(fx + 16, 41);
        ctx.lineTo(fx + 8, 60 + Math.sin(time * 3 + k) * 3);
        ctx.fill();
      }
      continue;
    }
    if (kind === 'nghe') {
      // kệ bày hàng mẫu
      ctx.fillStyle = '#7f5539';
      ctx.fillRect(x - 40, 200, 80, 100);
      ctx.fillStyle = '#a47148';
      for (let k = 0; k < 3; k++) ctx.fillRect(x - 40, 226 + k * 30, 80, 4);
      ctx.font = '18px sans-serif';
      ['🏺', '👒', '📜', '🎎', '🧧', '🏮'].forEach((p, k) =>
        ctx.fillText(p, x - 22 + (k % 3) * 22, 222 + Math.floor(k / 3) * 30),
      );
      continue;
    }
    if (kind === 'sankhau') {
      // phông màn thêu hai bên khán phòng
      ctx.fillStyle = '#8c1c13';
      ctx.fillRect(x - 36, 30, 72, 260);
      ctx.fillStyle = '#e9c46a';
      ctx.font = '26px sans-serif';
      ctx.fillText('🐉', x, 150);
      ctx.fillRect(x - 36, 30, 72, 6);
      continue;
    }
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x - 32, 210, 64, 74);
    ctx.fillStyle = kind === 'nuoc' ? '#dee2e6' : '#f5e6c8';
    ctx.fillRect(x - 27, 215, 54, 64);
    ctx.font = '34px sans-serif';
    ctx.fillText(kind === 'nuoc' ? (i === 0 ? '🏘️' : '🚲') : i === 0 ? '🐓' : '🐖', x, 262);
    if (kind === 'nuoc') {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(x - 27, 215, 54, 64); // ảnh đen trắng
    }
  }

  // ---- đèn
  for (let i = 0; i < n('light'); i++) {
    const cx = [830, 1050][i] ?? 830;
    if (kind === 'nuoc') {
      // dây đèn tròn võng
      ctx.strokeStyle = '#3b2416';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 200, 34);
      ctx.quadraticCurveTo(cx, 80, cx + 200, 34);
      ctx.stroke();
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const bx = cx - 200 + 400 * t;
        const by = 34 + 4 * 46 * t * (1 - t) + 6;
        ctx.fillStyle = `rgba(255,214,102,${0.7 + 0.3 * Math.sin(time * 3 + k)})`;
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    if (kind === 'ghe') {
      ctx.font = '30px sans-serif';
      ctx.fillText('🪔', cx, 96 + Math.sin(time * 2 + i) * 2);
      glow(ctx, cx, 86, nf);
      continue;
    }
    if (kind === 'nghe') {
      // góc chụp ảnh: phông hoa + đèn studio
      ctx.fillStyle = '#ffccd5';
      rr(ctx, cx - 70, 150, 140, 160, 10);
      ctx.fill();
      ctx.font = '20px sans-serif';
      for (let k = 0; k < 9; k++) ctx.fillText('🌸', cx - 54 + (k % 3) * 54, 180 + Math.floor(k / 3) * 46);
      ctx.font = '30px sans-serif';
      ctx.fillText('📸', cx + 86, 300);
      ctx.fillStyle = '#7b2cbf';
      ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
      ctx.fillText('Check-in Phố Đèn Lồng', cx, 140);
      continue;
    }
    for (let k = -1; k <= 1; k++)
      hooks.lantern(cx + k * 26, 30 + Math.abs(k) * 10, k === 0 ? '#f4a261' : '#d62828');
  }

  // ---- nhạc (xưởng nghề: vai này là đèn lồng lụa)
  if (n('music') > 0) {
    if (kind === 'nghe') {
      for (let i = 0; i < n('music'); i++) {
        const cx = [300, 560][i] ?? 300;
        for (let k = 0; k < 3; k++)
          hooks.lantern(cx + k * 30, 34 + (k % 2) * 12, ['#e63946', '#ffb703', '#2a9d8f'][k]!);
      }
      return;
    }
    const x = 1240;
    const icon = kind === 'nuoc' ? '🎙️' : kind === 'sankhau' ? '🪕' : '📻';
    ctx.font = '34px sans-serif';
    ctx.fillText(icon, x, 300);
    if (kind === 'sankhau') {
      ctx.fillText('🥁', x + 40, 304);
    }
    ctx.font = '16px sans-serif';
    for (let k = 0; k < 3; k++) {
      const t = (time * 0.6 + k / 3) % 1;
      ctx.globalAlpha = 1 - t;
      ctx.fillText(k % 2 ? '🎵' : '🎶', x + Math.sin(t * 6 + k) * 14, 270 - t * 70);
    }
    ctx.globalAlpha = 1;
  }
}

function fanBlades(ctx: Ctx, x: number, y: number, time: number, len: number, flat: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (flat) ctx.scale(1, 0.25);
  ctx.rotate(time * 12);
  ctx.fillStyle = flat ? 'rgba(120,80,50,.9)' : 'rgba(200,220,235,.85)';
  for (let k = 0; k < 3; k++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.ellipse(0, -len, 6, len, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (!flat) {
    ctx.strokeStyle = '#5c6b73';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, len * 2 + 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#5c6b73';
    ctx.fillRect(x - 2, 26, 4, y - 26);
  }
}

function glow(ctx: Ctx, x: number, y: number, nf: number) {
  const g = ctx.createRadialGradient(x, y, 4, x, y, 70);
  g.addColorStop(0, `rgba(255,200,100,${0.25 + nf * 0.3})`);
  g.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 70, y - 70, 140, 140);
}
