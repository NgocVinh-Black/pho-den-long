import { useEffect, useState } from 'react';
import { formatMoney, shipmentUnits } from '@pdl/shared';
import { worldHost } from '../game/worldHost';
import { useGame } from '../store/game';

function useClock() {
  const [clock, setClock] = useState('');
  useEffect(() => {
    const t = setInterval(() => setClock(worldHost.get()?.clockText() ?? ''), 250);
    return () => clearInterval(t);
  }, []);
  return clock;
}

export function Hud() {
  const player = useGame((s) => s.player);
  const shop = useGame((s) => s.shop);
  const catalog = useGame((s) => s.catalog);
  const menu = useGame((s) => s.menu);
  const openNotes = useGame((s) => s.openNotes);
  const screen = useGame((s) => s.screen);
  const cartSize = useGame((s) => s.cart.size);
  const clock = useClock();

  const carrying = player ? shipmentUnits(player.shipments, 'carry') : 0;
  const capacity = player && catalog ? (catalog.rules.carryCapacities[player.shopLevel - 1] ?? 20) : 20;
  const delivering = player?.shipments.filter((s) => s.mode === 'delivery').length ?? 0;

  return (
    <header className="hud">
      <div className="brand">🏮 Phố Đèn Lồng</div>
      {player && shop && (
        <div className="stats">
          <span>
            {shop.icon} {shop.name}
          </span>
          <span>📅 Ngày {player.day}</span>
          <span>🕔 {clock}</span>
          <span>💰 {formatMoney(player.money)}</span>
          <span>⭐ {player.rep}</span>
          {carrying > 0 && (
            <span className="badge-carry">
              🧺 Gánh {carrying}/{capacity}
            </span>
          )}
          {delivering > 0 && <span className="badge-ship">🛵 {delivering} đơn đang giao</span>}
        </div>
      )}
      {player && screen === 'play' && (
        <button className="btn ghost small" onClick={openNotes} title="Sổ tay (N)">
          📒 Sổ tay
        </button>
      )}
      {cartSize > 0 && <span className="badge-cart">🧺 Giỏ chợ: {cartSize} món</span>}
      {player && (
        <button className="btn ghost small" onClick={menu}>
          ☰ Menu
        </button>
      )}
      <FullscreenButton />
    </header>
  );
}

/** Bật / tắt toàn màn hình (ẩn khi trình duyệt không hỗ trợ, ví dụ Safari trên iPhone). */
function FullscreenButton() {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  if (!document.fullscreenEnabled) return null;
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };
  return (
    <button
      className="btn ghost small"
      onClick={toggle}
      title={on ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
      aria-label={on ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
    >
      {on ? '🗗' : '⛶'}
    </button>
  );
}
