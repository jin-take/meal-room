export type MealSlot = 'breakfast' | 'lunch' | 'dinner';
export type MemberRole = 'host' | 'member';

export interface Room { id: string; name: string; inviteCode: string; hostMemberId: string; createdAt: string; }
export interface Member { id: string; name: string; role: MemberRole; deviceId: string; joinedAt: string; }
export interface Recipe { id: string; name: string; category: string; ingredients: string[]; note: string; url: string; createdAt: string; updatedAt: string; }
export interface MealPlan { id: string; date: string; slot: MealSlot; recipeId: string; }
export interface ShoppingItem { id: string; name: string; checked: boolean; source: 'auto' | 'manual'; rangeKey?: string; }
export interface RoomData { schemaVersion: 1; version: number; room: Room; members: Member[]; recipes: Recipe[]; mealPlans: MealPlan[]; shoppingItems: ShoppingItem[]; }
