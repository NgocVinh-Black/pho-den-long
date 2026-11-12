import { useMemo, useState } from 'react';
import {
  MAX_TABLES,
  deliveryFee,
  formatMoney,
  furnitureFor,
  furnitureName,
  interiorStyle,
  portionsAvailable,
  shipmentUnits,
  type MarketItem,
  type MarketSectionId,
  type ShipmentMode,
} from '@pdl/shared';
import { Overlay } from '../components/Overlay';
import { learnedRecipes, useGame } from '../store/game';

function useMarketData() {
  const market = useGame((s) => s.market);
  const priceOf = useMemo(() => new Map(market?.items.map((i) => [i.id, i.price])), [market]);
  return { market, priceOf };
}

function cartTotals(cart: Map<string, number>, priceOf: Map<string, number>) {
  let goods = 0;
  let units = 0;
  for (const [id, n] of cart) {
    goods += n * (priceOf.get(id) ?? 0);
    units += n;
  }
  return { goods, units };
}

/** Thanh giỏ chợ ở cuối mỗi sạp */
function CartBar() {
  const cart = useGame((s) => s.cart);
  const { priceOf } = useMarketData();
  const { goods, units } = cartTotals(cart, priceOf);
  return (
    <div className="foot sticky">
      <span>
        🧺 Giỏ chợ: <b>{units}</b> phần · <b>{formatMoney(goods)}</b>
      </span>
      <span className="muted">Đi tiếp các sạp khác, hoặc ra quầy 🧾 ở cổng chợ để trả tiền</span>
    </div>
  );
}

/** Hộp ghi chú đang ghim (chỉ các món cần mua) */
function PinnedNoteBox({ section }: { section?: MarketSectionId }) {
  const notes = useGame((s) => s.notes);
  const ingredients = useGame((s) => s.ingredients);
  const catalog = useGame((s) => s.catalog);
  const fill = useGame((s) => s.fillCartFromNote);
  const toggle = useGame((s) => s.toggleNoteItem);
  const toast = useGame((s) => s.toast);
  const pinned = notes.find((n) => n.pinned);
  if (!pinned || !catalog) return null;
  const rows = pinned.items
    .map((it, index) => ({ it, index, ing: it.ingredientId ? ingredients.get(it.ingredientId) : undefined }))
    .filter(({ ing }) => !section || ing?.section === section);
  if (rows.length === 0) return null;
  const secName = (id?: string) => catalog.marketSections.find((s) => s.id === id);

  return (
    <div className="pinned-box">
      <div className="pinned-head">
        <b>📌 {pinned.title}</b>
        <button
          className="btn small"
          onClick={() => {
            const n = fill(pinned.id, section);
            toast(
              n ? `Đã bỏ ${n} món trong ghi chú vào giỏ 🧺` : 'Các món trong ghi chú đã có trong giỏ rồi',
            );
          }}
        >
          🧺 Bỏ {section ? 'món khu này' : 'hết'} vào giỏ
        </button>
      </div>
      <ul>
        {rows.map(({ it, index, ing }) => (
          <li key={index} className={it.done ? 'done' : ''}>
            <label>
              <input type="checkbox" checked={it.done} onChange={() => toggle(pinned.id, index)} />
              {ing?.icon} {it.text}
              {it.qty ? ` ×${it.qty}` : ''}
            </label>
            {!section && ing && (
              <small>
                {secName(ing.section)?.icon} {secName(ing.section)?.name}
              </small>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function IngredientRow({ it }: { it: MarketItem }) {
  const ingredients = useGame((s) => s.ingredients);
  const cart = useGame((s) => s.cart);
  const add = useGame((s) => s.cartAdd);
  const ig = ingredients.get(it.id);
  const n = cart.get(it.id) ?? 0;
  return (
    <div className={`mk-row ${it.forMyShop ? '' : 'faded'}`}>
      <span className="mk-icon">{ig?.icon}</span>
      <div className="mk-name">
        <b>{ig?.name}</b>
        <small>
          {ig?.perishable ? <span className="tag warn">tươi</span> : <span className="tag">để lâu</span>}{' '}
          {it.neededNow ? <span className="tag mine">món của bạn</span> : it.forMyShop ? 'món chưa học' : ''}
          {!it.forMyShop &&
            it.usedBy.length > 0 &&
            `dùng ở: ${it.usedBy.slice(0, 2).join(', ')}${it.usedBy.length > 2 ? '…' : ''}`}
        </small>
      </div>
      <div className="mk-price">
        {formatMoney(it.price)} {it.trend === 'up' && <span className="trend up">▲</span>}
        {it.trend === 'down' && <span className="trend down">▼</span>}
      </div>
      <div className="mk-stock">
        Kệ: <b>{it.stock}</b>
      </div>
      <div className="stepper">
        <button className="btn small" disabled={!n} onClick={() => add(it.id, -1)} aria-label="Bớt">
          −
        </button>
        <span>{n}</span>
        <button className="btn small" onClick={() => add(it.id, 1)} aria-label="Thêm">
          +
        </button>
        <button className="btn small" onClick={() => add(it.id, 5)}>
          +5
        </button>
      </div>
    </div>
  );
}

/** Một sạp trong chợ, bán hàng của một khu. */
export function StallPanel({ section }: { section: MarketSectionId }) {
  const catalog = useGame((s) => s.catalog);
  const ingredients = useGame((s) => s.ingredients);
  const closePanel = useGame((s) => s.closePanel);
  const openNotes = useGame((s) => s.openNotes);
  const { market } = useMarketData();
  const [onlyMine, setOnlyMine] = useState(false);
  const [q, setQ] = useState('');
  const sec = catalog?.marketSections.find((s) => s.id === section);
  if (!catalog || !sec) return null;

  const items = (market?.items ?? [])
    .filter((it) => ingredients.get(it.id)?.section === section)
    .filter((it) => !onlyMine || it.forMyShop)
    .filter((it) => !q || ingredients.get(it.id)?.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.neededNow) - Number(a.neededNow) || Number(b.forMyShop) - Number(a.forMyShop));

  return (
    <Overlay wide>
      <div className="choose-head">
        <h2>
          {sec.icon} {sec.name}
        </h2>
        <span className="btns">
          <button className="btn small" onClick={openNotes}>
            📒 Sổ tay
          </button>
          <button className="btn small" onClick={closePanel}>
            ✕ Đi tiếp
          </button>
        </span>
      </div>
      <div className="vendor-call">
        <span>🧑‍🌾</span> “{sec.call}”
      </div>

      {section === 'noithat' ? (
        <FurnitureList />
      ) : (
        <>
          <PinnedNoteBox section={section} />
          <div className="filters">
            <input placeholder="🔎 Tìm hàng trong khu…" value={q} onChange={(e) => setQ(e.target.value)} />
            <label>
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Chỉ
              hàng quán tôi dùng
            </label>
          </div>
          {!market && <p className="muted">Đang lấy giá chợ hôm nay…</p>}
          <div className="mk-list">
            {items.map((it) => (
              <IngredientRow key={it.id} it={it} />
            ))}
          </div>
          {market && items.length === 0 && <p className="muted center">Không có hàng phù hợp.</p>}
          <CartBar />
        </>
      )}
    </Overlay>
  );
}

/** Sạp đồ quán xá: chỉ bày danh mục hợp với kiểu quán của người chơi. */
function FurnitureList() {
  const player = useGame((s) => s.player);
  const shop = useGame((s) => s.shop);
  const buyFurniture = useGame((s) => s.buyFurniture);
  const [busy, setBusy] = useState(false);
  if (!player || !shop) return null;
  const style = interiorStyle(shop.interior);
  const items = furnitureFor(shop.interior);
  const tables = items
    .filter((f) => f.kind === 'table')
    .reduce((a, f) => a + (player.furniture[f.id] ?? 0), 0);

  return (
    <>
      <p className="muted">
        Đồ cho <b>{style.name.toLowerCase()}</b>. Mua xong thợ khiêng thẳng về quán. Quán đang có{' '}
        <b>
          {tables}/{MAX_TABLES}
        </b>{' '}
        {style.seat} ({tables * 2} chỗ). Ví: <b>{formatMoney(player.money)}</b>
      </p>
      <div className="furniture-grid">
        {items.map((f) => {
          const owned = player.furniture[f.id] ?? 0;
          const full = owned >= f.max || (f.kind === 'table' && tables >= MAX_TABLES);
          const poor = player.money < f.price;
          return (
            <div className="furniture-card" key={f.id}>
              <span className="f-icon">{f.icon}</span>
              <b>{furnitureName(f, shop.id)}</b>
              <small className="muted">{f.desc}</small>
              <small>
                Đang có: <b>{owned}</b>/{f.max}
              </small>
              <button
                className={`btn small ${!full && !poor ? 'primary' : ''}`}
                disabled={full || poor || busy}
                onClick={async () => {
                  setBusy(true);
                  await buyFurniture(f.id);
                  setBusy(false);
                }}
              >
                {full ? 'Đã đủ' : `Mua ${formatMoney(f.price)}`}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Quầy tính tiền ở cổng chợ: trả tiền giỏ chợ, chọn tự gánh hay gọi xe. */
export function CheckoutPanel() {
  const player = useGame((s) => s.player);
  const shop = useGame((s) => s.shop);
  const catalog = useGame((s) => s.catalog);
  const ingredients = useGame((s) => s.ingredients);
  const cart = useGame((s) => s.cart);
  const add = useGame((s) => s.cartAdd);
  const clear = useGame((s) => s.cartClear);
  const buy = useGame((s) => s.buy);
  const closePanel = useGame((s) => s.closePanel);
  const { priceOf } = useMarketData();
  const [busy, setBusy] = useState(false);
  if (!player || !shop || !catalog) return null;

  const { goods, units } = cartTotals(cart, priceOf);
  const fee = cart.size ? deliveryFee(goods) : 0;
  const capacity = catalog.rules.carryCapacities[player.shopLevel - 1] ?? 20;
  const carrying = shipmentUnits(player.shipments, 'carry');
  const canCarry = carrying + units <= capacity;
  const incoming = new Map<string, number>(cart);
  for (const sh of player.shipments)
    for (const it of sh.items) incoming.set(it.id, (incoming.get(it.id) ?? 0) + it.qty);

  const doBuy = async (mode: ShipmentMode) => {
    setBusy(true);
    const ok = await buy(mode);
    if (!ok) setBusy(false);
  };

  const bySection = catalog.marketSections
    .map((sec) => ({ sec, rows: [...cart].filter(([id]) => ingredients.get(id)?.section === sec.id) }))
    .filter((g) => g.rows.length);

  return (
    <Overlay wide>
      <div className="choose-head">
        <h2>🧾 Quầy tính tiền · cổng chợ</h2>
        <button className="btn small" onClick={closePanel}>
          ✕ Đi chợ tiếp
        </button>
      </div>

      <PinnedNoteBox />

      <div className="section-title">📖 Mua nhanh theo món (bỏ đủ nguyên liệu vào giỏ)</div>
      <div className="mk-recipes">
        {learnedRecipes(player, shop).map((r) => {
          const now = portionsAvailable(r, player.pantry);
          const after = portionsAvailable(r, player.pantry, incoming);
          return (
            <div className="mk-recipe" key={r.id}>
              <span className="r-icon sm">{r.icon}</span>
              <div className="r-body">
                <b>{r.name}</b>
                <small className="muted">
                  {r.ingredients.map(({ id }) => ingredients.get(id)?.icon).join(' ')}
                </small>
              </div>
              <div className="portions">
                Trên kệ <b>{now}</b>
                {after > now && (
                  <>
                    {' → '}
                    <b className="up">{after}</b>
                  </>
                )}{' '}
                phần
              </div>
              <div className="rbtns">
                {[3, 5, 10].map((n) => (
                  <button
                    key={n}
                    className="btn small"
                    onClick={() => r.ingredients.forEach((i) => add(i.id, i.qty * n))}
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-title">🧺 Giỏ chợ</div>
      {cart.size === 0 ? (
        <p className="muted">
          Giỏ đang trống. Đi các sạp trong chợ để chọn hàng, hoặc mua nhanh theo món ở trên.
        </p>
      ) : (
        bySection.map(({ sec, rows }) => (
          <div key={sec.id} className="cart-group">
            <div className="cart-sec">
              {sec.icon} {sec.name}
            </div>
            {rows.map(([id, n]) => {
              const ig = ingredients.get(id);
              return (
                <div className="cart-row" key={id}>
                  <span>
                    {ig?.icon} {ig?.name}
                  </span>
                  <span className="muted">{formatMoney((priceOf.get(id) ?? 0) * n)}</span>
                  <span className="stepper">
                    <button className="btn small" onClick={() => add(id, -1)}>
                      −
                    </button>
                    <span>{n}</span>
                    <button className="btn small" onClick={() => add(id, 1)}>
                      +
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        ))
      )}

      <div className="foot sticky checkout">
        <div className="checkout-info">
          <span>
            Tổng: <b>{units}</b> phần · <b>{formatMoney(goods)}</b>
          </span>
          <span>
            Ví: <b>{formatMoney(player.money)}</b>
          </span>
          <span className={canCarry ? 'muted' : 'bad'}>
            🧺 Quang gánh: {carrying + units}/{capacity}
          </span>
          {cart.size > 0 && (
            <button className="btn small" onClick={clear} disabled={busy}>
              Bỏ giỏ
            </button>
          )}
        </div>
        <div className="btns">
          <button
            className="btn"
            disabled={!cart.size || busy || !canCarry || goods > player.money}
            onClick={() => void doBuy('carry')}
          >
            🧺 Trả tiền & tự gánh về <small>miễn phí</small>
          </button>
          <button
            className="btn primary"
            disabled={!cart.size || busy || goods + fee > player.money}
            onClick={() => void doBuy('delivery')}
          >
            🛵 Trả tiền & gọi xe giao <small>+{formatMoney(fee)}</small>
          </button>
        </div>
      </div>
    </Overlay>
  );
}
