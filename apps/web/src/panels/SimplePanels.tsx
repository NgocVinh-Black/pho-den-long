import { useState } from 'react';
import { formatMoney, portionsAvailable, shipmentUnits } from '@pdl/shared';
import { Overlay } from '../components/Overlay';
import { RecipeRow } from '../components/RecipeRow';
import { canMake, learnedRecipes, useGame } from '../store/game';

function PanelHead({ title }: { title: string }) {
  const closePanel = useGame((s) => s.closePanel);
  return (
    <div className="choose-head">
      <h2>{title}</h2>
      <button className="btn small" onClick={closePanel}>
        ✕ Đóng
      </button>
    </div>
  );
}

/** Kệ hàng: xem kho, hàng đang gánh, đang giao. */
export function PantryPanel() {
  const player = useGame((s) => s.player);
  const ingredients = useGame((s) => s.ingredients);
  if (!player) return null;
  const items = Object.entries(player.pantry).sort((a, b) => b[1] - a[1]);

  return (
    <Overlay>
      <PanelHead title="📦 Kệ hàng của quán" />
      {items.length === 0 ? (
        <p className="muted">Kệ đang trống. Ra chợ đầu mối (đầu phố bên trái) mua nguyên liệu nhé!</p>
      ) : (
        <div className="pantry-grid">
          {items.map(([id, qty]) => {
            const ig = ingredients.get(id);
            return (
              <div className="pantry-item" key={id}>
                <span>{ig?.icon}</span>
                <b>{qty}</b>
                <small>{ig?.name}</small>
                {ig?.perishable && <span className="tag warn">tươi</span>}
              </div>
            );
          })}
        </div>
      )}
      {player.shipments.length > 0 && (
        <>
          <div className="section-title">🚚 Hàng chưa lên kệ</div>
          {player.shipments.map((s) => (
            <div className="note" key={s.id}>
              {s.mode === 'carry' ? '🧺 Đang gánh: ' : '🛵 Đang giao: '}
              {s.items.map((i) => `${ingredients.get(i.id)?.icon} ${i.qty}`).join(' · ')}
            </div>
          ))}
        </>
      )}
    </Overlay>
  );
}

/** Sổ công thức ở bếp. */
export function RecipesPanel() {
  const player = useGame((s) => s.player);
  const shop = useGame((s) => s.shop);
  if (!player || !shop) return null;
  return (
    <Overlay wide>
      <PanelHead title={`📖 Sổ công thức · ${shop.name}`} />
      <div className="recipe-list">
        {shop.recipes.map((r) => {
          const learned = player.learned.includes(r.id);
          return (
            <div className={`up-row ${learned ? '' : 'faded'}`} key={r.id}>
              <RecipeRow recipe={r} showLearn={!learned} />
              {learned ? (
                <span className="portions">
                  Làm được <b>{portionsAvailable(r, player.pantry)}</b> phần
                </span>
              ) : (
                <span className="tag warn">🔒 Học ở tổng kết cuối ngày</span>
              )}
            </div>
          );
        })}
      </div>
    </Overlay>
  );
}

/** Xác nhận mở cửa ở quầy. */
export function OpenConfirmPanel() {
  const player = useGame((s) => s.player);
  const shop = useGame((s) => s.shop);
  const openShop = useGame((s) => s.openShop);
  if (!player || !shop) return null;
  const carrying = shipmentUnits(player.shipments, 'carry');
  const delivering = player.shipments.filter((s) => s.mode === 'delivery').length;
  const recipes = learnedRecipes(player, shop);
  const ready = recipes.some((r) => canMake(r, player));

  return (
    <Overlay>
      <PanelHead title="🛎️ Mở cửa đón khách?" />
      <p className="muted">
        Khi mở cửa, khách vào quán ngồi bàn. Tới bàn có ✋ để nhận order, vào bếp 🔥 nấu, rồi bưng món ra bàn.
        Thuê nhân viên phục vụ / phụ bếp ở màn tổng kết cuối ngày để đỡ việc.
      </p>
      <div className="mk-recipes">
        {recipes.map((r) => (
          <div className="mk-recipe" key={r.id}>
            <span className="r-icon sm">{r.icon}</span>
            <div className="r-body">
              <b>{r.name}</b>
            </div>
            <div className="portions">
              Làm được{' '}
              <b className={portionsAvailable(r, player.pantry) ? 'up' : 'bad'}>
                {portionsAvailable(r, player.pantry)}
              </b>{' '}
              phần
            </div>
          </div>
        ))}
      </div>
      <AdPicker />
      {carrying > 0 && <div className="note">🧺 Bạn còn đang gánh {carrying} phần. Cất lên kệ trước đã!</div>}
      {delivering > 0 && <div className="note">🛵 Còn {delivering} đơn đang được giao tới.</div>}
      <div className="foot">
        <span />
        <button className="btn primary" disabled={!ready} onClick={openShop}>
          🏮 Mở cửa
        </button>
      </div>
    </Overlay>
  );
}

/** Thuê máy bay kéo băng rôn quảng cáo cho hôm nay (mỗi ngày một gói). */
function AdPicker() {
  const player = useGame((s) => s.player);
  const plans = useGame((s) => s.catalog?.adPlans);
  const buyAd = useGame((s) => s.buyAd);
  if (!player || !plans) return null;
  const active = plans.find((p) => p.id === player.adPlan);

  return (
    <>
      <div className="section-title">✈️ Thuê máy bay quảng cáo</div>
      {active ? (
        <div className="note good">
          {active.icon} Hôm nay đã thuê <b>{active.name.toLowerCase()}</b>: bay {active.flights} vòng, khách
          ghé thêm {Math.round(active.traffic * 100)}%.
        </div>
      ) : (
        <div className="ad-plans">
          {plans.map((p) => (
            <div className="up-row ad-plan" key={p.id}>
              <span className="r-icon sm">{p.icon}</span>
              <div className="r-body">
                <b>{p.name}</b>
                <div className="muted small">{p.desc}</div>
              </div>
              <button
                className="btn small"
                disabled={player.money < p.price}
                onClick={() => void buyAd(p.id)}
              >
                Thuê {formatMoney(p.price)}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const TIPS = [
  'Hàng tươi để qua đêm là hư mất một nửa, mua vừa đủ thôi con.',
  'Khách Tây thích đồ lưu niệm lắm, trả cũng hậu hĩnh.',
  'Treo thêm đèn lồng thì phố sáng, khách ghé đông hơn.',
  'Dân sành ăn khó tính nhưng khen một câu là cả phố biết.',
  'Đơn nhiều thì gọi xe ba gác, gánh nặng quá đi chậm lắm.',
  'Sửa sang quán lên cấp thì bán được giá hơn, gánh cũng khỏe hơn.',
  'Food reviewer mà khen là danh tiếng lên vù vù!',
  'Giá chợ mỗi ngày một khác, hôm nào rẻ thì mua trữ đồ khô.',
];

/** Ghé quán hàng xóm trò chuyện. */
export function NeighborPanel({ shopId }: { shopId: string }) {
  const catalog = useGame((s) => s.catalog);
  const player = useGame((s) => s.player);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]!);
  const shop = catalog?.shops.find((s) => s.id === shopId);
  const region = shop && catalog?.regions.find((r) => r.id === shop.region);
  if (!shop || !player) return null;

  return (
    <Overlay>
      <PanelHead title={`${shop.icon} ${shop.name}`} />
      <p className="muted">
        {region?.area} · {shop.desc}
      </p>
      <div className="chat">
        <span className="chat-avatar">🧑‍🍳</span>
        <div className="chat-bubble">
          <b>Chủ quán:</b> Chào {player.name}! {tip}
        </div>
      </div>
      <div className="section-title">Quán bên này có</div>
      <div className="neighbor-menu">
        {shop.recipes.map((r) => (
          <span className="chip big" key={r.id}>
            {r.icon} {r.name}
          </span>
        ))}
      </div>
    </Overlay>
  );
}
