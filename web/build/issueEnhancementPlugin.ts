import type { Plugin } from 'vite';

function replaceRequired(source: string, search: string | RegExp, replacement: string, label: string) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`[issue-8-13] App.tsx transform failed: ${label}`);
  return next;
}

const recipesComponent = String.raw`function Recipes({data,commit}:{data:RoomData;commit:(d:RoomData)=>void}) {
 const empty={name:'',category:'主菜',ingredients:'',note:'',url:''};
 const [mode,setMode]=useState<'list'|'create'|'edit'>('list');
 const [form,setForm]=useState(empty);
 const [editing,setEditing]=useState<string|null>(null);
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState<'updated'|'name'|'category'>('updated');
 const urlInvalid=Boolean(form.url.trim()&&!safeRecipeUrl(form.url));
 const filtered=[...data.recipes].filter(recipe=>{
  const needle=query.trim().toLocaleLowerCase('ja');
  return !needle||[recipe.name,recipe.category,...recipe.ingredients].some(value=>value.toLocaleLowerCase('ja').includes(needle));
 }).sort((left,right)=>sort==='name'?left.name.localeCompare(right.name,'ja'):sort==='category'?left.category.localeCompare(right.category,'ja')||left.name.localeCompare(right.name,'ja'):right.updatedAt.localeCompare(left.updatedAt));
 const openCreate=()=>{setEditing(null);setForm(empty);setMode('create')};
 const openEdit=(recipe:Recipe)=>{setEditing(recipe.id);setForm({name:recipe.name,category:recipe.category,ingredients:recipe.ingredients.join('、'),note:recipe.note,url:recipe.url||''});setMode('edit')};
 const closeEditor=()=>{setEditing(null);setForm(empty);setMode('list')};
 const save=()=>{
  const ingredients=form.ingredients.split(/[、,\n]/).map(normalizeIngredient).filter(Boolean);
  if(!form.name.trim()||!ingredients.length||urlInvalid)return;
  const now=new Date().toISOString();
  const recipes=editing
   ?data.recipes.map(recipe=>recipe.id===editing?{...recipe,name:form.name.trim(),category:form.category,ingredients,note:form.note.trim(),url:form.url.trim(),updatedAt:now}:recipe)
   :[...data.recipes,{id:id('recipe'),name:form.name.trim(),category:form.category,ingredients,note:form.note.trim(),url:form.url.trim(),createdAt:now,updatedAt:now}];
  commit({...data,recipes});
  closeEditor();
 };
 const remove=(recipeId:string)=>{
  const recipe=data.recipes.find(item=>item.id===recipeId);
  if(!recipe||!window.confirm(`「${recipe.name}」を削除しますか？献立からも削除されます。`))return;
  commit({...data,recipes:data.recipes.filter(item=>item.id!==recipeId),mealPlans:data.mealPlans.filter(plan=>plan.recipeId!==recipeId)});
 };
 if(mode!=='list')return <section className="stack recipe-editor-page">
  <div className="section-head"><div><button className="back-button" onClick={closeEditor}><ArrowLeft size={17}/>レシピ一覧へ戻る</button><h2>{mode==='edit'?'レシピを編集':'レシピを登録'}</h2></div></div>
  <div className="editor-card recipe-editor-card"><div className="form-grid"><label>レシピ名<input autoFocus value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="例：カレー"/></label><label>カテゴリ<select value={form.category} onChange={event=>setForm({...form,category:event.target.value})}><option>主菜</option><option>副菜</option><option>汁物</option><option>主食</option><option>デザート</option></select></label><label className="wide">レシピURL（任意）<input type="url" value={form.url} onChange={event=>setForm({...form,url:event.target.value})} placeholder="https://example.com/recipe"/>{urlInvalid&&<span className="field-error">http:// または https:// から始まるURLを入力してください</span>}</label><label className="wide">食材（「、」または改行で区切る）<textarea value={form.ingredients} onChange={event=>setForm({...form,ingredients:event.target.value})} placeholder="玉ねぎ、にんじん、じゃがいも"/></label><label className="wide">メモ<input value={form.note} onChange={event=>setForm({...form,note:event.target.value})} placeholder="作り方のコツや家族の好み"/></label></div><div className="actions"><button className="primary" onClick={save} disabled={!form.name.trim()||!form.ingredients.trim()||urlInvalid}><Check size={18}/>{mode==='edit'?'変更を保存':'レシピを登録'}</button><button className="ghost" onClick={closeEditor}>キャンセル</button></div></div>
 </section>;
 return <section className="stack"><div className="section-head recipe-list-head"><div><h2>レシピ</h2><p>献立に使うレシピと食材を管理します。</p></div><button className="primary recipe-add-button" onClick={openCreate}><Plus size={18}/>レシピを登録</button></div>
  <div className="recipe-toolbar"><label className="recipe-list-search"><Search size={18}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="名前・カテゴリ・食材で検索" aria-label="レシピを検索"/></label><label className="recipe-sort">並び順<select value={sort} onChange={event=>setSort(event.target.value as 'updated'|'name'|'category')}><option value="updated">更新が新しい順</option><option value="name">名前順</option><option value="category">カテゴリ順</option></select></label></div>
  <div className="card-list">{filtered.length===0&&<div className="empty">条件に一致するレシピがありません。</div>}{filtered.map(recipe=>{const recipeUrl=safeRecipeUrl(recipe.url);return <article className="recipe-card" key={recipe.id}><div><span className="pill">{recipe.category}</span><h3>{recipe.name}</h3><p>{recipe.ingredients.join('・')}</p>{recipeUrl&&<a className="recipe-link" href={recipeUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/>レシピを見る</a>}{recipe.note&&<small>{recipe.note}</small>}</div><div className="icon-actions"><button onClick={()=>openEdit(recipe)}>編集</button><button aria-label={`${recipe.name}を削除`} onClick={()=>remove(recipe.id)}><Trash2 size={17}/></button></div></article>})}</div>
 </section>
}`;

const roomComponent = String.raw`function enabledMealSlots(data:RoomData):MealSlot[] {
 const settings=data.room.settings?.mealSlots;
 return (['breakfast','lunch','dinner'] as MealSlot[]).filter(slot=>settings?.[slot]??true);
}

function Room({data,session,commit,onExit}:{data:RoomData;session:Session;commit:(d:RoomData)=>void;onExit:()=>void}) {
 const [copied,setCopied]=useState(false);
 const me=data.members.find(member=>member.id===session.memberId);
 const isHost=me?.role==='host';
 const mealSlots=data.room.settings?.mealSlots??{breakfast:true,lunch:true,dinner:true};
 const copy=async()=>{await navigator.clipboard.writeText(data.room.inviteCode);setCopied(true);window.setTimeout(()=>setCopied(false),1200)};
 const toggleSlot=(slot:MealSlot)=>{
  const next={...mealSlots,[slot]:!mealSlots[slot]};
  if(!Object.values(next).some(Boolean))return;
  commit({...data,room:{...data.room,settings:{...data.room.settings,mealSlots:next}}});
 };
 const removeMember=(memberId:string)=>{
  const member=data.members.find(item=>item.id===memberId);
  if(!isHost||!member||member.role==='host'||member.id===session.memberId)return;
  if(!window.confirm(`${member.name}さんをRoomから削除しますか？`))return;
  commit({...data,members:data.members.filter(item=>item.id!==memberId)});
 };
 return <section className="stack"><div className="section-head"><div><h2>{data.room.name}</h2></div></div>
  <div className="room-settings-grid"><div className="invite-card compact"><span>招待コード</span><strong>{data.room.inviteCode}</strong><button onClick={copy}>{copied?<Check/>:<Copy/>}{copied?'コピーしました':'コードをコピー'}</button></div>
  <div className="editor-card meal-slot-settings"><h3>献立に表示する時間帯</h3><p>家庭で使う項目だけを表示できます。最低1つは有効にしてください。</p>{(['breakfast','lunch','dinner'] as MealSlot[]).map(slot=><label className="setting-toggle" key={slot}><span><b>{slotLabels[slot]}食</b><small>{slot==='dinner'?'夕食の献立を考える':`${slotLabels[slot]}食も献立に含める`}</small></span><input type="checkbox" checked={mealSlots[slot]} onChange={()=>toggleSlot(slot)} disabled={!isHost||(mealSlots[slot]&&Object.values(mealSlots).filter(Boolean).length===1)}/></label>)}{!isHost&&<small className="setting-note">この設定はホストのみ変更できます。</small>}</div></div>
  <div className="editor-card"><h3>メンバー</h3><div className="members">{data.members.map(member=><div key={member.id}><div className="avatar">{member.name.slice(0,1)}</div><p><b>{member.name}{member.id===me?.id?'（あなた）':''}</b><span>{member.role==='host'?'ホスト':'メンバー'}</span></p>{isHost&&member.role!=='host'&&member.id!==session.memberId&&<button className="member-remove" onClick={()=>removeMember(member.id)} aria-label={`${member.name}さんを削除`}><Trash2 size={16}/>削除</button>}</div>)}</div></div>
  <button className="ghost" onClick={onExit}><LogOut size={18}/>Room一覧へ戻る</button>
 </section>
}`;

export function issueEnhancementPlugin(): Plugin {
  return {
    name: 'meal-room-issues-8-13',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.tsx')) return null;
      let next = code;
      next = replaceRequired(next, /function Recipes\([\s\S]*?\n}\n\nfunction safeRecipeUrl/, `${recipesComponent}\n\nfunction safeRecipeUrl`, 'replace Recipes');
      next = replaceRequired(next, "<Nav icon={<ChefHat/>} label=\"料理\"", "<Nav icon={<ChefHat/>} label=\"レシピ\"", 'rename recipe navigation');
      next = next.replace('登録した料理','登録したレシピ');
      next = replaceRequired(next, "const start=addDays(startOfWeek(new Date(),{weekStartsOn:1}),weekOffset*7);", "const start=addDays(startOfWeek(new Date(),{weekStartsOn:1}),weekOffset*7);\n const slots=enabledMealSlots(data);", 'add enabled slots');
      next = replaceRequired(next, "{(['breakfast','lunch','dinner'] as MealSlot[]).map(slot=>", "{slots.map(slot=>", 'filter calendar slots');
      next = next.replaceAll('料理を選ぶ','レシピを選ぶ').replaceAll('料理名・カテゴリ・食材で検索','レシピ名・カテゴリ・食材で検索').replaceAll('aria-label=\"料理を検索\"','aria-label=\"レシピを検索\"');
      next = replaceRequired(next, /function Room\([\s\S]*?\n\nfunction Nav/, `${roomComponent}\n\nfunction Nav`, 'replace Room settings');
      next = replaceRequired(next, '<Room data={data} session={session} onExit=', '<Room data={data} session={session} commit={commit} onExit=', 'pass commit to Room');
      return { code: next, map: null };
    },
  };
}
