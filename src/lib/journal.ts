export interface TradeRecord {
  id: string; symbol: string; side: 'long' | 'short'; openedAt: string; closedAt: string;
  entry: number; exit: number; quantity: number; leverage: number; fees: number; funding: number; principal?: number;
  judgment: string; entryReason: string; exitReason: string; strategy: string; followedPlan: boolean;
  screenshot?: Blob; demo: boolean;
}
export const grossProfit = (r: TradeRecord) => (r.exit-r.entry)*r.quantity*(r.side==='long'?1:-1);
export const netProfit = (r: TradeRecord) => grossProfit(r)-r.fees+r.funding;
export const returnPercent = (r: TradeRecord) => r.principal && r.principal>0 ? netProfit(r)/r.principal*100 : null;
export function taipeiDay(value: string) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)); }
export function periodKey(value: string, period: 'week'|'month') {
  const day=taipeiDay(value); if(period==='month') return day.slice(0,7);
  const d=new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)); return d.toISOString().slice(0,10);
}
export function summarize(records: TradeRecord[]) {
  const wins=records.map(netProfit).filter(n=>n>0), losses=records.map(netProfit).filter(n=>n<0);
  const winTotal=wins.reduce((a,b)=>a+b,0), lossTotal=-losses.reduce((a,b)=>a+b,0);
  const avgWin=wins.length?winTotal/wins.length:0, avgLoss=losses.length?lossTotal/losses.length:0;
  return {count:records.length,net:winTotal-lossTotal,winRate:records.length?wins.length/records.length*100:0,avgWin,avgLoss,payoff:avgLoss?avgWin/avgLoss:null,profitFactor:lossTotal?winTotal/lossTotal:null,discipline:records.length?records.filter(r=>r.followedPlan).length/records.length*100:0};
}
const DB='tide-trading-journal';
function openDB():Promise<IDBDatabase> { return new Promise((resolve,reject)=>{const q=indexedDB.open(DB,1); q.onupgradeneeded=()=>q.result.createObjectStore('trades',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);}); }
export async function readTrades():Promise<TradeRecord[]> { const db=await openDB();try{return await new Promise((resolve,reject)=>{const q=db.transaction('trades','readonly').objectStore('trades').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}finally{db.close();} }
export async function persistTrade(record:TradeRecord) {const db=await openDB();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('trades','readwrite');tx.objectStore('trades').put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
export async function deleteTrade(id:string) {const db=await openDB();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('trades','readwrite');tx.objectStore('trades').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export function demoTrades():TradeRecord[] {return Array.from({length:6},(_,i)=>({id:`demo-${i}`,symbol:i%2?'BTCUSDT':'ETHUSDT',side:i%2?'short':'long',openedAt:`2026-10-${String(6+i).padStart(2,'0')}T01:00:00.000Z`,closedAt:`2026-10-${String(6+i).padStart(2,'0')}T05:00:00.000Z`,entry:2500,exit:i%3?2540:2480,quantity:1,leverage:5,fees:2,funding:0,principal:500,judgment:'示範：均線回測後確認量能',entryReason:'示範：回測支撐',exitReason:'示範：依計劃停利／停損',strategy:'均線回測',followedPlan:i!==2,demo:true}));}
