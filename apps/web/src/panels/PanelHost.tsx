import { useKeyDown } from '../utils/useKeyDown';
import { useGame } from '../store/game';
import { CheckoutPanel, StallPanel } from './MarketPanels';
import { NotebookPanel } from './NotebookPanel';
import { NeighborPanel, OpenConfirmPanel, PantryPanel, RecipesPanel } from './SimplePanels';

export function PanelHost() {
  const panel = useGame((s) => s.panel);
  const cooking = useGame((s) => s.cooking);
  const closePanel = useGame((s) => s.closePanel);
  useKeyDown({ Escape: closePanel }, !!panel && !cooking);

  if (!panel || cooking) return null;
  switch (panel.type) {
    case 'stall':
      return <StallPanel key={panel.section} section={panel.section} />;
    case 'checkout':
      return <CheckoutPanel />;
    case 'notes':
      return <NotebookPanel />;
    case 'pantry':
      return <PantryPanel />;
    case 'recipes':
      return <RecipesPanel />;
    case 'open-confirm':
      return <OpenConfirmPanel />;
    case 'neighbor':
      return <NeighborPanel shopId={panel.shopId} />;
  }
}
