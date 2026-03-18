document.addEventListener('DOMContentLoaded', () => {
    // 預設設定：請替換為您最終的 LIFF ID 與 GAS 部署連結
    const LIFF_ID = "2009511611-QGXSdutf";
    const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyYR5WeGyLjuEqE6OWb3TJE_H3iu3pS67S7ouHHX1GsrJOFIl_irnCYfiQjYtJp11a7Kg/exec";

    // 暫存的本地使用者資料
    let userProfile = { userId: "測試ID", displayName: "王大明" }; 
    let isLiffReady = false;

    // 1. 初始化 LIFF
    async function initLiff() {
        const profileBox = document.getElementById('profileBox');
        
        // 若 LIFF ID 尚未設定，退回測試模式
        if (LIFF_ID === "YOUR_LIFF_ID") {
            profileBox.innerText = `申請人：${userProfile.displayName}（測試模式）`;
            isLiffReady = true;
            return;
        }

        try {
            await liff.init({ liffId: LIFF_ID });
            
            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                userProfile = { userId: profile.userId, displayName: profile.displayName };
                profileBox.innerText = `申請人：${userProfile.displayName}`;
                isLiffReady = true;
            } else {
                // 未登入則導向登入頁面
                liff.login();
            }
        } catch (err) {
            console.error("LIFF 初始化失敗", err);
            profileBox.innerText = `載入失敗：${err.message || '請在 LINE 內開啟'}`;
            // 彈出錯誤訊息幫助偵錯
            alert("LIFF 初始化出錯：" + err.message);
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
            if(data.status === "success"){
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
