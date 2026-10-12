export type DataProvider = 'okx' | 'binance';
export type Candle = { time:number; close:number; volume:number };
export type ScanRules = { preset:'strict'|'trend'|'pullback'; direction:'both'|'long'|'short'; ma:boolean; ema:boolean; slope:boolean; volumeRatio:number };
export type Indicators = { ma20:number; ma60:number; ma120:number; ema20:number; ema60:number; ema120:number; ema200:number; volumeRatio:number; price:number; previous:Record<string,number> };
export type ScanResult = { symbol:string; side:'long'|'short'; indicators:Indicators; time:number; demo?:boolean; provider?:DataProvider; tradingViewSymbol?:string };
export const defaultRules:ScanRules={preset:'strict',direction:'both',ma:true,ema:true,slope:true,volumeRatio:1.2};
const sma=(values:number[],period:number)=>values.slice(-period).reduce((a,b)=>a+b,0)/period;
const ema=(values:number[],period:number)=>{let value=sma(values.slice(0,period),period);const alpha=2/(period+1);for(let i=period;i<values.length;i++)value=values[i]*alpha+value*(1-alpha);return value;};
export function calculateIndicators(candles:Candle[]):Indicators {
 if(candles.length<250)throw new Error('至少需要 250 根已收盤 K 線');
 const closes=candles.map(c=>c.close), previous:Record<string,number>={};
 const current:Record<string,number>={};
 for(const period of [20,60,120]){current[`ma${period}`]=sma(closes,period);previous[`ma${period}`]=sma(closes.slice(0,-1),period);}
 for(const period of [20,60,120,200]){current[`ema${period}`]=ema(closes,period);previous[`ema${period}`]=ema(closes.slice(0,-1),period);}
 const base=sma(candles.slice(0,-1).map(c=>c.volume),20);
 return {...current, previous, price:closes.at(-1)!,volumeRatio:base?candles.at(-1)!.volume/base:0} as Indicators;
}
export function evaluateCandles(symbol:string,candles:Candle[],rules:ScanRules):ScanResult|null{
 const indicators=calculateIndicators(candles),i=indicators as unknown as Record<string,number>;
 if(indicators.volumeRatio<rules.volumeRatio)return null;
 for(const side of ['long','short'] as const){
  if(rules.direction!=='both'&&rules.direction!==side)continue;
  const sign=side==='long'?1:-1;
  const ordered=(keys:string[])=>keys.slice(1).every((key,n)=>sign*(i[keys[n]]-i[key])>0);
  const groups:string[][]=[];if(rules.ma)groups.push(['ma20','ma60','ma120']);if(rules.ema)groups.push(['ema20','ema60','ema120','ema200']);
  if(!groups.length||!groups.every(ordered))continue;
  const keys=groups.flat();
  if(rules.slope&&!keys.every(key=>sign*(i[key]-indicators.previous[key])>0))continue;
  if(rules.preset==='strict'&&!keys.every(key=>sign*(indicators.price-i[key])>0))continue;
  if(rules.preset==='trend'&&groups.some(group=>sign*(indicators.price-i[group[1]])<=0))continue;
  if(rules.preset==='pullback'&&(Math.abs(indicators.price-i[groups[0][0]])/i[groups[0][0]]>0.015||groups.some(group=>sign*(indicators.price-i[group[1]])<=0)))continue;
  return {symbol,side,indicators,time:candles.at(-1)!.time};
 }return null;
}
export type ScanProgress={total:number;completed:number;failed:number;results:ScanResult[]; provider?:DataProvider; updatedAt?:string};
async function request(path:string,signal:AbortSignal){for(let attempt=0;attempt<3;attempt++){const response=await fetch(`https://fapi.binance.com${path}`,{signal});if(response.status===429){if(attempt===2)throw new Error('API 速率限制 (429)');await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,2000*(attempt+1));signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});continue;}if(!response.ok)throw new Error(`Binance HTTP ${response.status}`);return response.json();}throw new Error('API 速率限制');}
export async function scanMarketDirect(rules:ScanRules,signal:AbortSignal,onProgress:(p:ScanProgress)=>void):Promise<ScanProgress>{
 const info=await request('/fapi/v1/exchangeInfo',signal);
 const symbols:string[]=info.symbols.filter((s:{quoteAsset:string;contractType:string;status:string})=>s.quoteAsset==='USDT'&&s.contractType==='PERPETUAL'&&s.status==='TRADING').map((s:{symbol:string})=>s.symbol);
 if(!symbols.length)throw new Error('找不到可交易的 USDT 永續合約');
 const progress:ScanProgress={total:symbols.length,completed:0,failed:0,results:[]};let cursor=0;onProgress({...progress});
 const server=await request('/fapi/v1/time',signal);const now=Number(server.serverTime);if(!Number.isFinite(now))throw new Error('交易所時間無效');
 await Promise.all(Array.from({length:4},async()=>{while(cursor<symbols.length){signal.throwIfAborted();const symbol=symbols[cursor++];try{const raw=await request(`/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=301`,signal);const candles:Candle[]=raw.filter((row:number[])=>Number(row[6])<now).map((row:number[])=>({time:Number(row[0]),close:Number(row[4]),volume:Number(row[5])}));const result=evaluateCandles(symbol,candles,rules);if(result)progress.results.push(result);}catch(error){if(signal.aborted)throw error;progress.failed++;}progress.completed++;onProgress({...progress,results:[...progress.results]});}}));return progress;
}
export function demoResults(rules:ScanRules):ScanResult[]{return ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','AVAXUSDT','LINKUSDT'].flatMap((symbol,n)=>{const candles=Array.from({length:300},(_,k)=>({time:Date.UTC(2026,9,12)-((300-k)*900000),close:(n%2?400:100)+(n%2?-1:1)*k*.2+Math.sin(k/7)*.03,volume:k===299?160:100}));const match=evaluateCandles(symbol,candles,rules);return match?[{...match,demo:true}]:[];});}

export async function scanMarket(rules:ScanRules,signal:AbortSignal,onProgress:(p:ScanProgress)=>void,provider:DataProvider='okx'):Promise<ScanProgress>{
 const api=async(action:string,body:unknown)=>{const response=await fetch(`/api/scan/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const payload=await response.json();if(response.status===409&&action==='begin'&&payload.progress){if(JSON.stringify(payload.progress.rules)===JSON.stringify(rules)&&(payload.progress.provider||'binance')===provider)return payload.progress;throw new Error('已有不同條件的掃描正在進行，請稍後重試或讀取最新快照。');}if(!response.ok)throw new Error(payload.error||`掃描 API HTTP ${response.status}`);return payload;};
 let run=await api('begin',{rules,provider});
 // Server APIs may wrap a run; normalize to the documented run structure.
 run=run.run||run.progress||run;
 while(true){signal.throwIfAborted();onProgress({total:run.total,completed:run.completed,failed:run.failed,results:run.results||[],provider:run.provider,updatedAt:run.updatedAt});if(run.status==='completed'||run.status==='complete'||(run.total>0&&run.completed>=run.total))return {total:run.total,completed:run.completed,failed:run.failed,results:run.results||[],provider:run.provider,updatedAt:run.updatedAt};if(run.status==='failed')throw new Error(run.error||'伺服器掃描失敗');const next=await api('step',{runId:run.runId,offset:run.offset});run=next.run||next.progress||next;}
}
