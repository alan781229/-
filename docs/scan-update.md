# 15 分鐘更新操作

此操作只限 owner-private 的觀潮 Site，維持現有分享權限。

1. 從 Sites get_site 取得此網站當前存取與雲端服務存取，或使用已安裝連接的本站 MCP。
2. 讀取 scan_status / GET /api/scan/status。若最新快照已在此 15 分鐘週期完成，或另一個 writer 正在掃描則不重開，避免兩個 driver。失效超過 15 分鐘的進度可重新 begin。
3. 使用OKX 公開來源（provider: okx）及預設 strict/both/MA+EMA/slope/volumeRatio=1.2 開始 scan_begin / POST /api/scan/begin {rules: ...}。
4. 對返回 runId 與 offset 呼叫 scan_step / POST /api/scan/step，直到 status completed/failed。409 請讀取最新狀態，不盲目重送 stale offset。未授權或資料來源封鎖時停止，不能用示範資料替代。
5. 讀取完成快照確認 runId 相同，商品總數、成功、失敗及候選。保留時間和 coverage。每次取得可用 OKX USDT 永續全市場，不固定熱門清單，不包含未收盤 K。
6. 常態成功保持安靜；只在來源失敗、寫入失敗或需要使用者處理時通知。同一次持續錯誤不重複通知。這不是交易/下單服務。

服務憑證不能寫入原始碼、備份、排程 prompt 或回應。Sites 的 service access 只送到相同 Site；驗證存取獨立於原始碼權限。若只提供瀏覽器刷新，必須標示未啟用無人排程。
