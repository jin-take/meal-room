import type { Plugin } from 'vite';

const recipeWalletComponent = `function Recipes({data,commit}:{data:RoomData;commit:(d:RoomData)=>void}) {
 const empty={name:'',category:'主菜',ingredients:'',note:'',url:''};
 const categories=['主菜','副菜','汁物','主食','デザート'];
 const categoryMeta:Record<string,{code:string;caption:string}>={
  '主菜':{code:'MAIN',caption:'今日のメイン'},
  '副菜':{code:'SIDE',caption:'もう一品'},
  '汁物':{code:'SOUP',caption:'あたたかい一杯'},
  '主食':{code:'STAPLE',caption:'ごはん・麺・パン'},
  'デザート':{code:'SWEET',caption:'食後のおたのしみ'}
 };
 const [mode,setMode]=useState<'list'|'create'|'edit'>('list');
 const [form,setForm]=useState(empty);
 const [editing,setEditing]=useState<string|null>(null);
 const [query,setQuery]=useState('');
 const [activeCategory,setActiveCategory]=useState('主菜');
 const urlInvalid=Boolean(form.url.trim()&&!safeRecipeUrl(form.url));
 const needle=query.trim().toLocaleLowerCase('ja');
 const filtered=data.recipes.filter(recipe=>!needle||[recipe.name,recipe.category,...recipe.ingredients].some(value=>value.toLocaleLowerCase('ja').includes(needle)));
 const openCreate=()=>{setEditing(null);setForm(empty);setMode('create')};
 const openEdit=(recipe:Recipe)=>{setEditing(recipe.id);setForm({name:recipe.name,category:recipe.category,ingredients:recipe.ingredients.join('、'),note:recipe.note,url:recipe.url||''});setMode('edit')};
 const closeEditor=()=>{setEditing(null);setForm(empty);setMode('list')};
 const save=()=>{
  const ingredients=form.ingredients.split(/[、,\\n]/).map(normalizeIngredient).filter(Boolean);
  if(!form.name.trim()||!ingredients.length||urlInvalid)return;
  const now=new Date().toISOString();
  const recipes=editing
   ?data.recipes.map(recipe=>recipe.id===editing?{...recipe,name:form.name.trim(),category:form.category,ingredients,note:form.note.trim(),url:form.url.trim(),updatedAt:now}:recipe)
   :[...data.recipes,{id:id('recipe'),name:form.name.trim(),category:form.category,ingredients,note:form.note.trim(),url:form.url.trim(),createdAt:now,updatedAt:now}];
  commit({...data,recipes});
  setActiveCategory(form.category);
  closeEditor();
 };
 const remove=(recipeId:string)=>{
  const recipe=data.recipes.find(item=>item.id===recipeId);
  if(!recipe||!window.confirm('「'+recipe.name+'」を削除しますか？献立からも削除されます。'))return;
  commit({...data,recipes:data.recipes.filter(item=>item.id!==recipeId),mealPlans:data.mealPlans.filter(plan=>plan.recipeId!==recipeId)});
 };
 if(mode!=='list')return <section className="stack recipe-editor-page">
  <div className="section-head"><div><button className="back-button" onClick={closeEditor}><ArrowLeft size={17}/>レシピ一覧へ戻る</button><h2>{mode==='edit'?'レシピを編集':'レシピを登録'}</h2></div></div>
  <div className="editor-card recipe-editor-card"><div className="form-grid"><label>レシピ名<input autoFocus value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="例：カレー"/></label><label>カテゴリ<select value={form.category} onChange={event=>setForm({...form,category:event.target.value})}>{categories.map(category=><option key={category}>{category}</option>)}</select></label><label className="wide">レシピURL（任意）<input type="url" value={form.url} onChange={event=>setForm({...form,url:event.target.value})} placeholder="https://example.com/recipe"/>{urlInvalid&&<span className="field-error">http:// または https:// から始まるURLを入力してください</span>}</label><label className="wide">食材（「、」または改行で区切る）<textarea value={form.ingredients} onChange={event=>setForm({...form,ingredients:event.target.value})} placeholder="玉ねぎ、にんじん、じゃがいも"/></label><label className="wide">メモ<textarea value={form.note} onChange={event=>setForm({...form,note:event.target.value})} placeholder="手順やコツを改行して入力できます"/></label></div><div className="actions"><button className="primary" onClick={save} disabled={!form.name.trim()||!form.ingredients.trim()||urlInvalid}><Check size={18}/>{mode==='edit'?'変更を保存':'レシピを登録'}</button><button className="ghost" onClick={closeEditor}>キャンセル</button></div></div>
 </section>;
 const activeMeta=categoryMeta[activeCategory];
 const activeRecipes=filtered.filter(recipe=>recipe.category===activeCategory);
 return <section className="stack recipe-wallet-page">
  <div className="section-head recipe-list-head"><div><span className="eyebrow">RECIPE COLLECTION</span><h2>レシピ</h2><p>カテゴリから料理を選んで、献立につながるレシピを管理します。</p></div><button className="primary recipe-add-button" onClick={openCreate}><Plus size={18}/>レシピを登録</button></div>
  <label className="recipe-wallet-search"><Search size={18}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="料理名・食材から探す" aria-label="レシピを検索"/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label="検索をクリア"><X size={16}/></button>}</label>
  <div className="recipe-credit-cards" role="list" aria-label="レシピカテゴリ">
   {categories.map((category,index)=>{const recipes=filtered.filter(recipe=>recipe.category===category);const total=data.recipes.filter(recipe=>recipe.category===category).length;const active=activeCategory===category;const meta=categoryMeta[category];return <button className={active?'recipe-credit-card active':'recipe-credit-card'} type="button" onClick={()=>setActiveCategory(category)} aria-pressed={active} key={category} role="listitem">
    <span className="recipe-credit-card-top"><span className="recipe-credit-brand">MEAL ROOM</span><span className="recipe-credit-index">0{index+1}</span></span>
    <span className="recipe-credit-card-center"><small>{meta.caption}</small><strong>{category}</strong></span>
    <span className="recipe-credit-card-bottom"><span>{meta.code}</span><span>{needle?recipes.length:total} RECIPES</span></span>
   </button>})}
  </div>
  <section className="recipe-category-panel" aria-label={activeCategory+'のレシピ'}>
   <div className="recipe-category-panel-head"><div><span className="recipe-category-code">{activeMeta.code}</span><h3>{activeCategory}</h3><p>{activeMeta.caption}</p></div><span className="recipe-category-total">{activeRecipes.length}品</span></div>
   {activeRecipes.length===0?<div className="wallet-empty">{needle?'検索条件に一致するレシピがありません。':'このカテゴリのレシピはまだありません。'}</div>:<div className="wallet-recipe-list">{activeRecipes.map(recipe=>{const recipeUrl=safeRecipeUrl(recipe.url);return <article className="wallet-recipe" key={recipe.id}><div className="wallet-recipe-main"><div><h3>{recipe.name}</h3><div className="wallet-ingredient-chips">{recipe.ingredients.slice(0,4).map(ingredient=><span key={ingredient}>{ingredient}</span>)}{recipe.ingredients.length>4&&<span>+{recipe.ingredients.length-4}</span>}</div>{recipe.note&&<small>{recipe.note}</small>}</div><div className="wallet-recipe-actions"><button type="button" onClick={()=>openEdit(recipe)}>編集</button><button type="button" className="wallet-delete" aria-label={recipe.name+'を削除'} onClick={()=>remove(recipe.id)}><Trash2 size={16}/></button></div></div><div className="wallet-recipe-footer"><span>{recipe.ingredients.length}材料</span>{recipeUrl&&<a className="recipe-link wallet-recipe-link" href={recipeUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/>レシピを見る</a>}</div></article>})}</div>}
   <button className="wallet-add-in-category" type="button" onClick={()=>{setEditing(null);setForm({...empty,category:activeCategory});setMode('create')}}><Plus size={17}/>{activeCategory}を追加</button>
  </section>
 </section>
}`;

export function recipeWalletPlugin(): Plugin {
  return {
    name: 'meal-room-recipe-wallet',
    enforce: 'pre',
    transform(code, id) {
      const sourceId = id.split('?', 1)[0].replaceAll('\\', '/');
      if (!sourceId.endsWith('/src/App.tsx')) return null;
      const next = code.replace(/function Recipes\([\s\S]*?\n}\n\nfunction safeRecipeUrl/, `${recipeWalletComponent}\n\nfunction safeRecipeUrl`);
      if (next === code) throw new Error('[recipe-wallet] Recipes transform failed');
      return { code: next, map: null };
    },
  };
}
