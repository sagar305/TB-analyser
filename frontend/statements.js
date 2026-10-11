import {financials} from './comparison.js';

export function statements(p){
 const f=financials(p),t=f.t;
 const pl=[['Revenue',f.revenue],['Cost of sales',-f.cogs],['Gross profit',f.revenue-f.cogs],['Other income',t['Other income']],['Operating expenses',-t['Operating expenses']],['EBITDA',f.ebitda],['Depreciation & amortisation',-t['Depreciation & amortisation']],['EBIT',f.ebit],['Finance costs',-t['Interest expense']],['Profit before tax',f.ebit-t['Interest expense']],['Tax expense',-t['Tax expense']],['Profit after tax',f.profit]];
 const liabilities=f.currentLiabilities+t['Long-term debt']+t['Other non-current liabilities'];
 const bs=[['Cash & bank',t['Cash & bank']],['Trade receivables',t.Receivables],['Inventory',t.Inventory],['Prepayments',t.Prepayments],['Other current assets',t['Other current assets']],['Total current assets',f.currentAssets],['Non-current assets',t['Non-current assets']],['Total assets',f.assets],['Trade payables',t['Trade payables']],['Short-term debt',t['Short-term debt']],['Other current liabilities',t['Other current liabilities']],['Total current liabilities',f.currentLiabilities],['Long-term debt',t['Long-term debt']],['Other non-current liabilities',t['Other non-current liabilities']],['Total liabilities',liabilities],['Mapped equity / reserves',f.equity],['Unclosed P&L balance',f.profit],['Total equity including unclosed P&L',f.equity+f.profit],['Total liabilities & equity',liabilities+f.equity+f.profit],['Balance sheet difference',f.assets-liabilities-f.equity-f.profit]];
 // A missing supporting cash-flow value is never treated as zero.
 const cash=p.cashFlow||{},valid=n=>Number.isSafeInteger(n)?n:null;
 const cfo=p.cfoSource?.trim()?valid(p.cfo):null;
 const v=key=>p.cfoSource?.trim()?valid(cash[key]):null;
 const sum=(...xs)=>xs.every(x=>x!==null)?xs.reduce((a,b)=>a+b,0):null;
 const movement=sum(cfo,v('investing'),v('financing'));
 const calculated=sum(v('opening'),movement,v('fx'));
 const difference=calculated!==null&&v('closing')!==null?v('closing')-calculated:null;
 const cf=[['Cash flow from operating activities',cfo],['Cash flow from investing activities',v('investing')],['Cash flow from financing activities',v('financing')],['Net cash movement before exchange effects',movement],['Exchange / other reconciling effects',v('fx')],['Opening cash & cash equivalents',v('opening')],['Calculated closing cash & cash equivalents',calculated],['Reported closing cash & cash equivalents',v('closing')],['Cash-flow reconciliation difference',difference]];
 return {pl:pl.map(([label,value])=>[label,f.ready?value:null]),bs:bs.map(([label,value])=>[label,f.ready?value:null]),cf};
}
