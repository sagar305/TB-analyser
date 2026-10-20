const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Local SVG only: keyboard-focusable marks expose the same exact values as hover.
export function barChart(items,{label='Financial trend',format=String,waterfall=false}={}) {
  const valid=items.filter(x=>x.value!==null&&Number.isFinite(x.value));
  if(!valid.length)return '<p>No calculated values available for this chart.</p>';
  const lo=Math.min(0,...valid.flatMap(x=>waterfall?[x.start,x.end]:[x.value]));
  const hi=Math.max(0,...valid.flatMap(x=>waterfall?[x.start,x.end]:[x.value]));
  const span=hi-lo||1,y=v=>205-(v-lo)/span*160,slot=660/valid.length;
  return `<svg class="financial-chart" viewBox="0 0 760 290" role="img" aria-label="${escape(label)}"><text x="15" y="18">${escape(label)}</text><line x1="65" x2="745" y1="${y(0)}" y2="${y(0)}" stroke="#879d8c"/>${valid.map((x,i)=>{
    const start=waterfall?x.start:0,end=waterfall?x.end:x.value,top=Math.min(y(start),y(end));
    const caption=`${x.label}: ${(x.value/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    return `<g tabindex="0" aria-label="${escape(caption)}"><title>${escape(caption)}</title><rect x="${75+i*slot}" y="${top}" width="${slot*.65}" height="${Math.max(2,Math.abs(y(end)-y(start)))}" fill="${x.value<0?'#b66a51':x.isTotal?'#173e31':'#6d987e'}"/><text x="${75+i*slot}" y="${Math.max(35,top-8)}">${escape(format(x.value))}</text><text x="${75+i*slot}" y="238">${escape(x.label.slice(0,23))}</text></g>`;
  }).join('')}</svg>`;
}
