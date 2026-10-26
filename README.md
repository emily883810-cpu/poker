# Poker OS

私人 Texas Hold’em Cash Game 離線復盤工作台。React + Vite 前端、Python 本機 API、SQLite 保存。專為已完成手牌；沒有客戶端監聽、HUD、即時建議、自動打牌、外部 AI 呼叫或 Solver。附帶手牌是自行編寫的示範，不是實際平台紀錄。

## Windows 雙擊版

已提供的 Windows ZIP 包含編譯後網頁，**不需安裝 Node.js**：

1. 下載 ZIP，右鍵選「全部解壓縮」，放到「文件」資料夾（不要直接在 ZIP 裡啟動）。
2. 在解壓後資料夾，雙擊 `Start-Poker-OS.cmd`。
3. 首次檢查 Python；如未安裝，使用 Windows Package Manager 安裝官方 Python 3.12，並安裝 PDF 套件。需要網路；若電腦出現安裝權限提示，請檢視後自行決定是否允許。
4. 等待瀏覽器自動開啟本機 Poker OS。使用期間保留黑色視窗，結束時在該視窗按 Ctrl+C。

支援有 Windows Package Manager 的 Windows 10/11。若無 winget，會開啟 Python 官網，需先安裝 Python 3.12+ 後再雙擊。防毒軟體／公司政策阻擋時，不要停用保護，保留錯誤訊息再處理。此啟動器在 Linux 環境完成靜態檢查，尚未在真正 Windows 電腦執行驗證；打包網頁及 Python 同源服務已在 Chromium 實測。

資料存在解壓資料夾內的 `data`，更新程式前先備份。相同埠已有 Poker OS 時會開啟原本執行中的工作區；要開另一份解壓資料夾，請先關閉上一份服務。ZIP 不含任何私人手牌或教材。原始碼版開發與測試仍依照下列流程。

## 本機啟動

需要 Node.js 22.12+（本環境測試 Node 24）、Python 3.12+。以下為 macOS/Linux Bash 指令：

```bash
cd /workspace/poker # 本機 clone 後改為你的專案路徑
npm ci --cache /tmp/poker-npm-cache
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

開兩個 terminal：

```bash
# Terminal 1：本機 API / SQLite
.venv/bin/python -m server.app
```

```bash
# Terminal 2：網頁，瀏覽器開啟 http://127.0.0.1:5173
npm run dev
```

只綁定 `127.0.0.1`，不需 API key、登入或雲端帳戶。不要改成公開監聽或把本機 API 暴露到網際網路；這是單使用者本機工具，沒有遠端身分驗證。程式運作不需外連，首次安裝需要 npm/PyPI。啟動 API 後，左下角顯示 Local database。

## MVP 操作

- **Replayer**：6-max / 9-max；逐動作播放、暫停、速度、滑桿、街道與 timeline 跳轉，公共牌逐街揭示。顯示座號、位置、Button、已知底牌、剩餘 Stack、Pot、當街投入和 SPR。勾選顯示底牌只揭露紀錄已有的牌，未知牌不猜測。
- **Import hand**：上傳或貼上英文 PokerStars / Zoom、相容英文 GGPoker HH，或 Poker OS JSON。確認已完成且有權使用後驗證保存。同 ID 更新，不會重複入庫。批次匯入先全部解析，解析失敗不寫入；若 API 寫入中途失敗，先前成功的手牌仍會保留，可用相同 ID 重試。
- **New live hand**：選擇 Macau Live / WePoker 等平台、幣別 HKD/RMB/USD/EUR、盲注、桌型與 Button。填入座位、起始 Stack、位置、已知兩張底牌、公共牌，再依序新增動作。最後填實際派彩 `collect`，確認已完成後保存。支援 2 至 6 / 9 名實際入座玩家；手機 9-max 牌桌可局部橫向捲動。
- **Hand library**：SQLite 持久保存，可依平台、標題、玩家、ID、盲注、標籤、筆記搜尋；例如 `B-X-B`、`B-B-X`、`3BP OOP R`。標籤是使用者分類，不會冒充自動策略判斷。支援刪除、單手 JSON 或全部匯出，再用 Import 恢復手牌。
- **Study library**：只匯入你有權私人使用的 ChakPoker 或其他教材，支援 UTF-8 TXT、Markdown、文字型 PDF（單檔 8 MB）。空白行切段，PDF 另保留頁碼；結果顯示檔名、段落序號、頁碼及教材原文。同檔名同內容重匯不重複。多個關鍵字以空格分隔，全部匹配；不是向量／語意搜尋。掃描 PDF 需要先自行 OCR，沒有可提取文字會明確拒絕。

所有查詢結果標記「教材原文 · 非 AI 推論」。本版 **AI 推論未啟用**，不會編造教材內容、精確 GTO 頻率或 EV。未附帶任何 ChakPoker 付費教材。

## 計算與匯入邊界

`examples/completed-hand.json` 是可直接匯入的完整範例；可用 JSON 陣列匯入多手。主要欄位：

```text
id, title, site, stakes, currency, maxSeats (6 或 9), dealer (座號),
completed: true, players[], board[], actions[], tags[], notes
players: { seat, name, position, stack, cards?: ["As", "Kh"] }
actions: { street, player, type, amount }
street: Preflop | Flop | Turn | River
type: post | bet | call | raise | check | fold | return | collect
```

金額單位為該手牌幣別，不轉換匯率，也不把不同幣別相加。每次 `amount` 是**本次額外投入**，包括 raise；HH 文字的 `raises … to …` 會先減去當街已投入額。Check/Fold 必須是 0。`return` 退回當街未跟注額，`collect` 為實際派彩；全押／分池使用多筆 collect 手動或按 HH 記錄。Pot 在投入後增加、退回或派彩後減少；派彩後餘額未自動認定為抽水，請對照原始 summary。沒有從牌力計算贏家，也不自動結算側池。

SPR 為**當前最大兩個未棄牌玩家剩餘 Stack 的較小值 / 當前未派彩 Pot**（兩人池為較小 Stack）。多人池不是 Hero 對每個對手的獨立 SPR；Pot=0 或少於兩個未棄牌玩家顯示「—」。投入分層保留死錢，合併可獲配玩家相同的層；是派彩前帳目檢視，不是 Solver 結果。

匯入器僅涵蓋標準英文 Cash No Limit Hold’em 常見文字語法。**不宣稱所有 PokerStars / GG 匯出版本相容**，目前只以自行編寫的相容 fixtures 測試，尚未用你的真實 HH 驗證。WePoker 私有格式請轉成 JSON 或手動記錄。Ante、Straddle、補盲、Bomb pot、雙跑牌、Short Deck、Omaha、錦標賽、非英文紀錄均不支援；未知玩家動作會拒絕。遇到無法解析的紀錄請保留原檔，不要強行猜測。檢核包含重複牌／座號／玩家、街序、Stack、退回額及派彩上限；**不是完整下注規則或牌力合法性驗證器**。JSON 可自行宣告 completed，不能證明紀錄真實性。

## 資料與備份

- 預設 `data/poker.sqlite3`，由 `.gitignore` 排除；可用 `POKER_DB=/absolute/path/private.sqlite3` 覆寫。
- `hands` 保存標準 JSON、筆記、標籤和匯入原文（如有），`documents` / `passages` 保存檔名與提取文字。原始教材 PDF 不另存；請自行保留來源原檔。
- 關閉 API 後複製 SQLite 檔可備份手牌及教材索引；前端「匯出全部」只備份手牌，不含教材。
- 刪除動作會刪除對應資料／索引，但 SQLite 非安全抹除且備份可能仍有內容。本機資料未加密，敏感教材請放在有磁碟加密與適當檔案權限的電腦。
- 沒有雲端同步／遙測；請勿把私人資料或教材提交到 Git。

## 測試與建置

```bash
. .venv/bin/activate
npm test                  # Node 重播／解析測試 + Python API / SQLite / PDF 測試
npm run build             # 生產前端產生 dist/
# 首次在一般本機安裝測試用瀏覽器（如未裝）
npx playwright install chromium
npm run test:e2e
# 此雲端環境使用已安裝 Chromium，不需下載
POKER_CHROMIUM=/usr/bin/chromium npm run test:e2e
```

E2E 使用 API 8010 / Vite 5174，獨立 `/tmp/poker-os-e2e.sqlite3`，不會修改開發資料庫。測試會清空**該測試庫**的資料。涵蓋保存與重新載入、標籤搜尋、教材匯入與來源、手動 Live Hand、9-max 匯入、手機捲動。Python 測試使用臨時 SQLite，測試結束清除。

建置後 Python API 可直接提供 `dist/` 網頁與 `/api`，Windows 雙擊版即採用此模式；開發模式仍使用 `npm run dev`。不要單獨雙擊 HTML。可設定 `POKER_PORT` 改 API 監聽埠、`POKER_API_PORT` 改 Vite proxy 目標，兩者需一致。

## 結構

```text
src/poker.js             標準資料驗證、重播帳目、HH 解析
src/Replayer.jsx         牌桌、播放、timeline、筆記與標籤
src/HandEditor.jsx       Live 手動輸入
src/StudyLibrary.jsx     教材索引與附來源搜尋
src/App.jsx              工作台與手牌庫
server/app.py            本機 API、SQLite、教材提取
server/validation.py     寫入邊界檢核
examples/                可匯入的完整 JSON
```
