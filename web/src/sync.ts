import type { MealPlan, RoomData } from './types';

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeCollection<T>(
  base: T[],
  local: T[],
  remote: T[],
  keyOf: (item: T) => string,
  preserveOrder = false,
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

  if (preserveOrder) {
    // Compare surviving items so additions/deletions alone do not override remote order.
    const sharedKeys = new Set(base.map(keyOf).filter(key => localByKey.has(key)));
    const baseOrder = base.map(keyOf).filter(key => sharedKeys.has(key));
    const localOrder = local.map(keyOf).filter(key => sharedKeys.has(key));
    const lastExistingIndex = local.reduce((last, item, index) => sharedKeys.has(keyOf(item)) ? index : last, -1);
    const insertedBeforeExisting = local.some((item, index) => !baseByKey.has(keyOf(item)) && index < lastExistingIndex);
    if (!sameValue(baseOrder, localOrder) || insertedBeforeExisting) {
      const ordered: T[] = [];
      for (const item of local) {
        const key = keyOf(item);
        const merged = mergedByKey.get(key);
        if (merged !== undefined) ordered.push(merged);
        mergedByKey.delete(key);
      }
      return [...ordered, ...mergedByKey.values()];
    }
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
      true,
    ),
  };
}

export function hasRoomChanges(base: RoomData, local: RoomData) {
  const { version: _baseVersion, ...baseContent } = base;
  const { version: _localVersion, ...localContent } = local;
  return !sameValue(baseContent, localContent);
}
