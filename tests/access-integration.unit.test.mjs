import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const scanner=ts.transpileModule(await fs.readFile(new URL('../src/lib/scanner.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^export /gm,'');
const modules=(await Promise.all(['rbac','history'].map(name=>fs.readFile(new URL(`../worker/${name}.mjs`,import.meta.url),'utf8')))).map(s=>s.replace(/^export /gm,'')).join('\n');
const index=(await fs.readFile(new URL('../worker/index.mjs',import.meta.url),'utf8')).replace(/^import .*\n/gm,'');
const {api,default:worker}=await import('data:text/javascript;base64,'+Buffer.from(scanner+'\n'+modules+'\n'+index).toString('base64'));
function fixture(){const map=new Map();return {map,BUCKET:{get:async key=>map.has(key)?{json:async()=>JSON.parse(map.get(key))}:null,put:async(key,value)=>map.set(key,value)}};}
const request=(path,id,body)=>new Request('https://private.example'+path,{method:body?'POST':'GET',headers:{...(id?{'oai-authenticated-user-id':id}:{}),'content-type':'application/json',origin:'https://private.example'},...(body?{body:JSON.stringify(body)}:{})});
test('HTTP APIs fail closed before reading premium data or fetching upstream',async()=>{const env=fixture(),original=fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('must not fetch')};try{
 assert.equal((await api(request('/api/scan/status'),env)).status,401);
 assert.equal((await api(request('/api/scan/status','free-user'),env)).status,403);
 assert.equal((await api(request('/api/history?assets=btc&start=2020-01-01&end=2020-01-10','free-user'),env)).status,403);
 assert.equal((await api(request('/api/admin/members','free-user',{userId:'free-user',role:'paid'}),env)).status,403);
 assert.equal(calls,0);
 env.map.set('rbac/members/paid-user.json',JSON.stringify({id:'paid-user',role:'paid'}));
 assert.equal((await api(request('/api/scan/status','paid-user'),env)).status,200);
 assert.equal((await api(request('/api/admin/members','paid-user'),env)).status,403);
 }finally{globalThis.fetch=original;}});
test('MCP forwards visitor identity and cannot turn a free visitor into a service',async()=>{const env={...fixture(),TIDE_PRIVATE_SERVICE_SCAN:'owner-private'};
 const mcp=new Request('https://private.example/mcp',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'free-user'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'scan_status',arguments:{role:'admin',privateService:true}}})});
 const result=await(await worker.fetch(mcp,env)).json();assert.equal(result.result.isError,true);assert.equal(JSON.parse(result.result.content[0].text).code,'FORBIDDEN');
 const noService=new Request('https://private.example/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'scan_status',arguments:{}}})});
 assert.equal((await(await worker.fetch(noService.clone(),fixture())).json()).result.isError,true);
 assert.equal((await(await worker.fetch(noService,env)).json()).result.isError,false);
});
