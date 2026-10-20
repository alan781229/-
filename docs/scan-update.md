# 15 分鐘更新操作

此操作只限 owner-private 的觀潮 Site，維持現有分享權限。

1. 從 Sites get_site 取得此網站當前存取與雲端服務存取，或使用已安裝連接的本站 MCP。
2. 讀取 scan_status / GET /api/scan/status。若最新快照已在此 15 分鐘週期完成，或另一個 writer 正在掃描則不重開，避免兩個 driver。失效超過 15 分鐘的進度可重新 begin。
3. 使用OKX 公開來源（provider: okx）及預設 strict/both/MA+EMA/slope/volumeRatio=1.2 開始 scan_begin / POST /api/scan/begin {rules: ...}。
4. 對返回 runId 與 offset 呼叫 scan_step / POST /api/scan/step，直到 status completed/failed。暫時失敗補掃時 completed/offset 可以重置下降，依返回 offset 接續；不要據此另開 run。409 請讀取最新狀態，不盲目重送 stale offset。未授權或資料來源封鎖時停止，不能用示範資料替代。
5. 讀取完成快照確認 runId 相同，商品總數、成功、失敗及候選。保留時間和 coverage。每次取得可用 OKX USDT 永續全市場，不固定熱門清單，不包含未收盤 K。
6. 常態成功保持安靜；只在來源失敗、寫入失敗或需要使用者處理時通知。同一次持續錯誤不重複通知。這不是交易/下單服務。

服務憑證不能寫入原始碼、備份、排程 prompt 或回應。Sites 的 service access 只送到相同 Site；驗證存取獨立於原始碼權限。若只提供瀏覽器刷新，必須標示未啟用無人排程。

## GitHub 15 分鐘排程

Sites create_schedule 已實際回報最低每小時一次，拒絕 15 分鐘。沒有建立每小時的替代排程。

`.github/workflows/market-scan.yml` 使用公開儲存庫的 GitHub-hosted Linux runner，每 15 分鐘觸發（UTC 分鐘 0/15/30/45，對應台北同分鐘），也支援 workflow_dispatch。GitHub 排程是 best effort，可能延遲；完整掃描仍受公開來源限流影響。concurrency 不重疊，已有新鮮 driver 時跳過，失敗進度保留。首次服務存取須另驗證，原生 Site MCP 的成功不能冒充 GitHub 服務連線成功。

啟用所需：在儲存庫 Actions secrets 設定 `TIDE_SITE_SERVICE_TOKEN` 為**同一私人 Site 的服務存取 token**，不是交易所 API key，也不是來源儲存庫 Git token。不要把值放入程式、workflow input、排程 prompt 或版本控制。沒有此 secret 時工作流程僅顯示未配置並跳過掃描；不能宣稱背景更新已啟用。現有工具沒有提供 GitHub secrets 設定操作，需使用者完成安全配置後再驗證第一次執行。

RBAC 更新後，未具訪客身分的背景驅動改呼叫 owner-private MCP 市場資料工具，需保留伺服器 `TIDE_PRIVATE_SERVICE_SCAN=owner-private`。這不授予會員或管理員權限；直接匿名 HTTP API 仍會拒絕。網站改為公開前必須移除此服務設定。排程仍待 GitHub secret 安全設定後才可啟用。
