import { formatMoney, type Recipe } from '@pdl/shared';
import { useGame } from '../store/game';

export function RecipeRow({ recipe, showLearn = false }: { recipe: Recipe; showLearn?: boolean }) {
  const ingredients = useGame((s) => s.ingredients);
  return (
    <div className="recipe">
      <div className="r-icon">{recipe.icon}</div>
      <div className="r-body">
        <div>
          <b>{recipe.name}</b>{' '}
          <small className="muted">
            bán {formatMoney(recipe.price)} · vốn ~{formatMoney(recipe.cost)} · {recipe.technique.label}
          </small>{' '}
          {showLearn &&
            (recipe.starter ? (
              <span className="tag">Biết sẵn</span>
            ) : (
              <span className="tag warn">
                Học: {formatMoney(recipe.learnCost)} · ⭐{recipe.learnRep}
              </span>
            ))}
        </div>
        <div className="chips">
          {recipe.ingredients.map(({ id, qty }) => {
            const ig = ingredients.get(id);
            return (
              <span key={id} className="chip">
                {ig?.icon} {ig?.name}
                {qty > 1 ? ` ×${qty}` : ''}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
