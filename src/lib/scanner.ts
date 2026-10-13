export type DataProvider = 'okx' | 'binance';
export type Candle = { time:number; close:number; volume:number; open?:number; high?:number; low?:number };
export type ScanRules = { preset:'strict'|'trend'|'pullback'; direction:'both'|'long'|'short'; ma:boolean; ema:boolean; slope:boolean; volumeRatio:number; conditions?:TechnicalConditionId[] };
export type Indicators = { ma20:number; ma60:number; ma120:number; ema20:number; ema60:number; ema120:number; ema200:number; volumeRatio:number; price:number; previous:Record<string,number> };
export type ScanResult = { symbol:string; side:'long'|'short'; indicators:Indicators; time:number; score?:number; matchedConditions?:TechnicalConditionId[]; demo?:boolean; provider?:DataProvider; tradingViewSymbol?:string };
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
  const matchedConditions=evaluateTechnicalConditions(candles,side);if((rules.conditions||[]).some(condition=>!matchedConditions.includes(condition)))continue;
  const score=scoreCandidate(indicators,side,matchedConditions.length);return {symbol,side,indicators,time:candles.at(-1)!.time,score,matchedConditions};
 }return null;
}
export type ScanProgress={total:number;completed:number;failed:number;results:ScanResult[]; provider?:DataProvider; updatedAt?:string; exchangeTime?:number; phase?:string; retryRounds?:number};
async function request(path:string,signal:AbortSignal){for(let attempt=0;attempt<3;attempt++){const response=await fetch(`https://fapi.binance.com${path}`,{signal});if(response.status===429){if(attempt===2)throw new Error('API 速率限制 (429)');await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,2000*(attempt+1));signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});continue;}if(!response.ok)throw new Error(`Binance HTTP ${response.status}`);return response.json();}throw new Error('API 速率限制');}
export async function scanMarketDirect(rules:ScanRules,signal:AbortSignal,onProgress:(p:ScanProgress)=>void):Promise<ScanProgress>{
 const info=await request('/fapi/v1/exchangeInfo',signal);
 const symbols:string[]=info.symbols.filter((s:{quoteAsset:string;contractType:string;status:string})=>s.quoteAsset==='USDT'&&s.contractType==='PERPETUAL'&&s.status==='TRADING').map((s:{symbol:string})=>s.symbol);
 if(!symbols.length)throw new Error('找不到可交易的 USDT 永續合約');
 const progress:ScanProgress={total:symbols.length,completed:0,failed:0,results:[]};let cursor=0;onProgress({...progress});
 const server=await request('/fapi/v1/time',signal);const now=Number(server.serverTime);if(!Number.isFinite(now))throw new Error('交易所時間無效');
 await Promise.all(Array.from({length:4},async()=>{while(cursor<symbols.length){signal.throwIfAborted();const symbol=symbols[cursor++];try{const raw=await request(`/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=301`,signal);const candles:Candle[]=raw.filter((row:number[])=>Number(row[6])<now).map((row:number[])=>({time:Number(row[0]),open:Number(row[1]),high:Number(row[2]),low:Number(row[3]),close:Number(row[4]),volume:Number(row[5])}));const result=evaluateCandles(symbol,candles,rules);if(result)progress.results.push(result);}catch(error){if(signal.aborted)throw error;progress.failed++;}progress.completed++;onProgress({...progress,results:[...progress.results]});}}));return progress;
}
export function demoResults(rules:ScanRules):ScanResult[]{return ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','AVAXUSDT','LINKUSDT'].flatMap((symbol,n)=>{const candles=Array.from({length:300},(_,k)=>({time:Date.UTC(2026,9,12)-((300-k)*900000),close:(n%2?400:100)+(n%2?-1:1)*k*.2+Math.sin(k/7)*.03,volume:k===299?160:100}));const match=evaluateCandles(symbol,candles,rules);return match?[{...match,demo:true}]:[];});}

export async function scanMarket(rules:ScanRules,signal:AbortSignal,onProgress:(p:ScanProgress)=>void,provider:DataProvider='okx'):Promise<ScanProgress>{
 const api=async(action:string,body:unknown)=>{const response=await fetch(`/api/scan/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const payload=await response.json();if(response.status===409&&action==='begin'&&payload.progress){if(JSON.stringify(payload.progress.rules)===JSON.stringify(rules)&&(payload.progress.provider||'binance')===provider)return payload.progress;throw new Error('已有不同條件的掃描正在進行，請稍後重試或讀取最新快照。');}if(!response.ok)throw new Error(payload.error||`掃描 API HTTP ${response.status}`);return payload;};
 let run=await api('begin',{rules,provider});
 // Server APIs may wrap a run; normalize to the documented run structure.
 run=run.run||run.progress||run;
 while(true){signal.throwIfAborted();onProgress({total:run.total,completed:run.completed,failed:run.failed,results:run.results||[],provider:run.provider,updatedAt:run.updatedAt,exchangeTime:run.exchangeTime,phase:run.phase,retryRounds:run.retryRounds});if(run.status==='completed'||run.status==='complete'||(run.total>0&&run.completed>=run.total))return {total:run.total,completed:run.completed,failed:run.failed,results:run.results||[],provider:run.provider,updatedAt:run.updatedAt,exchangeTime:run.exchangeTime,phase:run.phase,retryRounds:run.retryRounds};if(run.status==='failed')throw new Error(run.error||'伺服器掃描失敗');const next=await api('step',{runId:run.runId,offset:run.offset});run=next.run||next.progress||next;}
}

export const technicalConditionOptions = [
 {id:'ma',label:'MA 均線排列'}, {id:'ema',label:'EMA 均線排列'}, {id:'macd',label:'MACD 動能'}, {id:'rsi',label:'RSI 方向區間'}, {id:'engulfing',label:'多 / 空吞噬'}, {id:'volume',label:'成交量放大'}, {id:'headShouldersTop',label:'頭肩頂'}, {id:'headShouldersBottom',label:'頭肩底'}, {id:'doubleTop',label:'M 頭'}, {id:'doubleBottom',label:'W 底'}, {id:'divergence',label:'RSI 背離'},
] as const;
export type TechnicalConditionId=typeof technicalConditionOptions[number]['id'];
export function rsiSeries(values:number[],period=14):number[]{
 const output:number[]=Array(values.length).fill(50);if(values.length<=period)return output;
 let gain=0,loss=0;for(let n=1;n<=period;n++){const d=values[n]-values[n-1];gain+=Math.max(d,0)/period;loss+=Math.max(-d,0)/period;}
 for(let n=period;n<values.length;n++){if(n>period){const d=values[n]-values[n-1];gain=(gain*(period-1)+Math.max(d,0))/period;loss=(loss*(period-1)+Math.max(-d,0))/period;}output[n]=loss===0?(gain===0?50:100):100-100/(1+gain/loss);}return output;
}
export function evaluateTechnicalConditions(candles:Candle[],side:'long'|'short'):TechnicalConditionId[]{
 if(candles.length<250)return [];
 const sign=side==='long'?1:-1,i=calculateIndicators(candles),closes=candles.map(c=>c.close),last=candles.at(-1)!,prev=candles.at(-2)!,found:TechnicalConditionId[]=[];
 if(sign*(i.ma20-i.ma60)>0&&sign*(i.ma60-i.ma120)>0&&sign*(last.close-i.ma20)>0)found.push('ma');
 if(sign*(i.ema20-i.ema60)>0&&sign*(i.ema60-i.ema120)>0&&sign*(i.ema120-i.ema200)>0&&sign*(last.close-i.ema20)>0)found.push('ema');
 const macd=closes.slice(34).map((_,n)=>ema(closes.slice(0,n+35),12)-ema(closes.slice(0,n+35),26)),signal=ema(macd,9),current=macd.at(-1)!;
 if(sign*(current-signal)>0&&sign*current>0)found.push('macd');
 const rsis=rsiSeries(closes),rsi=rsis.at(-1)!;if(side==='long'?rsi>=50&&rsi<=70:rsi>=30&&rsi<=50)found.push('rsi');
 if(last.open!==undefined&&prev.open!==undefined&&sign*(last.close-last.open)>0&&sign*(prev.close-prev.open)<0&&Math.min(last.open,last.close)<=Math.min(prev.open,prev.close)&&Math.max(last.open,last.close)>=Math.max(prev.open,prev.close))found.push('engulfing');
 if(i.volumeRatio>=1.2)found.push('volume');
 // Confirmed local pivots: 2 bars on each side, last 80 bars. Patterns require neckline break in the last 3 closes.
 const pivots:{index:number;value:number}[]=[];const isTop=side==='short';
 for(let n=Math.max(2,candles.length-80);n<candles.length-2;n++){const value=isTop?(candles[n].high??closes[n]):(candles[n].low??closes[n]);if([-2,-1,1,2].every(d=>isTop?value>(candles[n+d].high??closes[n+d]):value<(candles[n+d].low??closes[n+d])))pivots.push({index:n,value});}
 const recent=pivots.slice(-5),similar=(a:number,b:number)=>Math.abs(a-b)/Math.max(a,b)<.02;
 const boundary=(a:number,b:number)=>isTop?Math.min(...candles.slice(a,b+1).map(c=>c.low??c.close)):Math.max(...candles.slice(a,b+1).map(c=>c.high??c.close));
 const broken=(level:number)=>sign*(last.close-level)>0&&closes.slice(-4,-1).some(c=>sign*(c-level)<=0);
 if(recent.length>=2){const [a,b]=recent.slice(-2),neck=boundary(a.index,b.index);if(b.index-a.index>=4&&similar(a.value,b.value)&&Math.abs(neck-a.value)/a.value>.01&&broken(neck))found.push(isTop?'doubleTop':'doubleBottom');if(sign*(b.value-a.value)<0&&sign*(rsis[b.index]-rsis[a.index])>3&&candles.length-1-b.index<=8)found.push('divergence');}
 if(recent.length>=3){const [a,b,c]=recent.slice(-3);if(b.index-a.index>=4&&c.index-b.index>=4&&similar(a.value,c.value)&&-sign*(b.value-(isTop?Math.max(a.value,c.value):Math.min(a.value,c.value)))>Math.abs(b.value)*.01){const left=boundary(a.index,b.index),right=boundary(b.index,c.index),neck=(left+right)/2;if(broken(neck))found.push(isTop?'headShouldersTop':'headShouldersBottom');}}
 return found;
}
export function scoreCandidate(i:Indicators,side:'long'|'short',matched=0):number {
 const sign=side==='long'?1:-1,price=Number.isFinite(i.price)&&i.price>0?i.price:1,trend=Number.isFinite(i.ma20)&&Number.isFinite(i.ma120)?Math.max(0,sign*(i.ma20-i.ma120)/price):0,prior=i.previous?.ema20,slope=Number.isFinite(prior)&&Number.isFinite(i.ema20)?Math.max(0,sign*(i.ema20-prior)/price):0;
 return Math.round(Math.min(100,30+Math.min(25,trend*500)+Math.min(20,slope*4000)+Math.min(15,Math.max(0,(Number.isFinite(i.volumeRatio)?i.volumeRatio:1)-1)*10)+Math.min(10,matched*2))*10)/10;
}
export function rankCandidates(results:ScanResult[],side:'long'|'short',limit=5):ScanResult[]{return results.filter(item=>item.side===side).map(item=>({...item,score:item.score??scoreCandidate(item.indicators,item.side,item.matchedConditions?.length||0)})).sort((a,b)=>(b.score!-a.score!)||b.indicators.volumeRatio-a.indicators.volumeRatio||a.symbol.localeCompare(b.symbol)).slice(0,limit);}
/** Synthetic OHLC history for UI exploration only; does not represent exchange quotes. */
export function demoAssetCandles(id:string,price:number,change:number):Candle[]{
 const seed=Array.from(id).reduce((sum,c)=>sum+c.charCodeAt(0),0),direction=change<0?-1:1;
 const values=Array.from({length:300},(_,n)=>Math.max(price*.1,price*(1+direction*(n-299)*.0006+.012*Math.sin((n+seed)/8)+.004*Math.sin((n+seed)/2))));
 return values.map((close,n)=>{const open=values[Math.max(0,n-1)];return {time:Date.UTC(2026,9,12)-((300-n)*900000),open,close,high:Math.max(open,close)*1.003,low:Math.min(open,close)*.997,volume:100+(seed%20)+(n===299?70:20*Math.sin(n/9))};});
}
