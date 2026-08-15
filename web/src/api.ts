import type { RoomData } from './types';
import { deviceId, id, inviteCode } from './utils';

const cloudFrontBase =
  import.meta.env.VITE_CLOUDFRONT_BASE_URL?.replace(/\/$/, '') ??
  import.meta.env.VITE_S3_BASE_URL?.replace(/\/$/, '');
const storageKey = (roomId: string) => `meal-room:${roomId}`;
const roomIndexPath = '/rooms/index.json';

export interface Session { roomId: string; memberId: string; }

type RoomIndexEntry = { roomId: string; inviteCode: string; name: string; updatedAt: string; };

function roomUrl(roomId: string) {
  if (!cloudFrontBase) {
    throw new Error('CloudFront/S3 base URL is not configured.');
  }
  return `${cloudFrontBase}/rooms/${roomId}.json`;
}

function roomIndexUrl() {
  if (!cloudFrontBase) {
    throw new Error('CloudFront/S3 base URL is not configured.');
  }
  return `${cloudFrontBase}${roomIndexPath}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return (await res.text()) as unknown as T;
  }

  return (await res.json()) as T;
}

async function readRoomIndex(): Promise<RoomIndexEntry[]> {
  if (!cloudFrontBase) return [];

  try {
    return await requestJson<RoomIndexEntry[]>(roomIndexUrl());
  } catch {
    return [];
  }
}

async function writeRoomIndex(entries: RoomIndexEntry[]) {
  if (!cloudFrontBase) return;
  await requestJson(roomIndexUrl(), { method: 'PUT', body: JSON.stringify(entries) });
}

async function updateRoomIndex(roomId: string, inviteCode: string, name: string) {
  const entries = await readRoomIndex();
  const nextEntries = [
    ...entries.filter((entry) => entry.roomId !== roomId),
    {
      roomId,
      inviteCode,
      name,
      updatedAt: new Date().toISOString(),
    },
  ];
  await writeRoomIndex(nextEntries);
}

const saveSession = (session: Session) => localStorage.setItem('meal-room-session', JSON.stringify(session));
export const loadSession = (): Session | null => {
  try { return JSON.parse(localStorage.getItem('meal-room-session') || 'null'); } catch { return null; }
};
export const clearSession = () => localStorage.removeItem('meal-room-session');

export async function createRoom(roomName: string, memberName: string): Promise<{data: RoomData; session: Session}> {
  if (cloudFrontBase) {
    const now = new Date().toISOString();
    const memberId = id('member');
    const roomId = id('room');
    const inviteCodeValue = inviteCode();
    const data: RoomData = {
      schemaVersion: 1,
      version: 1,
      room: { id: roomId, name: roomName, inviteCode: inviteCodeValue, hostMemberId: memberId, createdAt: now },
      members: [{ id: memberId, name: memberName, role: 'host', deviceId: deviceId(), joinedAt: now }],
      recipes: seedRecipes(now),
      mealPlans: [],
      shoppingItems: [],
    };

    await requestJson(roomUrl(roomId), { method: 'PUT', body: JSON.stringify(data) });
    await updateRoomIndex(roomId, inviteCodeValue, roomName);

    const session = { roomId, memberId };
    saveSession(session);
    return { data, session };
  }

  const now = new Date().toISOString();
  const memberId = id('member');
  const roomId = id('room');
  const data: RoomData = {
    schemaVersion: 1,
    version: 1,
    room: { id: roomId, name: roomName, inviteCode: inviteCode(), hostMemberId: memberId, createdAt: now },
    members: [{ id: memberId, name: memberName, role: 'host', deviceId: deviceId(), joinedAt: now }],
    recipes: seedRecipes(now),
    mealPlans: [],
    shoppingItems: [],
  };

  localStorage.setItem(storageKey(roomId), JSON.stringify(data));
  const session = { roomId, memberId };
  saveSession(session);
  return { data, session };
}

export async function joinRoom(code: string, memberName: string): Promise<{data: RoomData; session: Session}> {
  if (cloudFrontBase) {
    const entries = await readRoomIndex();
    const target = entries.find((entry) => entry.inviteCode === code.toUpperCase());
    if (!target) {
      throw new Error('招待コードに一致するRoomがありません');
    }

    const data = await getRoom(target.roomId);
    const memberId = id('member');
    data.members.push({
      id: memberId,
      name: memberName,
      role: 'member',
      deviceId: deviceId(),
      joinedAt: new Date().toISOString(),
    });
    data.version += 1;
    await putRoom(data);

    const session = { roomId: data.room.id, memberId };
    saveSession(session);
    return { data, session };
  }

  const candidates = Object.keys(localStorage).filter((k) => k.startsWith('meal-room:'));
  for (const key of candidates) {
    const data = JSON.parse(localStorage.getItem(key)!) as RoomData;
    if (data.room.inviteCode === code.toUpperCase()) {
      const memberId = id('member');
      data.members.push({ id: memberId, name: memberName, role: 'member', deviceId: deviceId(), joinedAt: new Date().toISOString() });
      data.version += 1;
      localStorage.setItem(key, JSON.stringify(data));
      const session = { roomId: data.room.id, memberId };
      saveSession(session);
      return { data, session };
    }
  }
  throw new Error('招待コードに一致するRoomがありません');
}

export async function getRoom(roomId: string): Promise<RoomData> {
  if (cloudFrontBase) {
    try {
      return await requestJson<RoomData>(roomUrl(roomId));
    } catch {
      throw new Error('Roomが見つかりません');
    }
  }

  const raw = localStorage.getItem(storageKey(roomId));
  if (!raw) throw new Error('Roomが見つかりません');
  return JSON.parse(raw);
}

export async function putRoom(data: RoomData): Promise<RoomData> {
  if (cloudFrontBase) {
    const next = { ...data, version: data.version + 1 };
    await requestJson(roomUrl(data.room.id), { method: 'PUT', body: JSON.stringify(next) });
    await updateRoomIndex(data.room.id, data.room.inviteCode, data.room.name);
    return next;
  }

  const next = { ...data, version: data.version + 1 };
  localStorage.setItem(storageKey(data.room.id), JSON.stringify(next));
  return next;
}

function seedRecipes(now: string) {
  return [
    { id: id('recipe'), name: '鶏の照り焼き', category: '主菜', ingredients: ['鶏もも肉', 'しょうゆ', 'みりん', '砂糖'], note: '', createdAt: now, updatedAt: now },
    { id: id('recipe'), name: '野菜たっぷり味噌汁', category: '汁物', ingredients: ['大根', 'にんじん', '豆腐', '味噌'], note: '', createdAt: now, updatedAt: now },
  ];
}
