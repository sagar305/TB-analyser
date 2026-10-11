import {amount,analyse} from './engine.js';
import {groups} from './comparison.js';
import {detectLayout,importDetected,periodDates,suggestFromStatement} from './importer.js';

export function classifyAccount(name,statement=''){
 const n=name.trim().toLowerCase();const pl=/^pl$|p\s*&\s*l|profit|income statement/i.test(statement);
 const rules=[
 [/accumulated (depreciation|amorti)|capitalised development|capital improvements|plant and machinery|investment building|^land$|equipment/,'Non-current assets'],
 [/restricted|escrow/,'Non-current assets'],
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
 [/payroll|compensation|commissions|expense|^rent$|marketing|utilities|software subscriptions|repairs and maintenance|property management fees|freight outward/,'Operating expenses']
 ];
 for(const [pattern,g] of rules)if(pattern.test(n))return g;
 const contextual=suggestFromStatement({name,category:pl?'Expenses':'Unclassified'},statement);
 return contextual;
}
function findHeader(grid){
 for(let i=0;i<Math.min(grid.length,30);i++){
  const h=grid[i].map(x=>String(x??'').trim());
  const name=h.findIndex(x=>/description|particular|narration|healthcare account|account name/i.test(x));
  if(name<0)continue;
  const debit=h.findIndex(x=>/^debit\b|^dr$/i.test(x)),credit=h.findIndex(x=>/^credit\b|^cr$/i.test(x));
  const signed=h.findIndex(x=>/signed balance|net dr|closing signed/i.test(x));
  if(debit<0&&signed<0)continue;
  return {header:i,h,name,debit,credit,signed,statement:h.findIndex(x=>/^(fs|statement|mapping)$/i.test(x)),code:h.findIndex(x=>/^(gl (number|ref|code)|account id|ledger)$/i.test(x)),department:h.findIndex(x=>/^(department|cost centre|segment|property|site)$/i.test(x))};
 }
 return null;
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
  if(definitions.some(x=>!x.label))throw Error(`${sheet}: no unambiguous year found. Use manual mapping for this sheet.`);
  for(const def of definitions){
   const rows=[];
   for(let i=h.header+1;i<grid.length;i++){
    const row=grid[i],name=String(row[h.name]??'').trim();
    if(!row.some(x=>String(x??'').trim()))continue;
    if(name===h.h[h.name]&&row[h.code]===h.h[h.code]){notes.push(`${sheet}: repeated header at row ${i+1} excluded.`);continue;}
    if(/^(grand\s+)?total(s)?\s*:?$/i.test(name))continue;
    if(!name)throw Error(`${sheet}, row ${i+1}: missing account name.`);
    try{
     let debit,credit;
     if(yearColumns.length||h.debit<0){const signed=amount(row[def.index]);debit=Math.max(signed,0);credit=Math.max(-signed,0);}
     else{debit=amount(row[h.debit]);credit=amount(row[h.credit]);if(debit<0||credit<0)throw Error('Negative debit/credit amount; signed balances need a signed column.');}
     const statement=String(row[h.statement]??''),group=classifyAccount(name,statement);
     rows.push({name,debit,credit,group,category:groups[group],sourceRow:i+1,code:String(row[h.code]??''),department:String(row[h.department]??''),statement});
    }catch(e){throw Error(`${sheet}, row ${i+1}: ${e.message}`);}
   }
   if(rows.length)periods.push({label:def.label,...periodDates(def.label,startMonth),rows,source,sheet,confirmed:false,cfo:null,cfoSource:'',sample:false});
  }
 }
 if(!periods.length)return null;
 if(periods.length>3)throw Error('More than three periods were found. Split the workbook into the intended three-period analysis.');
 if(new Set(periods.map(p=>p.end)).size!==periods.length)throw Error('Multiple sheets cover the same year. Consolidate them or use manual mapping; they were not silently combined.');
 for(const p of periods){
  for(const row of p.rows)if(row.group==='Unmapped'){row.group=classifyAccount(row.name,row.statement);row.category=groups[row.group];}
  p.autoMapped=true;p.importWarnings=[`Financial-year start assumed from workspace setting: month ${startMonth}.`, 'Classifications are suggestions, not reviewed financial statements.'];
  for(const r of p.rows)if(/restricted|escrow|lease liability|bank borrowing|security deposit|development wip|capitalised development|capital improvements/i.test(r.name))p.importWarnings.push(`${r.name}: review maturity, restrictions, and accounting policy for the suggested ${r.group} grouping.`);
  analyse(p.rows);
 }
 return {name:meta.entity||meta.company||source.replace(/\.[^.]+$/,''),industry:meta.industry||'',currency:currency||meta.currency||null,periods:periods.sort((a,b)=>a.end.localeCompare(b.end)),notes:[...new Set(notes)]};
}
