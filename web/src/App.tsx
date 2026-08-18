import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addDays, addMonths, format, isAfter, isBefore, isSameDay, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ArrowLeft, CalendarDays, ChefHat, Check, ChevronRight, CloudUpload, Copy, ExternalLink, Home, LogOut, Plus, Search, ShoppingBasket, Trash2, UserRound, Users, X } from 'lucide-react';
import { clearSession, createRoom, enterRoom, getRoom, getUserProfile, joinRoom, loadSession, putRoom, registerUser, rememberCurrentRoom, type Session } from './api';
import type { MealPlan, MealSlot, Recipe, RoomData, ShoppingItem, UserProfile } from './types';
import { id, normalizeIngredient } from './utils';
import { hasRoomChanges, mergeRoomData } from './sync';

type Tab = 'home' | 'recipes' | 'calendar' | 'shopping' | 'room';
const slotLabels: Record<MealSlot, string> = { breakfast: '朝', lunch: '昼', dinner: '夜' };

export function App() {
  const [session, setSession] = useState<Session | null>(loadSession());
  const [data, setData] = useState<RoomData | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const baseDataRef = useRef<RoomData | null>(null);
  const currentDataRef = useRef<RoomData | null>(null);
  const savingRef = useRef(false);
  const revisionRef = useRef(0);
  const rememberedSessionRef = useRef('');

  const receiveRemote = useCallback((remote: RoomData) => {
    if (savingRef.current) return;
    const base = baseDataRef.current;
    const current = currentDataRef.current;
    const next = base && current && hasRoomChanges(base, current)
      ? mergeRoomData(base, current, remote)
      : remote;
    baseDataRef.current = remote;
    currentDataRef.current = next;
    setData(next);
    setDirty(hasRoomChanges(remote, next));
    setError('');
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const remote = await getRoom(session.roomId);
        if (!cancelled) {
          receiveRemote(remote);
          const sessionKey = `${session.roomId}:${session.memberId}`;
          if (rememberedSessionRef.current !== sessionKey) {
            try {
              await rememberCurrentRoom(remote, session.memberId);
              rememberedSessionRef.current = sessionKey;
            } catch {
              // Roomの表示は継続し、次の定期取得でユーザー履歴の保存を再試行する。
            }
          }
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Roomの取得に失敗しました');
        if (!currentDataRef.current) {
          clearSession();
          setSession(null);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 3000);
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [receiveRemote, session]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [dirty]);

  const commit = (next: RoomData) => {
    revisionRef.current += 1;
    currentDataRef.current = next;
    setData(next);
    setDirty(true);
    setError('');
  };

  const sync = async () => {
    if (savingRef.current) return;
    const base = baseDataRef.current;
    const current = currentDataRef.current;
    if (!session || !base || !current || !hasRoomChanges(base, current)) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const latest = await getRoom(session.roomId);
      const merged = mergeRoomData(base, currentDataRef.current ?? current, latest);
      baseDataRef.current = latest;
      currentDataRef.current = merged;
      setData(merged);
      const sentRevision = revisionRef.current;
      const saved = await putRoom(merged);
      const editedWhileSaving = revisionRef.current !== sentRevision;
      const next = editedWhileSaving && currentDataRef.current
        ? mergeRoomData(merged, currentDataRef.current, saved)
        : saved;
      baseDataRef.current = saved;
      currentDataRef.current = next;
      setData(next);
      setDirty(hasRoomChanges(saved, next));
    } catch (e) {
      const latestBase = baseDataRef.current;
      const latestLocal = currentDataRef.current;
      setDirty(Boolean(latestBase && latestLocal && hasRoomChanges(latestBase, latestLocal)));
      setError(e instanceof Error ? e.message : '同期に失敗しました');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const ready = (d:RoomData,s:Session) => { baseDataRef.current=d; currentDataRef.current=d; rememberedSessionRef.current=`${s.roomId}:${s.memberId}`; setData(d); setSession(s); setDirty(false); };
  if (!session) return <Welcome onReady={ready} error={error} />;
  if (!data) return <LoadingScreen/>;

  return <div className="app-shell">
    <header className="topbar"><div className="topbar-brand"><img className="topbar-logo" src="./icon-meal-room-transparent.png" alt=""/><div><span className="eyebrow">MealRoom</span><h1>{data.room.name}</h1></div></div><div className={`sync-state ${dirty ? 'pending' : ''}`}><span>{saving ? '同期中…' : dirty ? '未同期の変更あり' : '同期済み'}</span><button className="sync-button" onClick={sync} disabled={!dirty || saving}><CloudUpload size={17}/>同期</button></div></header>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}><X size={16}/></button></div>}
    <main>
      {tab === 'home' && <Dashboard data={data} onTab={setTab} />}
      {tab === 'recipes' && <Recipes data={data} commit={commit} />}
      {tab === 'calendar' && <Calendar data={data} commit={commit} />}
      {tab === 'shopping' && <Shopping data={data} commit={commit} />}
      {tab === 'room' && <Room data={data} session={session} onExit={() => { if(dirty&&!window.confirm('未同期の変更があります。Room一覧へ戻りますか？'))return; clearSession(); baseDataRef.current=null; currentDataRef.current=null; rememberedSessionRef.current=''; setSession(null); setData(null); setDirty(false); }} />}
    </main>
    <nav className="bottom-nav">
      <Nav icon={<Home/>} label="ホーム" active={tab==='home'} onClick={()=>setTab('home')}/>
      <Nav icon={<ChefHat/>} label="料理" active={tab==='recipes'} onClick={()=>setTab('recipes')}/>
      <Nav icon={<CalendarDays/>} label="献立" active={tab==='calendar'} onClick={()=>setTab('calendar')}/>
      <Nav icon={<ShoppingBasket/>} label="買い物" active={tab==='shopping'} onClick={()=>setTab('shopping')}/>
      <Nav icon={<Users/>} label="Room" active={tab==='room'} onClick={()=>setTab('room')}/>
    </nav>
  </div>;
}

function LoadingScreen() {
 return <div className="welcome"><div className="welcome-card loading-card"><div className="brand-mark"><img src="./icon-meal-room-transparent.png" alt="MealRoom"/></div><span className="eyebrow">MEALROOM</span><h1>Roomを読み込んでいます</h1><p>少しだけお待ちください。</p><div className="loading-line"/></div></div>
}

function Welcome({onReady, error}:{onReady:(d:RoomData,s:Session)=>void; error:string}) {
 const [profile,setProfile]=useState<UserProfile|null>();
 const [mode,setMode]=useState<'rooms'|'create'|'join'>('rooms');
 const [name,setName]=useState('');
 const [roomName,setRoomName]=useState('わが家');
 const [code,setCode]=useState('');
 const [busy,setBusy]=useState(false);
 const [localError,setLocalError]=useState('');
 const loadProfile=async()=>{setLocalError('');try{setProfile(await getUserProfile())}catch(e){setLocalError(e instanceof Error?e.message:'ユーザー設定の取得に失敗しました')}};
 useEffect(()=>{void loadProfile()},[]);
 const createProfile=async()=>{if(busy)return;if(!name.trim())return setLocalError('ユーザーネームを入力してください');setBusy(true);setLocalError('');try{setProfile(await registerUser(name))}catch(e){setLocalError(e instanceof Error?e.message:'登録に失敗しました')}finally{setBusy(false)}};
 const open=async(roomId:string,memberId:string)=>{if(busy)return;setBusy(true);setLocalError('');try{const result=await enterRoom(roomId,memberId);onReady(result.data,result.session)}catch(e){setLocalError(e instanceof Error?e.message:'Roomを開けませんでした')}finally{setBusy(false)}};
 const submit=async()=>{if(!profile||busy||mode==='join'&&!code.trim())return;setBusy(true);setLocalError('');try{const result=mode==='create'?await createRoom(roomName.trim()||'わが家',profile.name):await joinRoom(code.trim().toUpperCase(),profile.name);onReady(result.data,result.session)}catch(e){setLocalError(e instanceof Error?e.message:'失敗しました')}finally{setBusy(false)}};
 const changeMode=(next:'rooms'|'create'|'join')=>{setMode(next);setLocalError('')};
 if(profile===undefined&&!localError)return <LoadingScreen/>;
 if(profile===undefined)return <div className="welcome"><div className="welcome-card"><div className="brand-mark"><img src="./icon-meal-room-transparent.png" alt="MealRoom"/></div><span className="eyebrow">USER SETTINGS</span><h1>ユーザー設定を読み込めませんでした</h1><p className="form-error">{localError}</p><button className="primary" onClick={()=>void loadProfile()}>もう一度試す</button></div></div>;
 if(!profile)return <div className="welcome"><div className="welcome-card"><div className="brand-mark"><img src="./icon-meal-room-transparent.png" alt="MealRoom"/></div><span className="eyebrow">WELCOME TO MEALROOM</span><h1>はじめに、あなたの名前を登録します。</h1><p>この端末のRoom一覧に表示するユーザーネームです。</p><label>ユーザーネーム<input autoFocus value={name} onChange={event=>setName(event.target.value)} onKeyDown={event=>event.key==='Enter'&&void createProfile()} placeholder="例：たけひろ"/></label>{(localError||error)&&<p className="form-error">{localError||error}</p>}<button className="primary" onClick={()=>void createProfile()} disabled={busy}>{busy?'登録中…':'登録してはじめる'}</button></div></div>;
 const rooms=[...profile.rooms].sort((left,right)=>right.updatedAt.localeCompare(left.updatedAt));
 return <div className="welcome"><div className="welcome-card room-home">
  <div className="profile-head"><div className="user-avatar"><UserRound size={24}/></div><div><span className="eyebrow">YOUR ROOMS</span><h1>{profile.name}さんのRoom</h1></div></div>
  {mode==='rooms'&&<><p>以前参加したRoomへ戻るか、新しいRoomをはじめられます。</p><div className="room-history">{rooms.length===0&&<div className="empty">参加したRoomはまだありません。</div>}{rooms.map(room=><button className="room-entry" key={room.roomId} onClick={()=>void open(room.roomId,room.memberId)} disabled={busy}><div><strong>{room.name}</strong><span>{room.role==='host'?'ホスト':'メンバー'} · {format(parseISO(room.joinedAt),'yyyy年M月d日')}から参加</span></div><ChevronRight size={20}/></button>)}</div><div className="room-actions"><button className="primary" onClick={()=>changeMode('create')}><Plus size={18}/>Roomを作る</button><button className="ghost" onClick={()=>changeMode('join')}><Users size={18}/>招待コードで参加</button></div></>}
  {mode!=='rooms'&&<><button className="back-button" onClick={()=>changeMode('rooms')}><ArrowLeft size={17}/>Room一覧へ戻る</button><div className="room-form"><h2>{mode==='create'?'新しいRoomを作る':'Roomに参加する'}</h2>{mode==='create'?<label>Room名<input autoFocus value={roomName} onChange={event=>setRoomName(event.target.value)} onKeyDown={event=>event.key==='Enter'&&void submit()} placeholder="例：わが家"/></label>:<label>招待コード<input autoFocus value={code} maxLength={6} onChange={event=>setCode(event.target.value.toUpperCase())} onKeyDown={event=>event.key==='Enter'&&void submit()} placeholder="ABC123"/></label>}<button className="primary" onClick={()=>void submit()} disabled={busy||mode==='join'&&!code.trim()}>{busy?'準備中…':mode==='create'?'Roomをはじめる':'Roomに参加する'}</button></div></>}
  {(localError||error)&&<p className="form-error">{localError||error}</p>}
 </div></div>
}

function Dashboard({data,onTab}:{data:RoomData;onTab:(t:Tab)=>void}) {
  const today=format(new Date(),'yyyy-MM-dd'); const todayPlans=data.mealPlans.filter(p=>p.date===today); const names=todayPlans.map(p=>data.recipes.find(r=>r.id===p.recipeId)?.name).filter(Boolean);
  return <section className="stack"><div className="hero-card"><span className="eyebrow">TODAY</span><h2>{format(new Date(),'M月d日 EEEE',{locale:ja})}</h2><p>{names.length?names.join('・'):'今日の献立はまだ空いています。'}</p><button className="secondary" onClick={()=>onTab('calendar')}>献立を決める</button></div><div className="stats-grid"><button className="stat-card" onClick={()=>onTab('recipes')}><ChefHat/><b>{data.recipes.length}</b><span>登録した料理</span></button><button className="stat-card" onClick={()=>onTab('shopping')}><ShoppingBasket/><b>{data.shoppingItems.filter(i=>!i.checked).length}</b><span>買うもの</span></button><button className="stat-card" onClick={()=>onTab('room')}><Users/><b>{data.members.length}</b><span>メンバー</span></button></div><div className="section-head"><div><span className="eyebrow">THIS WEEK</span><h2>今週の献立</h2></div></div><WeekPreview data={data}/></section>
}

function WeekPreview({data}:{data:RoomData}) { const start=startOfWeek(new Date(),{weekStartsOn:1}); return <div className="week-preview">{Array.from({length:7},(_,i)=>addDays(start,i)).map(day=>{const key=format(day,'yyyy-MM-dd');const plans=data.mealPlans.filter(p=>p.date===key);return <div className="day-row" key={key}><div><b>{format(day,'E',{locale:ja})}</b><span>{format(day,'M/d')}</span></div><p>{plans.map(p=>data.recipes.find(r=>r.id===p.recipeId)?.name).filter(Boolean).join(' / ')||'未定'}</p></div>})}</div> }

function Recipes({data,commit}:{data:RoomData;commit:(d:RoomData)=>void}) {
 const empty={name:'',category:'主菜',ingredients:'',note:'',url:''}; const [form,setForm]=useState(empty); const [editing,setEditing]=useState<string|null>(null); const urlInvalid=Boolean(form.url.trim()&&!safeRecipeUrl(form.url)); const save=()=>{const ingredients=form.ingredients.split(/[、,\n]/).map(normalizeIngredient).filter(Boolean); if(!form.name.trim()||!ingredients.length||urlInvalid)return; const now=new Date().toISOString(); let recipes:Recipe[]; if(editing){recipes=data.recipes.map(r=>r.id===editing?{...r,name:form.name.trim(),category:form.category,ingredients,note:form.note,url:form.url.trim(),updatedAt:now}:r)}else{recipes=[...data.recipes,{id:id('recipe'),name:form.name.trim(),category:form.category,ingredients,note:form.note,url:form.url.trim(),createdAt:now,updatedAt:now}]};commit({...data,recipes});setForm(empty);setEditing(null)};
 const edit=(r:Recipe)=>{setEditing(r.id);setForm({name:r.name,category:r.category,ingredients:r.ingredients.join('、'),note:r.note,url:r.url||''})}; const remove=(rid:string)=>commit({...data,recipes:data.recipes.filter(r=>r.id!==rid),mealPlans:data.mealPlans.filter(p=>p.recipeId!==rid)});
 return <section className="stack"><div className="section-head"><div><span className="eyebrow">RECIPES</span><h2>料理</h2></div></div><div className="editor-card"><h3>{editing?'料理を編集':'料理を追加'}</h3><div className="form-grid"><label>料理名<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="例：カレー"/></label><label>カテゴリ<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option>主菜</option><option>副菜</option><option>汁物</option><option>主食</option><option>デザート</option></select></label><label className="wide">レシピURL（任意）<input type="url" value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://example.com/recipe"/>{urlInvalid&&<span className="field-error">http:// または https:// から始まるURLを入力してください</span>}</label><label className="wide">食材（「、」または改行で区切る）<textarea value={form.ingredients} onChange={e=>setForm({...form,ingredients:e.target.value})} placeholder="玉ねぎ、にんじん、じゃがいも"/></label><label className="wide">メモ<input value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label></div><div className="actions"><button className="primary" onClick={save} disabled={urlInvalid}><Plus size={18}/>{editing?'更新する':'追加する'}</button>{editing&&<button className="ghost" onClick={()=>{setEditing(null);setForm(empty)}}>キャンセル</button>}</div></div><div className="card-list">{data.recipes.map(r=>{const recipeUrl=safeRecipeUrl(r.url);return <article className="recipe-card" key={r.id}><div><span className="pill">{r.category}</span><h3>{r.name}</h3><p>{r.ingredients.join('・')}</p>{recipeUrl&&<a className="recipe-link" href={recipeUrl}><ExternalLink size={14}/>レシピを見る</a>}{r.note&&<small>{r.note}</small>}</div><div className="icon-actions"><button onClick={()=>edit(r)}>編集</button><button aria-label="削除" onClick={()=>remove(r.id)}><Trash2 size={17}/></button></div></article>})}</div></section>
}

function safeRecipeUrl(value: string) {
 try { const parsed=new URL(value.trim()); return parsed.protocol==='http:'||parsed.protocol==='https:'?parsed.toString():'' } catch { return '' }
}

function Calendar({data,commit}:{data:RoomData;commit:(d:RoomData)=>void}) {
 const [weekOffset,setWeekOffset]=useState(0);
 const [picker,setPicker]=useState<{date:string;slot:MealSlot}|null>(null);
 const start=addDays(startOfWeek(new Date(),{weekStartsOn:1}),weekOffset*7);
 const setPlan=(date:string,slot:MealSlot,recipeId:string)=>{const without=data.mealPlans.filter(p=>!(p.date===date&&p.slot===slot));const mealPlans=recipeId?[...without,{id:id('plan'),date,slot,recipeId} as MealPlan]:without;commit({...data,mealPlans})};
 return <>
  <section className="stack"><div className="section-head"><div><span className="eyebrow">MEAL PLAN</span><h2>1週間の献立</h2></div><div className="week-controls"><button onClick={()=>setWeekOffset(v=>v-1)}>‹</button><button onClick={()=>setWeekOffset(0)}>今週</button><button onClick={()=>setWeekOffset(v=>v+1)}>›</button></div></div><div className="calendar-list">{Array.from({length:7},(_,i)=>addDays(start,i)).map(day=>{const key=format(day,'yyyy-MM-dd');const dayLabel=format(day,'M月d日（E）',{locale:ja});return <article className="calendar-day" key={key}><div className="calendar-date"><b>{format(day,'d')}</b><span>{format(day,'EEE',{locale:ja})}</span></div><div className="slot-list">{(['breakfast','lunch','dinner'] as MealSlot[]).map(slot=>{const current=data.mealPlans.find(p=>p.date===key&&p.slot===slot)?.recipeId||'';const recipe=data.recipes.find(r=>r.id===current);const open=picker?.date===key&&picker.slot===slot;return <div className="meal-slot" key={slot}><span>{slotLabels[slot]}</span><button type="button" className={recipe?'meal-picker-trigger selected':'meal-picker-trigger'} onClick={()=>setPicker({date:key,slot})} aria-label={`${dayLabel}・${slotLabels[slot]}の料理を選ぶ。現在は${recipe?.name||'未定'}`} aria-haspopup="dialog" aria-expanded={open}><span>{recipe?.name||'未定'}</span><Search size={15}/></button></div>})}</div></article>})}</div></section>
  {picker&&<RecipePickerModal recipes={data.recipes} currentRecipeId={data.mealPlans.find(p=>p.date===picker.date&&p.slot===picker.slot)?.recipeId||''} date={picker.date} slot={picker.slot} onSelect={recipeId=>{setPlan(picker.date,picker.slot,recipeId);setPicker(null)}} onClose={()=>setPicker(null)}/>}
 </>
}

function RecipePickerModal({recipes,currentRecipeId,date,slot,onSelect,onClose}:{recipes:Recipe[];currentRecipeId:string;date:string;slot:MealSlot;onSelect:(recipeId:string)=>void;onClose:()=>void}) {
 const [query,setQuery]=useState('');
 const dialogRef=useRef<HTMLDivElement>(null);
 const inputRef=useRef<HTMLInputElement>(null);
 const onCloseRef=useRef(onClose);
 onCloseRef.current=onClose;
 const normalizedQuery=query.trim().toLocaleLowerCase('ja');
 const filtered=recipes.filter(recipe=>!normalizedQuery||[recipe.name,recipe.category,...recipe.ingredients].some(value=>value.toLocaleLowerCase('ja').includes(normalizedQuery)));
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  inputRef.current?.focus();
  const handleKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onCloseRef.current();return}
   if(event.key!=='Tab'||!dialogRef.current)return;
   const focusable=[...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')];
   if(!focusable.length)return;
   const first=focusable[0];const last=focusable[focusable.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',handleKeyDown);
  return()=>{document.removeEventListener('keydown',handleKeyDown);document.body.style.overflow=previousOverflow;previous?.focus()};
 },[]);
 const titleId=`recipe-picker-${date}-${slot}`;
 return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <div className="recipe-picker-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
   <div className="modal-head"><div><span className="eyebrow">{format(parseISO(date),'M月d日（E）',{locale:ja})}・{slotLabels[slot]}</span><h3 id={titleId}>料理を選ぶ</h3></div><button type="button" className="modal-close" onClick={onClose} aria-label="閉じる"><X size={20}/></button></div>
   <div className="recipe-search"><Search size={18}/><input ref={inputRef} type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="料理名・カテゴリ・食材で検索" aria-label="料理を検索"/>{query&&<button type="button" onClick={()=>{setQuery('');inputRef.current?.focus()}} aria-label="検索をクリア"><X size={17}/></button>}</div>
   <div className="recipe-options">
    <button type="button" className={!currentRecipeId?'recipe-option selected':'recipe-option'} onClick={()=>onSelect('')}><div><strong>未定</strong><span>この枠の料理を設定しない</span></div>{!currentRecipeId&&<Check size={19}/>}</button>
    {filtered.map(recipe=><button type="button" className={recipe.id===currentRecipeId?'recipe-option selected':'recipe-option'} key={recipe.id} onClick={()=>onSelect(recipe.id)}><div><strong>{recipe.name}</strong><span>{recipe.category} · {recipe.ingredients.join('・')}</span></div>{recipe.id===currentRecipeId&&<Check size={19}/>}</button>)}
    {filtered.length===0&&<div className="recipe-search-empty"><Search size={24}/><p>「{query.trim()}」に一致する料理がありません。</p></div>}
   </div>
  </div>
 </div>
}

function Shopping({data,commit}:{data:RoomData;commit:(d:RoomData)=>void}) {
 const today=format(new Date(),'yyyy-MM-dd'); const [from,setFrom]=useState(today); const [to,setTo]=useState(format(addDays(new Date(),6),'yyyy-MM-dd')); const [manual,setManual]=useState(''); const rangeError=useMemo(()=>{if(!from||!to)return '';const a=parseISO(from),b=parseISO(to);if(isAfter(a,b))return '開始日は終了日以前にしてください';if(isAfter(b,addDays(a,30)))return '期間は最大31日です';return ''},[from,to]);
 const generate=()=>{if(!from||!to||rangeError)return;const ids=new Set(data.mealPlans.filter(p=>p.date>=from&&p.date<=to).map(p=>p.recipeId));const ingredients=[...new Set(data.recipes.filter(r=>ids.has(r.id)).flatMap(r=>r.ingredients).map(normalizeIngredient).filter(Boolean))];const manualItems=data.shoppingItems.filter(i=>i.source==='manual');const checked=new Map(data.shoppingItems.map(i=>[i.name,i.checked]));const auto=ingredients.map(name=>({id:id('shop'),name,checked:checked.get(name)||false,source:'auto' as const,rangeKey:`${from}:${to}`}));commit({...data,shoppingItems:[...auto,...manualItems]})};
 const add=()=>{const name=normalizeIngredient(manual);if(!name)return;commit({...data,shoppingItems:[...data.shoppingItems,{id:id('shop'),name,checked:false,source:'manual'}]});setManual('')}; const toggle=(sid:string)=>commit({...data,shoppingItems:data.shoppingItems.map(i=>i.id===sid?{...i,checked:!i.checked}:i)}); const remove=(sid:string)=>commit({...data,shoppingItems:data.shoppingItems.filter(i=>i.id!==sid)});
 return <section className="stack"><div className="section-head"><div><span className="eyebrow">SHOPPING</span><h2>買い物リスト</h2></div></div><div className="editor-card"><h3>献立から自動作成</h3><DateRangeCalendar from={from} to={to} onChange={(nextFrom,nextTo)=>{setFrom(nextFrom);setTo(nextTo)}}/>{rangeError&&<p className="form-error">{rangeError}</p>}<button className="primary" onClick={generate} disabled={!from||!to||!!rangeError}><ShoppingBasket size={18}/>この期間の食材を集計</button></div><div className="manual-add"><input value={manual} onChange={e=>setManual(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="手動で追加"/><button onClick={add}><Plus/></button></div><div className="shopping-list">{data.shoppingItems.length===0&&<div className="empty">まだ買うものがありません。</div>}{data.shoppingItems.map(item=><div className={`shopping-row ${item.checked?'done':''}`} key={item.id}><button className="check-button" onClick={()=>toggle(item.id)}>{item.checked&&<Check size={17}/>}</button><div><b>{item.name}</b><span>{item.source==='auto'?'献立から':'手動追加'}</span></div><button className="trash" onClick={()=>remove(item.id)}><Trash2 size={17}/></button></div>)}</div></section>
}

function DateRangeCalendar({from,to,onChange}:{from:string;to:string;onChange:(from:string,to:string)=>void}) {
 const [month,setMonth]=useState(()=>startOfMonth(parseISO(from))); const [selectingEnd,setSelectingEnd]=useState(false); const monthStart=startOfMonth(month); const gridStart=startOfWeek(monthStart,{weekStartsOn:0}); const days=Array.from({length:42},(_,i)=>addDays(gridStart,i));
 const pick=(day:Date)=>{const key=format(day,'yyyy-MM-dd');if(!selectingEnd){onChange(key,'');setSelectingEnd(true)}else if(from&&isBefore(day,parseISO(from))){onChange(key,from);setSelectingEnd(false)}else{onChange(from,key);setSelectingEnd(false)};if(day.getMonth()!==month.getMonth()||day.getFullYear()!==month.getFullYear())setMonth(startOfMonth(day))};
 const display=(value:string)=>value?format(parseISO(value),'M月d日（E）',{locale:ja}):'未選択';
 return <div className="range-picker"><div className="range-summary"><div><span>開始日</span><strong>{display(from)}</strong></div><span className="range-arrow">→</span><div><span>終了日</span><strong>{display(to)}</strong></div></div><p className="range-guide">{selectingEnd?'終了日を選択してください':'開始日を選ぶと、新しい範囲を選択できます'}</p><div className="range-calendar"><div className="range-calendar-head"><button type="button" aria-label="前の月" onClick={()=>setMonth(value=>addMonths(value,-1))}>‹</button><strong>{format(month,'yyyy年 M月')}</strong><button type="button" aria-label="次の月" onClick={()=>setMonth(value=>addMonths(value,1))}>›</button></div><div className="range-weekdays">{['日','月','火','水','木','金','土'].map(day=><span key={day}>{day}</span>)}</div><div className="range-days">{days.map(day=>{const key=format(day,'yyyy-MM-dd');const outside=day.getMonth()!==month.getMonth();const start=from===key;const end=to===key;const between=!!from&&!!to&&key>from&&key<to;const classes=['range-day',outside?'outside':'',between?'in-range':'',start?'range-start':'',end?'range-end':'',isSameDay(day,new Date())?'today':''].filter(Boolean).join(' ');return <button type="button" className={classes} key={key} onClick={()=>pick(day)} aria-label={format(day,'yyyy年M月d日 EEEE',{locale:ja})} aria-pressed={start||end||between}>{format(day,'d')}</button>})}</div></div></div>
}

function Room({data,session,onExit}:{data:RoomData;session:Session;onExit:()=>void}) { const [copied,setCopied]=useState(false); const me=data.members.find(m=>m.id===session.memberId); const copy=async()=>{await navigator.clipboard.writeText(data.room.inviteCode);setCopied(true);setTimeout(()=>setCopied(false),1200)}; return <section className="stack"><div className="section-head"><div><span className="eyebrow">ROOM</span><h2>{data.room.name}</h2></div></div><div className="invite-card"><span>招待コード</span><strong>{data.room.inviteCode}</strong><button onClick={copy}>{copied?<Check/>:<Copy/>}{copied?'コピーしました':'コードをコピー'}</button></div><div className="editor-card"><h3>メンバー</h3><div className="members">{data.members.map(m=><div key={m.id}><div className="avatar">{m.name.slice(0,1)}</div><p><b>{m.name}{m.id===me?.id?'（あなた）':''}</b><span>{m.role==='host'?'ホスト':'メンバー'}</span></p></div>)}</div></div><button className="ghost" onClick={onExit}><LogOut size={18}/>Room一覧へ戻る</button></section> }

function Nav({icon,label,active,onClick}:{icon:ReactNode;label:string;active:boolean;onClick:()=>void}) { return <button className={active?'active':''} onClick={onClick}>{icon}<span>{label}</span></button> }
