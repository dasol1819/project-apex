import {TREE_GRID,TREE_BANDS,layoutAircraftTree,treeSpatialTarget,treeRouteAncestors} from './aircraft-tree-layout.js';
import {TREE_NATIONS,TREE_BRANCHES,TREE_ERAS,TREE_SOURCES,treeAircraft,treeAircraftForSim,treeFamily,treeSummary,filterAircraftTree,treeRoleTags} from './aircraft-tree-data.js';
export const TREE_STORAGE_KEY='airdominion.aircraft-tree.v1';
const defaults=()=>({nation:'us',branch:'all',era:'all',status:'all',query:'',minBR:1,maxBR:20});
const rate=v=>Number(v).toFixed(1),rating=v=>Math.round(Math.max(1,Math.min(20,Number(v)||1))*2)/2;
const branchFor=id=>TREE_BRANCHES.find(b=>b.id===id);
function icon(branch){const path=branch==='strategic'?'M30 8 4 30 24 27 30 38 36 27 56 30Z':branch==='heavy'?'M27 5 22 20 6 30 23 28 23 38 28 35 30 25 32 35 37 38 37 28 54 30 38 20 33 5 30 16Z':'M30 4 26 20 8 29 26 27 23 38 30 34 37 38 34 27 52 29 34 20Z';return `<svg class="tree-plane-symbol" viewBox="0 0 60 44" aria-hidden="true"><path d="${path}"/><path d="M30 7v27" class="tree-plane-axis"/></svg>`;}
export function createAircraftTree({document:d,storage,getSelectedType,onChoose,canChoose=()=>true,isReady=()=>true,onClose,onHangar,onPrepare}){
 const $=id=>d.getElementById(id),root=$('aircraft-tree-screen');let state=defaults(),visible=[],active=false,inspected=null,focusId=null,layout=null,zoom=.8;const views=new Map();root.classList.add('tree-spatial');
 try{const saved=JSON.parse(storage?.getItem(TREE_STORAGE_KEY)||'null');if(saved&&typeof saved==='object'){
  for(const [key,allowed]of [['nation',TREE_NATIONS.map(n=>n.id)],['branch',['all',...TREE_BRANCHES.map(b=>b.id)]],['era',['all',...TREE_ERAS.map(e=>e.id)]],['status',['all','implemented','unimplemented']]])if(allowed.includes(saved[key]))state[key]=saved[key];
  zoom=Number.isFinite(saved.zoom)?Math.max(.5,Math.min(1.25,saved.zoom)):.8;
  state.query=typeof saved.query==='string'?saved.query.slice(0,80):'';state.minBR=Number.isFinite(saved.minBR)?rating(saved.minBR):1;state.maxBR=Number.isFinite(saved.maxBR)?Math.max(state.minBR,rating(saved.maxBR)):20;
 }}catch{}
 const selected=()=>treeAircraftForSim(getSelectedType());
 function el(tag,cls,text){const e=d.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
 function say(text){$('tree-announcement').textContent=text;}
 function save(){try{storage?.setItem(TREE_STORAGE_KEY,JSON.stringify({...state,zoom}));}catch{}}
 const cardFor=id=>[...$('tree-board').querySelectorAll('[data-tree-aircraft]')].find(b=>b.dataset.treeAircraft===id);
 function syncInert(){const overlay=active&&!!inspected&&(d.defaultView.innerWidth<=760||d.defaultView.innerHeight<=520);$('tree-board-viewport').inert=overlay;for(const e of root.querySelectorAll('.tree-heading,.tree-nations,.tree-filters,.tree-branch-bar,.tree-info-row,.tree-footer'))e.inert=overlay;}
 function updateCards(){const current=selected();for(const b of $('tree-board').querySelectorAll('[data-tree-aircraft]')){const a=treeAircraft(b.dataset.treeAircraft),chosen=a.id===current?.id,open=a.id===inspected;b.classList.toggle('is-equipped',chosen);b.classList.toggle('is-inspected',open);b.setAttribute('aria-pressed',String(open));b.setAttribute('aria-expanded',String(open));b.tabIndex=a.id===focusId?0:-1;b.querySelector('.tree-card-status').textContent=chosen?'✓ 선택됨':a.implemented?'구현':a.previewUrl?'외형 공개':'미구현';b.setAttribute('aria-label',`${a.name} ${a.variant}, ${branchFor(a.branch).name}, 레이팅 ${rate(a.br)}, ${chosen?'현재 선택된 기체':a.implemented?'구현':a.previewUrl?'외형 공개':'미구현'}. 상세 보기`);}
  highlightRoute();}
 function highlightRoute(){
  if(!layout)return;const current=selected(),id=inspected||current?.id,related=treeRouteAncestors(layout,id),subject=layout.byId.get(id),board=$('tree-board');
  for(const b of board.querySelectorAll('[data-tree-aircraft]'))b.classList.toggle('is-ancestor',related.has(b.dataset.treeAircraft)&&b.dataset.treeAircraft!==id);
  for(const path of board.querySelectorAll('[data-tree-edge]'))path.classList.toggle('is-route',related.has(path.dataset.from)&&related.has(path.dataset.to));
  for(const tick of board.querySelectorAll('[data-tree-tick]'))tick.classList.toggle('is-active',!!subject&&Number(tick.dataset.treeTick)===subject.br);
  const row=board.querySelector('.tree-selected-row');if(row){row.hidden=!subject;if(subject){row.style.top=(TREE_GRID.header+subject.y*zoom)+'px';row.style.height=(subject.height*zoom)+'px';}}
 }

 function scrollTo(id,focus=false){const b=cardFor(id);if(!b)return;b.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});if(focus)b.focus({preventScroll:true});}
 function closeDetail({focus=true}={}){const prior=inspected;inspected=null;root.classList.remove('tree-detail-open');$('tree-detail').hidden=true;syncInert();updateCards();if(focus&&prior)scrollTo(prior,true);}
 function inspect(id,{focusDetail=false}={}){const a=treeAircraft(id);if(!a||a.nation!==state.nation)return;inspected=id;focusId=id;root.classList.add('tree-detail-open');$('tree-detail').hidden=false;renderDetail();updateCards();syncInert();scrollTo(id);if(focusDetail)$('tree-detail-title').focus({preventScroll:true});}
 function applyChoice(prepare=false){const a=treeAircraft(inspected);if(!a?.implemented||!Number.isInteger(a.simId))return false;if(!canChoose()){say('비행 준비 또는 성능 측정 중에는 기체를 바꿀 수 없습니다.');return false;}if(onChoose(a.simId)!==true){say('지금은 기체를 변경할 수 없습니다.');return false;}refresh();say(`${a.name} ${a.variant} 선택 완료. 출격 기체에 적용했습니다.`);if(prepare&&isReady())onPrepare?.();return true;}
 function renderDetail(){const a=treeAircraft(inspected);if(!a)return;const branch=branchFor(a.branch),chosen=selected()?.id===a.id;
  $('tree-detail-kicker').textContent=TREE_NATIONS.find(n=>n.id===a.nation).english+' / '+branch.english;$('tree-detail-title').textContent=a.name;$('tree-detail-nickname').textContent=a.nickname;$('tree-detail-variant').textContent=a.variant;$('tree-detail-rating').textContent=rate(a.br);$('tree-detail-symbol').innerHTML=icon(a.branch);
  const status=$('tree-detail-status');status.textContent=a.implemented?(chosen?'현재 선택됨':'구현 · 선택 가능'):a.previewUrl?'외형 공개 · 비행 준비 중':'미구현';status.dataset.status=a.implemented?'implemented':'unimplemented';
  const props=$('tree-detail-properties');props.replaceChildren();for(const [label,value]of [['주 분류',branch.name],['기술 시대',TREE_ERAS.find(e=>e.id===a.era).name],['대표 임무',branch.description]]){const line=el('div');line.append(el('dt','',label),el('dd','',value));props.append(line);}
  const tags=$('tree-role-tags');tags.replaceChildren(...treeRoleTags(a).map(t=>el('span','',t)));
  $('tree-detail-note').textContent=a.note;$('tree-detail-availability').textContent=a.implemented?'기체 선택 시 현재 비행 모델·무장·레이더에 연결됩니다. 상세 성능은 격납고에서 확인할 수 있습니다.':a.previewUrl?'독립 제작한 Su-35S 외형을 3D 스튜디오에서 살펴보세요. 흡입구·내부 덕트·노즐·조종석을 확대하고 가동부를 움직여 볼 수 있습니다. Su-35S 비행 물리·무장·레이더는 아직 연결되지 않았습니다.':'비행 모델·외형·무장·레이더는 아직 미구현입니다. 이 항목은 분류와 레이팅을 미리 볼 수 있는 카탈로그입니다.';
  const siblings=treeFamily(a),variants=$('tree-variants');variants.replaceChildren();$('tree-variant-heading').textContent='같은 계열의 형식 · '+siblings.length;
  for(const other of siblings){const b=el('button','tree-variant');b.type='button';b.dataset.treeVariant=other.id;b.setAttribute('aria-current',String(other.id===a.id));const copy=el('span'),meta=el('span','tree-variant-meta');copy.append(el('b','',other.name),el('small','',other.variant));meta.append(el('b','',rate(other.br)),el('small','',other.implemented?'구현':'미구현'));b.append(copy,meta);b.onclick=()=>{if(!visible.some(a=>a.id===other.id)){state={...defaults(),nation:other.nation};render();}inspect(other.id,{focusDetail:true});};variants.append(b);}
  const source=TREE_SOURCES[a.source];$('tree-detail-source').href=source.url;$('tree-detail-source').textContent=source.name+' ↗';
  $('tree-choose').disabled=!a.implemented||!canChoose();$('tree-choose').textContent=!a.implemented?'미구현 · 선택 불가':chosen?'✓ 현재 선택된 기체':'이 기체 선택';$('tree-inspect-model').textContent=a.previewUrl?'Su-35S 3D 외형 스튜디오 ↗':'격납고에서 외형·성능 보기';$('tree-inspect-model').disabled=!a.previewUrl&&(!a.implemented||!isReady()||!canChoose());$('tree-prepare').hidden=!a.implemented||!chosen;$('tree-prepare').disabled=!isReady()||!canChoose();$('tree-flight-readiness').hidden=!a.implemented||isReady();
 }
 function syncFilters(){root.dataset.nation=state.nation;for(const b of root.querySelectorAll('[data-tree-nation]')){const on=b.dataset.treeNation===state.nation;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}for(const b of root.querySelectorAll('[data-tree-branch]'))b.setAttribute('aria-pressed',String(b.dataset.treeBranch===state.branch));for(const b of root.querySelectorAll('[data-tree-status]'))b.setAttribute('aria-pressed',String(b.dataset.treeStatus===state.status));$('tree-search').value=state.query;$('tree-era').value=state.era;$('tree-br-min').value=rate(state.minBR);$('tree-br-max').value=rate(state.maxBR);$('tree-clear-search').hidden=!state.query;$('tree-reset').hidden=!(state.query||state.branch!=='all'||state.era!=='all'||state.status!=='all'||state.minBR!==1||state.maxBR!==20);$('tree-russia-note').hidden=state.nation!=='ru';$('tree-filter-toggle').dataset.filtered=String(!($('tree-reset').hidden));}

 function svgEl(tag,attrs={}){const node=d.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;}
 function renderMap(branches){
  const g=TREE_GRID,board=$('tree-board');layout=layoutAircraftTree(visible,{minBR:state.minBR,maxBR:state.maxBR,branches});
  board.replaceChildren();board.style.width=(layout.width*zoom)+'px';board.style.height=(g.header+layout.height*zoom)+'px';board.style.setProperty('--tree-zoom',String(zoom));board.dataset.compact=String(zoom<.8);
  for(const band of layout.bands){const strip=el('div','tree-rating-band');strip.dataset.band=band.id;strip.style.cssText=['left:'+g.axis*zoom+'px','top:'+(g.header+band.y*zoom)+'px','width:'+(layout.width-g.axis)*zoom+'px','height:'+band.height*zoom+'px'].join(';');strip.append(el('span','tree-band-label',band.id+' · '+band.name));board.append(strip);}
  const row=el('div','tree-selected-row');row.hidden=true;row.style.width=(layout.width*zoom)+'px';board.append(row);
  const svg=svgEl('svg',{class:'tree-connections',viewBox:'0 0 '+layout.width+' '+layout.height,'aria-hidden':'true'});svg.style.cssText=['top:'+g.header+'px','width:'+layout.width*zoom+'px','height:'+layout.height*zoom+'px'].join(';');
  const defs=svgEl('defs'),marker=svgEl('marker',{id:'tree-arrow',markerWidth:8,markerHeight:8,refX:7,refY:4,orient:'auto',markerUnits:'strokeWidth'});marker.append(svgEl('path',{d:'M0,1 L7,4 L0,7',fill:'none',stroke:'#8aa2af','stroke-width':1.4}));defs.append(marker);svg.append(defs);
  for(const tick of layout.ticks)svg.append(svgEl('line',{x1:g.axis,y1:tick.y+g.cardHeight/2,x2:layout.width,y2:tick.y+g.cardHeight/2,class:tick.major?'tree-grid-major':'tree-grid-minor'}));
  for(const edge of layout.connections){const path=svgEl('path',{d:edge.d,class:'tree-edge tree-edge-'+edge.kind,'marker-end':'url(#tree-arrow)','data-tree-edge':edge.from+'>'+edge.to,'data-from':edge.from,'data-to':edge.to,'vector-effect':'non-scaling-stroke'});svg.append(path);}
  board.append(svg);
  for(const c of layout.columns){
   const column=el('section','tree-column');column.dataset.treeColumn=c.id;column.style.cssText=['left:'+c.x*zoom+'px','width:'+c.width*zoom+'px','height:'+(g.header+layout.height*zoom)+'px'].join(';');
   const heading=el('header','tree-column-heading'),symbol=el('span','tree-column-icon'),copy=el('div');symbol.innerHTML=icon(c.id);copy.append(el('h3','',c.name),el('span','',c.count+'개 형식'+(c.lanes>1?' · 분기 '+c.lanes:'')));heading.append(symbol,copy);column.append(heading);
   const list=el('ol','tree-path');list.setAttribute('aria-label',c.name+' · BR에 비례한 배치');list.style.cssText='top:'+g.header+'px;height:'+layout.height*zoom+'px';
   for(const node of layout.nodes.filter(n=>n.branch===c.id)){
    const a=node.aircraft,item=el('li','tree-path-node'),b=el('button','tree-card'),top=el('span','tree-card-top');item.style.cssText=['left:'+(node.x-c.x)*zoom+'px','top:'+node.y*zoom+'px','width:'+node.width*zoom+'px','height:'+node.height*zoom+'px'].join(';');item.dataset.treeNode=a.id;b.type='button';b.dataset.treeAircraft=a.id;b.dataset.implemented=String(a.implemented);b.dataset.rating=String(a.br);b.setAttribute('aria-controls','tree-detail');
    top.append(el('b','tree-card-rating',rate(a.br)),el('span','tree-card-status',a.implemented?'구현':a.previewUrl?'외형 공개':'미구현'));const art=el('span','tree-card-art');art.innerHTML=icon(a.branch);
    b.append(art,top,el('strong','tree-card-name',a.name),el('span','tree-card-variant',a.variant));b.onclick=()=>inspect(a.id,{focusDetail:d.defaultView.innerWidth<=760||d.defaultView.innerHeight<=520});b.onfocus=()=>{focusId=a.id;for(const button of board.querySelectorAll('[data-tree-aircraft]'))button.tabIndex=button===b?0:-1;};b.onkeydown=e=>{const target=treeSpatialTarget(layout,a.id,e.key);if(!target)return;e.preventDefault();focusId=target;updateCards();scrollTo(target,true);};item.append(b);list.append(item);
   }
   if(!c.count)list.append(el('li','tree-column-empty','표시할 기체 없음'));column.append(list);board.append(column);
  }
  const axis=el('aside','tree-rating-axis');axis.setAttribute('aria-label','공통 레이팅 눈금');axis.style.cssText='width:'+g.axis*zoom+'px;height:'+(g.header+layout.height*zoom)+'px';axis.append(el('div','tree-axis-heading','BR'));
  for(const tick of layout.ticks){const label=el('span',tick.major?'tree-rating-tick':'tree-rating-tick tree-rating-half',rate(tick.br));label.dataset.treeTick=String(tick.br);label.style.top=(g.header+(tick.y+g.cardHeight/2)*zoom)+'px';axis.append(label);}board.append(axis);
  $('tree-zoom-value').textContent=Math.round(zoom*100)+'%';$('tree-zoom-out').disabled=zoom<=.5;$('tree-zoom-in').disabled=zoom>=1.25;
  for(const option of $('tree-rating-jump').options)if(option.value!=='')option.disabled=Number(option.value)>state.maxBR||Number(option.dataset.max)<state.minBR;
 }
 function revealResult(){if(visible.length&&focusId)scrollTo(focusId);}
 function render(){
  syncFilters();save();visible=filterAircraftTree(state);if(!visible.some(a=>a.id===focusId))focusId=visible.find(a=>a.id===selected()?.id)?.id||visible[0]?.id||null;
  const constrained=state.query||state.status!=='all'||state.era!=='all'||state.minBR!==1||state.maxBR!==20,branches=TREE_BRANCHES.filter(b=>(state.branch==='all'||b.id===state.branch)&&(!(constrained&&state.branch==='all')||visible.some(a=>a.branch===b.id)));
  renderMap(branches);
  $('tree-empty').hidden=visible.length>0;const other=state.nation==='us'?'ru':'us',otherRows=filterAircraftTree({...state,nation:other});$('tree-other-nation').hidden=!!visible.length||!otherRows.length;$('tree-other-nation').textContent=(other==='us'?'미국':'러시아')+' 트리에서 '+otherRows.length+'개 보기';$('tree-other-nation').onclick=()=>switchNation(other);
  $('tree-results').textContent=visible.length+' / '+treeSummary(state.nation).total+'개 형식 · 표시 중 구현 '+visible.filter(a=>a.implemented).length;$('tree-navigation-hint').textContent='같은 BR은 같은 높이 · 빈 공간 드래그로 이동 · 방향키 / Enter';
  if(inspected&&!visible.some(a=>a.id===inspected))closeDetail({focus:false});refresh();
 }
 function rememberView(){const box=$('tree-board-viewport');views.set(state.nation,{left:box.scrollLeft,top:box.scrollTop});}
 function changeZoom(next){
  const box=$('tree-board-viewport'),old=zoom,x=(box.scrollLeft+box.clientWidth/2)/old,y=(box.scrollTop+box.clientHeight/2-TREE_GRID.header)/old;
  zoom=Math.round(Math.max(.5,Math.min(1.25,next))*100)/100;render();box.scrollLeft=x*zoom-box.clientWidth/2;box.scrollTop=TREE_GRID.header+y*zoom-box.clientHeight/2;
 }
 function switchNation(nation){if(!TREE_NATIONS.some(n=>n.id===nation))return;rememberView();state.nation=nation;closeDetail({focus:false});render();$('tree-board-viewport').scrollTop=0;$('tree-board-viewport').scrollLeft=0;if(state.query||state.branch!=='all'||state.era!=='all'||state.status!=='all'||state.minBR!==1||state.maxBR!==20)revealResult();say(`${nation==='us'?'미국':'러시아'} 트리. ${visible.length}개 형식.`);}
 function resetFilters(){state={...defaults(),nation:state.nation};closeDetail({focus:false});render();$('tree-board-viewport').scrollTop=0;$('tree-board-viewport').scrollLeft=0;}
 function refresh(){const current=selected();const badge=$('current-aircraft-rating');if(badge)badge.textContent=current?'BR '+rate(current.br):'—';$('tree-current-name').textContent=current?`${current.name} · ${current.variant}`:'선택 기체 없음';$('tree-current-rating').textContent=current?'BR '+rate(current.br):'';updateCards();if(inspected)renderDetail();}
 function jumpToSelected(){const a=selected();if(!a)return;state={...defaults(),nation:a.nation};render();inspect(a.id);scrollTo(a.id,true);}
 function setActive(value){if(active&&!value)rememberView();active=value;if(value){render();const prior=views.get(state.nation);if(prior){$('tree-board-viewport').scrollLeft=prior.left;$('tree-board-viewport').scrollTop=prior.top;}else revealResult();$('tree-back').focus({preventScroll:true});}else closeDetail({focus:false});}
 const nations=$('tree-nations');for(const [i,n]of TREE_NATIONS.entries()){const summary=treeSummary(n.id),b=el('button','tree-nation'),flag=el('span','tree-flag tree-flag-'+n.id),copy=el('span','tree-nation-copy'),count=el('span','tree-nation-count');b.type='button';b.dataset.treeNation=n.id;b.setAttribute('role','tab');b.setAttribute('aria-controls','tree-workspace');flag.setAttribute('aria-hidden','true');copy.append(el('small','',n.english),el('b','',n.name));count.append(el('strong','',summary.total+' 형식'),el('small','',`구현 ${summary.implemented} · ${summary.families} 계열`));b.append(flag,copy,count);b.onclick=()=>switchNation(n.id);b.onkeydown=e=>{const next=['ArrowLeft','ArrowRight'].includes(e.key)?(i+1)%2:e.key==='Home'?0:e.key==='End'?1:-1;if(next<0)return;e.preventDefault();switchNation(TREE_NATIONS[next].id);nations.children[next].focus();};nations.append(b);}
 for(const [id,name]of [['all','전체 트리'],...TREE_BRANCHES.map(b=>[b.id,b.name])]){const b=el('button','',name);b.type='button';b.dataset.treeBranch=id;b.onclick=()=>{state.branch=id;render();revealResult();};$('tree-branches').append(b);}
 for(const era of TREE_ERAS){const option=el('option','',era.name);option.value=era.id;$('tree-era').append(option);}
 $('tree-filter-toggle').onclick=()=>{const open=root.classList.toggle('tree-filters-open');$('tree-filter-toggle').setAttribute('aria-expanded',String(open));$('tree-filter-toggle').textContent=open?'접기':'필터';};
 $('tree-search').oninput=e=>{state.query=e.target.value.slice(0,80);render();revealResult();};$('tree-clear-search').onclick=()=>{state.query='';render();$('tree-search').focus();};$('tree-era').onchange=e=>{state.era=e.target.value;render();revealResult();};for(const b of root.querySelectorAll('[data-tree-status]'))b.onclick=()=>{state.status=b.dataset.treeStatus;render();revealResult();};
 for(const [id,key,other]of [['tree-br-min','minBR','maxBR'],['tree-br-max','maxBR','minBR']])$(id).onchange=e=>{state[key]=rating(e.target.value);if(state.minBR>state.maxBR)state[other]=state[key];render();revealResult();};
 $('tree-reset').onclick=$('tree-empty-reset').onclick=resetFilters;$('tree-back').onclick=()=>onClose?.();$('tree-detail-close').onclick=()=>closeDetail();$('tree-current').onclick=jumpToSelected;$('tree-choose').onclick=()=>applyChoice();$('tree-prepare').onclick=()=>applyChoice(true);$('tree-inspect-model').onclick=()=>{const a=treeAircraft(inspected);if(a?.previewUrl){d.defaultView.location.assign(a.previewUrl);return;}if(isReady()&&applyChoice())onHangar?.();};
 for(const [id,sign]of [['tree-pan-left',-1],['tree-pan-right',1]])$(id).onclick=()=>{const box=$('tree-board-viewport');box.scrollBy?.({left:sign*Math.max(180,box.clientWidth*.6),behavior:d.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};$('tree-top').onclick=()=>{$('tree-board-viewport').scrollTop=0;$('tree-board-viewport').scrollLeft=0;};

 const jump=$('tree-rating-jump');for(const band of TREE_BANDS){const option=el('option','',band.id+' · '+rate(band.min)+'–'+rate(band.max));option.value=String(band.min);option.dataset.max=String(band.max);jump.append(option);}
 jump.onchange=()=>{if(!jump.value)return;const br=Math.max(state.minBR,Math.min(state.maxBR,Number(jump.value)));$('tree-board-viewport').scrollTop=(br-state.minBR)*TREE_GRID.halfStep*2*zoom;jump.value='';};
 $('tree-zoom-out').onclick=()=>changeZoom(zoom-.15);$('tree-zoom-in').onclick=()=>changeZoom(zoom+.15);$('tree-fit').onclick=()=>{const box=$('tree-board-viewport');changeZoom(Math.min(1,(box.clientWidth-10)/Math.max(1,layout.width)));};
 let pan=null;const box=$('tree-board-viewport');
 box.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest?.('button,input,select,a'))return;pan={id:e.pointerId,x:e.clientX,y:e.clientY,left:box.scrollLeft,top:box.scrollTop};box.setPointerCapture?.(e.pointerId);box.classList.add('is-panning');e.preventDefault();});
 box.addEventListener('pointermove',e=>{if(!pan||pan.id!==e.pointerId)return;box.scrollLeft=pan.left+pan.x-e.clientX;box.scrollTop=pan.top+pan.y-e.clientY;});
 const stopPan=e=>{if(!pan||e.pointerId!==undefined&&e.pointerId!==pan.id)return;box.releasePointerCapture?.(pan.id);pan=null;box.classList.remove('is-panning');};
 box.addEventListener('pointerup',stopPan);box.addEventListener('pointercancel',stopPan);box.addEventListener('lostpointercapture',()=>{pan=null;box.classList.remove('is-panning');});

 root.addEventListener('keydown',e=>{if(!active||e.key!=='Escape'||d.querySelector('dialog[open]'))return;e.preventDefault();e.stopPropagation();if(inspected)closeDetail();else if(root.classList.contains('tree-filters-open'))$('tree-filter-toggle').click();else onClose?.();});d.defaultView.addEventListener('resize',syncInert);render();
 return{setActive,refresh,jumpToSelected,closeDetail,get active(){return active;},get state(){return{...state,inspected,focusId,visible:visible.map(a=>a.id),zoom};}};
}
