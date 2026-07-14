# 世界日記閱讀站

這個資料夾是**獨立上線單元**，只含閱讀界面與 `days/day*.md`，不含 TTC Engine 其他程式碼。

## 本機預覽

在 TTC Engine 專案根目錄先同步最新日記（會從 `novel/day*.md` 複製到這裡）：

```bat
C:\Users\mooki\AppData\Local\Programs\Python\Python312\python.exe novel\build.py --sync-web
```

再執行：

```bat
novel\web\preview.bat
```

瀏覽器開啟 `http://127.0.0.1:8765/`。

## 上傳到 GitHub（只推這個資料夾）

**請勿**在 TTC Engine 根目錄 `git push`——那會把整個專案推上去。

1. 在 GitHub 建立**新的空白** repository（例如 `ttc-world-diary`），不要加 README。
2. 在本機只對 `novel\web` 初始化 git 並推送：

```bat
cd C:\Users\mooki\Documents\TTC Engine\novel\web
git init
git add index.html style.css app.js manifest.json days README.md preview.bat .github
git commit -m "World diary reader"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo名稱>.git
git push -u origin main
```

3. GitHub 專案 **Settings → Pages → Build and deployment**：
   - Source 選 **GitHub Actions**
4. `push` 後 workflow **Deploy world diary reader** 會部署本站。
5. 網址：`https://<帳號>.github.io/<repo名稱>/`

## 更新日記內容

1. 在 TTC Engine 內用 `novel\build.py --day N` 重新產生 `novel\dayN.md`（或手動編輯）。
2. 執行 `novel\build.py --sync-web` 更新 `novel\web\days\` 與 `manifest.json`。
3. 在 `novel\web` 目錄內 `git add days manifest.json` → commit → push。

## 版面

- 左側：世界日記 1–19 目錄
- 正文：世界日記 narrative + 各 tick（內心動機／說話／線索）
- 右側（寬螢幕）：tick 時間軸錨點
- URL hash：`#3` 直接開第 3 篇
