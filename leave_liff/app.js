document.addEventListener('DOMContentLoaded', () => {

    const LIFF_ID = "2009511611-QGXSdutf";
    const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzRmewNbn4lczAqejxO1S0ksmUS8D8GcDWVzmEbgHP5pYGEXTK08NKeZtXcgeH7m0fXuA/exec";

    // 暫存的本地使用者資料
    let userProfile = { userId: "測試ID", displayName: "王大明" };
    let isLiffReady = false;

    // 1. 初始化 LIFF
    async function initLiff() {
        const profileBox = document.getElementById('profileBox');

        // 檢查 LIFF SDK 是否存在
        if (typeof liff === 'undefined') {
            profileBox.innerText = "❌ 錯誤：LIFF SDK 未載入，請檢查網路或 index.html 設定";
            alert("錯誤：找不到 liff 物件，SDK 可能未成功載入。");
            return;
        }

        // 若 LIFF ID 尚未設定，退回測試模式
        if (LIFF_ID === "YOUR_LIFF_ID" || !LIFF_ID) {
            profileBox.innerText = `申請人：${userProfile.displayName}（測試模式）`;
            isLiffReady = true;
            return;
        }

        try {
            console.log("正在初始化 LIFF ID:", LIFF_ID);
            await liff.init({ liffId: LIFF_ID });

            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                userProfile = { userId: profile.userId, displayName: profile.displayName };
                profileBox.innerText = `申請人：${userProfile.displayName}`;
                isLiffReady = true;
                console.log("LIFF 初始化成功，使用者:", profile.displayName);
            } else {
                console.log("使用者未登入，跳轉登入頁...");
                liff.login();
            }
        } catch (err) {
            console.error("LIFF 初始化失敗", err);
            const errorMsg = err.message || JSON.stringify(err);
            profileBox.innerText = `❌ 載入失敗：${errorMsg}`;
            // 更多細節供使用者反饋
            alert("LIFF 初始化出錯！\n原因：" + errorMsg + "\n請確認 LINE Console 的 Endpoint URL 是否與目前網址完全相符。");
        }
    }

    initLiff();

    // 2. 表單送出事件
    document.getElementById('leaveForm').addEventListener('submit', (e) => {
        e.preventDefault(); // 阻止原生表單跳轉

        if (!isLiffReady) {
            alert("⚠️ 個人資料尚未載入完成，請稍候。若持續失敗，請確認是否在 LINE 內開啟。");
            return;
        }

        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (!startDate || !endDate) {
            alert("⚠️ 請填寫開始與結束日期。");
            return;
        }

        // 整理要傳給後端 GAS 的 JSON Payload
        const payload = {
            action: "leave_application",
            userId: userProfile.userId,
            userName: userProfile.displayName,
            startDate: startDate,
            endDate: endDate,
            leaveType: document.getElementById('leaveType').value,
            reason: document.getElementById('reason').value,
            agentName: document.getElementById('agentName').value
        };

        const btn = document.getElementById('submitBtn');
        const originalText = btn.innerText;

        // 變更按鈕狀態防止重複點擊
        btn.innerText = "資料送出中...";
        btn.disabled = true;

        // 【防呆機制】：若未替換 GAS URL，單純在本地跳出模擬成功視窗
        if (GAS_WEB_APP_URL.includes("你的_GAS_部署代碼")) {
            setTimeout(() => {
                alert(`模擬請假送出成功！(因為尚未貼上GAS網址)\n\n開始：${payload.startDate}\n結束：${payload.endDate}\n假別：${payload.leaveType}\n代理人：${payload.agentName}\n事由：${payload.reason}`);
                btn.innerText = originalText;
                btn.disabled = false;
                // 若在真實 LINE 內，則送出成功就關閉網頁
                // if (typeof liff !== 'undefined' && liff.isInClient()) { liff.closeWindow(); }
            }, 800);
            return;
        }

        // 3. 實際發送 POST 請求到 GAS 後端
        fetch(GAS_WEB_APP_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === "success") {
                    alert("✅ 請假申請已成功送出！");
                    // 在 LINE App 中執行完畢即關閉視窗
                    if (typeof liff !== 'undefined' && liff.isInClient()) {
                        liff.closeWindow();
                    }
                } else {
                    alert("⚠️ 送出遇到問題，請稍後再試。");
                }
            })
            .catch(err => {
                alert("⚠️ 錯誤：無法連線，請確認網路或 GAS 網址！");
                console.error(err);
            })
            .finally(() => {
                btn.innerText = originalText;
                btn.disabled = false;
            });
    });
});
