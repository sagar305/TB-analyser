import {currencies,detectCurrency} from './currency.js';
import {statementAnalysis,waterfall,workingCapital,workingCapitalDefinitions,checks,management} from './analysis.js';
import {barChart} from './charts.js';
import {excelBytes,pdfPack} from './report.js';
import {parseWorkbook} from './workbook-import.js';
import {periodDates} from './importer.js';
import {statements} from './statements.js';
import {detectLayout,importDetected} from './importer.js';
import {categories,mapRows,analyse,amount} from './engine.js';
import {groups,suggestGroup,financials,ratios,ratioDefinitions,ratioReasoning,samplePeriods,validatePeriod,accountMovements,comparable,contiguous,days} from './comparison.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(n,code=data[dataset]?.currency)=>{return new Intl.NumberFormat(code==='INR'?'en-IN':'en-US',{...(code?{style:'currency',currency:code,currencyDisplay:'code'}:{}),minimumFractionDigits:2,maximumFractionDigits:2}).format((n||0)/100);};
const number=(v,unit='')=>v===null||v===undefined?'N/A':`${v.toLocaleString('en-IN',{maximumFractionDigits:2})}${unit==='days'?' days':unit}`;
const message=s=>{$('message').textContent=s;};
let data={company:{name:'Your company',periods:[null,null,null]},peer:{name:'Peer company',periods:[null,null,null]}};
let trendMetric='revenue',analysisMode='values',analysisStatement='pl';
let dataset='company',reviewSlot=2,workbook=null,filename='',queue=[],importTarget='company',requestedSlot=null;
let detected=null,groupOverrides={};const currencyChoices={};
let batchResults=[];
try{$('year-start').value=localStorage.getItem('setu-year-start')||'4';}catch{}
$('year-start').onchange=()=>{const month=Number($('year-start').value);try{localStorage.setItem('setu-year-start',String(month));}catch{}for(const item of Object.values(data))for(const p of item.periods.filter(Boolean))if(p.autoMapped&&!p.datesExplicit){Object.assign(p,periodDates(p.label,month));p.importWarnings=(p.importWarnings||[]).map(w=>w.startsWith('Financial-year start')?`Financial-year start assumed from workspace setting: month ${month}.`:w);}render();};
function acceptWorkbook(result){
 let key=Object.keys(data).find(k=>data[k].name===result.name);
 if(importTarget==='peer')key='peer';
 if(!key){key=data.company.periods.every(p=>!p||p.sample)?'company':'client_'+crypto.randomUUID();}
 const old=data[key];
 if(old&&old.name===result.name&&old.currency&&result.currency&&old.currency!==result.currency)throw Error('Currency differs from the existing client. No data was replaced.');
 let ps=result.periods;
 if(ps.length===1&&old?.name===result.name){ps=[...old.periods.filter(p=>p&&p.end!==ps[0].end),...ps].sort((a,b)=>a.end.localeCompare(b.end));if(ps.length>3)throw Error('This client already has three different periods. Remove a period before importing another.');}
 data[key]={...result,periods:[...ps,...Array(3-ps.length).fill(null)]};dataset=key;reviewSlot=ps.length-1;
 const unmapped=result.periods.reduce((n,p)=>n+p.rows.filter(r=>r.group==='Unmapped').length,0);
 batchResults.push(`${result.name}: ${result.periods.length} period(s), ${result.currency||'currency unspecified'}, ${result.periods[0].rows.length} accounts in the first period. ${unmapped?`${unmapped} account classifications need review; figures were imported. Open Review data to map them.`:'All accounts have suggested groups; review before relying on the statements.'}`);
}
$('currency').innerHTML='<option value="">Select currency</option>'+currencies.map(c=>'<option>'+c+'</option>').join('');
$('currency').onchange=()=>{current().currency=$('currency').value;currencyChoices[dataset]=current().currency;render();};
function requireCurrency(){const c=$('currency').value;if(!currencies.includes(c))throw Error('Select the reporting currency above before importing.');data[importTarget].currency=c;return c;}
function renderDetected(){
 const ps=importDetected(grid(),detected,{source:filename,sheet:$('sheet').value,startMonth:Number($('fiscal-start').value),overrides:groupOverrides});
 $('auto-summary').textContent=`${filename} · ${$('sheet').value}: ${ps.length} periods and ${ps[0].rows.length} accounts detected. Importing replaces the three slots for ${data[importTarget].name}.`;
 $('auto-periods').innerHTML=table(['Period','Start','End','Debit column','Credit column','TB difference'],ps.map((p,i)=>[esc(p.label),p.start,p.end,esc(grid()[detected.header][detected.periods[i].debit]),esc(grid()[detected.header][detected.periods[i].credit]),money(analyse(p.rows).difference,$('currency').value)]));
 $('auto-accounts').innerHTML=table(['GL code','Account','Statement','Suggested ratio group'],ps[0].rows.map(r=>[esc(r.code),esc(r.name),esc(r.statement),`<select data-auto-group="${r.sourceRow}" aria-label="Import group for ${esc(r.name)}">${Object.keys(groups).map(g=>`<option${g===r.group?' selected':''}>${esc(g)}</option>`).join('')}</select>`]));
}
$('fiscal-start').onchange=()=>{try{renderDetected();}catch(e){message(e.message);}};
$('auto-accounts').onchange=e=>{if(e.target.dataset.autoGroup){groupOverrides[e.target.dataset.autoGroup]=e.target.value;$('auto-confirm').checked=false;}};
$('auto-save').onclick=async()=>{try{
 const ps=importDetected(grid(),detected,{source:filename,sheet:$('sheet').value,startMonth:Number($('fiscal-start').value),overrides:groupOverrides,confirmed:$('auto-confirm').checked});
 ps.forEach((p,i)=>{validatePeriod(p,ps.filter((_,j)=>i!==j));analyse(p.rows);});
 if($('auto-confirm').checked&&ps.some(p=>!p.confirmed))throw Error('Resolve unmapped groups before confirming, or uncheck the review confirmation to import for later review.');
 requireCurrency();const target=data[importTarget];target.periods=[...ps,...Array(3-ps.length).fill(null)];if(target.name==='Aarohi Enterprises'||target.name==='Illustrative peer')target.name=importTarget==='company'?'Your company':'Peer company';
 dataset=importTarget;$('dataset').value=dataset;reviewSlot=ps.length-1;$('auto-import').hidden=true;detected=null;render();showTab('accounts');
 message(`Imported ${ps.length} periods together. ${ps.every(p=>p.confirmed)?'Reviewed classifications applied.':'Confirm classifications under Review data to enable statements and ratios.'}`);
 if(queue.length)await loadNext();else{workbook=null;$('results').scrollIntoView({behavior:'smooth'});}
 }catch(e){message(e.message);}};
$('auto-manual').onclick=()=>{$('auto-import').hidden=true;detected=null;setupMapping();$('mapping').hidden=false;};
$('auto-cancel').onclick=()=>{$('auto-import').hidden=true;detected=null;queue=[];workbook=null;};
const current=()=>data[dataset];
const ordered=(key=dataset)=>data[key].periods.filter(Boolean).sort((a,b)=>a.end.localeCompare(b.end));
const review=()=>current().periods[reviewSlot];
function table(headers,body){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function valueTable(ps,defs){return table(['Metric',...ps.map(p=>p.label)],defs.map(([label,get,fmt=money])=>[esc(label),...ps.map((p,i)=>fmt(get(p,i)))]));}
function metric(label,value,note){return `<div class="metric"><label>${label}</label><b>${value}</b><small>${note}</small></div>`;}
function status(p){const f=financials(p);return `${f.base.balanced?'Balanced':'Out of balance'} · ${p.confirmed?'Groups reviewed':f.ready?'Suggested groups · draft':'Review groups'}`;}
function render(){
 $('dataset').innerHTML=Object.entries(data).map(([key,item])=>`<option value="${key}"${key===dataset?' selected':''}>${key==='peer'?'Peer: ':''}${esc(item.name)}</option>`).join('');
 const ps=ordered();$('currency').value=current().currency||'';document.querySelectorAll('.currency-label').forEach(e=>e.textContent=current().currency||'select currency');$('company').value=current().name;
 $('period-slots').innerHTML=current().periods.map((p,i)=>`<div class="period-slot"><span class="eyebrow">PERIOD ${i+1}</span><h3>${esc(p?.label||'Add a trial balance')}</h3><small>${p?esc(p.start+' → '+p.end):'Separate file or workbook sheet'}</small><p>${p?esc(status(p)):'Ready for your data'}</p><button data-import="${i}">${p?'Replace TB':'Import TB'}</button>${p?` <button data-review="${i}">Review</button> <button data-remove="${i}" aria-label="Remove period ${i+1}">×</button>`:''}</div>`).join('');
 $('result-title').textContent=current().name;$('data-label').textContent=ps.some(p=>p.sample)?'ILLUSTRATIVE RESULT':ps.some(p=>!p.confirmed)?'DRAFT · AUTOMATIC CLASSIFICATIONS — REVIEW BEFORE RELYING':'YOUR TRIAL BALANCES';
 $('source').textContent=`${ps.length} of 3 periods · ${current().currency||'Currency not selected'} · ${ps.map(p=>p.label).join(' / ')}`;
 $('balance-badge').textContent=ps.length?`${ps.filter(p=>analyse(p.rows).balanced).length}/${ps.length} periods reconcile`:'No periods imported';
 renderOverview(ps);renderDrivers(ps);renderPeers();renderReview();renderChecks(ps);renderAnalysis(ps);renderWorkingCapital(ps);renderManagement(ps);
}
function renderTrend(ps){
 const label={revenue:'Revenue',ebitda:'EBITDA',profit:'Profit after tax',assets:'Total assets'}[trendMetric];
 return barChart(ps.map(p=>({label:p.label,value:financials(p).ready?financials(p)[trendMetric]:null})),{label:`${label} · ${current().currency||'currency unspecified'}`,format:v=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(v/100)});
}
function renderAnalysis(ps){
 const rows=statementAnalysis(ps,analysisStatement),format=v=>v===null?'N/A':money(v);
 $('financial-analysis').innerHTML=`<section class="card"><span class="eyebrow">FINANCIAL ANALYSIS</span><h2>Trends, variances & common size</h2><div class="chart-controls"><label>Statement <select id="analysis-statement"><option value="pl">Profit & Loss</option><option value="bs">Balance Sheet</option></select></label><label>View <select id="analysis-mode"><option value="values">Three-period amounts</option><option value="variance">Absolute variance</option><option value="percent">Percentage variance</option><option value="common">Common size</option></select></label></div><p class="hint">Variances compare each period with its predecessor. Percentage changes require a positive prior baseline. Common size uses revenue for P&L and total assets for Balance Sheet. Different durations are not like-for-like.</p>${table(['Particulars',...ps.map(p=>p.label)],rows.map(r=>[esc(r.label),...ps.map((p,i)=>analysisMode==='values'?format(r.values[i]):analysisMode==='variance'?format(r.changes[i].change):number(analysisMode==='common'?r.commonSize[i]:r.changes[i].percent,'%'))]))}</section><section class="card ratio-snapshot"><h2>EBITDA waterfall · latest versus prior</h2><p>Each contribution bridges prior EBITDA to latest EBITDA; cost increases reduce earnings.</p>${barChart(waterfall(ps.at(-1),ps.at(-2)),{waterfall:true,label:`EBITDA bridge · ${current().currency||'currency unspecified'}`,format:v=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(v/100)})}${table(['Step','Contribution / total','Running EBITDA'],waterfall(ps.at(-1),ps.at(-2)).map(x=>[esc(x.label),money(x.value),money(x.end)]))}</section>`;
 $('analysis-statement').value=analysisStatement;$('analysis-mode').value=analysisMode;
 $('analysis-statement').onchange=e=>{analysisStatement=e.target.value;renderAnalysis(ordered());};
 $('analysis-mode').onchange=e=>{analysisMode=e.target.value;renderAnalysis(ordered());};
}
function renderWorkingCapital(ps){
 const wc=ps.map(workingCapital);
 $('working-capital').innerHTML=`<section class="card"><span class="eyebrow">WORKING CAPITAL</span><h2>Cash, collections & payment capacity</h2>${table(['Metric',...ps.map(p=>p.label),'Latest movement'],workingCapitalDefinitions.map(([id,label])=>[esc(label),...wc.map(w=>w[id]===null?'N/A':money(w[id])),wc.length<2||wc.at(-1)[id]===null||wc.at(-2)[id]===null?'N/A':money(wc.at(-1)[id]-wc.at(-2)[id])]))}${barChart(ps.map((p,i)=>({label:p.label,value:wc[i].operating})),{label:'Operating working capital',format:v=>money(v)})}<p class="hint">Rising operating working capital indicates more funds in receivables and stock net of supplier funding. It is not a measured cash outflow: acquisitions, non-cash entries and currency effects may also change balances. TB totals do not establish overdue ageing or inventory obsolescence.</p></section><section class="card ratio-snapshot"><h2>Liquidity & cash cycle</h2>${ratioTable(ps,ratioDefinitions.filter(([id])=>['current','quick','receivable','inventory','payable','cycle'].includes(id)))}</section>`;
}
function renderManagement(ps){
 const findings=management(ps);
 $('management-insights').innerHTML=`<section class="card"><span class="eyebrow">MANAGEMENT REVIEW</span><h2>Findings grounded in your TB</h2><p class="hint">Deterministic rules, no AI. Screening uses 5% of prior revenue for account movements, 1 percentage point for margins and 5 days for the cash cycle components. These thresholds are review prompts, not audit or lending conclusions. Evidence amounts use ${esc(current().currency||'the selected currency')}.</p>${findings.map(f=>`<article class="finding"><span class="pill">${esc(f.severity)}</span><h3>${esc(f.title)}</h3><p>${esc(f.evidence)}</p></article>`).join('')||'<p>Import data to generate findings.</p>'}</section>`;
 $('management-questions').innerHTML=`<section class="card"><span class="eyebrow">MANAGEMENT QUESTIONS</span><h2>Questions for the financial review</h2>${findings.map(f=>`<article class="finding"><strong>${esc(f.title)} · ${esc(f.period)}</strong><p>${esc(f.question)}</p><details><summary>Supporting evidence</summary><p>${esc(f.evidence)}</p></details></article>`).join('')||'<p>Import data to generate questions.</p>'}</section>`;
}
function renderOverview(ps){
 if(!ps.length){$('overview').innerHTML='<section class="card empty">Import a trial balance using a period slot above.</section>';return;}
 const last=ps.at(-1),f=financials(last),rr=ratios(last,ps.at(-2));
 $('overview').innerHTML=`<div class="metrics">${metric('Revenue',f.ready?money(f.revenue):'Review groups',esc(last.label)+' · growth '+number(rr.growth,'%'))}${metric('EBITDA margin',number(rr.ebitda,'%'),'From mapped accounts · draft until confirmed')}${metric('Cash conversion cycle',number(rr.cycle,'days'),'Closing balances · sales/COGS proxies')}${metric('Operating cash flow',Number.isSafeInteger(last.cfo)&&last.cfoSource?.trim()?money(last.cfo):'Not supplied','From supporting cash-flow evidence')}</div><div class="columns"><section class="card"><span class="eyebrow">WHAT CHANGED</span><h2>Three-period performance</h2>${valueTable(ps,[['Revenue',p=>financials(p).ready?financials(p).revenue:null,v=>v===null?'Review groups':money(v)],['EBITDA',p=>financials(p).ready?financials(p).ebitda:null,v=>v===null?'Review groups':money(v)],['Provisional PAT',p=>financials(p).base.profit],['Total debits',p=>financials(p).base.debit],['Total credits',p=>financials(p).base.credit]])}${ps.map(p=>{const f=financials(p),max=Math.max(1,...ps.map(x=>Math.abs(financials(x).base.profit)));return `<div class="bar-row"><div class="bar-label"><span>${esc(p.label)} · ${f.base.profit<0?'loss':'profit'}</span><strong>${money(f.base.profit)}</strong></div><div class="bar-track"><progress aria-label="Profit magnitude ${esc(p.label)}" max="${max}" value="${Math.abs(f.base.profit)}"></progress></div></div>`;}).join('')}</section><section class="card"><span class="eyebrow">WHY IT CHANGED</span><h2>Decision-ready insights</h2>${insights(ps)}<button data-open="drivers">See all drivers →</button></section></div><section class="card ratio-snapshot"><span class="eyebrow">RATIO SNAPSHOT</span><h2>Health indicators</h2>${ratioTable(ps,ratioDefinitions.filter(([id])=>['growth','ebitda','current','debt','cfo'].includes(id)))}</section>`;
 const unresolved=ps.reduce((n,p)=>n+p.rows.filter(r=>r.group==='Unmapped').length,0);
 if(unresolved)$('overview').insertAdjacentHTML('afterbegin',`<section class="card"><h2>Figures imported · ${unresolved} classifications need review</h2><p>Your debit and credit figures have been read. Complete the account groups to calculate full statements; unknown balances are not assumed to be zero.</p><button data-open="accounts">Review imported accounts</button></section>`);
 $('overview').insertAdjacentHTML('beforeend', '<section class="card ratio-snapshot"><h2>Interactive financial trends</h2><label>Metric <select id="trend-metric"><option value="revenue">Revenue</option><option value="ebitda">EBITDA</option><option value="profit">Profit after tax</option><option value="assets">Total assets</option></select></label><div id="trend-chart">'+renderTrend(ps)+'</div><p class="hint">Hover or focus a bar for the exact amount. Full figures appear in the statements.</p></section>');
 $('trend-metric').value=trendMetric;$('trend-metric').onchange=e=>{trendMetric=e.target.value;$('trend-chart').innerHTML=renderTrend(ordered());};
}
function insights(ps){
 const last=ps.at(-1),prior=ps.at(-2),f=financials(last),rr=ratios(last,prior);
 const items=[['Reconciliation',`${ps.filter(p=>financials(p).base.balanced).length} of ${ps.length} periods balance. Latest difference: ${money(f.base.difference)}.`]];
 if(prior){const old=financials(prior);items.push(['Profit movement',`${money(f.base.profit-old.base.profit)} change versus ${prior.label}. ${!comparable(prior,last)?'Durations differ; raw change is not like-for-like.':''}`]);if(f.ready&&old.ready){items.push(['Revenue movement',`${money(f.revenue-old.revenue)} change; growth ${number(rr.growth,'%')}. Evidence: ${money(old.revenue)} → ${money(f.revenue)}.`]);items.push(['Margin movement',`EBITDA margin ${number(ratios(prior,ps.at(-3)).ebitda,'%')} → ${number(rr.ebitda,'%')}. Review cost and income movements in Drivers & ratios.`]);}}
 else items.push(['Add prior periods','Import two more periodic TBs for trends.']);
 items.push(['Classification coverage',`${ps.filter(p=>p.confirmed).length} of ${ps.length} periods have confirmed ratio groups; other complete mappings are provisional. Unavailable ratios are shown as N/A.`]);
 return items.map(([title,text])=>`<div class="finding"><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`).join('');
}
function ratioTable(ps,defs=ratioDefinitions){
 const rr=ps.map((p,i)=>ratios(p,ps[i-1]));
 return table(['Ratio',...ps.map(p=>p.label),'Latest change','What this tells you'],defs.map(([id,label,unit])=>{const a=rr.at(-1)?.[id],b=rr.at(-2)?.[id];return [esc(label),...rr.map(r=>number(r[id],unit)),a==null||b==null?'N/A':number(a-b,unit==='%'?' pp':unit),esc(ratioReasoning[id])];}));
}
function renderDrivers(ps){
 const latest=ps.at(-1),prior=ps.at(-2),moves=latest?accountMovements(latest,prior):[];
 const bridge=latest&&prior?categories.map(c=>{const a=financials(prior).base.totals[c],b=financials(latest).base.totals[c];return [c,money(a),money(b),money(b-a)];}):[];
 $('drivers').innerHTML=`<section class="card"><span class="eyebrow">DRIVERS & RATIOS</span><h2>Understand the movement</h2><p>Every ratio from the reference, across ${ps.length} imported periods. Review and confirm ratio groups in Review data to enable calculations.</p>${ratioTable(ps)}<p class="hint">N/A means a missing input, unreviewed group, non-positive denominator, or incomparable duration. Return on average assets also needs a contiguous opening period. Day ratios use closing balances and actual period days (365 for a normal year). CFO/PAT needs separately entered operating cash flow and its source. Ratios are provisional if the TB does not reconcile.</p></section><section class="card ratio-snapshot"><h2>Category movements · latest versus prior</h2>${bridge.length?table(['Category','Prior net debit','Latest net debit','Change'],bridge):'<p>Add a second period to compare movements.</p>'}<h2>Account movement evidence</h2><p class="hint">Matched by trimmed, case-insensitive account name; duplicate names are aggregated. Renamed accounts appear separately. Net debit movement provides evidence, not an inferred business cause.</p>${moves.length?table(['Account','Prior','Latest','Change'],moves.map(r=>[esc(r.name),money(r.prior),money(r.current),money(r.change)])):'<p>No comparison available yet.</p>'}</section>`;
}
function renderPeers(){
 const companyKey=dataset==='peer'?'company':dataset,company=data[companyKey],a=ordered(companyKey),b=ordered('peer');
 if(!a.length||!b.length){$('peers').innerHTML='<section class="card empty"><span class="eyebrow">PEER COMPARISON</span><h2>Bring your own benchmark</h2><p>Import peer TBs using Add peer TBs. Nothing is fetched online. Matching reporting periods will be compared with your company.</p><button data-peer class="primary">Add peer TBs</button></section>';return;}
 const matches=a.map((p,i)=>({p,i,j:b.findIndex(q=>q.start===p.start&&q.end===p.end)})).filter(x=>x.j>=0);
 $('peers').innerHTML=`<section class="card"><span class="eyebrow">PEER COMPARISON</span><h2>${esc(company.name)} vs ${esc(data.peer.name)}</h2><p>Only identical start and end dates are compared. Both companies use the same formulas. Currency: ${esc(company.currency||'not selected')} / ${esc(data.peer.currency||'not selected')}. No currency conversion is performed. ${matches.length} matched period(s).</p>${!matches.length?'<p>No dates match yet. Import peer TBs for the same reporting periods.</p>':''}${matches.map(({p,i,j})=>{const q=b[j],r1=ratios(p,a[i-1]),r2=ratios(q,b[j-1]);return `<h3>${esc(p.label)} · ${esc(p.start)} → ${esc(p.end)}</h3>${table(['Metric',company.name,data.peer.name,'Difference (company − peer)'],ratioDefinitions.map(([id,label,unit])=>[esc(label),number(r1[id],unit),number(r2[id],unit),r1[id]===null||r2[id]===null?'N/A':number(r1[id]-r2[id],unit==='%'?' pp':unit)]))}`;}).join('')}<p class="hint">Differences do not automatically imply better or worse. Business models and accounting policies may differ. Figures require human review.</p></section>`;
}
function renderStatements(){
 const ps=ordered(),records=ps.map(statements);
 const sections=[['pl','Profit & Loss','Period income and expenses. Expense lines are deductions; figures remain provisional until classifications and adjustments are reviewed.'],['bs','Balance Sheet','Closing assets, liabilities, and equity. Unclosed P&L is shown separately from mapped reserves to reconcile the TB; equity ratios use the same closing equity including unclosed P&L.'],['cf','Cash Flow Statement','Supporting cash-flow figures, entered below with their source. Missing inputs are shown as Not supplied, never assumed to be zero.']];
 $('statement-tables').innerHTML=sections.map(([key,title,note])=>`<section class="card statement-card"><span class="eyebrow">REVIEW DATA · ${esc(current().currency||'Currency not selected')}</span><h2>${title}</h2><p class="hint">${note}</p>${ps.length?table(['Particulars',...ps.map(p=>p.label)],records[0][key].map(([label],i)=>[esc(label),...records.map(r=>r[key][i][1]===null?(key==='cf'?'Not supplied':'Review classifications'):money(r[key][i][1]))])):'<p>Import a reporting period to populate this statement.</p>'}</section>`).join('');
}
function renderReview(){
 renderStatements();
 const slots=current().periods.map((p,i)=>({p,i})).filter(x=>x.p);if(!review())reviewSlot=slots.at(-1)?.i??0;
 $('review-period').innerHTML=slots.map(({p,i})=>`<option value="${i}"${i===reviewSlot?' selected':''}>${esc(p.label)}</option>`).join('');
 $('confirm-groups').checked=!!review()?.confirmed;$('confirm-groups').disabled=!review();
 $('edit-period-label').value=review()?.label||'';$('edit-period-start').value=review()?.start||'';$('edit-period-end').value=review()?.end||'';
 $('cfo').value=Number.isSafeInteger(review()?.cfo)?String(review().cfo/100):'';$('cfo-source').value=review()?.cfoSource||'';for(const key of ['investing','financing','opening','closing','fx'])$('cf-'+key).value=Number.isSafeInteger(review()?.cashFlow?.[key])?String(review().cashFlow[key]/100):'';renderAccounts();
}
function renderAccounts(){
 const p=review(),query=$('search').value.toLowerCase();if(!p){$('account-table').innerHTML='<p>No period loaded.</p>';return;}
 $('account-table').innerHTML=table(['Row','GL code','Department','Account','Debit','Credit','Category','Ratio group'],p.rows.map((r,i)=>({r,i})).filter(({r})=>r.name.toLowerCase().includes(query)).map(({r,i})=>[r.sourceRow,esc(r.code),esc(r.department),esc(r.name),money(r.debit),money(r.credit),`<select data-category="${i}" aria-label="Category for ${esc(r.name)}">${categories.map(c=>`<option${c===r.category?' selected':''}>${c}</option>`).join('')}</select>`,`<select data-group="${i}" aria-label="Ratio group for ${esc(r.name)}">${Object.keys(groups).map(g=>`<option${g===r.group?' selected':''}>${esc(g)}</option>`).join('')}</select>`]));
}
function evidence(ps){return checks(ps).filter(c=>c.severity!=='Pass').map(c=>[c.period,c.severity+' · '+c.subject,c.detail]);}
function renderChecks(ps){
 const findings=evidence(ps);$('checks').innerHTML=`<section class="card"><span class="eyebrow">EVIDENCE & CHECKS</span><h2>Every period, traceable to source</h2>${table(['Period','Source / worksheet','Rows','Days','Debits','Credits','Difference','Ratio groups'],ps.map(p=>{const f=financials(p);return [esc(p.label),esc(p.source+' / '+p.sheet),p.rows.length,days(p),money(f.base.debit),money(f.base.credit),money(f.base.difference),p.confirmed?'Reviewed':'Suggested — needs review'];}))}<h2>Cash-flow evidence</h2>${table(['Period','Operating cash flow','Source'],ps.map(p=>[esc(p.label),Number.isSafeInteger(p.cfo)?money(p.cfo):'Not supplied',esc(p.cfoSource||'Not supplied')]))}<h2>${findings.length} review flags</h2>${findings.length?table(['Period','Account / check','Evidence'],findings.map(r=>r.map(esc))):'<p class="good">No exceptions detected by the available checks.</p>'}<p class="hint">Reconciliation is not an audit. These checks cannot detect omitted or offsetting transactions. CFO is supporting data, not inferred from TBs. Source rows and classifications are included in the export.</p></section>`;
}
function showTab(name){document.querySelectorAll('.tab-panel').forEach(e=>e.hidden=e.id!==name);document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===name);b.setAttribute('aria-pressed',String(b.dataset.tab===name));});}
function beginPeer(){dataset='peer';$('dataset').value=dataset;render();requestedSlot=null;$('file').click();}
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.tab)showTab(b.dataset.tab);if(b.dataset.open){showTab(b.dataset.open);if(b.dataset.open==='accounts')document.querySelector('.classification-panel').open=true;}if(b.hasAttribute('data-peer'))beginPeer();if(b.dataset.import!==undefined){requestedSlot=Number(b.dataset.import);$('file').click();}if(b.dataset.review!==undefined){reviewSlot=Number(b.dataset.review);renderReview();showTab('accounts');document.querySelector('.classification-panel').open=true;$('results').scrollIntoView({behavior:'smooth'});}if(b.dataset.remove!==undefined){current().periods[Number(b.dataset.remove)]=null;render();}});
$('dataset').onchange=()=>{dataset=$('dataset').value;render();};$('company').oninput=()=>{current().name=$('company').value;$('result-title').textContent=current().name;renderPeers();};
$('review-period').onchange=()=>{reviewSlot=Number($('review-period').value);renderReview();};$('search').oninput=renderAccounts;
$('save-period-dates').onclick=()=>{try{const p=review();if(!p)throw Error('Import a period first.');const next={...p,label:$('edit-period-label').value.trim(),start:$('edit-period-start').value,end:$('edit-period-end').value};validatePeriod(next,current().periods.filter(x=>x&&x!==p));Object.assign(p,next,{datesExplicit:true,confirmed:false});p.importWarnings=(p.importWarnings||[]).filter(w=>!w.startsWith('Financial-year start'));render();message('Period dates updated. Reconfirm classifications and period completeness.');}catch(e){message(e.message);}};
$('confirm-groups').onchange=()=>{const p=review();if(!p)return;if(p.rows.some(r=>r.group==='Unmapped')){message('Map every account to a ratio group before confirming.');$('confirm-groups').checked=false;return;}p.confirmed=$('confirm-groups').checked;message('');render();};
$('save-cfo').onclick=()=>{try{
 const p=review();if(!p)throw Error('Import a period first.');
 const text=$('cfo').value.trim(),source=$('cfo-source').value.trim(),cashFlow={};
 for(const key of ['investing','financing','opening','closing','fx']){const value=$('cf-'+key).value.trim();cashFlow[key]=value?amount(value):null;}
 const cfo=text?amount(text):null;
 if((cfo!==null||Object.values(cashFlow).some(v=>v!==null))&&!source)throw Error('Enter a source for the cash-flow figures.');
 p.cfo=cfo;p.cfoSource=source;p.cashFlow=cashFlow;render();message('Cash-flow evidence saved locally.');
 }catch(e){message(e.message);}};
$('account-table').onchange=e=>{const p=review(),t=e.target;if(!p)return;if(t.dataset.category!==undefined){const r=p.rows[Number(t.dataset.category)];r.category=t.value;r.group=suggestGroup(r);}if(t.dataset.group!==undefined){const r=p.rows[Number(t.dataset.group)];r.group=t.value;r.category=groups[r.group];}p.confirmed=false;render();};
function grid(){return XLSX.utils.sheet_to_json(workbook.Sheets[$('sheet').value],{header:1,defval:'',raw:true});}
function setupMapping(){const g=grid(),h=Number($('header-row').value)-1,headers=g[h]||[];for(const type of ['name','debit','credit','category','group']){const s=$('map-'+type);s.innerHTML='<option value="-1">'+(['category','group'].includes(type)?'Suggest from account name':'Select column')+'</option>'+headers.map((x,i)=>`<option value="${i}">${esc(x||'Column '+(i+1))}</option>`).join('');const pattern={name:/account|particular|ledger|name/i,debit:/debit|^dr$/i,credit:/credit|^cr$/i,category:/^category$|classification/i,group:/ratio group|^group$/i}[type];s.value=String(headers.findIndex(x=>pattern.test(String(x))));}$('preview').innerHTML=table(headers.map(String),g.slice(h+1,h+4).map(r=>r.map(esc)));}
async function loadNext(){
 if(!queue.length){$('mapping').hidden=true;workbook=null;render();showTab('overview');message(batchResults.join('\n'));return;}const file=queue.shift();try{
 if(file.size>10*1024*1024)throw Error('Choose a file smaller than 10 MB.');if(!/\.(xlsx|xls|xlsm|csv)$/i.test(file.name))throw Error('Choose Excel or CSV files.');
 workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false,cellNF:true});filename=file.name;const currencyResult=detectCurrency(workbook);$('currency').value=currencyResult.currency||currencyChoices[importTarget]||'';$('currency-note').textContent=currencyResult.reason+' No exchange-rate conversion is performed.';$('sheet').innerHTML=workbook.SheetNames.map(n=>`<option>${esc(n)}</option>`).join('');$('header-row').value=1;
 if(currencyResult.reason.startsWith('Multiple'))throw Error('Conflicting currency labels found; separate currencies before importing.');
 const parsed=parseWorkbook(workbook.SheetNames.map(name=>({name,grid:XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:'',raw:true})})),{source:filename,currency:currencyResult.currency||currencyChoices[importTarget]||null,startMonth:Number($('year-start').value)});
 if(parsed){acceptWorkbook(parsed);$('mapping').hidden=true;$('auto-import').hidden=true;requestedSlot=null;await loadNext();return;}
 let slot=requestedSlot??data[importTarget].periods.findIndex(p=>!p||p.sample);if(slot<0)slot=0;requestedSlot=null;$('slot').value=String(slot);
 const existing=data[importTarget].periods[slot];$('period-label').value=existing&&!existing.sample?existing.label:'';$('period-start').value=existing&&!existing.sample?existing.start:'';$('period-end').value=existing&&!existing.sample?existing.end:'';
 $('import-source').textContent=`${filename} → ${data[importTarget].name}. ${queue.length} further file(s) queued. An occupied slot is replaced only after Save.`;
 $('auto-import').hidden=true;$('mapping').hidden=true;detected=null;groupOverrides={};
 for(const sheet of workbook.SheetNames){const candidate=XLSX.utils.sheet_to_json(workbook.Sheets[sheet],{header:1,defval:'',raw:true});const layout=detectLayout(candidate);if(layout){detected=layout;$('sheet').value=sheet;break;}}
 if(detected){$('auto-confirm').checked=false;renderDetected();$('auto-import').hidden=false;$('auto-import').scrollIntoView({behavior:'smooth'});return;}
 setupMapping();$('mapping').hidden=false;$('mapping').scrollIntoView({behavior:'smooth'});
 }catch(e){batchResults.push(`${file.name}: import failed — ${e.message}`);workbook=null;$('mapping').hidden=true;await loadNext();}}
function startFiles(files){if(!files.length)return;if(files.length>20){message('Choose no more than 20 files at a time.');return;}importTarget=dataset;queue=[...files];batchResults=[];message('Reading workbooks locally…');loadNext();}
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
 const target=data[importTarget];validatePeriod(p,target.periods.filter((q,i)=>q&&!q.sample&&i!==slot));analyse(p.rows);if(target.periods.some((q,i)=>q&&!q.sample&&i!==slot)&&target.currency!==$('currency').value)throw Error('This dataset already contains another currency. Use a separate dataset, or explicitly correct its Reporting currency first.');requireCurrency();
 if(target.periods.some(q=>q?.sample)){target.periods=[null,null,null];target.name=importTarget==='company'?'Your company':'Peer company';}target.periods[slot]=p;
 dataset=importTarget;$('dataset').value=dataset;reviewSlot=slot;render();message('Period saved. Review ratio groups and confirm completeness in Review data.');
 if(queue.length)await loadNext();else{$('mapping').hidden=true;workbook=null;showTab('accounts');document.querySelector('.classification-panel').open=true;$('results').scrollIntoView({behavior:'smooth'});}
 }catch(e){message(e.message);}};
$('cancel').onclick=()=>{queue=[];workbook=null;$('mapping').hidden=true;};
$('sample').onclick=()=>{data={company:{name:'Aarohi Enterprises',currency:'INR',periods:samplePeriods()},peer:{name:'Illustrative peer',currency:'INR',periods:samplePeriods(true)}};dataset='company';$('dataset').value=dataset;reviewSlot=2;queue=[];workbook=null;$('mapping').hidden=true;message('Illustrative data for two companies and three periods. Importing real data replaces sample periods in that dataset.');render();showTab('overview');};
$('template').onclick=()=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Entity','Your company'],['Currency','USD'],['Instructions','Replace illustrative accounts and amounts with your TB. Enter the appropriate currency. Years use your workspace financial-year setting.']]),'Read Me');for(const p of samplePeriods()){XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Account name','Debit','Credit','Ratio group'],...p.rows.map(r=>[r.name,r.debit/100,r.credit/100,r.group])]),p.end.slice(0,4));}XLSX.writeFile(book,'Setu-three-period-template.xlsx');message('Template contains illustrative balances. Replace them with actual TB figures and set the currency before importing.');};
$('excel').onclick=async()=>{const button=$('excel');button.disabled=true;try{const bytes=await excelBytes(XLSX,JSZip,data);saveDownload(bytes,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Setu-financial-review.xlsx');message('Excel review pack exported with statements, analysis, insights, questions and source TBs.');}catch(e){message('Excel export failed: '+e.message);}finally{button.disabled=false;}};
function saveDownload(bytes,type,name){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('print').onclick=async()=>{const button=$('print');button.disabled=true;try{const bytes=await pdfPack(PDFLib,data),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download='Setu-financial-review.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);message('Complete PDF review pack exported locally.');}catch(e){message('PDF export failed: '+e.message);}finally{button.disabled=false;}};
$('clear').onclick=()=>{data={company:{name:'Your company',periods:[null,null,null]},peer:{name:'Peer company',periods:[null,null,null]}};queue=[];workbook=null;filename='';detected=null;groupOverrides={};$('auto-import').hidden=true;$('auto-accounts').replaceChildren();$('auto-periods').replaceChildren();$('mapping').hidden=true;$('preview').replaceChildren();$('file').value='';dataset='company';render();message('All company and peer trial balances cleared from page memory.');};
render();
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('offline').textContent='Offline ready. All TB analysis, period comparisons, and exports run on this device.';}).catch(()=>{$('offline').textContent='Analysis works locally. Use the local server if offline caching is unavailable.';});





