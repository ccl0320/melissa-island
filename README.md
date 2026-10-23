# Melissa 的小島

給小學生玩的 3D 小島生活遊戲（Three.js）。網址：https://ccl0320.github.io/melissa-island/

- `index.html`：遊戲本體；音樂在 `music/`，圖示在 `icons/`，情境圖在 `scenes/`。
- `sync.js`：雲端存檔。連線設定只存在各裝置的瀏覽器（localStorage），不放在這個 repo。
- `sync.html`：在某台裝置設定 / 檢查雲端存檔，並產生給其他裝置用的設定連結。
- `supabase-setup.sql`：Supabase 資料表建立指令。
- 沒有設定雲端時，存檔只留在該裝置的瀏覽器裡。
