export type HistoryAssetId='oil'|'btc'|'sp500'|'gold'|'nasdaq';
export type HistoryPoint={date:string;value:number;open?:number;high?:number;low?:number};
export type HistorySeries={id:string;label:string;currency:string;unit?:string;source:string;sourceUrl?:string;note?:string;points:HistoryPoint[]};
export type HistoryEvent={id:string;date:string;title:string;region:string;description:string;sourceUrl:string};
export type HistoryPayload={series:HistorySeries[];events?:HistoryEvent[];asOf?:string};
export const historyAssets=[{id:'oil',label:'WTI 原油',color:'#ffbd69'},{id:'btc',label:'比特幣 BTC',color:'#65e3d4'},{id:'sp500',label:'標普 500',color:'#a5a0ff'},{id:'gold',label:'黃金',color:'#efda84'},{id:'nasdaq',label:'Nasdaq 綜合',color:'#75baff'}] as const;
export const historicalEvents:HistoryEvent[]=[
 {id:'covid',date:'2020-03-11',title:'WHO 宣布 COVID-19 為全球大流行',region:'全球',description:'世界衛生組織將 COVID-19 描述為全球大流行。事件與走勢僅作時間對照，不代表因果。',sourceUrl:'https://www.who.int/director-general/speeches/detail/who-director-general-s-opening-remarks-at-the-media-briefing-on-covid-19---11-march-2020'},
 {id:'oil-negative',date:'2020-04-20',title:'WTI 近月期貨結算價首次跌至負值',region:'美國',description:'2020 年 5 月交割的 WTI 期貨結算為每桶 −37.63 美元；此為特定到期合約，不等同原油現貨或連續期貨指數。',sourceUrl:'https://www.eia.gov/todayinenergy/detail.php?id=43495'},
 {id:'ukraine',date:'2022-02-24',title:'俄羅斯全面入侵烏克蘭',region:'歐洲',description:'聯合國就俄羅斯在烏克蘭發動軍事行動召開會議。能源與風險資產可於此日期前後交叉觀察。',sourceUrl:'https://news.un.org/en/story/2022/02/1112592'},
 {id:'fed-hike',date:'2022-03-16',title:'聯準會啟動該輪升息循環',region:'美國',description:'FOMC 將聯邦基金利率目標區間提高至 0.25%–0.50%。此頁不推斷單一事件造成的價格變化。',sourceUrl:'https://www.federalreserve.gov/newsevents/pressreleases/monetary20220316a.htm'},
 {id:'btc-etf',date:'2024-01-10',title:'SEC 核准現貨比特幣 ETP 上市交易',region:'美國',description:'SEC 核准多檔現貨比特幣交易所交易產品的上市與交易；核准不代表對比特幣的背書。',sourceUrl:'https://www.sec.gov/newsroom/speeches-statements/gensler-statement-spot-bitcoin-011023'},
];
export function validHistoryDate(value:string):boolean {if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function validateHistoryRange(start:string,end:string):string|null {if(!validHistoryDate(start)||!validHistoryDate(end))return '請輸入有效的起訖日期。';if(start>end)return '開始日期不能晚於結束日期。';if(start<'2000-01-01')return '目前支援 2000 年起的日期。';if(new Date(end+'T00:00:00Z').getTime()-new Date(start+'T00:00:00Z').getTime()>366*30*86400000)return '比較區間最多 30 年。';return null;}
/** Intersection avoids silently carrying forward weekend/holiday prices. Each baseline uses the same date. */
export function alignHistory(series:HistorySeries[]):{dates:string[];series:HistorySeries[];dropped:number}{
 if(!series.length)return {dates:[],series:[],dropped:0};
 const maps=series.map(item=>new Map(item.points.filter(p=>validHistoryDate(p.date)&&Number.isFinite(p.value)).map(p=>[p.date,p])));
 const all=new Set(maps.flatMap(map=>[...map.keys()]));
 const dates=[...maps[0].keys()].filter(date=>maps.every(map=>map.has(date))).sort();
 return {dates,series:series.map((item,n)=>({...item,points:dates.map(date=>maps[n].get(date)!)})),dropped:all.size-dates.length};
}
export function transformHistory(series:HistorySeries[],mode:'index'|'percent'):HistorySeries[]{return series.filter(s=>s.points.length&&s.points[0].value>0).map(s=>{const base=s.points[0].value;return {...s,points:s.points.map(p=>({...p,value:mode==='index'?p.value/base*100:(p.value/base-1)*100}))};});}
export function nearestHistoryDate(dates:string[],target:string):string|undefined {if(!dates.length||!validHistoryDate(target))return undefined;const time=Date.parse(target);return dates.reduce((best,date)=>Math.abs(Date.parse(date)-time)<Math.abs(Date.parse(best)-time)?date:best,dates[0]);}
/** Synthetic paths intentionally do not reproduce historical asset prices. */
export function createDemoHistory(ids:string[],start:string,end:string):HistoryPayload {
 const dates:string[]=[];for(let time=Date.parse(start+'T00:00:00Z');time<=Date.parse(end+'T00:00:00Z');time+=86400000){const date=new Date(time);if(date.getUTCDay()!==0&&date.getUTCDay()!==6)dates.push(date.toISOString().slice(0,10));}
 const series=ids.map(id=>{const n=Math.max(0,historyAssets.findIndex(a=>a.id===id));return {id,label:historyAssets.find(a=>a.id===id)?.label||id,currency:id==='sp500'||id==='nasdaq'?'指數點':'USD',source:'合成示範資料，非歷史報價',points:dates.map(date=>{const day=(Date.parse(date)-Date.UTC(2019,0,1))/86400000,base=[65,8500,2800,1500,8000][n],trend=1+day*(.00008+n*.000018),wave=.12*Math.sin(day/(67+n*17)+n)+.045*Math.cos(day/(21+n*4)),value=base*(trend+wave);return {date,value,open:value*(1+.006*Math.sin(day)),high:value*1.014,low:value*.986};})};});return {series,events:historicalEvents.filter(e=>e.date>=start&&e.date<=end),asOf:'合成示範'};
}
