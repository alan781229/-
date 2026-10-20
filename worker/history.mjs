/** Daily historical quotes. Authorization is performed by the caller before this handler. */
const HISTORY_ASSETS = Object.freeze({
 oil:{symbol:'CL=F',label:'WTI 原油連續期貨',currency:'USD',note:'連續期貨可能換月，非現貨或固定到期合約；價格可為零或負值。'},
 btc:{symbol:'BTC-USD',label:'Bitcoin / USD',currency:'USD',note:'供應商的每日加密貨幣報價，週末亦可能有資料。'},
 sp500:{symbol:'^GSPC',label:'標普 500 指數',currency:'USD',note:'價格指數，未含股息再投資；數值單位為指數點。'},
 gold:{symbol:'GC=F',label:'黃金連續期貨',currency:'USD',note:'連續期貨可能換月，非現貨或固定到期合約。'},
 nasdaq:{symbol:'^IXIC',label:'NASDAQ 綜合指數',currency:'USD',note:'價格指數，未含股息再投資；數值單位為指數點。'},
});
const FRED_HISTORY_ASSETS=Object.freeze({
 oil:{series:'DCOILWTICO',label:'WTI 原油現貨',currency:'USD',unit:'USD / 桶',note:'FRED DCOILWTICO：WTI Cushing 原油現貨價格，非 Yahoo 連續期貨；不可將兩者視為相同基準。'},
 btc:{series:'CBBTCUSD',label:'Bitcoin / USD（Coinbase）',currency:'USD',unit:'USD',note:'FRED CBBTCUSD：Coinbase Bitcoin 每日美元價格；非全市場加權價格。'},
 sp500:{series:'SP500',label:'標普 500 指數',currency:'USD',unit:'指數點',note:'FRED SP500：價格指數，未含股息再投資；可取得年限受供應商授權限制，可能未涵蓋整段日期。'},
 nasdaq:{series:'NASDAQCOM',label:'NASDAQ 綜合指數',currency:'USD',unit:'指數點',note:'FRED NASDAQCOM：價格指數，未含股息再投資。'},
});
const HISTORY_CACHE_MS=6*60*60*1000;
const historyJson=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
function validHistoryDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(value+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;}
export function parseHistoryQuery(url,now=Date.now()){
 const params=new URL(url).searchParams,start=params.get('start'),end=params.get('end'),provider=params.get('provider')||'fred';
 if(!['fred','yahoo'].includes(provider))throw Error('歷史資料來源僅支援 FRED 或 Yahoo。');
 if(!validHistoryDate(start)||!validHistoryDate(end))throw Error('請輸入有效的 YYYY-MM-DD 起訖日期。');
 const today=new Date(now).toISOString().slice(0,10);
 if(start<'2000-01-01'||end>today||start>end)throw Error(`日期須介於 2000-01-01 至 ${today}，且結束日不得早於開始日。`);
 const ids=[...new Set((params.get('assets')||'oil,btc,sp500').split(','))];
 if(ids.length<1||ids.length>5||ids.some(id=>!Object.hasOwn(HISTORY_ASSETS,id)))throw Error('商品限原油、BTC、標普 500、黃金或 NASDAQ，最多五個。');
 if(provider==='fred'&&ids.some(id=>!Object.hasOwn(FRED_HISTORY_ASSETS,id)))throw Error('FRED 來源不支援黃金；請取消黃金或明確選擇 Yahoo 來源。');
 return {ids,start,end,provider,period1:Date.parse(start+'T00:00:00Z')/1000,period2:Date.parse(end+'T00:00:00Z')/1000+86400};
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
/** FRED graph CSV contains observations only; it does not provide OHLC. */
export function parseFredHistory(raw,id,start,end){
 const config=FRED_HISTORY_ASSETS[id];if(!config)throw Error('FRED 不支援此商品。');
 if(typeof raw!=='string'||raw.length>6*1024*1024)throw Error('歷史行情回應超過大小上限。');
 const lines=raw.replace(/^\uFEFF/,'').trim().split(/\r?\n/);if(lines.length>10001)throw Error('歷史行情筆數超過上限。');
 const fields=line=>line.split(',').map(value=>value.trim().replace(/^"|"$/g,''));
 const header=fields(lines.shift()||'');
 if(!/^(date|observation_date)$/i.test(header[0])||header.length!==2||![config.series.toLowerCase(),'value'].includes(header[1].toLowerCase()))throw Error('FRED 歷史行情 CSV 格式無效。');
 const points=new Map();
 for(const line of lines){if(!line.trim())continue;const [date,rawValue,...extra]=fields(line);if(extra.length||!validHistoryDate(date))throw Error('FRED 歷史行情日期或欄位格式無效。');if(date<start||date>end||rawValue==='.'||rawValue==='')continue;if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(rawValue))throw Error('FRED 歷史行情數值格式無效。');const value=Number(rawValue);if(!Number.isFinite(value))throw Error('FRED 歷史行情數值無效。');points.set(date,{date,value});}
 const sorted=[...points.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(!sorted.length)throw Error('此日期區間沒有有效 FRED 行情；可能早於系列起始日、休市或供應商授權未涵蓋。');
 return {id,label:config.label,currency:config.currency,unit:config.unit,source:`FRED · ${config.series} · 每日觀測值（僅提供收盤／現貨日值，無 OHLC）`,sourceUrl:`https://fred.stlouisfed.org/series/${config.series}`,note:config.note,dateConvention:'依 FRED 發布的觀測日期對齊，非台北零時；休市與缺漏不補值。',coverage:{start:sorted[0].date,end:sorted.at(-1).date,count:sorted.length},points:sorted};
}
async function historySeries(id,query,env){
 const key=`history/${query.provider}-v1/${id}/${query.start}/${query.end}.json`;
 if(env.BUCKET){try{const saved=await env.BUCKET.get(key);const cached=saved?await saved.json():null;if(cached?.series?.id===id&&Number.isFinite(cached.fetchedAt)&&Date.now()-cached.fetchedAt<HISTORY_CACHE_MS&&Date.now()>=cached.fetchedAt)return {...cached.series,cached:true,fetchedAt:new Date(cached.fetchedAt).toISOString()};}catch{/* Quote fetching remains possible when cache is unavailable. */}}
 const config=query.provider==='fred'?FRED_HISTORY_ASSETS[id]:HISTORY_ASSETS[id];
 const url=query.provider==='fred'?new URL('https://fred.stlouisfed.org/graph/fredgraph.csv'):new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.symbol)}`);
 if(query.provider==='fred'){url.searchParams.set('id',config.series);url.searchParams.set('cosd',query.start);url.searchParams.set('coed',query.end);}else{url.searchParams.set('period1',String(query.period1));url.searchParams.set('period2',String(query.period2));url.searchParams.set('interval','1d');url.searchParams.set('events','history');}
 let response;
 try{response=await fetch(url.toString(),{headers:{accept:query.provider==='fred'?'text/csv':'application/json'},signal:AbortSignal.timeout(15000),redirect:'manual'});}catch(error){throw Error(error?.name==='TimeoutError'?'歷史行情供應商連線逾時。':`無法連線至歷史行情供應商（${String(error?.name||'Error')}: ${String(error?.message||'未知連線錯誤').replace(/[\r\n]/g,' ').slice(0,180)}）。`);}
 if(!response.ok)throw Error(`歷史行情供應商 HTTP ${response.status}，未切換示範資料。`);
 const declared=Number(response.headers.get('content-length'));if(Number.isFinite(declared)&&declared>6*1024*1024)throw Error('歷史行情回應超過大小上限。');
 const raw=await response.text();if(raw.length>6*1024*1024)throw Error('歷史行情回應超過大小上限。');
 let series;if(query.provider==='fred'){series=parseFredHistory(raw,id,query.start,query.end);}else{let data;try{data=JSON.parse(raw);}catch{throw Error('歷史行情供應商回傳非 JSON 資料。');}series=parseYahooHistory(data,id,query.start,query.end);}
 const fetchedAt=Date.now();
 if(env.BUCKET){try{await env.BUCKET.put(key,JSON.stringify({series,fetchedAt}),{httpMetadata:{contentType:'application/json'}});}catch{/* Do not hide valid quotes because a cache write failed. */}}
 return {...series,cached:false,fetchedAt:new Date(fetchedAt).toISOString()};
}
export async function handleHistoryApi(request,env={}){
 if(new URL(request.url).pathname!=='/api/history')return null;
 if(request.method!=='GET')return historyJson({error:'僅支援 GET。'},405);
 let query;try{query=parseHistoryQuery(request.url);}catch(error){return historyJson({error:error.message},400);}
 const outcomes=await Promise.all(query.ids.map(async id=>{try{return {series:await historySeries(id,query,env)};}catch(error){return {error:{id,label:HISTORY_ASSETS[id].label,error:String(error?.message||'歷史資料讀取失敗。')}};}}));
 const series=outcomes.flatMap(item=>item.series?[item.series]:[]),errors=outcomes.flatMap(item=>item.error?[item.error]:[]);
 return historyJson({provider:query.provider,isDemo:false,start:query.start,end:query.end,series,errors,incomplete:errors.length>0,fetchedAt:new Date().toISOString(),dateConvention:query.provider==='fred'?'FRED 觀測日期；缺漏與休市不補值。':'UTC 日線日期；缺漏與休市不補值。'},series.length?200:502);
}
