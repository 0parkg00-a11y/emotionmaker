"use strict";
/* ============ 매니페스트 (images/ 경로 참조) ============ */
const MANIFEST = {
  base: ["피부","얼굴 틀"],
  "눈": ["감은 눈","반눈","번뜩","보통 눈","웃는 눈","윙크","점눈","찡긋 감은 눈","초롱","하트 눈"],
  "눈썹": ["일반 눈썹","일자 눈썹","처진 눈썹","힘준 눈썹"],
  "입": ["3자 입","고양이 입","메롱","미소","불만 입","브이 입","웃으며 벌린 입","작게 벌린 입","직선 입","크게 벌린 입"],
  "꾸밈": ["검정","눈물","땀 많이","땀 하나","미간 주름","보라","빠직","빨강","음영","절망","코 그림자","파랑","홍조"]
};
const CATS = ["눈","눈썹","입","꾸밈"];    // 팔레트 표시 순서
const SINGLE = new Set(["눈","눈썹","입"]);
const DECO = "꾸밈";
const DRAW_SINGLE = ["눈썹","눈","입"];    // z-순서: 피부→얼굴틀→눈썹→눈→입→꾸밈
const STORE_KEY = "emotion_face_maker_v1";
const CUSTOM_KEY = "emotion_face_maker_custom_v1";
const IMG = { base:{} };                   // 합성용 Image 캐시
let customParts = {"눈":{},"눈썹":{},"입":{},"꾸밈":{}};  // {cat:{name:dataURL}}

/* ============ 내장 프리셋 20종 ============ */
const PRESETS = [
  { tag:"기쁨",     "눈":"보통 눈",      "눈썹":"일반 눈썹", "입":"웃으며 벌린 입", "꾸밈":[] },
  { tag:"행복",     "눈":"웃는 눈",      "눈썹":"일반 눈썹", "입":"미소",     "꾸밈":["홍조"] },
  { tag:"사랑",     "눈":"하트 눈",      "눈썹":"처진 눈썹", "입":"미소",         "꾸밈":["홍조"] },
  { tag:"설렘",     "눈":"초롱",        "눈썹":"일반 눈썹", "입":"작게 벌린 입",   "꾸밈":["홍조"] },
  { tag:"신남",     "눈":"초롱",        "눈썹":"힘준 눈썹", "입":"웃으며 벌린 입",   "꾸밈":[] },
  { tag:"장난",     "눈":"윙크",        "눈썹":"일반 눈썹", "입":"메롱",         "꾸밈":[] },
  { tag:"자신만만", "눈":"번뜩",        "눈썹":"힘준 눈썹", "입":"브이 입",       "꾸밈":[] },
  { tag:"역겨움",   "눈":"반눈",        "눈썹":"일자 눈썹", "입":"불만 입",       "꾸밈":["보라"] },
  { tag:"슬픔",     "눈":"반눈",        "눈썹":"일자 눈썹", "입":"불만 입",       "꾸밈":["눈물"] },
  { tag:"우울",     "눈":"반눈",        "눈썹":"처진 눈썹", "입":"직선 입",       "꾸밈":["절망","파랑"] },
  { tag:"절망",     "눈":"반눈",        "눈썹":"처진 눈썹", "입":"직선 입",       "꾸밈":["절망","검정"] },
  { tag:"오열",     "눈":"보통 눈",      "눈썹":"힘준 눈썹", "입":"크게 벌린 입",   "꾸밈":["눈물"] },
  { tag:"분노",     "눈":"반눈",        "눈썹":"힘준 눈썹", "입":"불만 입",       "꾸밈":["빠직","빨강"] },
  { tag:"격노",     "눈":"보통 눈",        "눈썹":"힘준 눈썹", "입":"크게 벌린 입",   "꾸밈":["빠직","빨강"] },
  { tag:"짜증",     "눈":"반눈",        "눈썹":"힘준 눈썹", "입":"불만 입",       "꾸밈":["미간 주름"] },
  { tag:"놀람",     "눈":"초롱",        "눈썹":"일반 눈썹", "입":"작게 벌린 입",   "꾸밈":["땀 하나"] },
  { tag:"경악",     "눈":"보통 눈",        "눈썹":"힘준 눈썹", "입":"크게 벌린 입",   "꾸밈":["음영","땀 많이"] },
  { tag:"당황",     "눈":"점눈",        "눈썹":"처진 눈썹", "입":"작게 벌린 입",   "꾸밈":["땀 많이"] },
  { tag:"부끄러움", "눈":"찡긋 감은 눈",  "눈썹":"처진 눈썹", "입":"3자 입",       "꾸밈":["홍조"] },
  { tag:"정색",   "눈":"보통 눈",      "눈썹":"일자 눈썹", "입":"직선 입",       "꾸밈":["코 그림자"] }
];

/* ============ 상태 ============ */
let draft = newDraft();
let editingId = null;
let collection = [];
let importTargetCat = null;   // 커스텀 파츠 불러오기 대상 카테고리
function newDraft(){ return {"눈":null,"눈썹":null,"입":null,"꾸밈":[]}; }
function partExpr(cat,name){ const e=newDraft(); if(cat===DECO) e["꾸밈"]=[name]; else e[cat]=name; return e; }

/* ============ 파츠 목록 / 경로 (내장 + 커스텀) ============ */
function names(cat){ return MANIFEST[cat].concat(Object.keys(customParts[cat]||{})); }
function isCustom(cat,name){ return !!(customParts[cat] && customParts[cat][name]); }
function baseSrc(name){ return encodeURI("images/"+name+".png"); }
function srcOf(cat,name){ return isCustom(cat,name) ? customParts[cat][name] : encodeURI("images/"+cat+"/"+name+".png"); }

/* 표정 → 아래에서 위로 레이어 src 배열 */
function layerSrcs(e){
  const s=[baseSrc("피부"), baseSrc("얼굴 틀")];
  for(const c of DRAW_SINGLE) if(e[c]) s.push(srcOf(c,e[c]));
  (e["꾸밈"]||[]).forEach(n=>s.push(srcOf(DECO,n)));
  return s;
}

/* ============ 이미지 프리로드 (canvas 합성용) ============ */
function loadImg(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(src); i.src=src; }); }
async function preloadAll(){
  const jobs=[];
  for(const n of MANIFEST.base) jobs.push(loadImg(baseSrc(n)).then(im=>IMG.base[n]=im));
  for(const c of CATS){ IMG[c]=IMG[c]||{}; for(const n of names(c)) jobs.push(loadImg(srcOf(c,n)).then(im=>IMG[c][n]=im).catch(()=>{})); }
  await Promise.all(jobs);
}

/* ============ 썸네일 (img 스택) ============ */
function thumbEl(e, cls){
  const d=document.createElement("div"); d.className="thumb"+(cls?" "+cls:"");
  for(const s of layerSrcs(e)){ const im=document.createElement("img"); im.src=s; im.alt=""; d.appendChild(im); }
  return d;
}

/* ============ 팔레트 ============ */
function renderPalette(){
  const wrap=document.getElementById("palette"); wrap.innerHTML="";
  for(const cat of CATS){
    const box=document.createElement("div"); box.className="cat";
    const head=document.createElement("div"); head.className="cat-head";
    const nm=document.createElement("span"); nm.className="name"; nm.textContent=cat;
    const tg=document.createElement("span"); tg.className="tag"; tg.textContent=SINGLE.has(cat)?"단일 선택":"다중·순서";
    const add=mkBtn("＋ 이미지",()=>promptAddImage(cat)); add.className="ghost add";
    head.append(nm,tg,add); box.appendChild(head);

    const grid=document.createElement("div"); grid.className="grid-parts";
    for(const name of names(cat)){
      const el=document.createElement("div"); el.className="part";
      if(isCustom(cat,name)) el.classList.add("custom");
      const sel = SINGLE.has(cat) ? draft[cat]===name : draft[DECO].includes(name);
      if(sel) el.classList.add(SINGLE.has(cat)?"sel":"sel-deco");
      el.appendChild(thumbEl(partExpr(cat,name)));
      const lbl=document.createElement("div"); lbl.className="lbl"; lbl.textContent=name; lbl.title=name;
      el.appendChild(lbl);
      if(isCustom(cat,name)){
        const del=mkBtn("✕",ev=>{ ev.stopPropagation(); removeCustomPart(cat,name); }); del.className="del"; el.appendChild(del);
      }
      el.onclick=()=>togglePart(cat,name);
      grid.appendChild(el);
    }
    box.appendChild(grid); wrap.appendChild(box);
  }
}
function togglePart(cat,name){
  if(SINGLE.has(cat)) draft[cat]= draft[cat]===name ? null : name;
  else{
    const i=draft[DECO].indexOf(name);
    if(i>=0) draft[DECO].splice(i,1); else draft[DECO].push(name); // 나중 선택이 위(배열 끝)
  }
  refreshEditor();
}

/* ============ 커스텀 파츠 불러오기 ============ */
function promptAddImage(cat){ importTargetCat=cat; document.getElementById("filePart").click(); }
function handlePartFiles(files){
  const cat=importTargetCat; if(!cat) return;
  let pending=files.length, added=[];
  Array.from(files).forEach(f=>{
    if(!f.type.startsWith("image/")){ if(--pending===0) finishAdd(cat,added); return; }
    const r=new FileReader();
    r.onload=()=>{
      const base=f.name.replace(/\.[^.]+$/,"").trim()||"파츠";
      const name=uniqueName(cat,base);
      customParts[cat][name]=r.result;
      added.push(name);
      loadImg(r.result).then(im=>{ (IMG[cat]=IMG[cat]||{})[name]=im; });
      if(--pending===0) finishAdd(cat,added);
    };
    r.onerror=()=>{ if(--pending===0) finishAdd(cat,added); };
    r.readAsDataURL(f);
  });
}
function finishAdd(cat,added){
  if(added.length===0){ toast("이미지 파일이 아닙니다"); return; }
  saveCustom(); refreshEditor(); toast(`${cat}에 이미지 ${added.length}개를 추가했습니다`);
}
function removeCustomPart(cat,name){
  if(!confirm(`커스텀 파츠 "${name}"을(를) 삭제할까요?`)) return;
  delete customParts[cat][name];
  if(IMG[cat]) delete IMG[cat][name];
  // 현재 편집중/저장된 표정에서 참조 제거
  if(draft[cat]===name) draft[cat]=null;
  draft[DECO]=draft[DECO].filter(n=>n!==name);
  collection.forEach(e=>{
    if(SINGLE.has(cat) && e[cat]===name) e[cat]=null;
    e["꾸밈"]=e["꾸밈"].filter(n=>n!==name);
  });
  saveCustom(); save(); refreshEditor(); renderCollection(); toast("커스텀 파츠를 삭제했습니다");
}
function uniqueName(cat,base){
  const exist=new Set(names(cat)); if(!exist.has(base)) return base;
  let i=2; while(exist.has(`${base} (${i})`)) i++; return `${base} (${i})`;
}

/* ============ 꾸밈 스택 ============ */
function renderDecoStack(){
  const box=document.getElementById("decoStack"); box.innerHTML="";
  const arr=draft[DECO];
  if(arr.length===0){ box.innerHTML=`<div class="hint">선택된 꾸밈 없음</div>`; return; }
  for(let i=arr.length-1;i>=0;i--){   // 위(앞)부터
    const it=document.createElement("div"); it.className="deco-item";
    const g=document.createElement("span"); g.className="grip"; g.textContent=(arr.length-i)+"층";
    const n=document.createElement("span"); n.className="dn"; n.textContent=arr[i];
    const up=mkBtn("▲",()=>moveDeco(i,+1)); up.disabled=(i===arr.length-1);
    const dn=mkBtn("▼",()=>moveDeco(i,-1)); dn.disabled=(i===0);
    const rm=mkBtn("✕",()=>{arr.splice(i,1);refreshEditor();}); rm.className="danger";
    it.append(g,n,up,dn,rm); box.appendChild(it);
  }
}
function moveDeco(i,dir){ const a=draft[DECO],j=i+dir; if(j<0||j>=a.length)return; [a[i],a[j]]=[a[j],a[i]]; refreshEditor(); }
function mkBtn(t,fn){ const b=document.createElement("button"); b.textContent=t; b.onclick=fn; return b; }

/* ============ 미리보기 ============ */
function renderPreview(){
  const p=document.getElementById("preview"); p.innerHTML="";
  for(const s of layerSrcs(draft)){ const im=document.createElement("img"); im.src=s; im.alt=""; p.appendChild(im); }
}
function refreshEditor(){ renderPalette(); renderDecoStack(); renderPreview(); }

/* ============ 컬렉션 ============ */
function renderCollection(){
  const wrap=document.getElementById("collection"); wrap.innerHTML="";
  document.getElementById("collCount").textContent=`(${collection.length})`;
  const sel=collection.filter(e=>e.includeInGrid).length;
  document.getElementById("countHint").textContent=collection.length?`그리드 선택 ${sel} / ${collection.length}`:"";
  if(collection.length===0){ wrap.innerHTML=`<div class="empty">저장된 표정이 없습니다.<br>왼쪽에서 파츠를 골라<br>「표정 저장」을 눌러보세요.</div>`; return; }
  collection.forEach(e=>{
    const it=document.createElement("div"); it.className="coll-item"+(e.id===editingId?" editing":"");
    const lab=document.createElement("label"); lab.className="inline";
    const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=e.includeInGrid; cb.title="그리드 포함 / 선택";
    cb.onchange=()=>{ e.includeInGrid=cb.checked; save(); renderCollection(); };
    lab.appendChild(cb);
    const th=thumbEl(e);
    const meta=document.createElement("div"); meta.className="meta";
    meta.innerHTML=`<div class="t">${escapeHtml(e.tag||"(태그 없음)")}</div><div class="s">${summary(e)}${e.showText?"":" · 텍스트숨김"}</div>`;
    const acts=document.createElement("div"); acts.className="acts";
    acts.append(mkBtn("편집",()=>loadForEdit(e.id)), mkBtn("복제",()=>duplicate(e.id)));
    const db=mkBtn("삭제",()=>del(e.id)); db.className="danger"; acts.appendChild(db);
    it.append(lab,th,meta,acts); wrap.appendChild(it);
  });
}
function summary(e){ const p=[]; for(const c of DRAW_SINGLE) if(e[c]) p.push(e[c]); if(e["꾸밈"].length) p.push("꾸밈"+e["꾸밈"].length); return p.join(" · ")||"빈 표정"; }

/* ============ 저장/편집 ============ */
function collectDraft(){
  return { id: editingId||uid(), "눈":draft["눈"],"눈썹":draft["눈썹"],"입":draft["입"],"꾸밈":[...draft["꾸밈"]],
    tag: document.getElementById("tagInput").value.trim(),
    showText: document.getElementById("showText").checked, includeInGrid:true };
}
function saveExpr(){
  const item=collectDraft();
  if(!item["눈"]&&!item["눈썹"]&&!item["입"]&&item["꾸밈"].length===0){ toast("파츠를 하나 이상 선택하세요"); return; }
  if(editingId){
    const idx=collection.findIndex(e=>e.id===editingId);
    item.includeInGrid=collection[idx].includeInGrid; collection[idx]=item; toast("표정을 수정했습니다");
  }else{ collection.push(item); toast("표정을 저장했습니다"); }
  save(); clearDraft(); renderCollection();
}
function loadForEdit(id){
  const e=collection.find(x=>x.id===id); if(!e)return;
  editingId=id; draft={"눈":e["눈"],"눈썹":e["눈썹"],"입":e["입"],"꾸밈":[...e["꾸밈"]]};
  document.getElementById("tagInput").value=e.tag||"";
  document.getElementById("showText").checked=e.showText;
  document.getElementById("btnSave").textContent="✔ 수정 완료";
  document.getElementById("btnCancelEdit").hidden=false;
  refreshEditor(); renderCollection();
}
function loadPresets(){
  if(collection.length && !confirm(`기존 목록에 내장 프리셋 ${PRESETS.length}종을 추가할까요?`)) return;
  PRESETS.forEach(p=>collection.push({
    id:uid(), "눈":p["눈"],"눈썹":p["눈썹"],"입":p["입"],"꾸밈":[...p["꾸밈"]],
    tag:p.tag, showText:true, includeInGrid:true
  }));
  save(); renderCollection(); toast(`프리셋 ${PRESETS.length}종을 추가했습니다`);
}
function randomize(){
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  draft["눈"]=pick(names("눈"));
  draft["눈썹"]=pick(names("눈썹"));
  draft["입"]=pick(names("입"));
  draft["꾸밈"]=[pick(names("꾸밈"))];   // 꾸밈도 1개만 임의 선택
  refreshEditor();
}
function clearDraft(){
  draft=newDraft(); editingId=null;
  document.getElementById("tagInput").value="";
  document.getElementById("showText").checked=true;
  document.getElementById("btnSave").textContent="＋ 표정 저장";
  document.getElementById("btnCancelEdit").hidden=true;
  refreshEditor();
}
function duplicate(id){
  const e=collection.find(x=>x.id===id); if(!e)return;
  const c=JSON.parse(JSON.stringify(e)); c.id=uid(); c.tag=(e.tag||"")+" (복사)";
  const idx=collection.findIndex(x=>x.id===id); collection.splice(idx+1,0,c);
  save(); renderCollection(); toast("복제했습니다");
}
function del(id){
  const e=collection.find(x=>x.id===id);
  if(!confirm(`"${e.tag||"이 표정"}" 을(를) 삭제할까요?`)) return;
  collection=collection.filter(x=>x.id!==id);
  if(editingId===id) clearDraft();
  save(); renderCollection();
}
function deleteSelected(){
  const n=collection.filter(e=>e.includeInGrid).length;
  if(n===0){ toast("체크된 표정이 없습니다"); return; }
  if(!confirm(`체크된 ${n}개의 표정을 삭제할까요?`)) return;
  const removedEditing = collection.some(e=>e.includeInGrid && e.id===editingId);
  collection=collection.filter(e=>!e.includeInGrid);
  if(removedEditing) clearDraft();
  save(); renderCollection(); toast(`${n}개를 삭제했습니다`);
}
function clearAll(){
  if(collection.length===0) return;
  if(!confirm(`저장된 표정 ${collection.length}개를 모두 삭제할까요?`)) return;
  collection=[]; clearDraft(); save(); renderCollection(); toast("전체 초기화했습니다");
}

/* ============ 저장소 ============ */
function save(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(collection)); }catch(e){} }
function saveCustom(){ try{ localStorage.setItem(CUSTOM_KEY, JSON.stringify(customParts)); }catch(e){ toast("커스텀 파츠 저장 실패(용량 초과)"); } }
function load(){
  try{ const r=localStorage.getItem(STORE_KEY); if(r) collection=normalize(JSON.parse(r)); }catch(e){}
  try{ const c=localStorage.getItem(CUSTOM_KEY); if(c){ const p=JSON.parse(c); for(const cat of CATS) customParts[cat]=p[cat]||{}; } }catch(e){}
}
function normalize(arr){
  return (arr||[]).map(e=>({ id:e.id||uid(),
    "눈":e["눈"]??null,"눈썹":e["눈썹"]??null,"입":e["입"]??null,
    "꾸밈":Array.isArray(e["꾸밈"])?e["꾸밈"]:[],
    tag:e.tag||"", showText:e.showText!==false, includeInGrid:e.includeInGrid!==false }));
}

/* ============ JSON ============ */
function exportJSON(){
  const data={ app:"emotion-face-maker", version:1, exportedAt:new Date().toISOString(), expressions:collection };
  downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}), `표정저장_${stamp()}.json`);
}
function importJSON(file){
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result); const arr=Array.isArray(d)?d:d.expressions;
      if(!Array.isArray(arr)) throw 0;
      const mode = collection.length ? (confirm(`불러온 ${arr.length}개를 기존 목록에 "추가"할까요?\n(취소 = 기존 목록을 대체)`)?"add":"replace") : "replace";
      const loaded=normalize(arr).map(e=>({...e,id:uid()}));
      collection = mode==="add" ? collection.concat(loaded) : loaded;
      save(); renderCollection(); toast(`${loaded.length}개를 불러왔습니다`);
    }catch(e){ toast("불러오기 실패: 올바른 JSON이 아닙니다"); }
  };
  r.readAsText(file);
}

/* ============ 그리드 (canvas) ============ */
let gridBg="transparent";
function drawFace(ctx,x,y,size,e){
  const d=img=>img&&ctx.drawImage(img,x,y,size,size);
  d(IMG.base["피부"]); d(IMG.base["얼굴 틀"]);
  for(const c of DRAW_SINGLE){ if(e[c]&&IMG[c]) d(IMG[c][e[c]]); }
  (e["꾸밈"]||[]).forEach(n=>{ if(IMG[DECO]) d(IMG[DECO][n]); });
}
function openGrid(){
  if(collection.filter(e=>e.includeInGrid).length===0){ toast("그리드에 포함할 표정을 선택하세요"); return; }
  document.getElementById("gridModal").classList.add("open"); buildGrid();
}
function buildGrid(){
  const sel=collection.filter(e=>e.includeInGrid);
  const info=document.getElementById("gridInfo");
  if(sel.length===0){ info.textContent="선택된 표정 없음"; return; }
  const cell=clampNum("optCell",300,80,800), gap=clampNum("optGap",14,0,200);
  let cols=clampNum("optCols",0,0,50); if(cols<=0) cols=Math.ceil(Math.sqrt(sel.length));
  cols=Math.min(cols,sel.length); const rows=Math.ceil(sel.length/cols);
  const globalText=document.getElementById("optText").checked;
  const font=clampNum("optFont",26,6,160), textColor=document.getElementById("optTextColor").value;
  const lineH=Math.round(font*1.28), pad=Math.round(font*0.5);

  const tmp=document.createElement("canvas").getContext("2d");
  const fontStr=`600 ${font}px "Segoe UI","Malgun Gothic",sans-serif`; tmp.font=fontStr;
  let maxLines=0; const wrapCache=new Map();
  sel.forEach(e=>{ if(globalText&&e.showText&&e.tag){ const l=wrapText(tmp,e.tag,cell-pad*2); wrapCache.set(e.id,l); maxLines=Math.max(maxLines,l.length);} });
  const bandH = maxLines>0 ? (maxLines*lineH+pad*2) : 0;
  const cellH = cell+bandH;
  const W=cols*cell+(cols+1)*gap, H=rows*cellH+(rows+1)*gap;

  const cv=document.getElementById("gridCanvas"); cv.width=W; cv.height=H;
  const ctx=cv.getContext("2d"); ctx.clearRect(0,0,W,H);
  if(gridBg!=="transparent"){ ctx.fillStyle=gridBg==="white"?"#ffffff":document.getElementById("optBgColor").value; ctx.fillRect(0,0,W,H); }
  ctx.textAlign="center"; ctx.textBaseline="top"; ctx.font=fontStr; ctx.fillStyle=textColor;

  sel.forEach((e,i)=>{
    const c=i%cols, r=Math.floor(i/cols);
    const x=gap+c*(cell+gap), y=gap+r*(cellH+gap);
    drawFace(ctx,x,y,cell,e);
    const lines=wrapCache.get(e.id);
    if(bandH>0&&lines){ let ty=y+cell+pad; for(const ln of lines){ ctx.fillText(ln,x+cell/2,ty); ty+=lineH; } }
  });
  info.innerHTML=`표정 <b>${sel.length}</b>개 · <b>${cols}×${rows}</b> · 출력 <b>${W}×${H}px</b>`;
}
function wrapText(ctx,text,maxW){
  const out=[];
  for(const raw of String(text).split("\n")){
    if(raw===""){ out.push(""); continue; }
    let line="";
    for(const ch of raw){ if(ctx.measureText(line+ch).width>maxW&&line){ out.push(line); line=ch; } else line+=ch; }
    out.push(line);
  }
  return out;
}
function downloadGrid(){
  const cv=document.getElementById("gridCanvas");
  try{
    cv.toBlob(b=>{ if(!b){ showServerWarn(); return; } downloadBlob(b, `표정모음_${stamp()}.png`); }, "image/png");
  }catch(err){ showServerWarn(); }
}
function showServerWarn(){ document.getElementById("serverWarn").hidden=false; toast("PNG 저장이 막혔습니다 — 로컬 서버로 실행하세요"); }

/* ============ 유틸 ============ */
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function stamp(){ const d=new Date(),p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; }
function clampNum(id,def,min,max){ let v=parseInt(document.getElementById(id).value,10); if(isNaN(v))v=def; return Math.max(min,Math.min(max,v)); }
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function downloadBlob(blob,name){ const u=URL.createObjectURL(blob),a=document.createElement("a"); a.href=u; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000); }
let toastT; function toast(m){ const t=document.getElementById("toast"); t.textContent=m; t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),1900); }

/* ============ 바인딩 ============ */
function bind(){
  document.getElementById("btnSave").onclick=saveExpr;
  document.getElementById("btnRandom").onclick=randomize;
  document.getElementById("btnPreset").onclick=loadPresets;
  document.getElementById("btnClear").onclick=clearDraft;
  document.getElementById("btnCancelEdit").onclick=clearDraft;
  document.getElementById("btnExport").onclick=exportJSON;
  document.getElementById("btnImport").onclick=()=>document.getElementById("fileImport").click();
  document.getElementById("fileImport").onchange=e=>{ if(e.target.files[0]){ importJSON(e.target.files[0]); e.target.value=""; } };
  document.getElementById("filePart").onchange=e=>{ if(e.target.files.length){ handlePartFiles(e.target.files); e.target.value=""; } };
  document.getElementById("btnGrid").onclick=openGrid;
  document.getElementById("btnCloseModal").onclick=()=>document.getElementById("gridModal").classList.remove("open");
  document.getElementById("btnDownload").onclick=downloadGrid;
  document.getElementById("gridModal").onclick=e=>{ if(e.target.id==="gridModal") e.target.classList.remove("open"); };
  document.getElementById("btnAll").onclick=()=>{ collection.forEach(e=>e.includeInGrid=true); save(); renderCollection(); };
  document.getElementById("btnNone").onclick=()=>{ collection.forEach(e=>e.includeInGrid=false); save(); renderCollection(); };
  document.getElementById("btnDelSel").onclick=deleteSelected;
  document.getElementById("btnClearAll").onclick=clearAll;
  ["optCols","optCell","optGap","optFont","optText","optTextColor","optBgColor"].forEach(id=>{
    document.getElementById(id).oninput=()=>{ if(document.getElementById("gridModal").classList.contains("open")) buildGrid(); };
  });
  document.getElementById("optBg").querySelectorAll("button").forEach(b=>{
    b.onclick=()=>{ document.getElementById("optBg").querySelectorAll("button").forEach(x=>x.classList.remove("on")); b.classList.add("on");
      gridBg=b.dataset.bg; document.getElementById("optBgColor").hidden=(gridBg!=="custom"); buildGrid(); };
  });
  window.addEventListener("keydown",e=>{ if(e.key==="Escape") document.getElementById("gridModal").classList.remove("open"); });
}

/* ============ 시작 ============ */
(async function init(){
  load(); bind(); refreshEditor(); renderCollection();   // UI 즉시 표시
  try{ await preloadAll(); }                              // canvas 합성용 프리로드
  catch(src){ toast("이미지 로드 실패: "+src); }
})();
