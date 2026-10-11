// Optional local static server. No upload, analysis, or external API endpoints.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../frontend/',import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep) && file!==path.join(root,'index.html')){res.writeHead(403);return res.end();}
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('Setu TB Analyser: http://127.0.0.1:4173'));
