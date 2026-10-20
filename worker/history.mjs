/** Daily historical quotes. Authorization is performed by the caller before this handler. */
const HISTORY_ASSETS = Object.freeze({
 oil:{symbol:'CL=F',label:'WTI 原油連續期貨',currency:'USD',note:'連續期貨可能換月，非現貨或固定到期合約；價格可為零或負值。'},
 btc:{symbol:'BTC-USD',label:'Bitcoin / USD',currency:'USD',note:'供應商的每日加密貨幣報價，週末亦可能有資料。'},
 sp500:{symbol:'^GSPC',label:'標普 500 指數',currency:'USD',note:'價格指數，未含股息再投資；數值單位為指數點。'},
 gold:{symbol:'GC=F',label:'黃金連續期貨',currency:'USD',note:'連續期貨可能換月，非現貨或固定到期合約。'},
 nasdaq:{symbol:'^IXIC',label:'NASDAQ 綜合指數',currency:'USD',note:'價格指數，未含股息再投資；數值單位為指數點。'},
});
const HISTORY_CACHE_MS=6*60*60*1000;
const historyJson=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
function validHistoryDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(value+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;}
export function parseHistoryQuery(url,now=Date.now()){
 const params=new URL(url).searchParams,start=params.get('start'),end=params.get('end');
 if(!validHistoryDate(start)||!validHistoryDate(end))throw Error('請輸入有效的 YYYY-MM-DD 起訖日期。');
 const today=new Date(now).toISOString().slice(0,10);
 if(start<'2000-01-01'||end>today||start>end)throw Error(`日期須介於 2000-01-01 至 ${today}，且結束日不得早於開始日。`);
 const ids=[...new Set((params.get('assets')||'oil,btc,sp500').split(','))];
 if(ids.length<1||ids.length>5||ids.some(id=>!Object.hasOwn(HISTORY_ASSETS,id)))throw Error('商品限原油、BTC、標普 500、黃金或 NASDAQ，最多五個。');
 return {ids,start,end,period1:Date.parse(start+'T00:00:00Z')/1000,period2:Date.parse(end+'T00:00:00Z')/1000+86400};
}
export function parseYahooHistory(payload,id,start,end){
 const config=HISTORY_ASSETS[id];if(!config)throw Error('不支援的商品。');
 const problem=payload?.chart?.error;if(problem)throw Error('歷史供應商未提供此商品資料。');
 const result=payload?.chart?.result?.[0],quote=result?.indicators?.quote?.[0];
 if(!result||!Array.isArray(result.timestamp)||!quote||!Array.isArray(quote.close))throw Error('歷史行情回應格式無效。');
 if(result.timestamp.length>10000)throw Error('歷史行情筆數超過上限。');
 const points=new Map();
 result.timestamp.forEach((stamp,index)=>{
  if(!Number.isFinite(stamp)||stamp<=0)return;
  const value=quote.close[index];if(typeof value!=='number'||!Number.isFinite(value))return;
  const date=new Date(stamp*1000).toISOString().slice(0,10);if(date<start||date>end)return;
  const point={date,value};
  for(const [field,property] of [['open','open'],['high','high'],['low','low']]){const number=quote[property]?.[index];if(typeof number==='number'&&Number.isFinite(number))point[field]=number;}
  const volume=quote.volume?.[index];if(typeof volume==='number'&&Number.isFinite(volume)&&volume>=0)point.volume=volume;
  points.set(date,point);
 });
 const sorted=[...points.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(!sorted.length)throw Error('此日期區間沒有有效行情；可能尚未上市、休市或供應商未提供資料。');
 return {id,label:config.label,currency:config.currency,unit:id==='sp500'||id==='nasdaq'?'指數點':'USD',source:'Yahoo Finance · 日線原始收盤價（未採 adjusted close）',sourceUrl:`https://finance.yahoo.com/quote/${encodeURIComponent(config.symbol)}/history/`,note:config.note,dateConvention:'以供應商日線時間戳的 UTC 日期對齊；非台北零時，休市與缺漏不補值。',points:sorted};
}
async function historySeries(id,query,env){
 const key=`history/yahoo-v1/${id}/${query.start}/${query.end}.json`;
 if(env.BUCKET){try{const saved=await env.BUCKET.get(key);const cached=saved?await saved.json():null;if(cached?.series?.id===id&&Number.isFinite(cached.fetchedAt)&&Date.now()-cached.fetchedAt<HISTORY_CACHE_MS&&Date.now()>=cached.fetchedAt)return {...cached.series,cached:true,fetchedAt:new Date(cached.fetchedAt).toISOString()};}catch{/* Quote fetching remains possible when cache is unavailable. */}}
 const config=HISTORY_ASSETS[id];const url=new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.symbol)}`);
 url.searchParams.set('period1',String(query.period1));url.searchParams.set('period2',String(query.period2));url.searchParams.set('interval','1d');url.searchParams.set('events','history');
 let response;
 try{response=await fetch(url.toString(),{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000),redirect:'manual'});}catch(error){throw Error(error?.name==='TimeoutError'?'歷史行情供應商連線逾時。':`無法連線至歷史行情供應商（${String(error?.name||'Error')}: ${String(error?.message||'未知連線錯誤').replace(/[\r\n]/g,' ').slice(0,180)}）。`);}
 if(!response.ok)throw Error(`歷史行情供應商 HTTP ${response.status}，未切換示範資料。`);
 const declared=Number(response.headers.get('content-length'));if(Number.isFinite(declared)&&declared>6*1024*1024)throw Error('歷史行情回應超過大小上限。');
 const raw=await response.text();if(raw.length>6*1024*1024)throw Error('歷史行情回應超過大小上限。');
 let data;try{data=JSON.parse(raw);}catch{throw Error('歷史行情供應商回傳非 JSON 資料。');}
 const series=parseYahooHistory(data,id,query.start,query.end),fetchedAt=Date.now();
 if(env.BUCKET){try{await env.BUCKET.put(key,JSON.stringify({series,fetchedAt}),{httpMetadata:{contentType:'application/json'}});}catch{/* Do not hide valid quotes because a cache write failed. */}}
 return {...series,cached:false,fetchedAt:new Date(fetchedAt).toISOString()};
}
export async function handleHistoryApi(request,env={}){
 if(new URL(request.url).pathname!=='/api/history')return null;
 if(request.method!=='GET')return historyJson({error:'僅支援 GET。'},405);
 let query;try{query=parseHistoryQuery(request.url);}catch(error){return historyJson({error:error.message},400);}
 const outcomes=await Promise.all(query.ids.map(async id=>{try{return {series:await historySeries(id,query,env)};}catch(error){return {error:{id,label:HISTORY_ASSETS[id].label,error:String(error?.message||'歷史資料讀取失敗。')}};}}));
 const series=outcomes.flatMap(item=>item.series?[item.series]:[]),errors=outcomes.flatMap(item=>item.error?[item.error]:[]);
 return historyJson({provider:'yahoo',isDemo:false,start:query.start,end:query.end,series,errors,incomplete:errors.length>0,fetchedAt:new Date().toISOString(),dateConvention:'UTC 日線日期；缺漏與休市不補值。'},series.length?200:502);
}
