import { worldHost } from '../game/worldHost';
import { useGame } from '../store/game';

/** Nút điều khiển trên màn hình (dùng được cả chuột lẫn cảm ứng). */
export function TouchControls() {
  const visible = useGame((s) => s.screen === 'play' && !s.panel && !s.cooking);
  if (!visible) return null;

  const hold = (dir: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      worldHost.get()?.setVirtualMove(dir);
    },
    onPointerUp: () => worldHost.get()?.setVirtualMove(0),
    onPointerCancel: () => worldHost.get()?.setVirtualMove(0),
  });

  return (
    <div className="touch-controls">
      <div className="pad">
        <button className="tc" aria-label="Đi sang trái" {...hold(-1)}>
          ◀
        </button>
        <button className="tc" aria-label="Đi sang phải" {...hold(1)}>
          ▶
        </button>
      </div>
      <button
        className="tc act"
        aria-label="Tương tác"
        onPointerDown={(e) => {
          e.preventDefault();
          worldHost.get()?.interact();
        }}
      >
        E
      </button>
    </div>
  );
}
