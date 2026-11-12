import { useEffect } from 'react';
import { CookingModal } from './cooking/CookingModal';
import { Hud } from './components/Hud';
import { Objective } from './components/Objective';
import { OrdersRail } from './components/OrdersRail';
import { PinnedNote } from './components/PinnedNote';
import { Toasts } from './components/Toasts';
import { TouchControls } from './components/TouchControls';
import { WorldCanvas } from './components/WorldCanvas';
import { PanelHost } from './panels/PanelHost';
import { ChooseShopScreen } from './screens/ChooseShopScreen';
import { NightScreen } from './screens/NightScreen';
import { LoadingScreen, OfflineScreen } from './screens/StatusScreens';
import { TitleScreen } from './screens/TitleScreen';
import { useGame } from './store/game';
import { useKeyDown } from './utils/useKeyDown';

const SCREENS = {
  loading: LoadingScreen,
  offline: OfflineScreen,
  title: TitleScreen,
  choose: ChooseShopScreen,
  night: NightScreen,
  play: null,
} as const;

export function App() {
  const screen = useGame((s) => s.screen);
  const boot = useGame((s) => s.boot);
  const openNotes = useGame((s) => s.openNotes);
  const panel = useGame((s) => s.panel);
  useKeyDown({ KeyN: openNotes }, screen === 'play' && !panel);

  useEffect(() => {
    void boot();
  }, [boot]);

  const Screen = SCREENS[screen];
  return (
    <div className="app">
      <Hud />
      <main className="stage">
        <WorldCanvas />
        <div className="rotate-hint">📱 Xoay ngang máy để thấy cả con phố</div>
        <Objective />
        <PinnedNote />
        <OrdersRail />
        <TouchControls />
        {Screen && <Screen />}
        <PanelHost />
        <CookingModal />
        <Toasts />
      </main>
      <p className="hint">
        <kbd>←</kbd> <kbd>→</kbd> / <kbd>A</kbd> <kbd>D</kbd> đi lại · <kbd>E</kbd> tương tác ·{' '}
        <kbd>Shift</kbd> chạy · <kbd>N</kbd> sổ tay · <kbd>Esc</kbd> đóng bảng · Bấm chuột vào chỗ muốn tới để
        đi tới đó
      </p>
    </div>
  );
}
