// Các hàm vẽ dùng chung: màu, khung bo góc, nhân vật chủ quán.
import type { Avatar } from '@pdl/shared';

export function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Trộn hai màu hex theo tỉ lệ t (0..1). */
export function mix(a: string, b: string, t: number): string {
  const pa = hexRgb(a);
  const pb = hexRgb(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t)).join(',')})`;
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface AvatarPose {
  /** Pha bước chân (tăng dần theo thời gian khi đi) */
  phase: number;
  walking: boolean;
  facing: 1 | -1;
  /** Đang gánh hàng: vẽ quang gánh */
  carrying?: boolean;
  scale?: number;
  name?: string;
}

/** Vẽ nhân vật chủ quán với chân đặt tại (x, feetY). */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  feetY: number,
  avatar: Avatar,
  pose: AvatarPose,
) {
  const { phase, walking, facing, carrying = false, scale = 1, name } = pose;
  const bob = walking ? Math.abs(Math.sin(phase)) * 3 : 0;
  const sw = walking ? Math.sin(phase) * 6 : 0;
  const y = feetY - bob;

  ctx.save();
  ctx.translate(x, feetY);
  ctx.scale(scale, scale);
  ctx.translate(-x, -feetY);

  // bóng
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.ellipse(x, feetY + 2, carrying ? 30 : 13, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // chân + dép
  ctx.strokeStyle = '#2b2b38';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 20);
  ctx.lineTo(x - 4 + sw, y - 2);
  ctx.moveTo(x + 4, y - 20);
  ctx.lineTo(x + 4 - sw, y - 2);
  ctx.stroke();
  ctx.fillStyle = '#7a4a2a';
  ctx.fillRect(x - 8 + sw, y - 3, 8, 3);
  ctx.fillRect(x + sw * -1, y - 3, 8, 3);

  // thân áo
  ctx.fillStyle = avatar.shirt;
  rr(ctx, x - 12, y - 48, 24, 30, 8);
  ctx.fill();
  if (avatar.shirt === '#ffffff') {
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // tạp dề
  ctx.fillStyle = 'rgba(255,248,236,.92)';
  rr(ctx, x - 8, y - 38, 16, 18, 3);
  ctx.fill();

  // tay
  ctx.strokeStyle = avatar.skin;
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (carrying) {
    // một tay giữ đòn gánh
    ctx.moveTo(x + facing * 8, y - 44);
    ctx.lineTo(x + facing * 4, y - 56);
    ctx.moveTo(x - facing * 10, y - 44);
    ctx.lineTo(x - facing * 14, y - 28);
  } else {
    ctx.moveTo(x - 11, y - 44);
    ctx.lineTo(x - 14 - sw * 0.6, y - 26);
    ctx.moveTo(x + 11, y - 44);
    ctx.lineTo(x + 14 + sw * 0.6, y - 26);
  }
  ctx.stroke();

  // đầu
  ctx.fillStyle = avatar.skin;
  ctx.beginPath();
  ctx.arc(x, y - 58, 11, 0, Math.PI * 2);
  ctx.fill();
  // mắt nhìn theo hướng đi
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath();
  ctx.arc(x + facing * 4, y - 59, 1.6, 0, Math.PI * 2);
  ctx.arc(x + facing * 9, y - 59, 1.4, 0, Math.PI * 2);
  ctx.fill();
  // tóc
  ctx.fillStyle = '#22180f';
  ctx.beginPath();
  ctx.arc(x, y - 61, 11, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();

  // nón / mũ / khăn
  if (avatar.hat === 'nonla') {
    ctx.fillStyle = '#ecd9a0';
    ctx.beginPath();
    ctx.moveTo(x - 25, y - 64);
    ctx.lineTo(x + 25, y - 64);
    ctx.lineTo(x, y - 86);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,30,.45)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      ctx.beginPath();
      ctx.moveTo(x - 25 * (1 - t), y - 64 - 22 * t);
      ctx.lineTo(x + 25 * (1 - t), y - 64 - 22 * t);
      ctx.stroke();
    }
    ctx.strokeStyle = '#8c6d2c';
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 64);
    ctx.lineTo(x - 5, y - 50);
    ctx.moveTo(x + 7, y - 64);
    ctx.lineTo(x + 5, y - 50);
    ctx.stroke();
  } else if (avatar.hat === 'cap') {
    ctx.fillStyle = avatar.shirt === '#ffffff' ? '#c0392b' : avatar.shirt;
    ctx.beginPath();
    ctx.arc(x, y - 63, 11, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x + (facing > 0 ? 4 : -16), y - 65, 12, 3);
  } else if (avatar.hat === 'khan') {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#111' : '#f4f1ea';
      ctx.fillRect(x - 12 + i * 4, y - 49, 4, 5);
    }
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(x - facing * 8, y - 46);
    ctx.lineTo(x - facing * 16, y - 34);
    ctx.lineTo(x - facing * 10, y - 34);
    ctx.closePath();
    ctx.fill();
  }

  // quang gánh
  if (carrying) {
    const poleY = y - 52;
    ctx.strokeStyle = '#a0763a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 38, poleY + 3);
    ctx.quadraticCurveTo(x, poleY - 4, x + 38, poleY + 3);
    ctx.stroke();
    for (const side of [-1, 1]) {
      const bx = x + side * 34;
      const swing = Math.sin(phase * 0.5 + side) * (walking ? 3 : 1);
      ctx.strokeStyle = 'rgba(80,50,20,.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, poleY + 2);
      ctx.lineTo(bx - 9 + swing, poleY + 26);
      ctx.moveTo(bx, poleY + 2);
      ctx.lineTo(bx + 9 + swing, poleY + 26);
      ctx.stroke();
      ctx.fillStyle = '#b5833f';
      ctx.beginPath();
      ctx.moveTo(bx - 12 + swing, poleY + 26);
      ctx.lineTo(bx + 12 + swing, poleY + 26);
      ctx.lineTo(bx + 9 + swing, poleY + 40);
      ctx.lineTo(bx - 9 + swing, poleY + 40);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = side < 0 ? '#6a994e' : '#e76f51';
      ctx.beginPath();
      ctx.arc(bx - 4 + swing, poleY + 24, 4, 0, Math.PI * 2);
      ctx.arc(bx + 4 + swing, poleY + 23, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // bảng tên (không bị scale)
  if (name) {
    const top = feetY - (avatar.hat === 'nonla' ? 92 : 78) * scale - 8;
    ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
    const tw = ctx.measureText(name).width + 14;
    ctx.fillStyle = 'rgba(25,15,30,.78)';
    rr(ctx, x - tw / 2, top - 16, tw, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x, top - 7);
    ctx.beginPath();
    ctx.moveTo(x - 4, top + 2);
    ctx.lineTo(x + 4, top + 2);
    ctx.lineTo(x, top + 7);
    ctx.fill();
    ctx.textBaseline = 'alphabetic';
  }
}
