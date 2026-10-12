# 觀潮 Tide Research

Next.js 15 + React 19 + TypeScript 金融研究可操作原型。介面繁體中文、時間 Asia/Taipei，支援手機。

## 啟動

```sh
npm ci
npm run dev
```

正式建置及啟動：`npm run build`、`npm run start`，預設 port 3000。

## 功能

- 加密貨幣、美股、台股共 18 筆標的，名稱/代碼搜尋、產業與漲跌篩選、排序、詳情走勢。
- 自選清單使用本機 localStorage；刷新後保留，可新增與移除。
- 資金觀察支援三市場及 7/30 日區間。
- 全球事件日曆支援週次、地區、重要性、詳情與收藏。
- 會員方案及租售合作預覽；tenant、訂閱、資料 provider 型別已預留。

所有行情、指數、資金流與事件日期皆為示範資料；未串接即時行情、登入或金流，不構成投資建議。事件週次移動是示範排程的平移，不代表真實發布日期。價格 USD/TWD 依市場呈現，資金觀察統一百萬美元。

## 驗證

```sh
npm run typecheck
npm run build
npm run test:e2e
```

E2E 設定使用環境中的 `/usr/bin/chromium`；其他環境可將 playwright.config.ts 的 executablePath 移除並執行 `npx playwright install chromium`。測試覆蓋桌面與 390px 手機 viewport、三市場流程、自選保存、資金切換與台北事件收藏。

架構與後續接入說明見 [docs/architecture.md](docs/architecture.md)。

## V2 私人交易終端

- 深色電子風格，加密商品為主軸；點選商品直達 TradingView K 線。
- 全市場掃描：Binance USDT 永續、已收盤 15m K 線、MA/EMA/成交量，內建三策略與自訂條件。
- 個人交易紀錄：截圖、判斷、費用、槓桿與保證金報酬、週月報告；IndexedDB 本機保存。
- `npm run build:hosted`：Next.js 靜態匯出＋Cloudflare Worker 打包；`npm run start` 以相同 Worker 開本機預覽。Hosted 綁定 R2 後才可執行 live 掃描，本機會明示 API 不可用。
- `npm run test:worker`：掃描 API 持久化與已收盤K測試。

無人更新流程見 docs/scan-update.md。瀏覽器刷新並不等同雲端排程；啟用狀態與實際 live 來源驗證須另外確認。
