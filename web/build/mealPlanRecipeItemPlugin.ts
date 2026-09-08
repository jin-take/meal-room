import type { Plugin } from 'vite';

function replaceRequired(source: string, search: string, replacement: string, label: string) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`[meal-plan-recipe-item] App.tsx transform failed: ${label}`);
  return next;
}

export function mealPlanRecipeItemPlugin(): Plugin {
  return {
    name: 'meal-plan-recipe-item',
    enforce: 'pre',
    transform(code, id) {
      const sourceId = id.split('?', 1)[0].replaceAll('\\', '/');
      if (!sourceId.endsWith('/src/App.tsx')) return null;

      let next = code;
      next = replaceRequired(
        next,
        "import { ShoppingList } from './ShoppingList';",
        "import { ShoppingList } from './ShoppingList';\nimport { MealPlanRecipeItem } from './MealPlanRecipeItem';",
        'import shared component',
      );

      next = replaceRequired(
        next,
        "function WeekPreview({data}:{data:RoomData}) { const start=startOfWeek(new Date(),{weekStartsOn:1}); return <div className=\"week-preview\">{Array.from({length:7},(_,i)=>addDays(start,i)).map(day=>{const key=format(day,'yyyy-MM-dd');const plans=data.mealPlans.filter(p=>p.date===key);return <div className=\"day-row\" key={key}><div><b>{format(day,'E',{locale:ja})}</b><span>{format(day,'M/d')}</span></div><p>{plans.map(p=>data.recipes.find(r=>r.id===p.recipeId)?.name).filter(Boolean).join(' / ')||'未定'}</p></div>})}</div> }",
        "function WeekPreview({data}:{data:RoomData}) { const start=startOfWeek(new Date(),{weekStartsOn:1}); return <div className=\"week-preview\">{Array.from({length:7},(_,i)=>addDays(start,i)).map(day=>{const key=format(day,'yyyy-MM-dd');const plans=data.mealPlans.filter(p=>p.date===key);const recipes=plans.map(plan=>data.recipes.find(recipe=>recipe.id===plan.recipeId)).filter((recipe):recipe is Recipe=>Boolean(recipe));return <div className=\"day-row\" key={key}><div><b>{format(day,'E',{locale:ja})}</b><span>{format(day,'M/d')}</span></div><div className=\"week-preview-recipes\">{recipes.length?recipes.map(recipe=><MealPlanRecipeItem key={recipe.id} recipe={recipe} variant=\"preview\"/>):<MealPlanRecipeItem variant=\"preview\"/>}</div></div>})}</div> }",
        'replace week preview',
      );

      next = replaceRequired(
        next,
        "<button type=\"button\" className={recipe?'meal-picker-trigger selected':'meal-picker-trigger'} onClick={()=>setPicker({date:key,slot})} aria-label={`${dayLabel}・${slotLabels[slot]}のレシピを選ぶ。現在は${recipe?.name||'未定'}`} aria-haspopup=\"dialog\" aria-expanded={open}><span>{recipe?.name||'未定'}</span><Search size={15}/></button>{recipeUrl&&<a className=\"recipe-link\" href={recipeUrl} target=\"_blank\" rel=\"noreferrer\" aria-label={`${recipe?.name}のレシピURLを開く`}><ExternalLink size={14}/>レシピを見る</a>}",
        "<MealPlanRecipeItem recipe={recipe} variant=\"calendar\" onSelect={()=>setPicker({date:key,slot})} selectAriaLabel={`${dayLabel}・${slotLabels[slot]}のレシピを選ぶ。現在は${recipe?.name||'未定'}`} expanded={open}/>",
        'replace calendar recipe display',
      );

      next = next.replace("const recipeUrl=recipe?safeRecipeUrl(recipe.url):'';", '');
      return { code: next, map: null };
    },
  };
}
