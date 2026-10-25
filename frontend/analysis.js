import {financials, ratios, comparable, accountMovements} from './comparison.js';
import {statements} from './statements.js';

export function analysisView(periods, requested='values') {
  const canCompare=periods.length>1;
  const mode=['values','common','variance','percent'].includes(requested)&&
    (canCompare||!['variance','percent'].includes(requested))?requested:'values';
  return {mode,canCompare,needsReview:periods.filter(p=>!financials(p).ready).map(p=>p.label)};
}
export function variance(value, prior) {
  if(value === null || prior === null) return {change:null,percent:null};
  return {change:value-prior,percent:prior>0?(value-prior)/prior*100:null};
}
export function statementAnalysis(periods, key) {
  if(!periods.length) return [];
  const records=periods.map(statements);
  return records[0][key].map(([label],index)=>{
    const values=records.map(s=>s[key][index][1]);
    const commonSize=values.map((v,i)=>{
      const f=financials(periods[i]),base=key==='pl'?f.revenue:f.assets;
      return v!==null&&base>0?v/base*100:null;
    });
    return {label,values,commonSize,changes:values.map((v,i)=>i?variance(v,values[i-1]):{change:null,percent:null})};
  });
}
export function waterfall(current, prior) {
  if(!current||!prior) return [];
  const a=financials(prior),b=financials(current);
  if(!a.ready||!b.ready) return [];
  const steps=[
    ['Prior EBITDA',a.ebitda,true],
    ['Revenue',b.revenue-a.revenue,false],
    ['Other income',b.t['Other income']-a.t['Other income'],false],
    ['Cost of sales',a.cogs-b.cogs,false],
    ['Operating expenses',a.t['Operating expenses']-b.t['Operating expenses'],false],
    ['Latest EBITDA',b.ebitda,true]
  ];
  let total=0;
  return steps.map(([label,value,isTotal])=>{
    const start=isTotal?0:total;
    total=isTotal?value:total+value;
    return {label,value,start,end:total,isTotal};
  });
}
export const workingCapitalDefinitions=[
  ['cash','Cash & bank'],['ar','Trade receivables'],['inventory','Inventory'],
  ['ap','Trade payables'],['operating','Operating working capital (AR + inventory - AP)'],
  ['net','Net working capital (current assets - current liabilities)'],
  ['currentAssets','Current assets'],['currentLiabilities','Current liabilities']
];
export function workingCapital(p) {
  const f=financials(p),t=f.t;
  const values={cash:t['Cash & bank'],ar:t.Receivables,inventory:t.Inventory,ap:t['Trade payables'],
    operating:t.Receivables+t.Inventory-t['Trade payables'],net:f.currentAssets-f.currentLiabilities,
    currentAssets:f.currentAssets,currentLiabilities:f.currentLiabilities};
  return Object.fromEntries(Object.entries(values).map(([k,v])=>[k,f.ready?v:null]));
}
export function checks(periods) {
  const result=[];
  for(const [i,p] of periods.entries()) {
    const f=financials(p),s=statements(p);
    const add=(severity,subject,detail)=>result.push({period:p.label,severity,subject,detail});
    add(f.base.balanced?'Pass':'Error','TB reconciliation',`Debits ${f.base.debit/100}; credits ${f.base.credit/100}; difference ${f.base.difference/100}.`);
    if(f.ready) add(s.bs.at(-1)[1]===0?'Pass':'Error','Balance sheet reconciliation',`Assets less liabilities and closing equity: ${s.bs.at(-1)[1]/100}.`);
    if(!p.confirmed) add('Review','Account mapping','Automatic classifications and completeness require human confirmation.');
    for(const r of p.rows.filter(r=>!r.group||r.group==='Unmapped')) add('Error',r.name,`Row ${r.sourceRow}: account group is missing.`);
    for(const issue of f.base.issues) add('Review',issue.name,issue.message);
    for(const warning of p.importWarnings||[]) add('Review','Import assumption',warning);
    const cf=s.cf.at(-1)[1];
    add(cf===null?'Missing':cf===0?'Pass':'Error','Cash-flow reconciliation',cf===null?'Supply operating, investing, financing, opening/closing cash, exchange effects and a source.':`Reported less calculated closing cash: ${cf/100}.`);
    if(Number.isSafeInteger(p.cashFlow?.closing)&&p.cfoSource?.trim()) {
      const diff=p.cashFlow.closing-f.t['Cash & bank'];
      add(diff===0?'Pass':'Review','Cash flow to TB cash',`Reported closing equivalents less mapped cash & bank: ${diff/100}. Explain restricted cash, overdrafts or scope differences.`);
    }
    if(i&&!comparable(periods[i-1],p)) add('Review','Period duration','Raw movements span different durations and are not like-for-like.');
    if(i&&p.start<=periods[i-1].end) add('Error','Period overlap','Reporting periods overlap.');
    if(i) for(const r of p.rows) {
      const old=periods[i-1].rows.find(q=>q.name.trim().toLowerCase()===r.name.trim().toLowerCase());
      if(old&&old.group!==r.group) add('Review',r.name,`Classification changed from ${old.group} to ${r.group}.`);
    }
  }
  return result;
}
export function management(periods) {
  if(!periods.length) return [];
  const p=periods.at(-1),prev=periods.at(-2),f=financials(p),old=prev?financials(prev):null;
  const r=ratios(p,prev),prior=prev?ratios(prev,periods.at(-3)):null,items=[];
  const add=(severity,title,evidence,question)=>items.push({severity,title,evidence,question,period:p.label});
  if(!f.base.balanced) add('Risk','TB is out of balance',`Debit-credit difference ${f.base.difference/100}. Statements remain provisional.`, 'Which missing, duplicated or mis-signed entries explain the TB difference?');
  if(!f.ready) {add('Review','Incomplete account mapping','Financial metrics are withheld until every account has a group.','Can finance resolve all unmapped accounts and confirm the reporting period?');return items;}
  if(!p.confirmed) add('Review','Suggested classifications','Figures use automatic account suggestions, not confirmed accounting judgments.','Can finance confirm classifications, year boundaries and stock adjustments before relying on this review?');
  if(r.current!==null&&r.current<1) add('Risk','Near-term liquidity gap',`Current assets ${f.currentAssets/100} versus current liabilities ${f.currentLiabilities/100}; cover ${r.current.toFixed(2)}x.`,'What collections, committed facilities or payment plans cover obligations as they fall due?');
  if(r.coverage!==null&&r.coverage<2) add('Risk','Limited interest cover',`EBIT covers interest ${r.coverage.toFixed(2)}x. The screening threshold is 2x, not a lending covenant.`,'How sensitive are debt-service plans to lower earnings or higher interest rates?');
  if(f.profit<0) add('Risk','Loss for the period',`Mapped loss is ${Math.abs(f.profit)/100}.`,'Which recurring costs and revenue gaps drive the loss, and what corrective actions have owners and dates?');
  if(f.equity+f.profit<=0) add('Risk','Non-positive closing equity',`Mapped equity plus unclosed P&L is ${(f.equity+f.profit)/100}.`,'What capital support or restructuring is planned, and are going-concern assumptions supported?');
  if(!Number.isSafeInteger(p.cfo)||!p.cfoSource?.trim()) add('Evidence','Operating cash evidence unavailable','Closing TB balances cannot distinguish cash transactions from non-cash movements.','Can finance provide a reconciled cash-flow statement, including non-cash and exchange adjustments?');
  else if(p.cfo<0) add('Risk','Negative operating cash flow',`Supported operating cash outflow is ${Math.abs(p.cfo)/100}.`,'Which operating cash outflows need funding, and what actions will restore cash generation?');
  else if(r.cfo!==null&&r.cfo<1) add('Review','Profit exceeds operating cash',`Operating cash to PAT is ${r.cfo.toFixed(2)}x.`,'Which working-capital movements or non-cash adjustments explain the cash conversion gap?');
  if(old?.ready) {
    if(comparable(prev,p)) {
      if(r.growth!==null) add(r.growth<0?'Risk':'Opportunity','Revenue movement',`Revenue changed ${(f.revenue-old.revenue)/100} (${r.growth.toFixed(2)}%) versus ${prev.label}.`,r.growth<0?'How much of the decline reflects volume, price, churn or timing, and which actions can recover it?':'Which products or customers drove growth, and can that growth be sustained without weakening margins or collections?');
      if(r.ebitda!==null&&prior.ebitda!==null&&Math.abs(r.ebitda-prior.ebitda)>=1) add(r.ebitda<prior.ebitda?'Risk':'Opportunity','EBITDA margin movement',`Margin moved from ${prior.ebitda.toFixed(2)}% to ${r.ebitda.toFixed(2)}%.`,'How do pricing, sales mix, direct costs and operating expenses explain the EBITDA bridge?');
      for(const [key,label] of [['receivable','Receivable'],['inventory','Inventory'],['payable','Payable']]) {
        if(r[key]!==null&&prior[key]!==null&&Math.abs(r[key]-prior[key])>=5) add('Review',`${label} days movement`,`${prior[key].toFixed(1)} to ${r[key].toFixed(1)} days; based on closing balances and sales/COGS proxies.`,key==='receivable'?'Which overdue customers explain this movement, and what does the ageing schedule show?':key==='inventory'?'Which stock categories are slow-moving, obsolete or deliberately held for demand?':'Does the movement reflect agreed supplier terms, purchasing timing or overdue payments?');
      }
    } else add('Review','Different reporting durations','Growth and efficiency movements are not assessed as like-for-like.','Can comparable period activity be supplied before interpreting growth?');
    const threshold=Math.max(Math.abs(old.revenue)*0.05,1);
    for(const m of accountMovements(p,prev).filter(m=>Math.abs(m.change)>=threshold).slice(0,5))
      add('Movement',m.name,`Net debit changed from ${m.prior/100} to ${m.current/100}; movement ${m.change/100}. Exceeds 5% of prior revenue.`,`What business activity or journal entries explain the movement in ${m.name}, and is it recurring?`);
  }
  if(!items.length) add('Review','No screening threshold triggered','The configured rules found no exception; this is not audit assurance.','Are there off-balance-sheet commitments, ageing concerns or subsequent events not visible in the TB?');
  return items;
}
