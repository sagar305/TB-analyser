import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWorkbook} from '../frontend/workbook-import.js';
import {analyse} from '../frontend/engine.js';
import {financials} from '../frontend/comparison.js';
const meta={name:'Read Me',grid:[['Entity','Example client'],['Currency','USD'],['Industry','Test']]};
test('all yearly sheets imported; titles, blanks and repeated headers excluded',()=>{
 const h=['GL Ref','Account / Narration','Debit $','Credit $'];
 const sheets=[meta,...[2023,2024,2025].map(year=>({name:'export',grid:[['Period',year],[],h,['1','Cash',10,''],[],h,['2','Share capital','',10]]}))];
 const r=parseWorkbook(sheets);assert.equal(r.name,'Example client');assert.equal(r.currency,'USD');assert.equal(r.periods.length,3);
 for(const p of r.periods){assert.equal(p.rows.length,2);assert.equal(p.rows[0].sourceRow,4);assert.equal(analyse(p.rows).difference,0);assert.equal(financials(p).ready,true);assert.equal(p.confirmed,false);}
});
test('signed columns are sorted chronologically and negative assets stay credit balances',()=>{
 const r=parseWorkbook([meta,{name:'Ledger',grid:[['Account ID','Particulars','2025 closing signed','2023 closing signed','2024 closing signed','Mapping'],['1','Cash',30,10,20,'BS'],['2','Capitalised development costs',-30,-10,-20,'BS']]}]);
 assert.deepEqual(r.periods.map(p=>p.label),['FY2023','FY2024','FY2025']);assert.equal(r.periods[0].rows[1].credit,1000);assert.equal(r.periods[0].rows[1].group,'Non-current assets');
});
test('yearly signed sheets use signs, not the normal-side description',()=>{
 const r=parseWorkbook([meta,{name:'TB 2024',grid:[['Ledger','Account description','FS','Signed balance','Normal side'],['1','Cash','BS',10,'CR'],['2','Share capital','BS',-10,'DR']]}]);assert.equal(r.periods[0].rows[0].debit,1000);assert.equal(r.periods[0].rows[1].credit,1000);
});
test('duplicate years and invalid amounts are rejected without silently combining',()=>{
 const s={name:'FY2024',grid:[['GL Description','Debit','Credit'],['Cash',10,0]]};assert.throws(()=>parseWorkbook([s,s]),/same year/);assert.throws(()=>parseWorkbook([{...s,grid:[s.grid[0],['Cash','oops',0]]}]),/row 2/);
});

test('one-period pre-closing TB excludes closing transfers, footer checks and source journals',()=>{
 const r=parseWorkbook([{name:'Annual TB',grid:[['Restaurant 2025 annual trial balance'],['Revenue and expenses cover January 1–December 31, 2025.'],['GL code','Account name','Account class','Pre-closing debit','Pre-closing credit','Closing debit','Closing credit','Post-closing debit','Post-closing credit'],['1000','Operating bank','Asset',180,0,0,0,180,0],['3000','Owner contributed capital','Equity',0,100,0,0,0,100],['3200','Owner distributions','Distribution',20,0,0,20,0,0],['4000','Food sales','Revenue',0,150,150,0,0,0],['6000','Cleaning and laundry','Expense',50,0,0,50,0,0],['','TOTAL','',250,250,150,70,180,100],['','Net income','',100],['Notes only']]},{name:'Source journal',grid:[['2025'],['Journal ID','Description','Debit','Credit'],['J001','Opening balances',100,0]]}],{source:'example.xlsx'});
 assert.equal(r.periods.length,1);const p=r.periods[0],f=financials(p);
 assert.equal(p.rows.length,5);assert.equal(p.start,'2025-01-01');assert.equal(p.end,'2025-12-31');assert.equal(p.datesExplicit,true);
 assert.equal(f.base.difference,0);assert.equal(f.revenue,15000);assert.equal(f.profit,10000);assert.equal(f.equity,8000);assert.equal(f.ready,true);
 assert.ok(p.importWarnings.some(x=>x.includes('Pre-closing')));
});
