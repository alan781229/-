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
