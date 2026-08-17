import type { MealPlan, RoomData } from './types';

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeCollection<T>(
  base: T[],
  local: T[],
  remote: T[],
  keyOf: (item: T) => string,
) {
  const baseByKey = new Map(base.map((item) => [keyOf(item), item]));
  const localByKey = new Map(local.map((item) => [keyOf(item), item]));
  const mergedByKey = new Map(remote.map((item) => [keyOf(item), item]));

  for (const [key, baseItem] of baseByKey) {
    const localItem = localByKey.get(key);
    if (!localItem) {
      mergedByKey.delete(key);
    } else if (!sameValue(localItem, baseItem)) {
      mergedByKey.set(key, localItem);
    }
  }

  for (const [key, localItem] of localByKey) {
    if (!baseByKey.has(key)) mergedByKey.set(key, localItem);
  }

  return [...mergedByKey.values()];
}

const mealPlanKey = (plan: MealPlan) => `${plan.date}:${plan.slot}`;

export function mergeRoomData(base: RoomData, local: RoomData, remote: RoomData): RoomData {
  const recipes = mergeCollection(base.recipes, local.recipes, remote.recipes, (recipe) => recipe.id);
  const recipeIds = new Set(recipes.map((recipe) => recipe.id));
  const mealPlans = mergeCollection(base.mealPlans, local.mealPlans, remote.mealPlans, mealPlanKey)
    .filter((plan) => recipeIds.has(plan.recipeId));

  return {
    ...remote,
    room: sameValue(local.room, base.room) ? remote.room : local.room,
    members: mergeCollection(base.members, local.members, remote.members, (member) => member.id),
    recipes,
    mealPlans,
    shoppingItems: mergeCollection(
      base.shoppingItems,
      local.shoppingItems,
      remote.shoppingItems,
      (item) => item.source === 'auto' ? `auto:${item.name}` : `manual:${item.id}`,
    ),
  };
}

export function hasRoomChanges(base: RoomData, local: RoomData) {
  const { version: _baseVersion, ...baseContent } = base;
  const { version: _localVersion, ...localContent } = local;
  return !sameValue(baseContent, localContent);
}
