import {mapRows} from './engine.js';
import {groups,suggestGroup} from './comparison.js';

export function detectLayout(grid){
 for(let header=0;header<Math.min(25,grid.length);header++){
  const labels=grid[header].map(v=>String(v??'').trim());
  const name=labels.findIndex(x=>/account|particular|ledger/i.test(x)&&!/code|number|no\.?$/i.test(x));
  if(name<0)continue;
  const pairs=new Map();
  labels.forEach((s,index)=>{const m=s.match(/\b(FY\s*\d{2,4}(?:\s*[-–/]\s*\d{2,4})?|20\d{2})\s*(DR|CR|DEBIT|CREDIT)\b/i)||s.match(/\b(DR|CR|DEBIT|CREDIT)\s*(FY\s*\d{2,4}(?:\s*[-–/]\s*\d{2,4})?|20\d{2})\b/i);if(!m)return;const reverse=/^(DR|CR|DEBIT|CREDIT)$/i.test(m[1]);const label=(reverse?m[2]:m[1]).replace(/\s/g,'').toUpperCase();const side=(reverse?m[1]:m[2]).toUpperCase();const p=pairs.get(label)||{label};p[/^(DR|DEBIT)$/.test(side)?'debit':'credit']=index;pairs.set(label,p);});
  const periods=[...pairs.values()].filter(p=>p.debit!==undefined&&p.credit!==undefined);
  if(periods.length<2||periods.length>3)continue;
  return {header,name,periods,statement:labels.findIndex(x=>/^statement$/i.test(x)),code:labels.findIndex(x=>/^(gl|account|ledger)\s*code$/i.test(x)),department:labels.findIndex(x=>/^department$/i.test(x)),category:labels.findIndex(x=>/^category$/i.test(x)),group:labels.findIndex(x=>/^ratio group$/i.test(x))};
 }
 return null;
}
export function suggestFromStatement(row,statement){
 const n=row.name.toLowerCase();const bs=/balance\s*sheet|^bs$/i.test(statement),pl=/p\s*&\s*l|profit|income statement/i.test(statement);
 if(bs){
  if(/accumulated depreciation|equipment|building|furniture|fixed asset/.test(n))return 'Non-current assets';
  if(/allowance.*(doubtful|claim)|receivable|debtor/.test(n))return 'Receivables';
  if(/prepaid|prepayment/.test(n))return 'Prepayments';
  if(/common stock|share capital|retained|equity|reserve/.test(n))return 'Equity';
  if(/inventory|consumables/.test(n))return 'Inventory';
  if(/accrued|payroll liabilit|deferred.*revenue/.test(n))return 'Other current liabilities';
  if(/payable|creditor/.test(n))return 'Trade payables';
  if(/term loan/.test(n))return 'Long-term debt';
  if(/cash|bank/.test(n))return 'Cash & bank';
  return 'Unmapped';
 }
 if(pl){
  if(/revenue|contractual adjustment|sales return/.test(n))return 'Revenue';
  if(/depreciation|amorti/.test(n))return 'Depreciation & amortisation';
  if(/interest|finance cost/.test(n))return 'Interest expense';
  if(/income tax|tax expense/.test(n))return 'Tax expense';
  if(/supplies consumed|lab outsourcing|cost of (sales|goods)/.test(n))return 'Cost of sales';
  if(/expense|payroll|compensation|salary|salaries|wages/.test(n))return 'Operating expenses';
  return 'Unmapped';
 }
 return suggestGroup(row);
}
export function periodDates(label,startMonth=4){
 const years=label.match(/\d{2,4}/g);if(!years)throw Error('Cannot identify the period year.');
 const expand=y=>Number(y)<100?2000+Number(y):Number(y);
 const endYear=expand(years.at(-1)),startYear=startMonth===1?endYear:endYear-1;
 const pad=n=>String(n).padStart(2,'0');
 return {start:`${startYear}-${pad(startMonth)}-01`,end:startMonth===1?`${endYear}-12-31`:`${endYear}-${pad(startMonth-1)}-${new Date(Date.UTC(endYear,startMonth-1,0)).getUTCDate()}`};
}
export function importDetected(grid,layout,{source,sheet,startMonth=4,overrides={},confirmed=false}={}){
 return layout.periods.map(pair=>{
  const parsed=mapRows(grid,{...layout,...pair});
  if(parsed.errors.length)throw Error(`${pair.label}: `+parsed.errors.map(e=>`row ${e.row}: ${e.message}`).join('; '));
  const rows=parsed.rows.map(r=>{
   const cells=grid[r.sourceRow-1],statement=String(cells[layout.statement]??''),supplied=String(cells[layout.group]??'');
   const group=overrides[r.sourceRow]||Object.keys(groups).find(k=>k.toLowerCase()===supplied.toLowerCase())||suggestFromStatement(r,statement);
   return {...r,group,category:groups[group],code:String(cells[layout.code]??''),department:String(cells[layout.department]??''),statement};
  });
  return {label:pair.label,...periodDates(pair.label,startMonth),rows,confirmed:confirmed&&rows.every(r=>r.group!=='Unmapped'),source,sheet,sample:false,cfo:null,cfoSource:''};
 });
}
