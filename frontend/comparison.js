import {analyse} from './engine.js';

export const groups={
 'Cash & bank':'Assets','Receivables':'Assets','Inventory':'Assets','Prepayments':'Assets','Other current assets':'Assets','Non-current assets':'Assets',
 'Trade payables':'Liabilities','Short-term debt':'Liabilities','Other current liabilities':'Liabilities','Long-term debt':'Liabilities','Other non-current liabilities':'Liabilities',
 'Equity':'Equity','Revenue':'Income','Other income':'Income','Cost of sales':'Expenses','Operating expenses':'Expenses','Depreciation & amortisation':'Expenses','Interest expense':'Expenses','Tax expense':'Expenses','Unmapped':'Unclassified'
};
export function suggestGroup(row){
 const n=row.name.toLowerCase(),c=row.category;
 if(c==='Equity')return 'Equity';
 if(c==='Income')return /sales|revenue|turnover/.test(n)?'Revenue':'Other income';
 if(c==='Expenses'){
  if(/depreciation|amortis|amortiz/.test(n))return 'Depreciation & amortisation';
  if(/interest|finance cost/.test(n))return 'Interest expense';
  if(/income tax|tax expense/.test(n))return 'Tax expense';
  if(/cost of (sales|goods)|cogs/.test(n))return 'Cost of sales';
  // Purchases alone need stock adjustments before they can be treated as COGS.
  if(/purchase|opening stock|closing stock/.test(n))return 'Unmapped';
  return 'Operating expenses';
 }
 if(c==='Assets'){
  if(/cash|bank/.test(n))return 'Cash & bank';
  if(/receivable|debtor/.test(n))return 'Receivables';
  if(/inventory|stock/.test(n))return 'Inventory';
  if(/prepaid|prepayment/.test(n))return 'Prepayments';
  if(/plant|equipment|furniture|building|land|fixed asset/.test(n))return 'Non-current assets';
 }
 if(c==='Liabilities'){
  if(/payable|creditor/.test(n))return 'Trade payables';
  if(/overdraft|short.term/.test(n))return 'Short-term debt';
  if(/term loan|long.term/.test(n))return 'Long-term debt';
 }
 return 'Unmapped';
}
export function days(p){return Math.round((Date.parse(p.end+'T00:00:00Z')-Date.parse(p.start+'T00:00:00Z'))/86400000)+1;}
export function comparable(a,b){return !!a&&!!b&&Math.abs(days(a)-days(b))<=1;}
export function contiguous(a,b){return !!a&&!!b&&Date.parse(b.start+'T00:00:00Z')-Date.parse(a.end+'T00:00:00Z')===86400000;}
export function validatePeriod(p,others=[]){
 if(!p.label.trim())throw Error('Enter a reporting period label.');
 if(!Number.isFinite(days(p))||days(p)<=0||days(p)>366)throw Error('Use a valid reporting period of 1–366 days.');
 if(others.some(o=>o&&p.start<=o.end&&p.end>=o.start))throw Error('Reporting periods for the same company must not overlap.');
}
export function financials(p){
 const base=analyse(p.rows),t=Object.fromEntries(Object.keys(groups).map(k=>[k,0]));
 for(const r of p.rows){const g=r.group||'Unmapped';t[g]+=(['Income','Liabilities','Equity'].includes(groups[g])?-1:1)*(r.debit-r.credit);}
 const sum=names=>names.reduce((v,k)=>v+t[k],0);
 const revenue=t.Revenue,cogs=t['Cost of sales'],ebitda=revenue+t['Other income']-cogs-t['Operating expenses'];
 const ebit=ebitda-t['Depreciation & amortisation'],profit=ebit-t['Interest expense']-t['Tax expense'];
 const currentAssets=sum(['Cash & bank','Receivables','Inventory','Prepayments','Other current assets']);
 const currentLiabilities=sum(['Trade payables','Short-term debt','Other current liabilities']);
 const ready=p.confirmed&&p.rows.every(r=>r.group&&r.group!=='Unmapped');
 return {base,t,ready,revenue,cogs,ebitda,ebit,profit,currentAssets,currentLiabilities,assets:currentAssets+t['Non-current assets'],debt:t['Short-term debt']+t['Long-term debt'],equity:t.Equity};
}
const fraction=(a,b)=>b>0?a/b:null;
export const ratioReasoning={
 growth:'Shows whether sales are expanding or contracting. Compare the pace across similar periods; growth alone does not show whether those extra sales are profitable or collected in cash.',
 gross:'Shows how much sales income remains after the cost of goods sold. A falling margin can reflect pricing pressure, a different sales mix, or higher direct costs; review those items before concluding why it changed.',
 ebitda:'Shows earnings retained from revenue before depreciation, interest, and tax. A higher margin can indicate better cost control or pricing, but other income can also lift this measure and it does not represent cash flow.',
 net:'Shows how much of each rupee of revenue remains as profit after interest and tax. If this falls while EBITDA margin holds steady, review depreciation, borrowing costs, and tax charges.',
 current:'Indicates the short-term asset cover available for near-term obligations. More cover can provide a cushion, but slow-moving stock or overdue receivables may not turn into cash when bills fall due.',
 quick:'Tests near-term payment capacity without relying on inventory or prepayments. A large gap from the current ratio means liquidity depends more heavily on those less readily available assets.',
 debt:'Shows reliance on borrowings relative to shareholder funds. A rise means more debt for each rupee of equity, which can increase repayment pressure; consider cash generation and loan maturities as well.',
 coverage:'Shows the earnings cushion available to meet interest costs. A declining figure leaves less room for weaker earnings or higher borrowing costs. It does not measure the ability to repay loan principal.',
 roe:'Shows the profit generated relative to closing shareholder funds. A rise may reflect stronger earnings, but can also result from lower equity or higher borrowing, so review those changes together.',
 cfo:'Checks how reported profit translates into operating cash. Above one means operating cash exceeds profit for that period; below one can reflect cash tied up in working capital or other timing differences.',
 roa:'Shows the profit generated from the assets employed during the period. A change can reflect earnings performance or a change in the asset base. Compare similar durations because this measure is not annualised.',
 receivable:'Estimates how much sales activity is tied up in unpaid customer balances. More days can signal slower collection or different credit terms; check ageing and seasonal sales before drawing a conclusion.',
 inventory:'Estimates how long stock is held relative to the cost of sales. Rising days can tie up cash or indicate slow-moving stock, but may also reflect planned stocking for future demand.',
 payable:'Estimates how long supplier balances remain outstanding. More days can support cash availability, but may also indicate overdue payments; review agreed terms. Cost of sales is used as a proxy for purchases.',
 cycle:'Estimates how long cash is tied up between holding stock, collecting customer balances, and paying suppliers. A shorter cycle generally releases working capital; inspect the three components to understand the change.'
};
export const ratioDefinitions=[
 ['growth','Revenue growth','%','(Revenue − prior revenue) / prior revenue × 100. Requires comparable duration.'],
 ['gross','Gross margin','%','(Revenue − cost of sales) / revenue × 100. Cost of sales must include stock adjustments.'],
 ['ebitda','EBITDA margin','%','(Revenue + other income − cost of sales − operating expenses) / revenue × 100.'],
 ['net','PAT margin','%','Provisional profit after mapped interest and tax / revenue × 100.'],
 ['current','Current ratio','×','Current assets / current liabilities.'],
 ['quick','Quick ratio','×','(Current assets − inventory − prepayments) / current liabilities.'],
 ['debt','Debt / equity','×','(Short-term debt + long-term debt) / mapped closing equity; no automatic profit addition.'],
 ['coverage','Interest coverage','×','EBIT / interest expense.'],
 ['roe','Return on equity','%','PAT / mapped closing equity × 100.'],
 ['cfo','CFO / PAT','×','Entered operating cash flow / PAT. Requires a cash-flow source note.'],
 ['roa','Return on average assets','%','Profit / average opening and closing total assets × 100. Not annualised.'],
 ['receivable','Receivable days','days','Closing receivables / revenue × period days. Total revenue is a proxy for credit sales.'],
 ['inventory','Inventory days','days','Closing inventory / cost of sales × period days.'],
 ['payable','Payable days','days','Closing trade payables / cost of sales × period days. COGS is a proxy for credit purchases.'],
 ['cycle','Cash conversion cycle','days','Receivable days + inventory days − payable days.']
];
export function ratios(p,previous){
 const f=financials(p),old=previous?financials(previous):null;
 const result=Object.fromEntries(ratioDefinitions.map(([id])=>[id,null]));
 if(!f.ready)return result;
 const pct=(a,b)=>{const v=fraction(a,b);return v===null?null:v*100;};
 Object.assign(result,{gross:pct(f.revenue-f.cogs,f.revenue),ebitda:pct(f.ebitda,f.revenue),net:pct(f.profit,f.revenue),current:fraction(f.currentAssets,f.currentLiabilities),quick:fraction(f.currentAssets-f.t.Inventory-f.t.Prepayments,f.currentLiabilities),debt:fraction(f.debt,f.equity),coverage:fraction(f.ebit,f.t['Interest expense'])});
 if(old?.ready&&comparable(previous,p))result.growth=pct(f.revenue-old.revenue,old.revenue);
 result.roe=pct(f.profit,f.equity);
 result.cfo=Number.isSafeInteger(p.cfo)&&p.cfoSource?.trim()?fraction(p.cfo,f.profit):null;
 for(const [key,g,den] of [['receivable','Receivables',f.revenue],['inventory','Inventory',f.cogs],['payable','Trade payables',f.cogs]]){
  const v=fraction(f.t[g],den);result[key]=v===null?null:v*days(p);
 }
 if(['receivable','inventory','payable'].every(k=>result[k]!==null))result.cycle=result.receivable+result.inventory-result.payable;
 if(old?.ready&&contiguous(previous,p)){
  result.roa=pct(f.profit,(f.assets+old.assets)/2);
 }
 return result;
}
export function accountMovements(current,prior){
 if(!prior)return [];
 const data=new Map();
 for(const [p,field] of [[prior,'prior'],[current,'current']])for(const row of p.rows){const key=row.name.trim().toLowerCase();if(!data.has(key))data.set(key,{name:row.name,prior:0,current:0});data.get(key)[field]+=row.debit-row.credit;}
 return [...data.values()].map(r=>({...r,change:r.current-r.prior})).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change));
}
export function samplePeriods(peer=false){
 return [2024,2025,2026].map((year,i)=>{
  const scale=(peer?0.8:1)*(1+i*0.15),r=(name,dr,cr,group)=>({name,debit:Math.round(dr*scale*100),credit:Math.round(cr*scale*100),category:groups[group],group,sourceRow:0});
  const rows=[r('Bank current account',420000,0,'Cash & bank'),r('Trade receivables',680000,0,'Receivables'),r('Inventory',350000,0,'Inventory'),r('Plant & equipment',900000,0,'Non-current assets'),r('Trade payables',0,450000,'Trade payables'),r('Term loan',0,600000,'Long-term debt'),r('Share capital',0,1000000,'Equity'),r('Retained earnings',0,100000,'Equity'),r('Sales revenue',0,1800000,'Revenue'),r('Cost of goods sold',1100000,0,'Cost of sales'),r('Salaries',240000,0,'Operating expenses'),r('Rent expense',120000,0,'Operating expenses'),r('Utilities expense',80000,0,'Operating expenses'),r('Depreciation',30000,0,'Depreciation & amortisation'),r('Interest expense',20000,0,'Interest expense'),r('Income tax expense',10000,0,'Tax expense')];
  rows.forEach((x,j)=>x.sourceRow=j+2);
  return {label:`FY ${year-1}–${String(year).slice(2)}`,start:`${year-1}-04-01`,end:`${year}-03-31`,rows,confirmed:true,cfo:Math.round(300000*scale*100),cfoSource:'Illustrative cash-flow statement',source:'Illustrative trial balance',sheet:`FY ${year}`,sample:true};
 });
}
