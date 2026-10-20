import {financials,ratios,ratioDefinitions,ratioReasoning,accountMovements} from './comparison.js';
import {statements} from './statements.js';
import {statementAnalysis,waterfall,workingCapital,workingCapitalDefinitions,checks,management} from './analysis.js';

const numeric=v=>v===null||v===undefined?'Not available':v;
const units=v=>v===null||v===undefined?'Not available':v/100;
export function reportSections(data) {
  const sections=[];
  for(const [key,client] of Object.entries(data)) {
    const ps=client.periods.filter(Boolean).sort((a,b)=>a.end.localeCompare(b.end));
    if(!ps.length)continue;
    const add=(title,headers,rows,note='')=>sections.push({client:client.name,currency:client.currency||'Unspecified',key,title,headers,rows,note,status:ps.some(p=>p.sample)?'ILLUSTRATIVE':ps.some(p=>!p.confirmed)?'DRAFT':'REVIEWED MAPPINGS'});
    const note=`${ps.some(p=>p.sample)?'ILLUSTRATIVE SAMPLE. ':''}${ps.some(p=>!p.confirmed)?'DRAFT: classifications require review. ':''}Amounts in ${client.currency||'unspecified currency'}; no currency conversion.`;
    add('Review summary',['Period','Start','End','Source','TB difference','Mapping'],ps.map(p=>[p.label,p.start,p.end,`${p.source} / ${p.sheet}`,units(financials(p).base.difference),p.confirmed?'Reviewed':'Draft']),note);
    add('Financial dashboard',['KPI',...ps.map(p=>p.label)],[['revenue','Revenue'],['ebitda','EBITDA'],['profit','Profit after tax'],['assets','Total assets']].map(([id,label])=>[label,...ps.map(p=>financials(p).ready?units(financials(p)[id]):'Not available')]),note);
    sections.at(-1).chart=ps.filter(p=>financials(p).ready).map(p=>({label:p.label,value:financials(p).revenue/100,start:0,end:financials(p).revenue/100}));
    const findings=management(ps);
    add('Management insights',['Type','Finding','Evidence'],findings.map(f=>[f.severity,f.title,f.evidence]),'Rule-based screening. Movements are observations, not established causes. 5% prior revenue materiality; 1 percentage-point margin and 5-day efficiency triggers.');
    add('Management questions',['Finding','Question'],findings.map(f=>[f.title,f.question]));
    for(const [id,title] of [['pl','Profit and Loss'],['bs','Balance Sheet'],['cf','Cash Flow Statement']]){
      const ss=ps.map(statements);
      add(title,['Particulars',...ps.map(p=>p.label)],ss[0][id].map(([label],i)=>[label,...ss.map(s=>units(s[id][i][1]))]),id==='cf'?'Cash flow requires supporting evidence; missing values are not estimated. Sources: '+ps.map(p=>`${p.label}: ${p.cfoSource||'Not supplied'}`).join('; '):note);
      if(id!=='cf'){
        const analysis=statementAnalysis(ps,id);
        add(`${title} common size`,['Particulars',...ps.map(p=>p.label+' %')],analysis.map(r=>[r.label,...r.commonSize.map(numeric)]),id==='pl'?'Percentage of revenue. Expense deductions retain negative signs.':'Percentage of total assets.');
        add(`${title} variance`,['Particulars',...ps.slice(1).flatMap(p=>[p.label+' change',p.label+' %'])],analysis.map(r=>[r.label,...r.changes.slice(1).flatMap(v=>[units(v.change),numeric(v.percent)])]),'Each period versus its predecessor. Percentage changes require a positive prior value; negative/zero baselines are not meaningful. Different durations are not like-for-like.');
      }
    }
    add('Ratios',['Ratio',...ps.map(p=>p.label),'Unit','Interpretation'],ratioDefinitions.map(([id,label,unit])=>[label,...ps.map((p,i)=>numeric(ratios(p,ps[i-1])[id])),unit,ratioReasoning[id]]),'Closing balance day ratios are proxies; ROA requires a contiguous opening period. Unavailable values reflect missing inputs or non-positive denominators.');
    add('Working capital',['Metric',...ps.map(p=>p.label)],workingCapitalDefinitions.map(([id,label])=>[label,...ps.map(p=>units(workingCapital(p)[id]))]),'Balance movements are not a cash-flow statement. Ageing, credit terms and stock obsolescence require supporting schedules.');
    add('EBITDA waterfall',['Step','EBITDA contribution','Running EBITDA'],waterfall(ps.at(-1),ps.at(-2)).map(x=>[x.label,units(x.value),units(x.end)]),'Prior EBITDA plus revenue, other income and cost contributions reconciles to latest EBITDA.');
    sections.at(-1).chart=waterfall(ps.at(-1),ps.at(-2)).map(x=>({...x,value:x.value/100,start:x.start/100,end:x.end/100}));
    add('Account movements',['Account','Prior net debit','Latest net debit','Change'],accountMovements(ps.at(-1),ps.at(-2)).map(x=>[x.name,units(x.prior),units(x.current),units(x.change)]),'Matched by trimmed account names; duplicate names aggregate. Renamed accounts appear separately.');
    add('Evidence checks',['Period','Result','Check','Evidence'],checks(ps).map(x=>[x.period,x.severity,x.subject,x.detail]));
    for(const p of ps) add(`TB ${p.label}`,['Account','Debit','Credit','Group','GL code','Source row'],p.rows.map(r=>[r.name,units(r.debit),units(r.credit),r.group,r.code||'',r.sourceRow]),`${p.source} / ${p.sheet}; ${p.start} to ${p.end}.`);
    if(key!=='peer'&&data.peer?.periods.some(Boolean)) {
      const peers=data.peer.periods.filter(Boolean).sort((a,b)=>a.end.localeCompare(b.end)),rows=[];
      ps.forEach((p,i)=>{const j=peers.findIndex(q=>q.start===p.start&&q.end===p.end);if(j<0)return;const a=ratios(p,ps[i-1]),b=ratios(peers[j],peers[j-1]);ratioDefinitions.forEach(([id,label,unit])=>rows.push([p.label,label,numeric(a[id]),numeric(b[id]),a[id]===null||b[id]===null?'Not available':a[id]-b[id],unit]));});
      add('Peer comparison',['Period','Ratio',client.name,data.peer.name,'Difference','Unit'],rows,'Only identical period dates. Ratios are dimensionless; accounting policies and business models may differ.');
    }
  }
  return sections;
}

export function excelPack(XLSX,data) {
  const book=XLSX.utils.book_new(),sections=reportSections(data),index=[['Sheet','Company','Section','Currency']];
  sections.forEach((s,i)=>{
    const name=`${i+1} ${s.title}`.replace(/[:\\/?*[\]]/g,'').slice(0,31);
    const rows=[['SETU | FINANCIAL REVIEW',s.client],['Currency',s.currency],['Notes',s.note],[],s.headers,...(s.rows.length?s.rows:[['No comparison available']])];
    const sheet=XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols']=s.headers.map((h,j)=>({wch:Math.min(65,s.rows.reduce((max,r)=>Math.max(max,typeof r[j]==='string'?Math.min(r[j].length,55):18),Math.max(18,h.length)))}));
    sheet['!merges']=[{s:{r:0,c:1},e:{r:0,c:s.headers.length-1}},{s:{r:2,c:1},e:{r:2,c:s.headers.length-1}}];
    sheet['!rows']=rows.map((row,r)=>({hpt:r===0||r===4?30:r===2?Math.max(30,Math.ceil(s.note.length/100)*15):Math.max(22,...row.map((v,c)=>Math.ceil(String(v??'').length/(sheet['!cols'][c]?.wch||40))*14+8))}));
    sheet['!autofilter']={ref:XLSX.utils.encode_range({r:4,c:0},{r:rows.length-1,c:s.headers.length-1})};
    for(const [address,cell] of Object.entries(sheet))if(!address.startsWith('!')&&cell.t==='n')cell.z='#,##0.00;[Red](#,##0.00);0.00';
    XLSX.utils.book_append_sheet(book,sheet,name);index.push([name,s.client,s.title,s.currency]);
  });
  if(!sections.length)throw Error('Import a trial balance before exporting.');
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(index),'Contents');
  return book;
}

export async function excelBytes(XLSX,JSZip,data) {
  const book=excelPack(XLSX,data),zip=await JSZip.loadAsync(XLSX.write(book,{type:'array',bookType:'xlsx'}));
  let styles=await zip.file('xl/styles.xml').async('string');
  function append(tag,xml) {
    let index;
    styles=styles.replace(new RegExp(`<${tag} count="(\\d+)"[^>]*>([\\s\\S]*?)</${tag}>`),(all,count,body)=>{
      index=Number(count);return `<${tag} count="${index+1}">${body}${xml}</${tag}>`;
    });
    if(index===undefined)throw Error('Unable to format workbook styles.');
    return index;
  }
  const font=append('fonts','<font><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><b/></font>');
  const fill=append('fills','<fill><patternFill patternType="solid"><fgColor rgb="FF173E31"/><bgColor indexed="64"/></patternFill></fill>');
  const header=append('cellXfs',`<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`);
  const body=append('cellXfs','<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>');
  zip.file('xl/styles.xml',styles);
  for(const [index,name] of book.SheetNames.entries()) {
    const path=`xl/worksheets/sheet${index+1}.xml`;let xml=await zip.file(path).async('string');
    xml=xml.replace(/<c\b([^>]*)>/g,(all,attrs)=>{
      const row=Number(attrs.match(/\br="[A-Z]+(\d+)"/)?.[1]),heading=row===1||(name!=='Contents'&&row===5);
      if(!heading&&!/\bt="(?:s|str)"/.test(attrs))return all;
      return `<c${attrs.replace(/\s+s="\d+"/,'')} s="${heading?header:body}">`;
    });
    xml=xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/,`<sheetViews><sheetView workbookViewId="0"><pane ySplit="${name==='Contents'?1:5}" topLeftCell="A${name==='Contents'?2:6}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`);
    zip.file(path,xml);
  }
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}

// PDF uses a bundled library, never a network resource. Fixed-width columns,
// repeated headers and wrapped text keep the same report model readable.
export async function pdfPack(PDFLib,data) {
  const {PDFDocument,StandardFonts,rgb}=PDFLib,doc=await PDFDocument.create();
  const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const green=rgb(.09,.24,.19),ink=rgb(.13,.18,.15),pale=rgb(.93,.95,.91);
  let page,y,pageNo=0;
  const clean=s=>String(s??'').replace(/[–—−]/g,'-').replace(/→/g,' to ').replace(/₹/g,'INR ').replace(/×/g,'x').replace(/[^\x20-\x7e\n\u00a0-\u00ff]/gu,ch=>'[U+'+ch.codePointAt(0).toString(16).toUpperCase()+']');
  const wrap=(value,width,size=9)=>{
    const words=clean(typeof value==='number'?value.toLocaleString('en-US',{maximumFractionDigits:2}):value).split(/\s+/),lines=[];let line='';
    for(const word of words) {
      if(font.widthOfTextAtSize(line+(line?' ':'')+word,size)<=width){line+=(line?' ':'')+word;continue;}
      if(line)lines.push(line);line='';
      for(const ch of word){if(font.widthOfTextAtSize(line+ch,size)>width){lines.push(line);line='';}line+=ch;}
    }
    if(line||!lines.length)lines.push(line);return lines;
  };
  const text=(s,x,yy,size=9,strong=false)=>page.drawText(clean(s),{x,y:yy,size,font:strong?bold:font,color:ink});
  const newPage=s=>{
    page=doc.addPage([842,595]);pageNo++;y=530;
    page.drawRectangle({x:0,y:555,width:842,height:40,color:green});
    page.drawText('SETU / FINANCIAL REVIEW',{x:32,y:570,size:13,font:bold,color:rgb(1,1,1)});
    for(const line of wrap(`${s.client} | ${s.currency} | ${s.title}`,760,11)){text(line,32,y,11,true);y-=14;}y-=8;
    text(`${s.status} | Offline analysis | Review classifications and evidence before relying on results`,32,20,8);
    text(`Page ${pageNo}`,750,20,8);
  };
  for(const s of reportSections(data)) {
    newPage(s);
    for(const line of wrap(s.note,778)){text(line,32,y);y-=12;}y-=12;
    if(s.chart?.length) {
      const lo=Math.min(0,...s.chart.flatMap(x=>[x.start,x.end])),hi=Math.max(0,...s.chart.flatMap(x=>[x.start,x.end])),span=hi-lo||1,base=y-135;
      const yy=v=>base+(v-lo)/span*100,slot=740/s.chart.length;
      text(s.title==='Financial dashboard'?'Revenue trend':'EBITDA bridge',40,y,10,true);y-=15;
      s.chart.forEach((v,i)=>{
        const x=45+i*slot,bottom=Math.min(yy(v.start),yy(v.end));
        page.drawRectangle({x,y:bottom,width:slot*.65,height:Math.max(1,Math.abs(yy(v.end)-yy(v.start))),color:v.value<0?rgb(.7,.4,.3):green});
        text(v.value.toLocaleString('en-US',{maximumFractionDigits:2}),x,Math.max(yy(v.start),yy(v.end))+5,8);
        text(v.label,x,base-16,8);
      });
      y=base-40;
    }
    const n=s.headers.length,widths=n===2?[225,553]:n===3?[115,205,458]:Array.from({length:n},(_,i)=>i===0?210:568/(n-1));
    if(s.title==='Evidence checks')widths.splice(0,4,95,65,170,448);
    if(s.title==='Ratios') {const middle=n-2;widths.splice(0,n,140,...Array(middle).fill(75),778-140-75*middle);}
    const drawRow=(values,heading=false)=>{
      const lines=values.map((v,i)=>wrap(v,widths[i]-14,heading?8:9));
      let remaining=Math.max(...lines.map(a=>a.length)),offset=0;
      if(y-Math.min(remaining,8)*12-12<44){newPage(s);if(!heading)drawRow(s.headers,true);}
      while(remaining>0){
        const count=Math.min(remaining,Math.max(1,Math.floor((y-56)/12))),height=count*12+12;
        if(heading)page.drawRectangle({x:32,y:y-height+4,width:778,height,color:pale});
        let x=32;lines.forEach((ls,i)=>{ls.slice(offset,offset+count).forEach((l,j)=>text(l,x+7,y-9-j*12,heading?8:9,heading));x+=widths[i];});
        y-=height;page.drawLine({start:{x:32,y:y+3},end:{x:810,y:y+3},thickness:.4,color:rgb(.85,.88,.84)});
        remaining-=count;offset+=count;
        if(remaining>0){newPage(s);if(!heading)drawRow(s.headers,true);}
      }
    };
    drawRow(s.headers,true);
    for(const row of s.rows.length?s.rows:[['No comparison available',...s.headers.slice(1).map(()=>'')]])drawRow(row);
  }
  if(!pageNo)throw Error('Import a trial balance before exporting.');
  doc.setTitle('SETU Financial Review');doc.setAuthor('SETU Offline TB Analyzer');
  return doc.save();
}
