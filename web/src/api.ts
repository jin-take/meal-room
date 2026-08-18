import type { Member, RoomData, UserProfile } from './types';
import { deviceId, id, inviteCode } from './utils';

const cloudFrontBase =
  import.meta.env.VITE_CLOUDFRONT_BASE_URL?.replace(/\/$/, '') ??
  import.meta.env.VITE_S3_BASE_URL?.replace(/\/$/, '');
const storageKey = (roomId: string) => `meal-room:${roomId}`;
const roomIndexPath = '/rooms/index.json';
const userStorageKey = (currentDeviceId: string) => `meal-room-user:${currentDeviceId}`;

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

function userUrl(currentDeviceId: string) {
  if (!cloudFrontBase) {
    throw new Error('CloudFront/S3 base URL is not configured.');
  }
  return `${cloudFrontBase}/users/${encodeURIComponent(currentDeviceId)}.json`;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new HttpError(res.status, text || `HTTP ${res.status}`);
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

export async function getUserProfile(): Promise<UserProfile | null> {
  const currentDeviceId = deviceId();
  if (cloudFrontBase) {
    try {
      return normalizeUserProfile(await requestJson<UserProfile>(userUrl(currentDeviceId)));
    } catch (error) {
      // 非公開S3は、存在しないキーをCloudFront経由で403として返す場合がある。
      if (error instanceof HttpError && (error.status === 403 || error.status === 404)) return null;
      throw new Error('ユーザー設定の取得に失敗しました');
    }
  }

  const raw = localStorage.getItem(userStorageKey(currentDeviceId));
  if (!raw) return null;
  try {
    return normalizeUserProfile(JSON.parse(raw) as UserProfile);
  } catch {
    throw new Error('ユーザー設定を読み込めませんでした');
  }
}

async function putUserProfile(profile: UserProfile) {
  if (cloudFrontBase) {
    await requestJson(userUrl(profile.deviceId), { method: 'PUT', body: JSON.stringify(profile) });
  } else {
    localStorage.setItem(userStorageKey(profile.deviceId), JSON.stringify(profile));
  }
  return profile;
}

export async function registerUser(name: string): Promise<UserProfile> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('ユーザーネームを入力してください');
  const currentDeviceId = deviceId();
  const current = await getUserProfile();
  const now = new Date().toISOString();
  return putUserProfile({
    schemaVersion: 1,
    deviceId: currentDeviceId,
    name: normalizedName,
    rooms: current?.rooms ?? [],
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  });
}

async function rememberRoom(data: RoomData, member: Member) {
  const current = await getUserProfile();
  const now = new Date().toISOString();
  const profile: UserProfile = {
    schemaVersion: 1,
    deviceId: deviceId(),
    name: current?.name ?? member.name,
    rooms: [
      ...(current?.rooms ?? []).filter((room) => room.roomId !== data.room.id),
      {
        roomId: data.room.id,
        memberId: member.id,
        name: data.room.name,
        role: member.role,
        joinedAt: member.joinedAt,
        updatedAt: now,
      },
    ],
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  await putUserProfile(profile);
}

export async function rememberCurrentRoom(data: RoomData, memberId: string) {
  const currentDeviceId = deviceId();
  const member = data.members.find((candidate) => candidate.id === memberId && candidate.deviceId === currentDeviceId)
    ?? data.members.find((candidate) => candidate.deviceId === currentDeviceId);
  if (member) await rememberRoom(data, member);
}

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
    await rememberRoom(data, data.members[0]);

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
  await rememberRoom(data, data.members[0]);
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
    const currentDeviceId = deviceId();
    let member = data.members.find((candidate) => candidate.deviceId === currentDeviceId);
    let saved = data;
    if (!member) {
      member = { id: id('member'), name: memberName, role: 'member', deviceId: currentDeviceId, joinedAt: new Date().toISOString() };
      data.members.push(member);
      saved = await putRoom(data);
    }
    await rememberRoom(saved, member);

    const session = { roomId: data.room.id, memberId: member.id };
    saveSession(session);
    return { data: saved, session };
  }

  const candidates = Object.keys(localStorage).filter((k) => k.startsWith('meal-room:'));
  for (const key of candidates) {
    const data = normalizeRoomData(JSON.parse(localStorage.getItem(key)!) as RoomData);
    if (data.room.inviteCode === code.toUpperCase()) {
      const currentDeviceId = deviceId();
      let member = data.members.find((candidate) => candidate.deviceId === currentDeviceId);
      if (!member) {
        member = { id: id('member'), name: memberName, role: 'member', deviceId: currentDeviceId, joinedAt: new Date().toISOString() };
        data.members.push(member);
        data.version += 1;
        localStorage.setItem(key, JSON.stringify(data));
      }
      await rememberRoom(data, member);
      const session = { roomId: data.room.id, memberId: member.id };
      saveSession(session);
      return { data, session };
    }
  }
  throw new Error('招待コードに一致するRoomがありません');
}

export async function enterRoom(roomId: string, memberId: string): Promise<{data: RoomData; session: Session}> {
  const data = await getRoom(roomId);
  const currentDeviceId = deviceId();
  const member = data.members.find((candidate) => candidate.id === memberId && candidate.deviceId === currentDeviceId)
    ?? data.members.find((candidate) => candidate.deviceId === currentDeviceId);
  if (!member) throw new Error('この端末のメンバー情報がRoomに見つかりません');
  await rememberRoom(data, member);
  const session = { roomId: data.room.id, memberId: member.id };
  saveSession(session);
  return { data, session };
}

export async function getRoom(roomId: string): Promise<RoomData> {
  if (cloudFrontBase) {
    try {
      return normalizeRoomData(await requestJson<RoomData>(roomUrl(roomId)));
    } catch {
      throw new Error('Roomが見つかりません');
    }
  }

  const raw = localStorage.getItem(storageKey(roomId));
  if (!raw) throw new Error('Roomが見つかりません');
  return normalizeRoomData(JSON.parse(raw));
}

export async function putRoom(data: RoomData): Promise<RoomData> {
  if (cloudFrontBase) {
    const next = { ...data, version: data.version + 1 };
    await requestJson(roomUrl(data.room.id), { method: 'PUT', body: JSON.stringify(next) });
    return next;
  }

  const next = { ...data, version: data.version + 1 };
  localStorage.setItem(storageKey(data.room.id), JSON.stringify(next));
  return next;
}

function seedRecipes(now: string) {
  return [
    { id: id('recipe'), name: '鶏の照り焼き', category: '主菜', ingredients: ['鶏もも肉', 'しょうゆ', 'みりん', '砂糖'], note: '', url: '', createdAt: now, updatedAt: now },
    { id: id('recipe'), name: '野菜たっぷり味噌汁', category: '汁物', ingredients: ['大根', 'にんじん', '豆腐', '味噌'], note: '', url: '', createdAt: now, updatedAt: now },
  ];
}

function normalizeRoomData(data: RoomData): RoomData {
  return {
    ...data,
    recipes: data.recipes.map((recipe) => ({
      ...recipe,
      url: typeof recipe.url === 'string' ? recipe.url : '',
    })),
  };
}

function normalizeUserProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    schemaVersion: 1,
    deviceId: deviceId(),
    rooms: Array.isArray(profile.rooms) ? profile.rooms : [],
  };
}
