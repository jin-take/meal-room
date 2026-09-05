import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRoomData, hasRoomChanges } from '../src/sync.ts';

const item = (id, extra = {}) => ({ id, name: id, checked: false, source: 'auto', ...extra });
const room = shoppingItems => ({ schemaVersion: 1, version: 1, room: {}, members: [], recipes: [], mealPlans: [], shoppingItems });
const names = data => data.shoppingItems.map(item => item.name);
const a = item('a'), b = item('b'), c = item('c', { source: 'manual' });

test('local reorder remains dirty and survives refresh/save, including manual items', () => {
  const base = room([a, b, c]);
  const local = room([c, a, b]);
  assert.equal(hasRoomChanges(base, local), true);
  assert.deepEqual(names(mergeRoomData(base, local, base)), ['c', 'a', 'b']);
});

test('local reorder preserves remote checks and additions', () => {
  const result = mergeRoomData(room([a, b, c]), room([c, a, b]), room([{ ...a, checked: true }, b, c, item('d')]));
  assert.deepEqual(names(result), ['c', 'a', 'b', 'd']);
  assert.equal(result.shoppingItems[1].checked, true);
});

test('local reorder does not resurrect a remotely deleted item', () => {
  assert.deepEqual(names(mergeRoomData(room([a, b, c]), room([c, a, b]), room([b, c]))), ['c', 'b']);
});

test('local check, deletion and addition preserve remote ordering', () => {
  const result = mergeRoomData(room([a, b, c]), room([{ ...a, checked: true }, c, item('d')]), room([c, b, a]));
  assert.deepEqual(names(result), ['c', 'a', 'd']);
  assert.equal(result.shoppingItems[1].checked, true);
});

test('simultaneous reorders use local order deterministically', () => {
  assert.deepEqual(names(mergeRoomData(room([a, b, c]), room([b, a, c]), room([c, b, a]))), ['b', 'a', 'c']);
});

test('auto item matching survives regenerated IDs without losing remote state', () => {
  const result = mergeRoomData(room([a, b]), room([b, a]), room([{ ...a, id: 'new-a', checked: true }, { ...b, id: 'new-b' }]));
  assert.deepEqual(names(result), ['b', 'a']);
  assert.equal(result.shoppingItems[1].checked, true);
  assert.equal(result.shoppingItems[1].id, 'new-a');
});

test('newly added item moved above existing items keeps its position on sync', () => {
  const result = mergeRoomData(room([a, b]), room([item('new'), a, b]), room([a, b]));
  assert.deepEqual(names(result), ['new', 'a', 'b']);
});
