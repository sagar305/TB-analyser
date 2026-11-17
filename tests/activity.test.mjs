import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {announce,milestones} from '../frontend/activity.js';

function framed(){
  const seen=[];
  class CustomEvent{constructor(type,init){this.type=type;this.detail=init.detail;}}
  const parent={CustomEvent,dispatchEvent:e=>seen.push(e)};
  return {host:{parent},seen};
}

test('a framed app tells its page a listed milestone and nothing more',()=>{
  const {host,seen}=framed();
  assert.equal(announce('excel_exported',host),true);
  assert.equal(seen.length,1);
  assert.equal(seen[0].type,'setu:activity');
  assert.deepEqual(seen[0].detail,{product:'tb',name:'excel_exported'});
});

test('an unlisted name is never announced',()=>{
  const {host,seen}=framed();
  assert.equal(announce('Aarohi Enterprises revenue 4,20,000',host),false);
  assert.equal(seen.length,0);
});

test('opened on its own, or under another origin, the app announces nothing',()=>{
  const alone={};alone.parent=alone;
  assert.equal(announce('sample_loaded',alone),false);
  assert.equal(announce('sample_loaded',{}),false);
  const foreign={parent:{get CustomEvent(){throw new Error('cross-origin');}}};
  assert.equal(announce('sample_loaded',foreign),false);
});

test('every call passes a literal name from the list, so no figure can ride along',()=>{
  const source=fs.readFileSync('frontend/app.js','utf8');
  const calls=[...source.matchAll(/announce\(([^)]*)\)/g)].map(m=>m[1]);
  assert.ok(calls.length>=milestones.length);
  for(const argument of calls){
    const literal=argument.match(/^'([a-z_]+)'$/);
    assert.ok(literal,'not a bare literal: '+argument);
    assert.ok(milestones.includes(literal[1]),literal[1]);
  }
  assert.deepEqual([...new Set(calls.map(c=>c.slice(1,-1)))].sort(),[...milestones].sort());
});

test('the announcer reaches no network and no storage',()=>{
  const source=fs.readFileSync('frontend/activity.js','utf8').replace(/^\s*\/\/.*$/gm,'');
  assert.doesNotMatch(source,/\bfetch\b|XMLHttpRequest|WebSocket|sendBeacon|postMessage|localStorage|indexedDB|\bimport\b/);
});
