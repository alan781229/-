# 金融研究網站架構

本版為 Next.js / TypeScript 可操作原型，介面使用繁體中文。初版市場總覽、資金、事件與方案價格為示範，不代表正式排程或可購買方案；V2 掃描器與 TradingView 為另行標示的公開行情來源。

## 資料與時間

`src/lib/demo-data.ts` 定義三大市場的型別與示範資料。價格使用各資產的 `currency`；成交額與市值為同幣別金額，不能跨幣別直接加總。`change` 是百分比數值，`series` 是圖表示範序列。供應商事件型別以含 `Z` 的 ISO UTC 時間保存，展示一律由 `Intl.DateTimeFormat` 轉為 `Asia/Taipei`，避免瀏覽器時區造成差異。

`MarketDataProvider` 在 `src/lib/platform.ts` 隔離供應商。正式串接應於伺服器讀取金鑰、正規化報價幣別、記錄資料時間與授權來源，再由介面呈現延遲／過期狀態。示範 provider 保留同一存取介面。

## 自選與會員

目前 UI 資金觀察與週次事件另使用元件內的模擬序列；正式串接須將這兩個面板統一接到 provider，不能將示範週次平移當作真實事件。

原型自選清單儲存在瀏覽器 localStorage，依 tenant 命名空間隔離；不提供登入或跨裝置同步。正式版以 Member、Watchlist 表保存，每次讀寫驗證登入身分、tenantId 與授權，不接受客戶端提供的權限判定。匿名清單可在登入後明確合併。

## 訂閱預留

SubscriptionPlan 目前全部標記 `available: false`。正式版需加入身分驗證、付款供應商 checkout、經簽章驗證且具冪等性的 webhook、訂閱／帳單紀錄與伺服器端 entitlement。價格僅為產品設計示範，現階段不得收款或宣稱啟用訂閱。

## 網站租售

TenantConfig 保存品牌、語言、時區與 `managed-rental` / `license-sale` 商業模式。租用模式可由可信網域對應 tenant，所有資料查詢與快取必須納入 tenantId；出售模式可獨立部署，使用相同型別與供應商介面。正式多租戶需資料隔離、網域驗證、租戶管理與稽核紀錄，不能只依前端 slug 隔離。

## 上線前

串接經授權的市場與事件資料、設定資料更新與錯誤處理，完成身分／付款／租戶隔離驗證，再開啟會員、收款或即時資料。原型不包含投資建議、真實帳務或交易執行。

## V2 電子研究終端

前端維持 Next.js / TypeScript，`next build` 匯出 `out/`；`scripts/build-hosted.mjs` 將匯出資產及掃描程式打包為 Cloudflare Worker ESM。Sites 私人權限維持本人，R2 `BUCKET` 保存 `scan/progress.json` 與 `scan/snapshot.json`。`npm run build:hosted` 生成 `dist/server/index.js`。

### 掃描範圍與演算法

全市場定義為所選 OKX 或 Binance 所有有效、正在交易的 USDT 永續合約，不含現貨、USDC 或其他交易所。以交易所伺服器時間作截點，僅使用已收盤的 15 分鐘 K 線。OKX K 線依確認旗標與交易所時間排除未收盤後由新到舊轉為時間正序；每商品至少 250 根；MA20/60/120 為 SMA，EMA20/60/120/200 使用有限歷史的 SMA 初始化，數值可能與 TradingView 完整歷史有差異；量比為最近已收盤量除以前 20 根均量。嚴格、順勢及回踩的確切規則見 scanner.ts 和掃描器說明。新上市資料不足或 API 失敗會計入失敗數；不會退回示範假裝成功。候選不代表獲利預測。

`POST /api/scan/begin` 動態取得商品及時間，`POST /api/scan/step` 每次 12 商品，`GET /api/scan/status` 可讀取最後完成快照。以 runId/offset 避免重複步驟；R2 不是原子鎖，排程與瀏覽器應保持單一驅動，遇既有 running run 應讀取/等待，不能同時重開。頁面可見時每 15 分鐘刷新與雲端無人排程為不同功能，不能互相代稱。

### TradingView

使用官方 advanced-chart embed，不需交易所金鑰；商品映射 OKX / Binance USDT 永續 `.P`、NASDAQ、TWSE。外連支援商品與週期。完整掃描均線由本站計算，圖表內建 MA/EMA 為 TradingView 預設值，指定週期要於圖表手動設定。圖表服務可能受地區/延遲/瀏覽器限制，失敗提供重試與外連，不顯示假圖冒充行情。

### 個人交易紀錄

紀錄與 PNG/JPEG/WebP 圖片保存於 IndexedDB，最多 5MB，驗證 MIME 及 magic bytes。尚未跨裝置同步，使用者可下載含 base64 圖片的 JSON 備份；不作 OCR 或截圖自動數值推測。個人/示範交易分開，表單以台北時間換 UTC 保存，依台北平倉日期聚合週（週一為週起點）與月。

毛損益 = (出場−進場)×商品數量×方向，淨損益 = 毛損益−交易費用+資金費用（收入正、支出負）。槓桿不重複乘在商品數量損益；ROI 只有填入投入保證金才計算。少於 5 筆標示樣本不足；建議依紀律率及歷史統計，無模型讀取圖片或預測市場。報告按目前模式即時計算，非自動推播。

### 無人更新與驗證

Worker `/mcp` 提供 `scan_status`、`scan_begin`、`scan_step`，供 Sites 已授權私人連線使用。無人排程需驗證 writer 將結果寫入 R2，且後續 task 能獨立取得相同 Site 的存取；未驗證前不能宣稱 15 分鐘背景更新已啟用。寫入不重新發布網站，所有錯誤與覆蓋保存在 scan run。

本機因沒有 R2，live API 會明示 503；Worker 單元測試使用公開 API fixture，瀏覽器 TradingView 載入測試使用 fixture，這些不是生產行情驗證。

### 來源可用性

2026/10/12 已透過原生 Site 工具證實私人 R2 存取成功；Binance 公開 API 從託管伺服器返回 HTTP403，因此加入 OKX 公開來源作明示可選的獨立交易所，不作隱性代理或錯誤回落。最終成功覆蓋數與候選依最新實際掃描狀態為準。

### 全市場限流處理

正式環境 OKX 能取得 485 個有效 USDT 永續商品；首輪未節流時實際返回大量 HTTP429。已加入每批至少 2.2 秒間隔、最多 4 個同時行情請求、尊重 Retry-After 的 3 次有限嘗試，以及暫時失敗最多 2 輪補掃。永久資料不足不重試；最終 coverage 必須呈現，不能將不完整結果當作完整市場。前端會自動讀取真實掃描進度或已完成快照，背景進行中每 30 秒讀取進度且禁止重複驅動，沒有任何進度／快照時明示示範模式。
