"use client";

import { useEffect, useState } from "react";
import "./research-panels.css";

type Market = "加密貨幣" | "美股" | "台股";
const flows: Record<Market, number[]> = {
  加密貨幣: [31, -18, 47, 22, -29, 65, 42],
  美股: [72, 44, -31, 95, 38, -24, 81],
  台股: [-24, 36, 51, -19, 42, 68, 27],
};
const destinations: Record<Market, string[]> = {
  加密貨幣: ["Bitcoin 現貨 ETF", "Ethereum 現貨 ETF", "穩定幣供給", "交易所淨流入"],
  美股: ["大型科技", "半導體", "美國公債", "金融類股"],
  台股: ["半導體", "電子零組件", "金融保險", "航運類股"],
};

export function CapitalPanel() {
  const [market, setMarket] = useState<Market>("加密貨幣");
  const [period, setPeriod] = useState<7 | 30>(7);
  const values = flows[market].map((v, i) => period === 7 ? v : Math.round(v * 2.8 + i * 3));
  const net = values.reduce((a, b) => a + b, 0);
  return <section className="rp-panel" aria-labelledby="capital-title">
    <div className="rp-heading"><div><p className="rp-eyebrow">CAPITAL FLOW</p><h2 id="capital-title">資金觀察</h2><p className="rp-muted">追蹤資金方向，觀察市場輪動。</p></div><span className="rp-demo">示範資料</span></div>
    <div className="rp-controls"><div className="rp-segment" aria-label="資金市場">{(Object.keys(flows) as Market[]).map(m => <button key={m} aria-pressed={market === m} className={market === m ? "is-active" : ""} onClick={() => setMarket(m)}>{m}</button>)}</div><div className="rp-segment" aria-label="觀察區間">{([7, 30] as const).map(p => <button key={p} aria-pressed={period === p} className={period === p ? "is-active" : ""} onClick={() => setPeriod(p)}>{p} 日</button>)}</div></div>
    <div className="rp-flow-summary"><span>{period} 日累計淨流入</span><strong className={net >= 0 ? "rp-positive" : "rp-negative"}>{net >= 0 ? "+" : ""}{net.toLocaleString()} <small>百萬美元</small></strong><span className="rp-muted">統一美元口徑 · 模擬值</span></div>
    <div className="rp-chart" role="img" aria-label={`${market} ${period} 日模擬資金流向；各期數值 ${values.join("、")} 百萬美元`}>
      <div className="rp-chart-axis"><span>流入</span><span>0</span><span>流出</span></div><div className="rp-bars">{values.map((v, i) => <div className="rp-bar-column" key={i}><div className="rp-bar-area"><div className={`rp-bar ${v < 0 ? "negative" : "positive"}`} style={{ height: `${Math.min(43, Math.abs(v) / (period === 7 ? 2.5 : 7))}%` }}><span>{v > 0 ? "+" : ""}{v}</span></div></div><span className="rp-bar-label">{period === 7 ? `第 ${i + 1} 日` : `第 ${i * 4 + 1}–${i === 6 ? 30 : i * 4 + 4} 日`}</span></div>)}</div>
    </div>
    <div className="rp-table-scroll"><table className="rp-table"><thead><tr><th>觀察標的</th><th>淨流向（百萬美元）</th><th>方向</th></tr></thead><tbody>{destinations[market].map((name, i) => { const value = values[i] * (i === 3 ? -1 : 1); return <tr key={name}><td>{name}</td><td className={value >= 0 ? "rp-positive" : "rp-negative"}>{value >= 0 ? "+" : ""}{value}</td><td><span className={`rp-direction ${value >= 0 ? "in" : "out"}`}>{value >= 0 ? "淨流入" : "淨流出"}</span></td></tr>; })}</tbody></table></div>
    <p className="rp-footnote">以上為功能展示用模擬數值，未連接即時行情或機構資金資料。</p>
  </section>;
}

type EventItem = { id: string; day: number; hour: number; title: string; region: "美國" | "台灣" | "全球"; importance: "高" | "中"; previous: string; expected: string; detail: string };
const events: EventItem[] = [
  { id: "cpi", day: 1, hour: 20, title: "美國消費者物價指數 CPI", region: "美國", importance: "高", previous: "2.8%", expected: "2.7%", detail: "觀察通膨變化與利率預期，可能影響美元、債券及風險資產。數值與排程均為示範。" },
  { id: "twtrade", day: 2, hour: 16, title: "台灣進出口統計", region: "台灣", importance: "中", previous: "+8.2%", expected: "+9.1%", detail: "觀察出口需求與電子產業景氣，搭配產業營收追蹤。數值與排程均為示範。" },
  { id: "fed", day: 3, hour: 2, title: "聯準會利率決策", region: "美國", importance: "高", previous: "4.00%", expected: "4.00%", detail: "留意政策聲明與利率路徑；此模擬事件不代表官方會議時間。" },
  { id: "crypto", day: 4, hour: 18, title: "數位資產市場觀察報告", region: "全球", importance: "中", previous: "—", expected: "—", detail: "追蹤穩定幣供給、ETF 資金及鏈上活動；此為虛構研究事件。" },
  { id: "jobs", day: 4, hour: 20, title: "美國非農就業報告", region: "美國", importance: "高", previous: "15.1 萬", expected: "16.0 萬", detail: "就業增長與薪資變化有助評估景氣及政策方向。數值與排程均為示範。" },
];
const FAVORITES_KEY = "financial-research-demo-events-v1";
const dateFormat = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false });
function eventDate(week: number, day: number, hour = 0) { return new Date(Date.UTC(2026, 9, 12 + week * 7 + day, hour - 8)); }

export function CalendarPanel() {
  const [week, setWeek] = useState(0);
  const [region, setRegion] = useState("全部地區");
  const [importance, setImportance] = useState("全部重要性");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  useEffect(() => { try { const raw: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); if (Array.isArray(raw)) setFavorites(raw.filter((id): id is string => typeof id === "string" && /^-?\d{1,3}:(cpi|twtrade|fed|crypto|jobs)$/.test(id)).slice(0, 100)); } catch { /* Unavailable or malformed storage uses defaults. */ } setLoaded(true); }, []);
  useEffect(() => { if (loaded) { try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch { /* Browsing remains usable without storage. */ } } }, [favorites, loaded]);
  const filtered = events.filter(e => (region === "全部地區" || e.region === region) && (importance === "全部重要性" || e.importance === importance) && (!savedOnly || favorites.includes(`${week}:${e.id}`)));
  return <section className="rp-panel" aria-labelledby="calendar-title">
    <div className="rp-heading"><div><p className="rp-eyebrow">ECONOMIC CALENDAR</p><h2 id="calendar-title">全球金融事件日曆</h2><p className="rp-muted">掌握研究節奏 · 所有時間為台北時間 UTC+8</p></div><span className="rp-demo">模擬排程</span></div>
    <div className="rp-calendar-toolbar"><div className="rp-week-nav"><button aria-label="上一週" disabled={week <= -52} onClick={() => setWeek(w => w - 1)}>←</button><strong>{dateFormat.format(eventDate(week, 0))} — {dateFormat.format(eventDate(week, 6))}<small>{new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric" }).format(eventDate(week, 0))} 示範週次{week !== 0 ? ` ${week > 0 ? "+" : ""}${week}` : ""}</small></strong><button aria-label="下一週" disabled={week >= 52} onClick={() => setWeek(w => w + 1)}>→</button><button className="rp-reset" onClick={() => setWeek(0)}>示範本週</button></div><div className="rp-filters"><label><span className="rp-sr-only">地區</span><select value={region} onChange={e => setRegion(e.target.value)}>{["全部地區", "美國", "台灣", "全球"].map(v => <option key={v}>{v}</option>)}</select></label><label><span className="rp-sr-only">重要性</span><select value={importance} onChange={e => setImportance(e.target.value)}><option>全部重要性</option><option value="高">高重要性</option><option value="中">中重要性</option></select></label><button className={`rp-saved-filter ${savedOnly ? "is-active" : ""}`} aria-pressed={savedOnly} onClick={() => setSavedOnly(v => !v)}>☆ 已收藏</button></div></div>
    <div className="rp-events">{filtered.length === 0 ? <div className="rp-empty">此週沒有符合條件的示範事件。試試調整篩選或收藏事件。</div> : filtered.map(e => { const key = `${week}:${e.id}`; const saved = favorites.includes(key); const open = expanded === key; const date = eventDate(week, e.day, e.hour); return <article className="rp-event" key={key}><div className="rp-event-row"><div className="rp-event-time"><strong>{dateFormat.format(date)}</strong><span>{timeFormat.format(date)}</span></div><button className="rp-event-main" aria-expanded={open} aria-controls={`detail-${e.id}`} onClick={() => setExpanded(open ? null : key)}><span className="rp-event-meta"><span>{e.region}</span><span className={`rp-importance ${e.importance === "高" ? "high" : ""}`}>{e.importance === "高" ? "●●●" : "●●○"} {e.importance}重要性</span></span><strong>{e.title}</strong><span className="rp-expand-hint">{open ? "收起詳情 −" : "展開詳情 +"}</span></button><button className={`rp-star ${saved ? "is-saved" : ""}`} aria-label={`${saved ? "取消收藏" : "收藏"}${e.title}`} aria-pressed={saved} onClick={() => setFavorites(list => saved ? list.filter(id => id !== key) : [...list, key].slice(-100))}>{saved ? "★" : "☆"}</button></div>{open && <div id={`detail-${e.id}`} className="rp-event-detail"><div className="rp-estimates"><span>前值 <strong>{e.previous}</strong></span><span>預期 <strong>{e.expected}</strong></span><span>實際 <strong>尚未公布（示範）</strong></span></div><p>{e.detail}</p></div>}</article>; })}</div>
    <p className="rp-footnote">日期、事件與預期值皆為可操作原型的模擬資料，非官方經濟行事曆。收藏儲存在本機瀏覽器。</p>
  </section>;
}
