# iPhone / 私人網頁部署

網頁版支援手機與電腦。**此文件及設定檔不代表網站已上線**。部署後使用同一網址及密碼登入，手牌與教材索引保存在伺服器；不需要 Windows 電腦開住，也不需要手機安裝 Python。手機需要連接網路，分析仍只針對已完成手牌，不提供即時打牌輔助。

## Render：有持久儲存的單人工作台

本專案提供 `Dockerfile` 與 `render.yaml`。Blueprint 明確使用 **Starter 付費 web service + 1 GB persistent disk**。請先檢閱 [Render 價目](https://render.com/pricing)，以你帳戶頁面當時顯示的收費為準；本次開發沒有建立服務、提供付款資料或替你開啟計費。免費暫存檔案系統不適合保存私人手牌，因此沒有宣稱免費方案能永久保留 SQLite。

1. 登入 [Render Dashboard](https://dashboard.render.com/)，連接你有權使用的 GitHub 帳戶。
2. 建立 **New → Blueprint**，選擇 `emily883810-cpu/poker`。
3. 選 **`web/private-iphone` 分支**，讀取根目錄的 `render.yaml`。不要選目前仍是初始內容的 main。
4. 檢閱服務、儲存空間及收費後，再自行決定是否部署。若畫面要求信用卡或付款確認，先停下確認費用。
5. 部署完成後，服務頁會提供 HTTPS 網址。Render 自動提供 `RENDER_EXTERNAL_HOSTNAME`，應用程式會接受該 hostname。
6. 到該服務 **Environment** 查看自動產生的 `POKER_PASSWORD`，自己安全保存。這是你的工作台登入密碼，**不要貼到聊天或 GitHub**。密碼不會寫在程式或網址。
7. iPhone 用 Safari 開啟服務的 **HTTPS** 網址，輸入該密碼登入。可用 Safari 分享選單「加入主畫面」作快捷方式；不是離線快取，也不會自動下載教材到手機。

沒有 Render 帳戶或尚未同意計費時，以上流程停在準備階段；不能把 GitHub 檔案頁或雲端開發機的 localhost 當成已發布網站。

## 部署設定

- `POKER_PUBLIC=1` 啟用私人網頁模式，監聽 `0.0.0.0`，要求至少 16 字元的 `POKER_PASSWORD`。Render Blueprint 自動產生長隨機密碼。沒設定密碼的公開模式會拒絕啟動。
- `PORT` 由 Render 注入；本機可用 `POKER_PORT` 覆寫。
- `POKER_DB=/var/data/poker.sqlite3` 位於已掛載的 persistent disk，服務重新啟動／重新部署後仍可沿用。刪除服務或磁碟可能刪除資料，請自行備份。
- 自訂網域需在 Render 設定 TLS，另將網域加入 `POKER_ALLOWED_HOSTS`（逗號分隔的純 hostname，沒有 scheme 或 path）。不要加入 `*`。
- 其他平台亦可執行 Docker image，但必須提供 HTTPS 終結、上述環境變數，以及 `/var/data` 持久卷；只執行一個實例。本應用沒有多租戶、分享連結或分散式資料庫。

## 登入及資料範圍

密碼透過 HTTPS 傳送；session 為隨機 token，資料庫只存 token 雜湊。Cookie 使用 HttpOnly、SameSite=Strict，公開模式要求 Secure。session 最長七天，登出即撤銷；更改 `POKER_PASSWORD` 會使既有 session 失效。登入失敗有頻率限制。請使用獨立隨機密碼，不要重用銀行或 GitHub 密碼。

沒有密碼的本機 Windows / loopback 模式仍可直接使用。網頁版的資料會存到你選用的託管供應商，而非只在手機；不會送至 AI 服務。只上傳你有權在該私人工作台使用的手牌及教材。伺服器資料庫、環境設定及磁碟備份仍需由帳戶持有人管理。

## 檢查與備份

- `/api/health` 只公開最小健康狀態，不含手牌、教材或密碼。
- 未登入時 `/api/hands`、`/api/documents`、`/api/search` 及寫入路由回傳 401。
- 部署後先用示範手牌測試：登入 → 保存 → 重載 → 手牌庫查找 → 登出；登出後應回到登入頁。
- 「匯出全部」只備份手牌。教材索引與 session 在 SQLite，原始 PDF／TXT 請自行保留。完整備份應在服務停止寫入時備份持久磁碟上的 SQLite，並存放於有存取控制的位置。
- 尚未在真實 iPhone Safari 及 Render 線上服務驗證；本機 Chromium 手機模擬測試不等於實機驗證。

## 開發驗證

```bash
. .venv/bin/activate
npm test
npm run build
POKER_CHROMIUM=/usr/bin/chromium npm run test:e2e
POKER_CHROMIUM=/usr/bin/chromium npm run test:web
# 一般 Docker 環境
docker build -t poker-os:private-web .
```

此開發環境的 Docker 網路另有代理 DNS / CA 限制；本次已透過平台既有信任鏈、BuildKit `build_ca` secret 及本機代理路由成功建置。另以獨立測試磁碟驗證容器登入、保存、重啟後 session 與手牌持續存在，以及登出後拒絕存取。這是本機容器驗證，並非 Render 線上部署驗證。`build_ca` 是可選的建置時 CA bundle；一般 Render 建置無需提供。TLS 與套件驗證一直保持啟用，不要關閉 TLS 驗證解決下載問題。
