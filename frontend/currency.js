export const currencies=['USD','INR','EUR','GBP','CAD','AUD','NZD','SGD','HKD','AED','SAR','JPY','CNY','CHF'];
export function detectCurrency(book){
 const found=new Set();let dollar=false;
 const inspect=value=>{const s=String(value??'');for(const code of currencies)if(new RegExp('\\b'+code+'\\b','i').test(s))found.add(code);
 if(/₹/.test(s))found.add('INR');if(/€/.test(s))found.add('EUR');if(/£/.test(s))found.add('GBP');if(/US\$|\[\$\$-409\]/i.test(s))found.add('USD');if(/\$/.test(s))dollar=true;};
 for(const s of Object.values(book.Sheets||{}))for(const [key,cell] of Object.entries(s))if(!key.startsWith('!')){if(cell.t==='s')inspect(cell.v);inspect(cell.z);for(const comment of cell.c||[])inspect(comment.t);}
 for(const props of [book.Props,book.Custprops])for(const [key,value] of Object.entries(props||{}))if(/currency|title|subject|comments/i.test(key))inspect(value);
 return {currency:found.size===1?[...found][0]:null,reason:found.size>1?'Multiple currencies found; select the reporting currency.':found.size===1?'Currency detected from workbook.':dollar?'Dollar symbol is ambiguous; select the reporting currency.':'No currency specified in readable workbook data; select the reporting currency.'};
}
