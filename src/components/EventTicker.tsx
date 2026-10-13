"use client";

import { useRef, useState } from "react";
import { CalendarPanel, dateFormat, eventDate, events, timeFormat } from "./ResearchPanels";
import "./event-ticker.css";

export function EventTicker() {
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<string | undefined>();
  const [session, setSession] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  function browse(id?: string) {
    setSelected(id);
    setSession(value => value + 1);
    dialog.current?.showModal();
  }
  return <section className="event-ticker" aria-labelledby="event-ticker-title">
    <div className="event-ticker-heading">
      <div><p>GLOBAL EVENTS</p><h2 id="event-ticker-title">本週焦點事件</h2><span>示範排程 · 台北時間 UTC+8</span></div>
      <div className="event-ticker-actions">
        <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "播放跑馬燈" : "暫停跑馬燈"}</button>
        <button type="button" onClick={() => browse()}>瀏覽全部事件 →</button>
      </div>
    </div>
    <div className={`event-ticker-window ${paused ? "is-paused" : ""}`}>
      <div className="event-ticker-track">
        <div className="event-ticker-group">
          {events.map(event => <button type="button" className="event-ticker-item" key={event.id} onClick={() => browse(event.id)}>
            <span className="event-ticker-date">{dateFormat.format(eventDate(0, event.day, event.hour))} {timeFormat.format(eventDate(0, event.day, event.hour))}</span>
            <strong>{event.title}</strong><span className={event.importance === "高" ? "event-ticker-high" : ""}>{event.region} · {event.importance}重要性</span>
          </button>)}
        </div>
        <div className="event-ticker-group" aria-hidden="true">
          {events.map(event => <button type="button" tabIndex={-1} className="event-ticker-item" key={event.id} onClick={() => browse(event.id)}>
            <span className="event-ticker-date">{dateFormat.format(eventDate(0, event.day, event.hour))} {timeFormat.format(eventDate(0, event.day, event.hour))}</span>
            <strong>{event.title}</strong><span className={event.importance === "高" ? "event-ticker-high" : ""}>{event.region} · {event.importance}重要性</span>
          </button>)}
        </div>
      </div>
    </div>
    <p className="event-ticker-note">日期與數值為示範資料。停留或聚焦時暫停，可點選事件展開詳情。</p>
    <dialog ref={dialog} className="event-browser-dialog" aria-labelledby="event-browser-title" onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
      <div className="event-browser-bar"><h2 id="event-browser-title">全部金融事件</h2><button type="button" autoFocus aria-label="關閉全部金融事件" onClick={() => dialog.current?.close()}>關閉 ×</button></div>
      <CalendarPanel key={session} initialEventId={selected} />
    </dialog>
  </section>;
}
