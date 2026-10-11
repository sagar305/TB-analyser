// Integer paise arithmetic; this module has no network or storage access.
export const categories=['Assets','Liabilities','Equity','Income','Expenses','Unclassified'];
export function amount(value){
 if(value===null||value===undefined||String(value).trim()===''||String(value).trim()==='-')return 0;
 if(typeof value==='number'){if(!Number.isFinite(value)||!Number.isSafeInteger(Math.round(value*100)))throw Error('Amount is outside the supported range');return Math.round(value*100);}
 let s=String(value).trim().replace(/[₹$£€\s,]/g,'');
 if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);
 if(!/^[+-]?\d+(\.\d{1,2})?$/.test(s))throw Error('Invalid amount: '+value);
 const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n))throw Error('Amount is outside the supported range');return n;
}
export function classify(name){
 const s=name.toLowerCase();
 if(/depreciation|expense|purchase|salary|salaries|rent|wages|cost|freight|insurance|advertis|electric|discount allowed/.test(s))return 'Expenses';
 if(/sales|revenue|income|interest received|discount received/.test(s))return 'Income';
 if(/capital|reserve|retained|equity|drawings/.test(s))return 'Equity';
 if(/payable|creditor|loan|overdraft|liabilit|provision/.test(s))return 'Liabilities';
 if(/cash|bank|receivable|debtor|inventory|stock|asset|equipment|furniture|building|land|deposit|prepaid|investment/.test(s))return 'Assets';
 return 'Unclassified';
}
export function mapRows(grid,mapping){
 const rows=[],errors=[];
 for(let i=mapping.header+1;i<grid.length;i++){
  const cells=grid[i];if(!cells.some(v=>String(v??'').trim()))continue;
  const name=String(cells[mapping.name]??'').trim();
  if(/^(grand\s+)?total(s)?\s*:?$/i.test(name))continue;
  try{
   if(!name)throw Error('Account name is missing');
   let debit=amount(cells[mapping.debit]),credit=amount(cells[mapping.credit]);
   if(debit<0||credit<0)throw Error('Debit and credit columns must contain non-negative amounts');
   const supplied=String(cells[mapping.category]??'').trim();
   const category=categories.find(c=>c.toLowerCase()===supplied.toLowerCase())||classify(name);
   rows.push({name,debit,credit,category,sourceRow:i+1});
  }catch(e){errors.push({row:i+1,message:e.message});}
 }
 if(!rows.length&&!errors.length)errors.push({row:0,message:'No account rows found'});
 return {rows,errors};
}
export function analyse(rows){
 let debit=0,credit=0;const totals=Object.fromEntries(categories.map(c=>[c,0]));const issues=[],seen=new Set();
 for(const r of rows){
  debit+=r.debit;credit+=r.credit;
  if(!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit))throw Error('Totals exceed the supported range');
  totals[r.category]+=r.debit-r.credit;
  if(seen.has(r.name.toLowerCase()))issues.push({name:r.name,message:'Duplicate account name; verify this is intentional.'});seen.add(r.name.toLowerCase());
  if(r.debit&&r.credit)issues.push({name:r.name,message:'Both debit and credit contain a balance.'});
  if(r.category==='Unclassified')issues.push({name:r.name,message:'Account classification needs review.'});
  if((['Assets','Expenses'].includes(r.category)&&r.credit>r.debit)||(['Liabilities','Equity','Income'].includes(r.category)&&r.debit>r.credit))issues.push({name:r.name,message:'Balance is on the unusual side for this category; review contra accounts.'});
 }
 return {debit,credit,difference:debit-credit,balanced:debit===credit,totals,issues,profit:(-totals.Income-totals.Expenses)||0};
}
export const sample=[['Account','Debit','Credit','Category'],['Bank current account',420000,0,'Assets'],['Trade receivables',680000,0,'Assets'],['Inventory',350000,0,'Assets'],['Plant & equipment',900000,0,'Assets'],['Trade payables',0,450000,'Liabilities'],['Term loan',0,600000,'Liabilities'],['Share capital',0,1000000,'Equity'],['Retained earnings',0,100000,'Equity'],['Sales revenue',0,1800000,'Income'],['Purchases',1100000,0,'Expenses'],['Salaries',300000,0,'Expenses'],['Rent expense',120000,0,'Expenses'],['Utilities expense',80000,0,'Expenses']];
