import { useRef, useState } from 'react';
import { clamp, interiorStyle, seatName, verdict } from '@pdl/shared';
import { Overlay } from '../components/Overlay';
import { useGame, type CookingSession } from '../store/game';
import { ChopGame } from './ChopGame';
import { GrillGame } from './GrillGame';
import { MashGame } from './MashGame';
import { MemoryGame } from './MemoryGame';
import { PourGame } from './PourGame';
import { PrepStep } from './PrepStep';
import { RhythmGame } from './RhythmGame';
import { TimingGame } from './TimingGame';

const TECHNIQUES = {
  timing: TimingGame,
  mash: MashGame,
  memory: MemoryGame,
  pour: PourGame,
  chop: ChopGame,
  grill: GrillGame,
  rhythm: RhythmGame,
} as const;

export function CookingModal() {
  const cooking = useGame((s) => s.cooking);
  if (!cooking) return null;
  return (
    <Overlay modal>
      <CookingFlow key={cooking.key} cooking={cooking} />
    </Overlay>
  );
}

function CookingFlow({ cooking }: { cooking: CookingSession }) {
  const shop = useGame((s) => s.shop);
  const player = useGame((s) => s.player);
  const weights = useGame((s) => s.catalog?.rules.qualityWeights);
  const finishCooking = useGame((s) => s.finishCooking);
  const [step, setStep] = useState<'prep' | 'technique' | 'waiting'>('prep');
  const prepScore = useRef(0);

  if (!shop || !player || !weights) return null;
  const style = interiorStyle(shop.interior);
  const { recipe, customerName, done, table } = cooking;

  if (done) {
    const stars = done.quality >= 0.85 ? 3 : done.quality >= 0.6 ? 2 : done.quality >= 0.35 ? 1 : 0;
    return (
      <div className="result">
        <div className="stars">
          {'★'.repeat(stars)}
          {'☆'.repeat(3 - stars)}
        </div>
        <h3>
          {recipe.icon} {recipe.name}: {verdict(done.quality)}
        </h3>
        <p>
          🍽️ Xong rồi! {style.serve} ra <b>{seatName(style, table).toLowerCase()}</b> cho{' '}
          {customerName.toLowerCase()} nhé!
        </p>
      </div>
    );
  }

  if (step === 'prep') {
    return (
      <PrepStep
        recipe={recipe}
        shop={shop}
        customerName={`${customerName} (${seatName(style, table).toLowerCase()})`}
        onDone={(s) => {
          prepScore.current = s;
          setStep('technique');
        }}
      />
    );
  }

  const Technique = TECHNIQUES[recipe.technique.type];
  return (
    <Technique
      recipe={recipe}
      level={player.shopLevel}
      onDone={(t) => {
        if (step === 'waiting') return;
        setStep('waiting');
        void finishCooking(clamp(prepScore.current * weights.prep + t * weights.technique, 0, 1));
      }}
    />
  );
}
