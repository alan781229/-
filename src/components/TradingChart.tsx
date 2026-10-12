"use client";

import { useEffect, useId, useRef, useState } from "react";
import "./trading-chart.css";

function normalizeSymbol(input: string) {
  const value = input.trim().toUpperCase().replace(/^:/, "");
  if (value.includes(":")) return value;
  if (/^\d{4,6}$/.test(value)) return `TWSE:${value}`;
  if (/^[A-Z0-9]+USDT$/.test(value)) return `BINANCE:${value}`;
  if (["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT"].includes(value)) return `BINANCE:${value}USDT`;
  return `NASDAQ:${value}`;
}

export function TradingChart({ symbol, onClose }: { symbol: string; onClose?: () => void }) {
  const ticker = normalizeSymbol(symbol);
  const [interval, setInterval] = useState("15");
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const host = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(ticker)}&interval=${interval}`;

  useEffect(() => {
    const target = host.current;
    if (!target) return;
    setStatus("loading");
    const container = document.createElement("div");
    container.className = "tradingview-widget-container tc-widget-inner";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    container.appendChild(widget);
    target.replaceChildren(container);
    let disposed = false;
    let frame: HTMLIFrameElement | null = null;
    const ready = () => { if (!disposed) { setStatus("ready"); clearTimeout(timer); } };
    const timer = setTimeout(() => { if (!disposed) setStatus("error"); }, 25000);
    const observer = new MutationObserver(() => {
      const next = container.querySelector("iframe");
      if (next && next !== frame) {
        frame?.removeEventListener("load", ready);
        frame = next;
        frame.title = `${ticker} TradingView K 線圖`;
        frame.addEventListener("load", ready);
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true, symbol: ticker, interval, timezone: "Asia/Taipei", theme: "dark",
      style: "1", locale: "zh_TW", allow_symbol_change: true, hide_side_toolbar: false,
      hide_top_toolbar: false, calendar: false, support_host: "https://www.tradingview.com",
      studies: ["MASimple@tv-basicstudies", "MAExp@tv-basicstudies"],
    });
    script.onerror = () => { if (!disposed) { clearTimeout(timer); setStatus("error"); } };
    container.appendChild(script);
    return () => {
      disposed = true;
      clearTimeout(timer);
      observer.disconnect();
      frame?.removeEventListener("load", ready);
      script.onerror = null;
      container.remove();
    };
  }, [ticker, interval, attempt]);

  return <section className="tc-panel" aria-labelledby={headingId}>
    <div className="tc-header">
      <div><p className="tc-eyebrow">LIVE CHART / TRADINGVIEW</p><h2 id={headingId}>{ticker} <span>K 線圖</span></h2></div>
      {onClose && <button className="tc-close" type="button" onClick={onClose} aria-label="關閉 K 線圖">✕</button>}
    </div>
    <div className="tc-toolbar">
      <div className="tc-intervals" role="group" aria-label="K 線週期">{[["15", "15 分"], ["60", "1 小時"], ["240", "4 小時"], ["D", "日線"]].map(([value, label]) => <button key={value} type="button" aria-pressed={interval === value} onClick={() => setInterval(value)}>{label}</button>)}</div>
      <a href={href} target="_blank" rel="noopener noreferrer">在 TradingView 開啟 ↗</a>
    </div>
    <div className="tc-canvas" aria-busy={status === "loading"}>
      <div className="tc-widget" ref={host} />
      {status !== "ready" && <div className="tc-status" role="status" aria-live="polite">
        {status === "loading" ? <><span className="tc-loader" aria-hidden="true" /><strong>正在連接 TradingView 圖表…</strong></> : <><strong>圖表尚未載入</strong><p>外部服務可能暫時無法連線，或被瀏覽器阻擋。請重試或直接開啟 TradingView。</p><button type="button" onClick={() => setAttempt(a => a + 1)}>重新載入</button><a href={href} target="_blank" rel="noopener noreferrer">開啟商品 K 線 ↗</a></>}
      </div>}
    </div>
    <p className="tc-note">圖表由外部 TradingView 服務提供，行情延遲、交易所與商品可用性依其資料方案而定。台北時間（UTC+8）。內嵌圖表使用 MA、EMA 預設參數；MA20／60／120、EMA20／60／120／200 與成交量的完整判斷由市場掃描器計算，圖表指標請於 TradingView 手動設定。</p>
  </section>;
}
