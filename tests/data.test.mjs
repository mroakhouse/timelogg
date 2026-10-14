import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {validateDay,emptyDay,week,shift,importLegacy,total} from '../src/model.js';
import {createHandler} from '../netlify/functions/data.mjs';
import {createBlobRepository} from '../netlify/functions/lib/blob-repository.mjs';
import {createSqlRepository} from '../netlify/functions/lib/sql-repository.mjs';
import {messages} from '../src/i18n.js';
const entry={id:'e1',kind:'time',start:'08:00',end:'10:30',hours:99,desc:'Work',order:'WBS-1'};
test('time validation calculates duration, rejects overlaps and invalid ranges',()=>{
 const d=validateDay({...emptyDay(),entries:[entry]});assert.equal(d.entries[0].hours,2.5);
 assert.throws(()=>validateDay({...d,entries:[...d.entries,{...entry,id:'e2',start:'10:00',end:'11:00',hours:1}]}),/overlap/);
 assert.throws(()=>validateDay({...d,entries:[{...entry,start:'23:00',end:'01:00',hours:2}]}),/invalidTime/);
 assert.throws(()=>validateDay({...d,target:25}),/invalidTarget/);
});
test('week and legacy imports preserve decimal hours without inventing start times',()=>{
 assert.equal(week('2026-09-20')[0],'2026-09-14');assert.equal(shift('2026-03-29',1),'2026-03-30');
 const data=importLegacy({timelogg:{'2026-09-20':{target:7.5,entries:[{desc:'Legacy',order:'ABC',hours:1.25}]}}});
 assert.equal(data['2026-09-20'].entries[0].kind,'manual');assert.equal(total(data['2026-09-20']),1.25);
 assert.throws(()=>importLegacy({'2026-02-30':{entries:[]}}),/invalidDay/);
});
test('both languages contain the same translation keys',()=>assert.deepEqual(Object.keys(messages.nb).sort(),Object.keys(messages.en).sort()));
// In-memory stand-in for a Netlify Blobs store with production ETag semantics
// (the bundled local BlobsServer omits ETags on reads, so conditional writes can't be tested against it).
function memoryStore(){
 const data=new Map();let version=0;
 const tick=()=>new Promise(r=>setTimeout(r,Math.random()*5));
 return {
  async list({prefix=''}={}){await tick();return {blobs:[...data].filter(([k])=>k.startsWith(prefix)).map(([key,v])=>({key,etag:v.etag})),directories:[]};},
  async get(key){await tick();return data.has(key)?structuredClone(data.get(key).value):null;},
  async getWithMetadata(key){await tick();const v=data.get(key);return v?{data:structuredClone(v.value),etag:v.etag,metadata:{}}:null;},
  async setJSON(key,value,{onlyIfMatch,onlyIfNew}={}){await tick();const v=data.get(key);if((onlyIfNew&&v)||(onlyIfMatch&&v?.etag!==onlyIfMatch))return {modified:false};const etag=`"${++version}"`;data.set(key,{value:structuredClone(value),etag});return {etag,modified:true};},
 };
}
async function apiScenario(repository){
 const factory=id=>createHandler({authenticate:async()=>id?{id}:null,repository});
 const request=(method,body,origin='https://test.example')=>new Request('https://test.example/api/data',{method,headers:{origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const a=factory('alice'),b=factory('bob'),d={...emptyDay(),entries:[{...entry,hours:2.5}]};
 assert.equal((await factory(null)(request('GET'))).status,401);
 const switched=request('PUT',{date:'2026-09-20',day:d});switched.headers.set('X-Timelogg-Account','bob');assert.equal((await a(switched)).status,401);
 assert.equal((await a(request('PUT',{date:'2026-09-20',day:d},'https://evil.example'))).status,403);
 assert.equal((await a(request('PUT',{date:'2026-09-20',day:d,owner_id:'bob'}))).status,200);
 let response=await (await a(request('GET'))).json();assert.equal(response.days['2026-09-20'].revision,1);assert.equal(response.days['2026-09-20'].entries[0].hours,2.5);
 assert.deepEqual((await (await b(request('GET'))).json()).days,{});
 assert.equal((await a(request('PUT',{date:'2026-09-20',day:d}))).status,409);
 assert.equal((await b(request('PUT',{date:'2026-09-20',day:{...d,note:'Bob'}}))).status,200);
 assert.equal((await a(request('PUT',{date:'2026-09-20',day:{...d,revision:1,entries:[]}}))).status,200);
 response=await (await b(request('GET'))).json();assert.equal(response.days['2026-09-20'].entries.length,1);
 assert.equal((await a(request('POST',{code:'P1',name:'Alice project'}))).status,200);
 assert.deepEqual((await (await b(request('GET'))).json()).projects,[]);
 assert.equal((await a(request('PUT',{date:'2026-09-20',day:{...d,target:100}}))).status,400);
}
test('real SQL (disabled storage): owners isolated, revisions conflict, API rejects unauthenticated and cross-origin requests',async()=>{
 const db=new PGlite();await db.exec(await readFile(new URL('../disabled/database/migrations/202609200001_timelogg.sql',import.meta.url),'utf8'));
 const client={query:(sql,args)=>db.query(sql,args),release(){}};
 await apiScenario(createSqlRepository(()=>({pool:{connect:async()=>client}})));
 await db.close();
});
test('Netlify Blobs: owners isolated, revisions conflict, parallel saves in one month are not lost',async()=>{
 const store=memoryStore();
 const repository=createBlobRepository(()=>store);
 await apiScenario(repository);
 const d={...emptyDay(),entries:[{...entry,hours:2.5}]},dates=Array.from({length:8},(_,i)=>`2026-10-0${i+1}`);
 assert.deepEqual(await Promise.all(dates.map(date=>repository.writeDay('carol',date,d))),dates.map(()=>1));
 assert.deepEqual(Object.keys((await repository.readData('carol')).days),dates);
 await assert.rejects(repository.readData('../alice'),/invalidOwner/);
});
