import test from 'node:test';
import assert from 'node:assert/strict';
import {samplePeriods,financials,ratios,ratioDefinitions,validatePeriod,accountMovements,suggestGroup,days} from '../frontend/comparison.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.000001,`${a} != ${b}`);
test('three sample TBs balance and all reference ratios exist',()=>{
 const ps=samplePeriods();for(const p of ps){assert.equal(financials(p).base.balanced,true);assert.equal(financials(p).base.profit,financials(p).profit);}
 const r=ratios(ps[2],ps[1]);for(const id of ['growth','ebitda','net','current','debt','coverage','roe','cfo','receivable','inventory','payable','cycle'])assert.ok(Number.isFinite(r[id]),id);
 assert.equal(ratioDefinitions.length,15);
 close(r.ebitda,260000/1800000*100);close(r.net,200000/1800000*100);close(r.current,1450000/450000);close(r.debt,600000/1100000);close(r.coverage,230000/20000);close(r.roe,200000/1100000*100);close(r.cfo,1.5);
 close(r.receivable,680000/1800000*365);close(r.inventory,350000/1100000*365);close(r.payable,450000/1100000*365);close(r.cycle,r.receivable+r.inventory-r.payable);
 close(r.growth,(1.3/1.15-1)*100);
});
test('ratios unavailable until complete mapping is confirmed',()=>{const p=samplePeriods()[0];p.confirmed=false;assert.ok(Object.values(ratios(p)).every(v=>v===null));p.confirmed=true;p.rows[0].group='Unmapped';assert.ok(Object.values(ratios(p)).every(v=>v===null));});
test('CFO is never inferred and requires evidence; zero remains valid',()=>{const p=samplePeriods()[0];delete p.cfo;assert.equal(ratios(p).cfo,null);p.cfo=0;assert.equal(ratios(p).cfo,0);p.cfoSource='';assert.equal(ratios(p).cfo,null);});
test('zero and negative denominators produce N/A, not infinity',()=>{const p=samplePeriods()[0];p.rows=p.rows.filter(r=>!['Revenue','Equity','Interest expense','Trade payables'].includes(r.group));const r=ratios(p);for(const k of ['net','gross','ebitda','debt','roe','coverage','current','quick','receivable'])assert.equal(r[k],null,k);});
test('period validation rejects overlaps, empty dates and reverse dates',()=>{const p=samplePeriods()[0];assert.throws(()=>validatePeriod({...p,start:'',end:''}));assert.throws(()=>validatePeriod({...p,start:p.end,end:p.start}));assert.throws(()=>validatePeriod(p,[p]));assert.doesNotThrow(()=>validatePeriod(samplePeriods()[1],[p]));});
test('unequal durations disable growth and noncontiguous opening disables ROA',()=>{const [prior,p]=samplePeriods();p.start='2024-10-01';const r=ratios(p,prior);assert.equal(r.growth,null);assert.equal(r.roa,null);close(r.receivable,680000/1800000*days(p));});
test('account matching aggregates duplicates and retains missing accounts',()=>{const prev={rows:[{name:' Bank ',debit:100,credit:0},{name:'bank',debit:50,credit:0},{name:'Old',debit:10,credit:0}]};const curr={rows:[{name:'BANK',debit:120,credit:0}]};const moves=accountMovements(curr,prev);assert.equal(moves[0].change,-30);assert.equal(moves[1].change,-10);});
test('purchases require explicit COGS review and classifications recalculate',()=>{assert.equal(suggestGroup({name:'Purchases',category:'Expenses'}),'Unmapped');const p=samplePeriods()[0],r=ratios(p);p.rows.find(r=>r.group==='Long-term debt').group='Other non-current liabilities';assert.equal(ratios(p).debt,0);assert.ok(r.debt>0);});

