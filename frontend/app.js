import {categories,mapRows,analyse,amount} from './engine.js';
import {groups,suggestGroup,financials,ratios,ratioDefinitions,samplePeriods,validatePeriod,accountMovements,comparable,contiguous,days} from './comparison.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format((n||0)/100);
const number=(v,unit='')=>v===null||v===undefined?'N/A':`${v.toLocaleString('en-IN',{maximumFractionDigits:2})}${unit==='days'?' days':unit}`;
const message=s=>{$('message').textContent=s;};
let data={company:{name:'Aarohi Enterprises',periods:samplePeriods()},peer:{name:'Peer company',periods:[null,null,null]}};
let dataset='company',reviewSlot=2,workbook=null,filename='',queue=[],importTarget='company',requestedSlot=null;
const current=()=>data[dataset];
const ordered=(key=dataset)=>data[key].periods.filter(Boolean).sort((a,b)=>a.end.localeCompare(b.end));
const review=()=>current().periods[reviewSlot];
function table(headers,body){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function valueTable(ps,defs){return table(['Metric',...ps.map(p=>p.label)],defs.map(([label,get,fmt=money])=>[esc(label),...ps.map((p,i)=>fmt(get(p,i)))]));}
function metric(label,value,note){return `<div class="metric"><label>${label}</label><b>${value}</b><small>${note}</small></div>`;}
function status(p){const f=financials(p);return `${f.base.balanced?'Balanced':'Out of balance'} · ${f.ready?'Groups reviewed':'Review groups'}`;}
function render(){
 const ps=ordered();$('company').value=current().name;
 $('period-slots').innerHTML=current().periods.map((p,i)=>`<div class="period-slot"><span class="eyebrow">PERIOD ${i+1}</span><h3>${esc(p?.label||'Add a trial balance')}</h3><small>${p?esc(p.start+' → '+p.end):'Separate file or workbook sheet'}</small><p>${p?esc(status(p)):'Ready for your data'}</p><button data-import="${i}">${p?'Replace TB':'Import TB'}</button>${p?` <button data-review="${i}">Review</button> <button data-remove="${i}" aria-label="Remove period ${i+1}">×</button>`:''}</div>`).join('');
 $('result-title').textContent=current().name;$('data-label').textContent=ps.some(p=>p.sample)?'ILLUSTRATIVE RESULT':'YOUR TRIAL BALANCES';
 $('source').textContent=`${ps.length} of 3 periods · INR · ${ps.map(p=>p.label).join(' / ')}`;
 $('balance-badge').textContent=ps.length?`${ps.filter(p=>analyse(p.rows).balanced).length}/${ps.length} periods reconcile`:'No periods imported';
 renderOverview(ps);renderDrivers(ps);renderPeers();renderReview();renderChecks(ps);
}
function renderOverview(ps){
 if(!ps.length){$('overview').innerHTML='<section class="card empty">Import a trial balance using a period slot above.</section>';return;}
 const last=ps.at(-1),f=financials(last),rr=ratios(last,ps.at(-2));
 $('overview').innerHTML=`<div class="metrics">${metric('Revenue',f.ready?money(f.revenue):'Review groups',esc(last.label)+' · growth '+number(rr.growth,'%'))}${metric('EBITDA margin',number(rr.ebitda,'%'),'From reviewed ratio groups')}${metric('Cash conversion cycle',number(rr.cycle,'days'),'Closing balances · sales/COGS proxies')}${metric('Operating cash flow',Number.isSafeInteger(last.cfo)?money(last.cfo):'Not supplied','From supporting cash-flow evidence')}</div><div class="columns"><section class="card"><span class="eyebrow">WHAT CHANGED</span><h2>Three-period performance</h2>${valueTable(ps,[['Revenue',p=>financials(p).ready?financials(p).revenue:null,v=>v===null?'Review groups':money(v)],['EBITDA',p=>financials(p).ready?financials(p).ebitda:null,v=>v===null?'Review groups':money(v)],['Provisional PAT',p=>financials(p).base.profit],['Total debits',p=>financials(p).base.debit],['Total credits',p=>financials(p).base.credit]])}${ps.map(p=>{const f=financials(p),max=Math.max(1,...ps.map(x=>Math.abs(financials(x).base.profit)));return `<div class="bar-row"><div class="bar-label"><span>${esc(p.label)} · ${f.base.profit<0?'loss':'profit'}</span><strong>${money(f.base.profit)}</strong></div><div class="bar-track"><progress aria-label="Profit magnitude ${esc(p.label)}" max="${max}" value="${Math.abs(f.base.profit)}"></progress></div></div>`;}).join('')}</section><section class="card"><span class="eyebrow">WHY IT CHANGED</span><h2>Decision-ready insights</h2>${insights(ps)}<button data-open="drivers">See all drivers →</button></section></div><section class="card ratio-snapshot"><span class="eyebrow">RATIO SNAPSHOT</span><h2>Health indicators</h2>${ratioTable(ps,ratioDefinitions.filter(([id])=>['growth','ebitda','current','debt','cfo'].includes(id)))}</section>`;
}
function insights(ps){
 const last=ps.at(-1),prior=ps.at(-2),f=financials(last),rr=ratios(last,prior);
 const items=[['Reconciliation',`${ps.filter(p=>financials(p).base.balanced).length} of ${ps.length} periods balance. Latest difference: ${money(f.base.difference)}.`]];
 if(prior){const old=financials(prior);items.push(['Profit movement',`${money(f.base.profit-old.base.profit)} change versus ${prior.label}. ${!comparable(prior,last)?'Durations differ; raw change is not like-for-like.':''}`]);if(f.ready&&old.ready){items.push(['Revenue movement',`${money(f.revenue-old.revenue)} change; growth ${number(rr.growth,'%')}. Evidence: ${money(old.revenue)} → ${money(f.revenue)}.`]);items.push(['Margin movement',`EBITDA margin ${number(ratios(prior,ps.at(-3)).ebitda,'%')} → ${number(rr.ebitda,'%')}. Review cost and income movements in Drivers & ratios.`]);}}
 else items.push(['Add prior periods','Import two more periodic TBs for trends.']);
 items.push(['Classification coverage',`${ps.filter(p=>financials(p).ready).length} of ${ps.length} periods have complete, confirmed ratio groups. Unavailable ratios are shown as N/A.`]);
 return items.map(([title,text])=>`<div class="finding"><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`).join('');
}
function ratioTable(ps,defs=ratioDefinitions){
 const rr=ps.map((p,i)=>ratios(p,ps[i-1]));
 return table(['Ratio',...ps.map(p=>p.label),'Latest change','Formula'],defs.map(([id,label,unit,formula])=>{const a=rr.at(-1)?.[id],b=rr.at(-2)?.[id];return [esc(label),...rr.map(r=>number(r[id],unit)),a==null||b==null?'N/A':number(a-b,unit==='%'?' pp':unit),esc(formula)];}));
}
function renderDrivers(ps){
 const latest=ps.at(-1),prior=ps.at(-2),moves=latest?accountMovements(latest,prior):[];
 const bridge=latest&&prior?categories.map(c=>{const a=financials(prior).base.totals[c],b=financials(latest).base.totals[c];return [c,money(a),money(b),money(b-a)];}):[];
 $('drivers').innerHTML=`<section class="card"><span class="eyebrow">DRIVERS & RATIOS</span><h2>Understand the movement</h2><p>Every ratio from the reference, across ${ps.length} imported periods. Review and confirm ratio groups in Review data to enable calculations.</p>${ratioTable(ps)}<p class="hint">N/A means a missing input, unreviewed group, non-positive denominator, or incomparable duration. Return on average assets also needs a contiguous opening period. Day ratios use closing balances and actual period days (365 for a normal year). CFO/PAT needs separately entered operating cash flow and its source. Ratios are provisional if the TB does not reconcile.</p></section><section class="card ratio-snapshot"><h2>Category movements · latest versus prior</h2>${bridge.length?table(['Category','Prior net debit','Latest net debit','Change'],bridge):'<p>Add a second period to compare movements.</p>'}<h2>Account movement evidence</h2><p class="hint">Matched by trimmed, case-insensitive account name; duplicate names are aggregated. Renamed accounts appear separately. Net debit movement provides evidence, not an inferred business cause.</p>${moves.length?table(['Account','Prior','Latest','Change'],moves.map(r=>[esc(r.name),money(r.prior),money(r.current),money(r.change)])):'<p>No comparison available yet.</p>'}</section>`;
}
function renderPeers(){
 const a=ordered('company'),b=ordered('peer');
 if(!a.length||!b.length){$('peers').innerHTML='<section class="card empty"><span class="eyebrow">PEER COMPARISON</span><h2>Bring your own benchmark</h2><p>Import peer TBs using Add peer TBs. Nothing is fetched online. Matching reporting periods will be compared with your company.</p><button data-peer class="primary">Add peer TBs</button></section>';return;}
 const matches=a.map((p,i)=>({p,i,j:b.findIndex(q=>q.start===p.start&&q.end===p.end)})).filter(x=>x.j>=0);
 $('peers').innerHTML=`<section class="card"><span class="eyebrow">PEER COMPARISON</span><h2>${esc(data.company.name)} vs ${esc(data.peer.name)}</h2><p>Only identical start and end dates are compared. Both companies use the same formulas and INR. ${matches.length} matched period(s).</p>${!matches.length?'<p>No dates match yet. Import peer TBs for the same reporting periods.</p>':''}${matches.map(({p,i,j})=>{const q=b[j],r1=ratios(p,a[i-1]),r2=ratios(q,b[j-1]);return `<h3>${esc(p.label)} · ${esc(p.start)} → ${esc(p.end)}</h3>${table(['Metric',data.company.name,data.peer.name,'Difference (company − peer)'],ratioDefinitions.map(([id,label,unit])=>[esc(label),number(r1[id],unit),number(r2[id],unit),r1[id]===null||r2[id]===null?'N/A':number(r1[id]-r2[id],unit==='%'?' pp':unit)]))}`;}).join('')}<p class="hint">Differences do not automatically imply better or worse. Business models and accounting policies may differ. Figures require human review.</p></section>`;
}
function renderReview(){
 const slots=current().periods.map((p,i)=>({p,i})).filter(x=>x.p);if(!review())reviewSlot=slots.at(-1)?.i??0;
 $('review-period').innerHTML=slots.map(({p,i})=>`<option value="${i}"${i===reviewSlot?' selected':''}>${esc(p.label)}</option>`).join('');
 $('confirm-groups').checked=!!review()?.confirmed;$('confirm-groups').disabled=!review();
 $('cfo').value=Number.isSafeInteger(review()?.cfo)?String(review().cfo/100):'';$('cfo-source').value=review()?.cfoSource||'';renderAccounts();
}
function renderAccounts(){
 const p=review(),query=$('search').value.toLowerCase();if(!p){$('account-table').innerHTML='<p>No period loaded.</p>';return;}
 $('account-table').innerHTML=table(['Row','Account','Debit','Credit','Category','Ratio group'],p.rows.map((r,i)=>({r,i})).filter(({r})=>r.name.toLowerCase().includes(query)).map(({r,i})=>[r.sourceRow,esc(r.name),money(r.debit),money(r.credit),`<select data-category="${i}" aria-label="Category for ${esc(r.name)}">${categories.map(c=>`<option${c===r.category?' selected':''}>${c}</option>`).join('')}</select>`,`<select data-group="${i}" aria-label="Ratio group for ${esc(r.name)}">${Object.keys(groups).map(g=>`<option${g===r.group?' selected':''}>${esc(g)}</option>`).join('')}</select>`]));
}
function evidence(ps){
 const findings=[];ps.forEach((p,i)=>{const f=financials(p);if(!f.base.balanced)findings.push([p.label,'Reconciliation',`Debit/credit difference: ${money(f.base.difference)}`]);for(const x of f.base.issues)findings.push([p.label,x.name,x.message]);for(const r of p.rows.filter(x=>x.group==='Unmapped'))findings.push([p.label,r.name,`Row ${r.sourceRow}: ratio group is unmapped.`]);if(!p.confirmed)findings.push([p.label,'Review required','Confirm completeness and classifications in Review data.']);if(!Number.isSafeInteger(p.cfo)||!p.cfoSource?.trim())findings.push([p.label,'CFO / PAT','Operating cash flow and its source have not been supplied.']);if(i&&!comparable(ps[i-1],p))findings.push([p.label,'Different durations','Growth is unavailable; compare like-for-like periods.']);if(i&&!contiguous(ps[i-1],p))findings.push([p.label,'Gap between periods','Return on average assets needs contiguous opening balances.']);});
 const seen=new Map();for(const p of ps)for(const r of p.rows){const key=r.name.trim().toLowerCase(),old=seen.get(key);if(old&&old.group!==r.group)findings.push([p.label,r.name,`Classification differs from ${old.label}: ${old.group} → ${r.group}.`]);seen.set(key,{group:r.group,label:p.label});}return findings;
}
function renderChecks(ps){
 const findings=evidence(ps);$('checks').innerHTML=`<section class="card"><span class="eyebrow">EVIDENCE & CHECKS</span><h2>Every period, traceable to source</h2>${table(['Period','Source / worksheet','Rows','Days','Debits','Credits','Difference','Ratio groups'],ps.map(p=>{const f=financials(p);return [esc(p.label),esc(p.source+' / '+p.sheet),p.rows.length,days(p),money(f.base.debit),money(f.base.credit),money(f.base.difference),f.ready?'Reviewed':'Needs review'];}))}<h2>Cash-flow evidence</h2>${table(['Period','Operating cash flow','Source'],ps.map(p=>[esc(p.label),Number.isSafeInteger(p.cfo)?money(p.cfo):'Not supplied',esc(p.cfoSource||'Not supplied')]))}<h2>${findings.length} review flags</h2>${findings.length?table(['Period','Account / check','Evidence'],findings.map(r=>r.map(esc))):'<p class="good">No exceptions detected by the available checks.</p>'}<p class="hint">Reconciliation is not an audit. These checks cannot detect omitted or offsetting transactions. CFO is supporting data, not inferred from TBs. Source rows and classifications are included in the export.</p></section>`;
}
function showTab(name){document.querySelectorAll('.tab-panel').forEach(e=>e.hidden=e.id!==name);document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===name);b.setAttribute('aria-pressed',String(b.dataset.tab===name));});}
function beginPeer(){dataset='peer';$('dataset').value=dataset;render();requestedSlot=null;$('file').click();}
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.tab)showTab(b.dataset.tab);if(b.dataset.open)showTab(b.dataset.open);if(b.hasAttribute('data-peer'))beginPeer();if(b.dataset.import!==undefined){requestedSlot=Number(b.dataset.import);$('file').click();}if(b.dataset.review!==undefined){reviewSlot=Number(b.dataset.review);renderReview();showTab('accounts');$('results').scrollIntoView({behavior:'smooth'});}if(b.dataset.remove!==undefined){current().periods[Number(b.dataset.remove)]=null;render();}});
$('dataset').onchange=()=>{dataset=$('dataset').value;render();};$('company').oninput=()=>{current().name=$('company').value;$('result-title').textContent=current().name;renderPeers();};
$('review-period').onchange=()=>{reviewSlot=Number($('review-period').value);renderReview();};$('search').oninput=renderAccounts;
$('confirm-groups').onchange=()=>{const p=review();if(!p)return;if(p.rows.some(r=>r.group==='Unmapped')){message('Map every account to a ratio group before confirming.');$('confirm-groups').checked=false;return;}p.confirmed=$('confirm-groups').checked;message('');render();};
$('save-cfo').onclick=()=>{try{const p=review();if(!p)throw Error('Import a period first.');const text=$('cfo').value.trim(),source=$('cfo-source').value.trim();if(text&&!source)throw Error('Enter a source for the operating cash flow figure.');p.cfo=text?amount(text):null;p.cfoSource=text?source:'';render();message('Cash-flow evidence saved locally.');}catch(e){message(e.message);}};
$('account-table').onchange=e=>{const p=review(),t=e.target;if(!p)return;if(t.dataset.category!==undefined){const r=p.rows[Number(t.dataset.category)];r.category=t.value;r.group=suggestGroup(r);}if(t.dataset.group!==undefined){const r=p.rows[Number(t.dataset.group)];r.group=t.value;if(r.group!=='Unmapped')r.category=groups[r.group];}p.confirmed=false;render();};
function grid(){return XLSX.utils.sheet_to_json(workbook.Sheets[$('sheet').value],{header:1,defval:'',raw:true});}
function setupMapping(){const g=grid(),h=Number($('header-row').value)-1,headers=g[h]||[];for(const type of ['name','debit','credit','category','group']){const s=$('map-'+type);s.innerHTML='<option value="-1">'+(['category','group'].includes(type)?'Suggest from account name':'Select column')+'</option>'+headers.map((x,i)=>`<option value="${i}">${esc(x||'Column '+(i+1))}</option>`).join('');const pattern={name:/account|particular|ledger|name/i,debit:/debit|^dr$/i,credit:/credit|^cr$/i,category:/^category$|classification/i,group:/ratio group|^group$/i}[type];s.value=String(headers.findIndex(x=>pattern.test(String(x))));}$('preview').innerHTML=table(headers.map(String),g.slice(h+1,h+4).map(r=>r.map(esc)));}
async function loadNext(){
 if(!queue.length){$('mapping').hidden=true;workbook=null;return;}const file=queue.shift();try{
 if(file.size>10*1024*1024)throw Error('Choose a file smaller than 10 MB.');if(!/\.(xlsx|xls|xlsm|csv)$/i.test(file.name))throw Error('Choose Excel or CSV files.');
 workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});filename=file.name;$('sheet').innerHTML=workbook.SheetNames.map(n=>`<option>${esc(n)}</option>`).join('');$('header-row').value=1;
 let slot=requestedSlot??data[importTarget].periods.findIndex(p=>!p||p.sample);if(slot<0)slot=0;requestedSlot=null;$('slot').value=String(slot);
 const existing=data[importTarget].periods[slot];$('period-label').value=existing&&!existing.sample?existing.label:'';$('period-start').value=existing&&!existing.sample?existing.start:'';$('period-end').value=existing&&!existing.sample?existing.end:'';
 $('import-source').textContent=`${filename} → ${data[importTarget].name}. ${queue.length} further file(s) queued. An occupied slot is replaced only after Save.`;
 setupMapping();$('mapping').hidden=false;$('mapping').scrollIntoView({behavior:'smooth'});
 }catch(e){message('Import failed: '+e.message);queue=[];workbook=null;$('mapping').hidden=true;}}
function startFiles(files){if(!files.length)return;if(files.length>3){message('Choose no more than three files at a time.');return;}importTarget=dataset;queue=[...files];message('');loadNext();}
$('drop').onclick=()=>{requestedSlot=null;$('file').click();};$('file').onchange=e=>{startFiles(e.target.files);$('file').value='';};
$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('drag');};$('drop').ondragleave=()=>$('drop').classList.remove('drag');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('drag');requestedSlot=null;startFiles(e.dataTransfer.files);};
$('add-peer').onclick=beginPeer;$('sheet').onchange=setupMapping;$('header-row').onchange=setupMapping;
$('analyse').onclick=async()=>{try{
 const mapping={header:Number($('header-row').value)-1};for(const t of ['name','debit','credit','category'])mapping[t]=Number($('map-'+t).value);const g=grid();
 if(!Number.isInteger(mapping.header)||mapping.header<0||mapping.header>=g.length)throw Error('Select a valid header row.');
 if([mapping.name,mapping.debit,mapping.credit].some(x=>x<0)||new Set([mapping.name,mapping.debit,mapping.credit]).size!==3)throw Error('Select three different columns for account, debit, and credit.');
 const result=mapRows(g,mapping);if(result.errors.length)throw Error(result.errors.slice(0,15).map(x=>`Row ${x.row}: ${x.message}`).join('\n'));
 const groupColumn=Number($('map-group').value);for(const row of result.rows){const supplied=String(g[row.sourceRow-1][groupColumn]??'').trim();row.group=Object.keys(groups).find(k=>k.toLowerCase()===supplied.toLowerCase())||suggestGroup(row);if(row.group!=='Unmapped')row.category=groups[row.group];}
 const slot=Number($('slot').value),p={label:$('period-label').value.trim(),start:$('period-start').value,end:$('period-end').value,rows:result.rows,confirmed:false,cfo:null,cfoSource:'',source:filename,sheet:$('sheet').value,sample:false};
 const target=data[importTarget];validatePeriod(p,target.periods.filter((q,i)=>q&&!q.sample&&i!==slot));analyse(p.rows);
 if(target.periods.some(q=>q?.sample)){target.periods=[null,null,null];target.name=importTarget==='company'?'Your company':'Peer company';}target.periods[slot]=p;
 dataset=importTarget;$('dataset').value=dataset;reviewSlot=slot;render();message('Period saved. Review ratio groups and confirm completeness in Review data.');
 if(queue.length)await loadNext();else{$('mapping').hidden=true;workbook=null;showTab('accounts');$('results').scrollIntoView({behavior:'smooth'});}
 }catch(e){message(e.message);}};
$('cancel').onclick=()=>{queue=[];workbook=null;$('mapping').hidden=true;};
$('sample').onclick=()=>{data={company:{name:'Aarohi Enterprises',periods:samplePeriods()},peer:{name:'Illustrative peer',periods:samplePeriods(true)}};dataset='company';$('dataset').value=dataset;reviewSlot=2;queue=[];workbook=null;$('mapping').hidden=true;message('Illustrative data for two companies and three periods. Importing real data replaces sample periods in that dataset.');render();showTab('overview');};
$('template').onclick=()=>{const book=XLSX.utils.book_new();for(const [i,p] of samplePeriods().entries()){XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Account','Debit','Credit','Category','Ratio group'],...p.rows.map(r=>[r.name,r.debit/100,r.credit/100,r.category,r.group])]),`Period ${i+1}`);}XLSX.writeFile(book,'Setu-three-period-template.xlsx');};
$('excel').onclick=()=>{
 if(!ordered('company').length&&!ordered('peer').length)return message('Import data before exporting.');
 const book=XLSX.utils.book_new(),checks=[['Dataset','Period','Account / check','Evidence']],peer=[['Period','Ratio','Company','Peer','Difference','Unit']];
 for(const key of ['company','peer']){const ps=ordered(key);if(!ps.length)continue;
 ps.forEach((p,i)=>{const f=financials(p);const rows=[['Company',data[key].name],['Period',p.label],['Dates',p.start,p.end],['Source',p.source,p.sheet],['Groups reviewed',f.ready?'Yes':'No'],['Operating cash flow',Number.isSafeInteger(p.cfo)?p.cfo/100:'N/A',p.cfoSource],[],['Account','Debit','Credit','Category','Ratio group','Source row'],...p.rows.map(r=>[r.name,r.debit/100,r.credit/100,r.category,r.group,r.sourceRow])];XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),`${key} TB ${i+1}`);checks.push([key,p.label,'Difference',f.base.difference/100]);});
 for(const finding of evidence(ps))checks.push([key,...finding]);
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Ratio',...ps.map(p=>p.label),'Unit','Formula'],...ratioDefinitions.map(([id,label,unit,formula])=>[label,...ps.map((p,i)=>ratios(p,ps[i-1])[id]??'N/A'),unit,formula])]),`${key} ratios`);
 const movement=ps.length>1?accountMovements(ps.at(-1),ps.at(-2)):[];XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Account','Prior net debit','Latest net debit','Change'],...movement.map(r=>[r.name,r.prior/100,r.current/100,r.change/100])]),`${key} drivers`);
 }
 const a=ordered('company'),b=ordered('peer');a.forEach((p,i)=>{const j=b.findIndex(q=>q.start===p.start&&q.end===p.end);if(j<0)return;const x=ratios(p,a[i-1]),y=ratios(b[j],b[j-1]);for(const [id,label,unit] of ratioDefinitions)peer.push([p.label,label,x[id]??'N/A',y[id]??'N/A',x[id]===null||y[id]===null?'N/A':x[id]-y[id],unit]);});
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(checks),'Evidence checks');XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(peer),'Peer comparison');XLSX.writeFile(book,'Setu-three-period-analysis.xlsx');
};
$('print').onclick=()=>window.print();
$('clear').onclick=()=>{data={company:{name:'Your company',periods:[null,null,null]},peer:{name:'Peer company',periods:[null,null,null]}};queue=[];workbook=null;filename='';$('mapping').hidden=true;$('preview').replaceChildren();$('file').value='';render();message('All company and peer trial balances cleared from page memory.');};
render();
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('offline').textContent='Offline ready. All TB analysis, period comparisons, and exports run on this device.';}).catch(()=>{$('offline').textContent='Analysis works locally. Use the local server if offline caching is unavailable.';});
