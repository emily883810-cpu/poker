# Windows 下載 · v0.1.1

下載此資料夾內的 **Poker-OS-Windows.zip**，按 GitHub 檔案頁右上角的下載圖示（Download raw file）。

1. 右鍵按 ZIP，選「全部解壓縮」。
2. 開啟解壓後的 Poker-OS 資料夾。
3. 雙擊 Start-Poker-OS.cmd。
4. 首次會安裝 Python 及 PDF 套件，之後自動開啟瀏覽器。使用時保留黑色視窗。

不需要 Node.js。Windows 10/11 自動安裝需 winget；無 winget 時會開啟 Python 官網。

打包後的網頁、保存與搜尋流程已在 Linux Chromium 實測；v0.1.1 修正 Windows PowerShell 傳遞 Python 指令的引號問題，已測試 Legacy / Standard 呼叫及缺少套件的首次安裝情境；尚未在真實 Windows 電腦驗證。

壓縮檔包含自行編寫的示範手牌，沒有私人手牌、付費教材或憑證。SHA256SUMS.txt 可核對檔案完整性。
