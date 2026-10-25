import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('all runtime app assets are bundled and cached with no external application calls',()=>{
  const html=fs.readFileSync('frontend/index.html','utf8'),sw=fs.readFileSync('frontend/sw.js','utf8');
  assert.match(html,/connect-src 'none'/);
  // The canonical link names the public product page; it is never fetched.
  for(const [,asset] of html.replace(/<link rel="canonical"[^>]*>/,'').matchAll(/(?:src|href)="([^"]+)"/g)){
    assert.ok(!/^https?:/.test(asset),asset);
    assert.ok(fs.existsSync('frontend/'+asset),asset);
    assert.ok(sw.includes("'./"+asset+"'"),asset+' missing from offline cache');
  }
  for(const path of fs.readdirSync('frontend').filter(p=>p.endsWith('.js')&&p!=='sw.js')){
    const source=fs.readFileSync('frontend/'+path,'utf8');
    assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
    assert.ok(sw.includes("'./"+path+"'"),path+' missing from offline cache');
  }
  for(const [,font] of fs.readFileSync('frontend/style.css','utf8').matchAll(/url\(([^)]+)\)/g)){
    assert.ok(fs.existsSync('frontend/'+font),font);
    assert.ok(sw.includes("'./"+font+"'"),font+' missing from offline cache');
  }
});
