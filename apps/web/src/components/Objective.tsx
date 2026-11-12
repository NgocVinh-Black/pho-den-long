import { useEffect, useState } from 'react';
import { interiorStyle, seatName, shipmentUnits } from '@pdl/shared';
import type { HeroStatus } from '../game/World';
import { worldHost } from '../game/worldHost';
import { canMake, learnedRecipes, useGame } from '../store/game';

function useHeroStatus() {
  const [status, setStatus] = useState<HeroStatus | null>(null);
  useEffect(() => {
    const t = setInterval(() => setStatus(worldHost.get()?.heroStatus() ?? null), 300);
    return () => clearInterval(t);
  }, []);
  return status;
}

/** Dòng nhiệm vụ gợi ý người chơi nên làm gì tiếp theo. */
export function Objective() {
  const screen = useGame((s) => s.screen);
  const dayPhase = useGame((s) => s.dayPhase);
  const player = useGame((s) => s.player);
  const shop = useGame((s) => s.shop);
  const panel = useGame((s) => s.panel);
  const cooking = useGame((s) => s.cooking);
  const hero = useHeroStatus();
  const cartSize = useGame((s) => s.cart.size);
  const pinnedLeft = useGame((s) => s.notes.find((n) => n.pinned)?.items.filter((i) => !i.done).length ?? 0);

  if (screen !== 'play' || panel || cooking || !player || !shop || !hero) return null;

  const carrying = shipmentUnits(player.shipments, 'carry');
  const delivering = player.shipments.filter((s) => s.mode === 'delivery').length;
  const ready = learnedRecipes(player, shop).some((r) => canMake(r, player));
  const inside = hero.insideOwn;
  const st = interiorStyle(shop.interior);

  let text: string;
  if (hero.inMarket) {
    text =
      dayPhase === 'open' && hero.frontWaiting
        ? '🔔 Khách đang chờ ở quán! Mua nhanh rồi về'
        : cartSize > 0
          ? `🧾 Giỏ có ${cartSize} món. Mua tiếp, hoặc ra quầy tính tiền ở cổng chợ (◀)`
          : pinnedLeft > 0
            ? `📌 Ghi chú còn ${pinnedLeft} món. Sạp có 📌 là khu bán món đó`
            : '🛒 Đi tới từng sạp, bấm E để xem hàng. Bấm N mở sổ tay';
  } else if (hero.insideShop && !hero.insideOwn) {
    text =
      dayPhase === 'open' && hero.frontWaiting
        ? `🔔 Khách đang chờ ở quán bạn! Ra cửa (◀) về quán`
        : `👀 Đang ghé ${hero.insideShop.name}. Tới quầy nói chuyện với chủ quán, hoặc ra cửa về phố`;
  } else if (dayPhase === 'open') {
    if (!inside) {
      text = hero.frontWaiting
        ? '🔔 Khách đang chờ trong quán! Về quán phục vụ'
        : '🏮 Quán đang mở cửa. Về quán đón khách';
    } else if (hero.carryingDish) {
      text = `🍽️ Đang ${st.serve.toLowerCase()} ${hero.carryingDish.icon} ${hero.carryingDish.name}: mang ra ${seatName(st, hero.carryingDish.table).toLowerCase()} rồi bấm E`;
    } else if (hero.readyDishes > 0) {
      text = `✅ Có ${hero.readyDishes} món đã xong ở ${st.pass}: tới ${st.station} bấm E để ${st.serve.toLowerCase()}`;
    } else if (hero.wantOrder > 0) {
      text = `✋ ${hero.wantOrder} ${st.seat} đang giơ tay: tới chỗ có ✋ bấm E để ${st.takeOrder.toLowerCase()}`;
    } else if (hero.toCook > 0) {
      text = `📝 Có ${hero.toCook} phiếu ${st.order}: tới ${st.station} bấm E để ${st.make.toLowerCase()}`;
    } else if (hero.queueLength > 0) {
      text = `⏳ ${hero.queueLength} khách đứng chờ chỗ. Mua thêm ${st.seat} ở khu đồ quán xá trong chợ`;
    } else text = '🏮 Đang chờ khách vào quán…';
  } else if (carrying > 0) {
    text = inside
      ? `📦 Đến Kệ hàng bấm E để cất ${carrying} phần hàng`
      : hero.farFromShop
        ? `🚏 Đang gánh ${carrying} phần, quán còn xa: tới trạm xe buýt 🚏 bấm E để về nhanh`
        : `🧺 Đang gánh ${carrying} phần. Mang về quán (🏮 trên bản đồ) rồi cất lên kệ`;
  } else if (delivering > 0) {
    text = `🛵 Xe ba gác đang chở ${delivering} đơn hàng tới quán…`;
  } else if (!ready) {
    text = inside
      ? '🎯 Bấm N lập danh sách đi chợ, rồi ra phố đi sang trái tới Chợ đầu mối'
      : hero.farFromMarket
        ? '🚏 Quán xa chợ: tới trạm xe buýt 🚏 gần nhất bấm E để ra chợ nhanh'
        : '🎯 Đi sang trái (◀ / A, giữ Shift để chạy) tới Chợ đầu mối';
  } else {
    text = inside
      ? '🎯 Đủ hàng rồi! Tới Quầy bấm E để mở cửa đón khách'
      : '🎯 Đủ hàng rồi! Về quán, tới Quầy để mở cửa';
  }

  return <div className="objective">{text}</div>;
}
