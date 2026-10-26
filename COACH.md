# 文字手記 → 重播 → Coach 分享

兩個使用方式：

- 原本的 Windows／私人網頁工作台：頂部「文字轉重播」，核對後可保存到 SQLite。
- **純瀏覽器 Coach 頁**：`npm run build:coach` 產生 `coach-dist/`，可放在 GitHub Pages。沒有後端或月費伺服器，只在此瀏覽器保存（最多 50 手，不會自動刪舊手牌）；跨手機／教練分享單手連結或 JSON。公開的是檢視器程式，不會自動上傳手牌或教材。

## 支援文字

文字手記視窗只顯示文字框及「轉成重播」。無需先選幣別、桌型、每人 Stack 或勾選確認；按鈕說明只接受已完成手牌。選填設定及兩種虛構範例收在摺疊區。

可直接逐行記錄，例如：

```text
25/50
Hero BTN AKs
CO 150, Hero 500, CO c
K72r
CO x Hero 400 c
4
x x
8
CO x Hero x
```

支援位置串接、逗號／全形標點、數字下注、r / b / c / x / f / jam / all-in / shove、k 千位、PF/F/T/R 或 Flop/Turn/River 標記，也可直接換行寫牌面。未寫玩家的動作按已記位置輪序對應，timeline 加 `*` 提醒核對。`Hero` 首次需寫位置；`VIP` 可先寫 `HJ VIP` 建立對應。原先提供的 LJ open / HJ VIP call / Hero SB 3bet、多路全押、提前棄牌註記仍支援。解析在本機執行，**不是通用自然語言 AI**；不明縮寫只提示未辨識的那段，保留文字供修改。

沒有幣別時顯示「籌碼」，不假設 HKD 或換成 BB；沒有桌型時按已記位置使用 6 或 9 格示意，不宣稱原桌人數。選填設定可覆寫。牌面 `JJ`、`AKs`、`366r` 可讀入，但未知實際花色顯示 `?`，原有 suited / offsuit / rainbow 描述保留，不隨機指定花色。一般自由手記按已記總投入建立每人 Stack 下限 `≥`，不要求填滿全桌 Stack；有明確金額的 jam 才可由投入總額得知該玩家 Stack，SPR 不足以確認時顯示未知。

一般自由手記以 **Pot · 已記投入** 呈現：缺失的跟注、下注、過牌及派彩不會自動補作，未記齊回應的街道列入「重建假設與缺漏」。未提及的 SB / BB 暫按只付盲注後棄牌並明示假設，若有參與應補其動作；這是可編輯的手記重建，不是精確的 HH。此標示在保存及 Coach 分享後仍保留。只保留牌面而沒動作的街道仍可播放發牌。

三人入池的 3-bet pot 會保留翻前已棄牌的 BB 盲注死錢，但不把 BB 當成入 Flop 的第四人。缺少實際派彩／抽水時，標示「未記派彩」，底池保留至最後動作，**不自動發獎、不推定 rake**。提前棄牌時點按手記重建並在 timeline 加 `*`；記錄者仍需確認實際順序。

通用格式亦可用：

```text
WePoker 5/10 RMB 6-max
Hero BTN 1000 AhKh
SB 1000
BB 1200
PF: Hero r25, SB f, BB c
F: Qh Jh 2c | BB x, Hero b40, BB c
T: 3d | BB x, Hero x
R: Ts | BB b100, Hero r300, BB c
Result: Hero win 735
```

R 預設為 raise-to，可切換「本次額外投入」。Call 沒填額時，由已知當街差額算出，列入核對事項；明確填了不相符數額則拒絕，不會悄悄修正。若只剩發牌（全押後 Turn / River），可寫 `T: 4 |`、`R: 8 |`，仍可逐街播放。

## 使用流程

1. 貼上已完成手記 →「轉成重播」，直接開預覽，未會保存或分享。
2. 按需要展開「重建假設與缺漏」核對；唔清楚的文字只提示相關段落，修改後再轉換。
3. 可用「修改／補充手牌」更正資料。完整 Stack 欄旁的勾選決定是確切數額或僅下限。確認後保存，或匯出 JSON。
4. 按「分享畀 Coach」。預設改名及隱藏筆記／原始手記；可自行選擇包含復盤筆記。檢查內容後複製連結或用手機分享。
5. Coach 用同一個已發布檢視頁讀取網址 `#review=...`，不用登入你的資料庫。唯讀頁可逐動作／街道播放及下載此手牌，不能存取其他手牌或教材。

JSON 可傳單手，亦可匯入純瀏覽器模式的手牌備份陣列。清除瀏覽資料、私密模式、換裝置或換網域可能失去本機副本，請定期備份。

## 分享私隱

連結中的手牌資料放在 `#` fragment，不會隨網頁請求傳到網站伺服器；但**整條連結包含可還原手牌，並非加密，也沒有撤回或到期功能**。訊息服務可能保存你傳送的完整連結。只傳給指定 coach，勿當作有帳戶權限控制的私人雲端分享。

匿名選項會改玩家名稱及標題，但牌面、下注、平台／盲注及標籤仍可能辨識牌局。原始手記不會放入分享連結；教材及其他手牌亦不會加入。免費 Coach 頁不會呼叫任何 `/api/` 路由或外部 AI。

## GitHub Pages（公開檢視器，無需 Render）

已準備 `coach-pages` 分支，只包含已建置的 HTML / JS / CSS / icon 及 `.nojekyll`，沒有資料庫、使用者手牌、教材或憑證。

儲存庫管理者需在 GitHub 做一次設定：

1. 開啟 `https://github.com/emily883810-cpu/poker/settings/pages`。
2. Source 選 **Deploy from a branch**。
3. Branch 選 **coach-pages**，資料夾選 **/(root)**，按 Save。
4. 等 GitHub 顯示發布成功後，以頁面提供的網址為準。一般專案網址會是 `https://emily883810-cpu.github.io/poker/`。

**本次工具沒有 GitHub Pages 管理 API 權限，不能代替管理者啟用或驗證線上發布。** 推送分支不等於網站已上線。GitHub Pages 在免費方案通常要求公開儲存庫；如介面要求升級或付款，請先停下，不要為此付款。可另用只含檢視器的公開 repo，但建立及發布需由管理者另行處理。勿為了 Pages 公開私人手牌／教材或其他不應公開的檔案。

在 localhost 時，分享視窗不會自動產生可供外地 coach 使用的本機連結；先填已發布檢視頁的 HTTPS 網址，或透過 JSON 分享。`VITE_COACH_VIEWER_URL` 可在原工作台建置時設定預設檢視頁地址。

## 維護及驗證

```bash
. .venv/bin/activate
npm test
npm run build
npm run build:coach
POKER_CHROMIUM=/usr/bin/chromium npm run test:coach
# 準備靜態分支，不切換／刪除工作目錄，不含私人資料
python scripts/publish_coach_branch.py
git push origin coach-pages
```

手機畫面及分享流程以 Chromium 手機模擬測試；未宣稱已在真 iPhone Safari 或已發布 GitHub Pages 驗證。只針對已完成手牌離線復盤，不提供策略、精確 GTO 頻率或即時決策。
