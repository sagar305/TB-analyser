import {amount,analyse,classify} from './engine.js';
import {groups} from './comparison.js';
import {detectLayout,importDetected,periodDates,suggestFromStatement} from './importer.js';

export function classifyAccount(name,statement='',accountClass=''){
 const classCategory={asset:'Assets','contra asset':'Assets',liability:'Liabilities',equity:'Equity',distribution:'Equity',revenue:'Income',income:'Income',expense:'Expenses'}[accountClass.trim().toLowerCase()];
 const n=name.trim().toLowerCase();const pl=/^pl$|p\s*&\s*l|profit|income statement/i.test(statement);
 const rules=[
 [/accumulated (depreciation|amorti)|capitalised development|capital improvements|plant and machinery|investment building|^land$|equipment/,'Non-current assets'],
 [/restricted|escrow|refundable.*deposit|leasehold improvements|furniture|fixtures/,'Non-current assets'],
 [/owner.*(capital|distribution)|drawings/,'Equity'],
 [/loan.*current portion/,'Short-term debt'],
 [/loan.*long.term/,'Long-term debt'],
 [/loan interest/,'Interest expense'],
 [/unredeemed gift cards|employee tips payable|payroll taxes payable/,'Other current liabilities'],
 [/prepaid|prepayment/,'Prepayments'],
 [/receivable|debtor|unbilled revenue|allowance.*(doubtful|claim)/,'Receivables'],
 [/share capital|common stock|members capital|retained earnings|equity|reserves/,'Equity'],
 [/inventory|work in progress|\bwip\b|finished goods|stores and spares|medical consumables/,'Inventory'],
 [/deferred.*(revenue|income)|security deposits|accrued|accrual|wages payable|gst payable|sales tax payable|payroll liabilit/,'Other current liabilities'],
 [/accounts payable|trade payables|creditors/,'Trade payables'],
 [/short.term.*loan|working capital loan|bank borrowing|overdraft/,'Short-term debt'],
 [/long.term debt|term loan|mortgage loan|lease liability/,'Long-term debt'],
 [/cash|bank/,'Cash & bank'],
 [/interest expense|finance costs/,'Interest expense'],
 [/income tax expense/,'Tax expense'],
 [/depreciation|amortisation|amortization/,'Depreciation & amortisation'],
 [/sales returns|customer credits and refunds|contractual adjustments|subscription revenue|implementation revenue|product sales|domestic sales|export sales|rental income|parking income/,'Revenue'],
 [/cost of goods sold|cost of sales|raw material consumed|direct labour|factory overhead|power and fuel|scrap and wastage|freight inward|supplies consumed|lab outsourcing|cloud infrastructure costs/,'Cost of sales'],
 [/employee benefits|operating supplies|(?:card|payment) processing|delivery fees|accounting and legal|legal fees|professional fees|licen[cs]es and permits|cleaning|laundry|waste removal|pest control/,'Operating expenses'],
 [/payroll|compensation|commissions|expense|^rent$|marketing|utilities|software subscriptions|repairs and maintenance|property management fees|freight outward/,'Operating expenses']
 ];
 for(const [pattern,g] of rules)if(pattern.test(n))return g;
 const contextual=suggestFromStatement({name,category:classCategory||(pl?'Expenses':classify(name))},statement);
 return contextual;
}
function findHeader(grid){
 for(let i=0;i<Math.min(grid.length,30);i++){
  const h=grid[i].map(x=>String(x??'').trim().replace(/[_\n\r]+/g,' ').replace(/\s+/g,' '));
  if(h.some(x=>/^journal id$/i.test(x)))continue; // Transaction journals are not closing trial balances.
  let name=h.findIndex(x=>/description|particular|narration|healthcare account|account name|^account$/i.test(x));
  if(name<0)name=h.findIndex(x=>/^ledger(?: name)?$/i.test(x));
  if(name<0)continue;
  const preDebit=h.findIndex(x=>/^pre[- ]closing debit$/i.test(x)),preCredit=h.findIndex(x=>/^pre[- ]closing credit$/i.test(x));
  const debit=preDebit>=0?preDebit:h.findIndex(x=>/^(?:debit|dr)\b/i.test(x)),credit=preDebit>=0?preCredit:h.findIndex(x=>/^(?:credit|cr)\b/i.test(x));
  const signed=h.findIndex(x=>/signed balance|net dr|closing signed/i.test(x));
  if(debit<0&&signed<0)continue;
  return {header:i,h,name,debit,credit,signed,preClosing:preDebit>=0,accountClass:h.findIndex(x=>/^account class$/i.test(x)),group:h.findIndex(x=>/^ratio group$|^group$/i.test(x)),statement:h.findIndex(x=>/^(fs|statement|mapping)$/i.test(x)),code:h.findIndex(x=>/^(gl (number|ref|code)|account id|ledger)$/i.test(x)),department:h.findIndex(x=>/^(department|cost centre|segment|property|site)$/i.test(x))};
 }
 return null;
}
// Only a unique, valid calendar date in the title is used as a closing date.
// Multiple dates need an explicit range rule or human review.
function singleClosingDate(text){
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const found=[];
 for(const m of text.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/gi)){
  const date=new Date(Date.UTC(Number(m[3]),months.indexOf(m[1].toLowerCase()),Number(m[2])));
  if(date.getUTCDate()===Number(m[2]))found.push(date);
 }
 for(const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)){
  const date=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));
  if(date.toISOString().slice(0,10)===m[0])found.push(date);
 }
 const unique=[...new Map(found.map(d=>[d.toISOString(),d])).values()];return unique.length===1?unique[0]:null;
}
function readMetadata(sheets){const meta={};for(const {grid} of sheets)for(const row of grid.slice(0,30)){const key=String(row[0]??'').trim().toLowerCase();if(['entity','company','industry','currency','fiscal year start'].includes(key))meta[key]=String(row[1]??'').trim();}return meta;}
function yearLabel(text){const m=String(text).match(/(?:FY\s*)?(20\d{2})/i);return m?'FY'+m[1]:null;}
export function parseWorkbook(sheets,{source='',currency=null,startMonth=4}={}){
 const meta=readMetadata(sheets),periods=[],notes=[];
 for(const {name:sheet,grid} of sheets){
  const wide=detectLayout(grid);
  if(wide){periods.push(...importDetected(grid,wide,{source,sheet,startMonth}));continue;}
  const h=findHeader(grid);if(!h)continue;
  const yearColumns=h.h.map((text,index)=>({label:yearLabel(text),index})).filter(x=>x.label&&/signed/i.test(h.h[x.index]));
  const sheetYear=yearLabel(sheet)||yearLabel(grid.slice(0,h.header).flat().join(' '));
  const definitions=yearColumns.length?yearColumns:[{label:sheetYear,index:h.signed}];
  // Let the UI collect explicit dates instead of rejecting a perfectly valid,
  // undated single-period TB. Do not partially import a mixed dated workbook.
  if(definitions.some(x=>!x.label))return null;
  if(h.debit>=0&&h.credit<0&&!yearColumns.length)throw Error(`${sheet}: a Debit column requires a Credit column.`);
  for(const def of definitions){
   const rows=[];let afterTotal=false;
   for(let i=h.header+1;i<grid.length;i++){
    const row=grid[i],name=String(row[h.name]??'').trim();
    if(!row.some(x=>String(x??'').trim()))continue;
    if(name===h.h[h.name]&&row[h.code]===h.h[h.code]){notes.push(`${sheet}: repeated header at row ${i+1} excluded.`);continue;}
    if(/^(grand\s+)?total(s)?\s*:?$/i.test(name)){afterTotal=true;if(h.preClosing){notes.push(`${sheet}: account table ends at total row ${i+1}; summary checks and notes excluded.`);break;}continue;}
    if(afterTotal&&!String(row[h.code]??'').trim()&&/^(?:debit\s*(?:less|minus|[-−])\s*credit|credit\s*(?:less|minus|[-−])\s*debit|(?:trial balance|tb|balance)\s*(?:difference|check)|net (?:income|profit)|total (?:expenses|revenue))\b/i.test(name)){notes.push(`${sheet}: summary/check row ${i+1} excluded: ${name}.`);continue;}
    if(!name)throw Error(`${sheet}, row ${i+1}: missing account name.`);
    try{
     let debit,credit;
     if(yearColumns.length||h.debit<0){const signed=amount(row[def.index]);debit=Math.max(signed,0);credit=Math.max(-signed,0);}
     else{debit=amount(row[h.debit]);credit=amount(row[h.credit]);if(debit<0||credit<0)throw Error('Negative debit/credit amount; signed balances need a signed column.');}
     const statement=String(row[h.statement]??''),supplied=String(row[h.group]??'').trim();
     const group=Object.keys(groups).find(g=>g.toLowerCase()===supplied.toLowerCase())||classifyAccount(name,statement,String(row[h.accountClass]??''));
     rows.push({name,debit,credit,group,category:groups[group],sourceRow:i+1,code:String(row[h.code]??''),department:String(row[h.department]??''),statement});
    }catch(e){throw Error(`${sheet}, row ${i+1}: ${e.message}`);}
   }
   if(rows.length){
    const title=grid.slice(0,h.header).flat().join(' ');
    const calendar=title.match(/January\s+1\s*[-–—]\s*December\s+31,?\s*(20\d{2})/i);
    const explicit=calendar&&def.label.endsWith(calendar[1]);
    const closingCandidate=explicit?null:singleClosingDate(title);
    const asOf=definitions.length===1&&closingCandidate&&def.label.endsWith(String(closingCandidate.getUTCFullYear()))?closingCandidate:null;
    const endDates=asOf?{start:new Date(Date.UTC(asOf.getUTCFullYear()-1,asOf.getUTCMonth()+(asOf.getUTCDate()===new Date(Date.UTC(asOf.getUTCFullYear(),asOf.getUTCMonth()+1,0)).getUTCDate()?1:0),asOf.getUTCDate()===new Date(Date.UTC(asOf.getUTCFullYear(),asOf.getUTCMonth()+1,0)).getUTCDate()?1:asOf.getUTCDate()+1)).toISOString().slice(0,10),end:asOf.toISOString().slice(0,10)}:null;
    periods.push({label:def.label,...(explicit?{start:calendar[1]+'-01-01',end:calendar[1]+'-12-31'}:endDates||periodDates(def.label,startMonth)),dateAssumption:endDates?'Closing date detected from the worksheet; the opening date assumes a full year. Review dates for a shorter reporting period.':null,datesExplicit:!!(explicit||endDates),rows,source,sheet,confirmed:false,cfo:null,cfoSource:'',sample:false,preClosing:h.preClosing});
   }
  }
 }
 if(!periods.length)return null;
 if(periods.length>3)throw Error('More than three periods were found. Split the workbook into the intended three-period analysis.');
 if(new Set(periods.map(p=>p.end)).size!==periods.length)throw Error('Multiple sheets cover the same year. Consolidate them or use manual mapping; they were not silently combined.');
 for(const p of periods){
  for(const row of p.rows)if(row.group==='Unmapped'){row.group=classifyAccount(row.name,row.statement);row.category=groups[row.group];}
  p.autoMapped=true;p.importWarnings=[...(p.dateAssumption?[p.dateAssumption]:p.datesExplicit?['Reporting dates detected from the explicit January–December period in the worksheet.']:[`Financial-year start assumed from workspace setting: month ${startMonth}.`]), 'Classifications are suggestions, not reviewed financial statements.',...notes.filter(n=>n.startsWith(p.sheet+':')),...(p.preClosing?['Pre-closing balances selected; closing transfers and post-closing balances are excluded to retain period revenue and expenses.']:[])];
  for(const r of p.rows)if(/restricted|escrow|lease liability|bank borrowing|security deposit|development wip|capitalised development|capital improvements/i.test(r.name))p.importWarnings.push(`${r.name}: review maturity, restrictions, and accounting policy for the suggested ${r.group} grouping.`);
  analyse(p.rows);
 }
 return {name:meta.entity||meta.company||source.replace(/\.[^.]+$/,''),industry:meta.industry||'',currency:currency||meta.currency||null,periods:periods.sort((a,b)=>a.end.localeCompare(b.end)),notes:[...new Set(notes)]};
}
