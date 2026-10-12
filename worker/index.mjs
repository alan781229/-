import {evaluateCandles,defaultRules} from '../src/lib/scanner.ts';
const VERSION='tide-worker-2';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const read=async(bucket,key)=>{const object=await bucket.get(key);return object?object.json():null;};
const write=(bucket,key,value)=>bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
async function remote(path){const response=await fetch(`https://fapi.binance.com${path}`,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error(`Binance HTTP ${response.status}`);return response.json();}
function rulesFrom(value={}){const rules={...defaultRules,...value};if(!['strict','trend','pullback'].includes(rules.preset)||!['both','long','short'].includes(rules.direction)||!['ma','ema','slope'].every(k=>typeof rules[k]==='boolean')||!Number.isFinite(rules.volumeRatio)||rules.volumeRatio<0||rules.volumeRatio>20||(!rules.ma&&!rules.ema))throw Error('篩選條件無效');return rules;}
export async function api(request,env){const path=new URL(request.url).pathname;if(path==='/api/health')return json({ok:true,storage:Boolean(env.BUCKET),version:VERSION});if(!path.startsWith('/api/scan/'))return json({error:'找不到 API'},404);if(!env.BUCKET)return json({error:'尚未綁定持久儲存 BUCKET'},503);if(request.method!=='GET'&&request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'來源不符'},403);
 const bucket=env.BUCKET;try{
 if(path==='/api/scan/status'&&request.method==='GET')return json({progress:await read(bucket,'scan/progress.json'),snapshot:await read(bucket,'scan/snapshot.json'),singleWriter:true});
 if(request.method!=='POST')return json({error:'方法不支援'},405);
 const body=await request.json();
 if(path==='/api/scan/begin'){
 const previous=await read(bucket,'scan/progress.json');if(previous?.status==='running'&&Date.now()-Date.parse(previous.updatedAt)<15*60*1000)return json({error:'掃描仍在進行',progress:previous},409);
 const rules=rulesFrom(body.rules);const info=await remote('/fapi/v1/exchangeInfo');const symbols=[...new Set(info.symbols.filter(s=>s.quoteAsset==='USDT'&&s.contractType==='PERPETUAL'&&s.status==='TRADING'&&/^[A-Z0-9_]+USDT$/.test(s.symbol)).map(s=>s.symbol))];if(!symbols.length)throw Error('找不到可交易的 USDT 永續合約');
 const clock=await remote('/fapi/v1/time');if(!Number.isFinite(Number(clock.serverTime)))throw Error('交易所時間無效');
 const now=new Date().toISOString();const run={runId:crypto.randomUUID(),status:'running',total:symbols.length,completed:0,offset:0,failed:0,results:[],errors:[],startedAt:now,updatedAt:now,symbols,rules,exchangeTime:Number(clock.serverTime)};await write(bucket,'scan/progress.json',run);return json(run);
 }
 if(path==='/api/scan/step'){
 const run=await read(bucket,'scan/progress.json');if(!run||run.runId!==body.runId||run.offset!==body.offset||run.status!=='running')return json({error:'掃描版本或位置已變更',progress:run},409);
 const batch=run.symbols.slice(run.offset,run.offset+8);
 const outcomes=await Promise.all(batch.map(async symbol=>{try{const raw=await remote(`/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=15m&limit=301`);if(!Array.isArray(raw))throw Error('K 線格式無效');const candles=raw.filter(row=>Number(row[6])<run.exchangeTime).map(row=>({time:Number(row[0]),close:Number(row[4]),volume:Number(row[5])}));if(candles.some(c=>!Number.isFinite(c.close)||c.close<=0||!Number.isFinite(c.volume)||c.volume<0))throw Error('K 線數值無效');return {result:evaluateCandles(symbol,candles,run.rules)};}catch(error){return {error:{symbol,message:String(error.message||error)}};}}));
 const latest=await read(bucket,'scan/progress.json');if(latest?.runId!==run.runId||latest.offset!==run.offset)return json({error:'掃描位置已由其他請求更新'},409);
 for(const outcome of outcomes){if(outcome.error){run.failed++;run.errors.push(outcome.error);}else if(outcome.result)run.results.push(outcome.result);}run.completed+=batch.length;run.offset=run.completed;run.updatedAt=new Date().toISOString();if(run.completed===run.total){run.status=run.failed===run.total?'failed':'completed';if(run.status==='completed')await write(bucket,'scan/snapshot.json',run);}await write(bucket,'scan/progress.json',run);return json(run);
 }return json({error:'找不到 API'},404);
 }catch(error){return json({error:String(error.message||error)},502);}}
export default {async fetch(request,env){if(new URL(request.url).pathname==='/mcp')return mcp(request,env);if(new URL(request.url).pathname.startsWith('/api/'))return api(request,env);return serveAsset(request);}};
function serveAsset(request){const path=decodeURIComponent(new URL(request.url).pathname);const key=path==='/'?'/index.html':path;const item=ASSETS[key]||ASSETS[`${key.replace(/\/$/,'')}.html`]||ASSETS[`${key.replace(/\/$/,'')}/index.html`];if(!item)return new Response('找不到頁面',{status:404});const bytes=Uint8Array.from(atob(item.data),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':item.mime,'cache-control':key.startsWith('/_next/')?'public,max-age=31536000,immutable':'no-cache'}});}

const mcpTools=[
 {name:'scan_status',description:'Read the persisted scan coverage, latest snapshot and current progress.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'scan_begin',description:'Begin a complete Binance USDT perpetual scan using closed 15-minute candles and default MA/EMA/volume rules. Owner-private Site only.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'scan_step',description:'Process the next eight symbols of a running full-market scan. Use the returned runId and offset until terminal.',inputSchema:{type:'object',properties:{runId:{type:'string'},offset:{type:'integer',minimum:0}},required:['runId','offset'],additionalProperties:false}}
];
async function mcp(request,env){
 if(request.method!=='POST')return json({error:'POST required'},405);
 try{const message=await request.json();let result;
 if(message.method==='server/discover')result={supportedVersions:['2026-07-28'],capabilities:{tools:{}}};
 else if(message.method==='initialize')result={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'tide-scan',version:'2.0.0'}};
 else if(message.method==='notifications/initialized')return new Response(null,{status:202});
 else if(message.method==='tools/list')result={tools:mcpTools};
 else if(message.method==='tools/call'){
 const action={scan_status:'status',scan_begin:'begin',scan_step:'step'}[message.params?.name];if(!action)return json({jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Unknown tool'}});
 const body=action==='begin'?{rules:defaultRules}:message.params.arguments||{};
 const response=await api(new Request(new URL('/api/scan/'+action,request.url),action==='status'?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),env);
 result={content:[{type:'text',text:JSON.stringify(await response.json())}],isError:!response.ok};
 }else return json({jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Unsupported method'}});
 return json({jsonrpc:'2.0',id:message.id,result});
 }catch{return json({jsonrpc:'2.0',id:null,error:{code:-32603,message:'Invalid MCP request'}},400)}
}
