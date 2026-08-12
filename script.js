const menuToggle=document.getElementById('menuToggle');
const mainNav=document.getElementById('mainNav');
menuToggle?.addEventListener('click',()=>{const open=mainNav.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open));});
mainNav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{mainNav.classList.remove('open');menuToggle?.setAttribute('aria-expanded','false');}));

const searchInput=document.getElementById('ruleSearch');
const ruleGrid=document.getElementById('ruleGrid');
let rules=[];
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const uniqueBy=(arr,key)=>{const s=new Set();return arr.filter(x=>{const k=key(x);if(s.has(k))return false;s.add(k);return true;});};
const majorName=id=>rules.find(r=>Number(r.major_id)===Number(id))?.major_title||'未分類';
const middleName=id=>rules.find(r=>Number(r.middle_id)===Number(id))?.middle_title||'未分類';

function backButton(label,fn){const b=document.createElement('button');b.type='button';b.className='rule-nav-back';b.textContent='← '+label;b.onclick=fn;return b;}
function bread(parts){const d=document.createElement('div');d.className='rule-breadcrumb';d.textContent=parts.filter(Boolean).join(' ＞ ');return d;}
function navCard(title,sub,fn,icon='📘'){const b=document.createElement('button');b.type='button';b.className='rule-card rule-nav-card';b.innerHTML=`<span class="rule-icon">${icon}</span><strong>${esc(title)}</strong><span>${esc(sub||'')}</span>`;b.onclick=fn;return b;}
function tools(backLabel,backFn,parts){const d=document.createElement('div');d.className='rule-nav-tools';d.appendChild(backButton(backLabel,backFn));d.appendChild(bread(parts));return d;}

function showMajors(){ruleGrid.innerHTML='';const majors=uniqueBy(rules.filter(r=>r.major_id&&r.major_title),r=>Number(r.major_id));if(!majors.length){ruleGrid.innerHTML='<p class="no-results" style="display:block">現在公開中のルールはありません。</p>';return;}majors.forEach(m=>{const count=rules.filter(r=>Number(r.major_id)===Number(m.major_id)).length;ruleGrid.appendChild(navCard(m.major_title,`${count}件のルール`,()=>showMiddles(m.major_id)));});}
function showMiddles(majorId){ruleGrid.innerHTML='';ruleGrid.appendChild(tools('大タイトル一覧',showMajors,['ルール一覧',majorName(majorId)]));const group=rules.filter(r=>Number(r.major_id)===Number(majorId));const mids=uniqueBy(group.filter(r=>r.middle_id&&r.middle_title),r=>Number(r.middle_id));if(!mids.length){group.forEach(r=>ruleGrid.appendChild(ruleCard(r)));return;}mids.forEach(m=>{const count=group.filter(r=>Number(r.middle_id)===Number(m.middle_id)).length;ruleGrid.appendChild(navCard(m.middle_title,`${count}件のルール`,()=>showRuleList(majorId,m.middle_id)));});}
function ruleCard(r){return navCard(r.title,r.summary||'ルールを確認',()=>showRule(r.id),'📄');}
function showRuleList(majorId,middleId){ruleGrid.innerHTML='';ruleGrid.appendChild(tools(majorName(majorId),()=>showMiddles(majorId),['ルール一覧',majorName(majorId),middleName(middleId)]));rules.filter(r=>Number(r.middle_id)===Number(middleId)).forEach(r=>ruleGrid.appendChild(ruleCard(r)));}
function showRule(id){const r=rules.find(x=>Number(x.id)===Number(id));if(!r)return;ruleGrid.innerHTML='';const backFn=r.middle_id?()=>showRuleList(r.major_id,r.middle_id):()=>showMiddles(r.major_id);const backLabel=r.middle_id?middleName(r.middle_id):majorName(r.major_id);ruleGrid.appendChild(tools(backLabel,backFn,['ルール一覧',r.major_title,r.middle_title,r.title]));const a=document.createElement('article');a.className='rule-detail-card';a.innerHTML=`<div class="rule-detail-meta">${esc(r.major_title||'')}${r.middle_title?' ＞ '+esc(r.middle_title):''}</div><h3>${esc(r.title)}</h3>${r.summary?`<p class="rule-detail-summary">${esc(r.summary)}</p>`:''}<div class="rule-detail-content">${esc(r.content).replaceAll('\n','<br>')}</div>${r.details?`<details class="rule-detail-extra" ${r.details_collapsed?'':'open'}><summary>詳しく見る</summary><div>${esc(r.details).replaceAll('\n','<br>')}</div></details>`:''}`;ruleGrid.appendChild(a);}
function search(q){ruleGrid.innerHTML='';ruleGrid.appendChild(tools('大タイトル一覧',showMajors,[`検索結果：「${q}」`]));const s=q.toLowerCase();const hits=rules.filter(r=>[r.major_title,r.middle_title,r.category,r.title,r.summary,r.content,r.details,r.keywords].filter(Boolean).join(' ').toLowerCase().includes(s));if(!hits.length){ruleGrid.innerHTML+='<p class="no-results" style="display:block">該当するルールがありません。</p>';return;}hits.forEach(r=>ruleGrid.appendChild(ruleCard(r)));}
searchInput?.addEventListener('input',()=>{const q=searchInput.value.trim();q?search(q):showMajors();});
(async()=>{try{const res=await fetch('/api/rules',{cache:'no-store'});const data=await res.json();if(!res.ok||!data.ok||!Array.isArray(data.rules))throw new Error();rules=data.rules;showMajors();}catch(e){ruleGrid.innerHTML='<p class="no-results" style="display:block">ルールを読み込めませんでした。時間をおいて再度お試しください。</p>';}})();
