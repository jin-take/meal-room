import { ExternalLink, Search } from 'lucide-react';
import type { Recipe } from './types';

type MealPlanRecipeItemProps = {
  recipe?: Recipe;
  variant: 'calendar' | 'preview';
  onSelect?: () => void;
  selectAriaLabel?: string;
  expanded?: boolean;
};

function safeUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export function MealPlanRecipeItem({ recipe, variant, onSelect, selectAriaLabel, expanded }: MealPlanRecipeItemProps) {
  const recipeUrl = recipe ? safeUrl(recipe.url) : '';

  return <div className={`meal-plan-recipe-item ${variant}`}>
    {variant === 'calendar' ? (
      <button
        type="button"
        className={recipe ? 'meal-picker-trigger selected' : 'meal-picker-trigger'}
        onClick={onSelect}
        aria-label={selectAriaLabel}
        aria-haspopup="dialog"
        aria-expanded={expanded}
      >
        <span>{recipe?.name || '未定'}</span>
        <Search size={15}/>
      </button>
    ) : (
      <span className="meal-plan-recipe-name">{recipe?.name || '未定'}</span>
    )}
    {recipeUrl && <a className="recipe-link" href={recipeUrl} target="_blank" rel="noreferrer" aria-label={`${recipe?.name}のレシピURLを開く`}><ExternalLink size={14}/>レシピを見る</a>}
  </div>;
}
