import { useEffect, useRef } from 'react';
import { World } from '../game/World';
import { worldHost } from '../game/worldHost';
import { syncWorld, useGame } from '../store/game';

export function WorldCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const world = new World(canvas, {
      onInteract: (id) => useGame.getState().interact(id),
      onAngry: (msg) => void useGame.getState().customerLeft(msg),
      canAccept: (r) => useGame.getState().canAccept(r),
      onRequestCook: (o, d) => useGame.getState().startCooking(o, d),
      onDeliver: (o, d) => void useGame.getState().deliverDish(o, d),
      onEvent: (t) => useGame.getState().toast(t),
      onDayOver: () => void useGame.getState().endDay(),
      onDeliveryArrived: (id) => void useGame.getState().deliveryArrived(id),
    });
    worldHost.set(world);
    syncWorld();

    // Co giãn theo khung sân khấu: màn rộng thấy thêm phố, vẽ nét theo devicePixelRatio
    const box = canvas.parentElement ?? canvas;
    const fit = () => {
      const { width, height } = world.resize(box.clientWidth, box.clientHeight);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    // đổi màn hình (devicePixelRatio khác) cũng cần vẽ lại cho nét
    window.addEventListener('resize', fit);

    // Chỉ cho điều khiển nhân vật khi đang chơi và không mở bảng nào
    const applyInput = () => {
      const s = useGame.getState();
      world.setInputEnabled(s.screen === 'play' && !s.panel && !s.cooking);
    };
    applyInput();
    const unsub = useGame.subscribe(applyInput);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
      unsub();
      world.destroy();
      if (worldHost.get() === world) worldHost.set(null);
    };
  }, []);

  return <canvas ref={ref} id="street" aria-label="Phố Đèn Lồng" tabIndex={0} />;
}
