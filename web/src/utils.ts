export const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
export const inviteCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
export const normalizeIngredient = (value: string) => value.trim().replace(/\s+/g, ' ');
export const deviceId = () => {
  const key = 'meal-room-device-id';
  const current = localStorage.getItem(key);
  if (current) return current;
  const next = id('device');
  localStorage.setItem(key, next);
  return next;
};
