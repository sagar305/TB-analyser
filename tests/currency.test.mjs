import test from 'node:test';
import assert from 'node:assert/strict';
import {detectCurrency} from '../frontend/currency.js';
test('explicit ISO currency in a workbook cell is detected',()=>{assert.equal(detectCurrency({Sheets:{TB:{A1:{t:'s',v:'Currency: USD'},B1:{t:'n',v:10,z:'General'}}}}).currency,'USD');});
test('currency formats and ambiguous dollars are distinguished',()=>{assert.equal(detectCurrency({Sheets:{TB:{A1:{t:'n',v:1,z:'[$$-409]#,##0.00'}}}}).currency,'USD');assert.equal(detectCurrency({Sheets:{TB:{A1:{t:'n',v:1,z:'$#,##0.00'}}}}).currency,null);});
test('absent or conflicting currencies never default to INR',()=>{assert.equal(detectCurrency({Sheets:{}}).currency,null);assert.equal(detectCurrency({Sheets:{TB:{A1:{t:'s',v:'USD and INR'}}}}).currency,null);});
