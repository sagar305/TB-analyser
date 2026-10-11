import test from 'node:test';
import assert from 'node:assert/strict';
import {statements} from '../frontend/statements.js';
import {samplePeriods} from '../frontend/comparison.js';
test('P&L ties to TB income and expenses, and balance sheet reconciles unclosed profit',()=>{
 const s=statements(samplePeriods()[0]);
 assert.equal(s.pl.at(-1)[1],20000000);
 assert.equal(s.bs.at(-1)[1],0);
 assert.equal(s.bs.find(([l])=>l==='Total assets')[1],235000000);
 assert.equal(s.cf.at(-1)[1],0);
});
test('missing cash-flow inputs stay unavailable while explicit zero works',()=>{
 const p=samplePeriods()[0];delete p.cashFlow;
 let s=statements(p);assert.equal(s.cf[0][1],30000000);assert.equal(s.cf[3][1],null);assert.equal(s.cf.at(-1)[1],null);
 p.cashFlow={investing:0,financing:0,opening:0,closing:30000000,fx:0};
 assert.equal(statements(p).cf.at(-1)[1],0);
 p.cashFlow.closing=30000001;assert.equal(statements(p).cf.at(-1)[1],1);
});
test('unconfirmed account groups block statements; missing source blocks cash flow',()=>{
 const p=samplePeriods()[0];p.confirmed=false;p.cfoSource='';const s=statements(p);
 assert.ok(s.pl.every(r=>r[1]===null));assert.ok(s.bs.every(r=>r[1]===null));assert.ok(s.cf.every(r=>r[1]===null));
});
