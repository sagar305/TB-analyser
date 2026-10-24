import test from 'node:test';
import assert from 'node:assert/strict';
import {samplePeriods,financials,ratios} from '../frontend/comparison.js';
import {statements} from '../frontend/statements.js';
import {variance,statementAnalysis,waterfall,workingCapital,checks,management} from '../frontend/analysis.js';
import {reportSections,excelPack,excelBytes,pdfPack} from '../frontend/report.js';
import {parseWorkbook} from '../frontend/workbook-import.js';
import fs from 'node:fs';
import vm from 'node:vm';
const ps=samplePeriods(),data={company:{name:'Test entity',currency:'USD',periods:ps}};
const context={setTimeout,clearTimeout,Uint8Array,ArrayBuffer,Array,Object,Date};
vm.createContext(context);
vm.runInContext(fs.readFileSync('frontend/vendor/xlsx.full.min.js','utf8'),context);
context.PDFLib={};new Function('exports','module',fs.readFileSync('frontend/vendor/pdf-lib.min.js','utf8'))(context.PDFLib,{exports:context.PDFLib});
const zipModule={exports:{}};new Function('exports','module',fs.readFileSync('frontend/vendor/jszip.min.js','utf8'))(zipModule.exports,zipModule);
test('all comparative statement values, percentages and variances share reconciled figures',()=>{
  const pl=statementAnalysis(ps,'pl'),bs=statementAnalysis(ps,'bs');
  assert.equal(pl.find(r=>r.label==='Revenue').values[2],234000000);
  assert.equal(pl.find(r=>r.label==='Revenue').commonSize[2],100);
  assert.equal(pl.find(r=>r.label==='Revenue').changes[2].change,27000000);
  assert.deepEqual(bs.at(-1).values,[0,0,0]);
  assert.equal(bs.find(r=>r.label==='Total assets').commonSize[2],100);
  assert.deepEqual(variance(100,0),{change:100,percent:null});
  assert.deepEqual(variance(100,-50),{change:150,percent:null});
  assert.deepEqual(variance(null,50),{change:null,percent:null});
});
test('EBITDA bridge reconciles exactly including losses and cost decreases',()=>{
  const p=structuredClone(ps[2]);p.rows.find(r=>r.group==='Operating expenses').debit+=100000000;
  for(const current of [ps[2],p]){
    const steps=waterfall(current,ps[1]);
    assert.equal(steps.slice(0,-1).reduce((n,s)=>n+s.value,0),financials(current).ebitda);
    assert.equal(steps.at(-2).end,steps.at(-1).value);
  }
  assert.deepEqual(waterfall(ps[0]),[]);
});
test('working capital equals balance-sheet amounts; unreviewed values stay missing',()=>{
  const w=workingCapital(ps[0]);assert.equal(w.cash,42000000);assert.equal(w.operating,58000000);assert.equal(w.net,100000000);
  const p=structuredClone(ps[0]);p.confirmed=false;
  assert.ok(Object.values(workingCapital(p)).every(v=>v===null));
});
test('cash-flow and TB mismatches trigger evidence, not fabricated reconciliation',()=>{
  const p=structuredClone(ps[0]);p.cashFlow.closing+=100;
  const issues=checks([p]);
  assert.ok(issues.some(x=>x.subject==='Cash-flow reconciliation'&&x.severity==='Error'));
  assert.ok(issues.some(x=>x.subject==='Cash flow to TB cash'&&x.severity==='Review'));
  p.rows[0].debit+=1;
  assert.equal(statements(p).bs.at(-1)[1],1);
  assert.ok(checks([p]).some(x=>x.subject==='TB reconciliation'&&x.severity==='Error'));
});
test('management questions trace findings, and missing cash is never estimated',()=>{
  const p=structuredClone(ps[2]);delete p.cfo;
  const items=management([ps[1],p]);
  assert.ok(items.some(x=>x.title==='Revenue movement'));
  assert.ok(items.some(x=>x.title==='Operating cash evidence unavailable'));
  assert.ok(items.every(x=>x.evidence&&x.question&&x.period===p.label));
  assert.deepEqual(management([]),[]);
});
test('losses do not mislabel supplied cash evidence as missing',()=>{
  const p=structuredClone(ps[2]);p.rows.find(r=>r.group==='Operating expenses').debit+=100000000;p.cfo=-10000;
  const items=management([p]);assert.ok(items.some(x=>x.title==='Negative operating cash flow'));
  assert.ok(!items.some(x=>x.title==='Operating cash evidence unavailable'));
});
test('ratios use the same closing equity as the reconciled balance sheet',()=>{
  const equity=statements(ps[0]).bs.find(r=>r[0]==='Total equity including unclosed P&L')[1];
  assert.equal(equity,130000000);
  assert.equal(ratios(ps[0]).debt,60000000/equity);
  assert.equal(ratios(ps[0]).roe,20000000/equity*100);
});
test('export models include all modules, missing cash and account-level audit trail',()=>{
  const sections=reportSections(data);
  for(const title of ['Management insights','Management questions','Profit and Loss','Balance Sheet','Cash Flow Statement','Ratios','Working capital','EBITDA waterfall','Evidence checks','TB FY 2025–26'])
    assert.ok(sections.some(x=>x.title===title),title);
  const book=excelPack(context.XLSX,data);
  const bytes=context.XLSX.write(book,{type:'buffer',bookType:'xlsx'});
  const roundtrip=context.XLSX.read(bytes,{type:'buffer'});
  assert.equal(roundtrip.SheetNames.length,sections.length+1);
  const pl=roundtrip.SheetNames.find(n=>n.endsWith('Profit and Loss'));
  const rows=context.XLSX.utils.sheet_to_json(roundtrip.Sheets[pl],{header:1});
  assert.equal(rows.find(r=>r[0]==='Profit after tax')[3],260000);
  assert.equal(rows.find(r=>r[0]==='Revenue')[3],2340000);
});
test('PDF export is readable and contains a complete paginated pack',async()=>{
  const bytes=await pdfPack(context.PDFLib,data);
  assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
  const pdf=await context.PDFLib.PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount()>=reportSections(data).length);
  assert.ok(bytes.length>10000);
});
test('formatted Excel preserves numeric values, wraps evidence and freezes headers',async()=>{
  const bytes=await excelBytes(context.XLSX,zipModule.exports,data);
  const zip=await zipModule.exports.loadAsync(bytes),xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(xml,/state="frozen"/);assert.match(await zip.file('xl/styles.xml').async('string'),/FF26306B/);
  const book=context.XLSX.read(bytes,{type:'array'}),pl=book.SheetNames.find(n=>n.endsWith('Profit and Loss'));
  assert.equal(context.XLSX.utils.sheet_to_json(book.Sheets[pl],{header:1}).find(r=>r[0]==='Profit after tax')[3],260000);
});
test('undated basic TB opens manual mapping, missing credit fails, supplied groups survive import',()=>{
  assert.equal(parseWorkbook([{name:'Ledger',grid:[['Account name','Debit','Credit'],['Cash',10,0]]}]),null);
  assert.throws(()=>parseWorkbook([{name:'2025',grid:[['Account name','Debit'],['Cash',10]]}]),/Credit/);
  const r=parseWorkbook([{name:'2025',grid:[['Account name','Debit','Credit','Ratio group'],['My custom bank',10,0,'Other current assets'],['Capital',0,10,'Equity']]}]);
  assert.equal(r.periods[0].rows[0].group,'Other current assets');
});
