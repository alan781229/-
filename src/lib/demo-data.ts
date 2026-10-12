/** All records in this module are fictional demonstration data, never live quotes. */
export type Market = 'crypto' | 'us' | 'tw';
export interface Asset {
  id: string; market: Market; symbol: string; name: string; price: number;
  change: number; volume: number; marketCap: number; sector: string;
  series: number[]; currency: 'USD' | 'TWD'; isDemo: true;
}
export const marketLabels: Record<Market, string> = { crypto: '加密貨幣', us: '美股', tw: '台股' };
const series = (base: number, direction: number) => [0.92, 0.95, 0.93, 0.98, 0.96, 1.01, 0.99, 1.03, 1.01, 1.05, 1.04, 1.08].map((n, i) => Math.round(base * (direction > 0 ? n : 1.14 - n + i * 0.005) * 100) / 100);
const asset = (id: string, market: Market, symbol: string, name: string, price: number, change: number, volume: number, marketCap: number, sector: string): Asset => ({ id, market, symbol, name, price, change, volume, marketCap, sector, series: series(price, change), currency: market === 'tw' ? 'TWD' : 'USD', isDemo: true });
export const assets: Asset[] = [
  asset('btc', 'crypto', 'BTC', '比特幣', 68432.5, 2.84, 28400000000, 1350000000000, '價值儲存'),
  asset('eth', 'crypto', 'ETH', '以太幣', 3521.8, 1.62, 14200000000, 423000000000, '智能合約'),
  asset('sol', 'crypto', 'SOL', 'Solana', 172.45, 5.37, 3200000000, 79200000000, '智能合約'),
  asset('bnb', 'crypto', 'BNB', '幣安幣', 594.2, -0.82, 1800000000, 86600000000, '交易所生態'),
  asset('link', 'crypto', 'LINK', 'Chainlink', 17.28, 3.12, 540000000, 10200000000, '預言機'),
  asset('avax', 'crypto', 'AVAX', 'Avalanche', 36.92, -1.25, 420000000, 14600000000, '智能合約'),
  asset('nvda', 'us', 'NVDA', '輝達', 138.85, 3.42, 24800000000, 3400000000000, '半導體'),
  asset('aapl', 'us', 'AAPL', '蘋果', 228.42, 0.86, 9800000000, 3480000000000, '消費科技'),
  asset('msft', 'us', 'MSFT', '微軟', 428.78, 1.24, 7200000000, 3190000000000, '軟體服務'),
  asset('tsla', 'us', 'TSLA', '特斯拉', 248.5, -2.16, 16200000000, 795000000000, '電動車'),
  asset('amd', 'us', 'AMD', '超微', 164.12, 2.71, 4800000000, 265000000000, '半導體'),
  asset('googl', 'us', 'GOOGL', 'Alphabet', 172.35, -0.43, 3600000000, 2110000000000, '網路服務'),
  asset('tsmc', 'tw', '2330', '台積電', 1085, 2.36, 32500000000, 28100000000000, '半導體'),
  asset('honhai', 'tw', '2317', '鴻海', 212.5, 1.43, 8400000000, 2950000000000, '電子代工'),
  asset('mediatek', 'tw', '2454', '聯發科', 1345, 1.89, 4200000000, 2150000000000, '半導體'),
  asset('delta', 'tw', '2308', '台達電', 412, -0.72, 2100000000, 1070000000000, '電子零組件'),
  asset('fubon', 'tw', '2881', '富邦金', 91.6, 0.55, 1300000000, 1240000000000, '金融保險'),
  asset('etf0050', 'tw', '0050', '元大台灣50', 58.75, 1.12, 2800000000, 560000000000, 'ETF'),
];
export interface CapitalFlow { id: string; name: string; market: Market; value: number; unit: string; change: number; description: string; series: number[]; isDemo: true; }
export const capitalFlows: CapitalFlow[] = [
  { id: 'btc-etf', name: '比特幣現貨 ETF', market: 'crypto', value: 328, unit: '百萬美元', change: 18.6, description: '近 7 日淨流入', series: [84, 110, 96, 158, 142, 246, 328], isDemo: true },
  { id: 'us-institution', name: '美股機構資金', market: 'us', value: 2.84, unit: '十億美元', change: 12.4, description: '近 7 日淨流入', series: [0.7, 1.2, 1.1, 1.8, 1.6, 2.3, 2.84], isDemo: true },
  { id: 'tw-foreign', name: '台股外資買賣超', market: 'tw', value: 186.4, unit: '億新台幣', change: 8.2, description: '近 7 日累計買超', series: [42, 68, 54, 92, 118, 154, 186.4], isDemo: true },
  { id: 'stablecoin', name: '穩定幣供給變化', market: 'crypto', value: 1.26, unit: '十億美元', change: 4.8, description: '近 7 日供給增加', series: [0.3, 0.4, 0.38, 0.7, 0.82, 1.04, 1.26], isDemo: true },
];
export interface FinancialEvent { id: string; title: string; startsAt: string; region: string; importance: 'high' | 'medium' | 'low'; category: '總體經濟' | '央行政策' | '企業財報' | '加密貨幣'; description: string; forecast: string; previous: string; isDemo: true; }
export const financialEvents: FinancialEvent[] = [
  { id: 'cpi', title: '美國消費者物價指數 CPI', startsAt: '2026-10-13T12:30:00Z', region: '美國', importance: 'high', category: '總體經濟', description: '觀察通膨趨勢與利率預期；日期與數值均為示範。', forecast: '2.4%', previous: '2.5%', isDemo: true },
  { id: 'tsmc-earnings', title: '台積電第三季法說會', startsAt: '2026-10-14T06:00:00Z', region: '台灣', importance: 'high', category: '企業財報', description: '關注 AI 需求、資本支出與營運展望；此為示範事件。', forecast: '—', previous: '—', isDemo: true },
  { id: 'fed', title: '聯準會政策會議紀要', startsAt: '2026-10-14T18:00:00Z', region: '美國', importance: 'high', category: '央行政策', description: '追蹤政策討論與資金成本；此為示範事件。', forecast: '—', previous: '—', isDemo: true },
  { id: 'claims', title: '美國初領失業救濟金人數', startsAt: '2026-10-15T12:30:00Z', region: '美國', importance: 'medium', category: '總體經濟', description: '觀察勞動市場動能；此為示範事件。', forecast: '22.0 萬', previous: '21.8 萬', isDemo: true },
  { id: 'crypto-update', title: '以太坊生態技術更新', startsAt: '2026-10-16T09:00:00Z', region: '全球', importance: 'medium', category: '加密貨幣', description: '關注鏈上活動與生態發展；此為示範事件。', forecast: '—', previous: '—', isDemo: true },
  { id: 'retail', title: '美國零售銷售月增率', startsAt: '2026-10-16T12:30:00Z', region: '美國', importance: 'high', category: '總體經濟', description: '觀察消費需求與經濟活動；此為示範事件。', forecast: '0.3%', previous: '0.2%', isDemo: true },
];
export const TAIPEI_TIMEZONE = 'Asia/Taipei';
export function formatTaipeiDateTime(isoDate: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, ...options, timeZone: TAIPEI_TIMEZONE }).format(new Date(isoDate));
}
