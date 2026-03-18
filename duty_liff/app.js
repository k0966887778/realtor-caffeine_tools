document.addEventListener('DOMContentLoaded', () => {
    // 【重要】請替換為您在 LINE Developers Console 申請的 LIFF ID 與 GAS 部署連結
    const LIFF_ID = "2009511611-TcLF758l";
    const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyYR5WeGyLjuEqE6OWb3TJE_H3iu3pS67S7ouHHX1GsrJOFIl_irnCYfiQjYtJp11a7Kg/exec";

    let userProfile = { userId: "", displayName: "待載入..." };
    let selectedDates = new Set();
    let calendar;

    // 1. 初始化日曆
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'zh-tw',
        headerToolbar: {
            left: 'prev,next',
            center: 'title',
            right: 'today'
        },
        height: 'auto',
        selectable: false, // 我們手動處理點擊邏輯
        dateClick: function(info) {
            toggleDate(info.dateStr);
        },
        dayCellDidMount: function(info) {
            // 每次渲染時檢查是否已被選中
            if (selectedDates.has(info.date.toISOString().split('T')[0])) {
                info.el.classList.add('selected-day');
            }
        }
    });
    calendar.render();

    // 切換日期選中狀態
    function toggleDate(dateStr) {
        if (selectedDates.has(dateStr)) {
            selectedDates.delete(dateStr);
        } else {
            selectedDates.add(dateStr);
        }
        
        // 更新 UI
        updateUI();
    }

    function updateUI() {
        // 重新渲染日曆以更新樣式
        const allDayEls = document.querySelectorAll('.fc-daygrid-day');
        allDayEls.forEach(el => {
            const date = el.getAttribute('data-date');
            if (selectedDates.has(date)) {
                el.classList.add('selected-day');
            } else {
                el.classList.remove('selected-day');
            }
        });

        // 更新選擇資訊
        document.getElementById('dateCount').innerText = selectedDates.size;
        const listEl = document.getElementById('selectedDateList');
        listEl.innerHTML = '';
        
        // 排序並顯示標籤
        Array.from(selectedDates).sort().forEach(date => {
            const tag = document.createElement('span');
            tag.className = 'date-tag';
            tag.innerText = date;
            listEl.appendChild(tag);
        });

        // 控制按鈕狀態
        document.getElementById('submitBtn').disabled = selectedDates.size === 0;
    }

    // 2. 初始化 LIFF
    async function initLiff() {
        const profileBox = document.getElementById('profileBox');
        try {
            await liff.init({ liffId: LIFF_ID });
            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                userProfile = { userId: profile.userId, displayName: profile.displayName };
                profileBox.innerText = `目前使用者：${userProfile.displayName}`;
                fetchStaffNames();
            } else {
                liff.login();
            }
        } catch (err) {
            console.error("LIFF 初始化失敗", err);
            profileBox.innerText = "❌ 請在 LINE 內開啟";
        }
    }

    // 抓取歷史姓名
    async function fetchStaffNames() {
        const datalist = document.getElementById('staffList');
        try {
            const response = await fetch(`${GAS_WEB_APP_URL}?action=get_staff_list`);
            const data = await response.json();
            if (data && data.names) {
                datalist.innerHTML = '';
                data.names.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    datalist.appendChild(option);
                });
            }
        } catch (err) {
            console.error("無法獲取名單", err);
        }
    }

    // 3. 提交表單
    document.getElementById('dutyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitBtn');
        const statusMsg = document.getElementById('statusMsg');
        
        const payload = {
            action: "save_duty",
            userId: userProfile.userId,
            userName: userProfile.displayName,
            dutyDates: Array.from(selectedDates), // 送出日期陣列
            dutyName: document.getElementById('dutyName').value,
            editorName: document.getElementById('editorName').value
        };

        btn.disabled = true;
        btn.innerText = "正在儲存...";
        statusMsg.className = "status-msg hidden";

        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.status === "success") {
                showStatus("✅ 儲存成功！資料已批次寫入試算表。", "success");
                selectedDates.clear();
                updateUI();
                document.getElementById('dutyForm').reset();
            } else {
                showStatus("⚠️ 錯誤：" + result.message, "error");
            }
        } catch (err) {
            showStatus("❌ 儲存失敗，請檢查 GAS 連結", "error");
        } finally {
            btn.disabled = false;
            btn.innerText = "儲存排班資料";
        }
    });

    function showStatus(msg, type) {
        const statusMsg = document.getElementById('statusMsg');
        statusMsg.innerText = msg;
        statusMsg.className = `status-msg ${type}`;
        setTimeout(() => { statusMsg.className = 'status-msg hidden'; }, 5000);
    }

    initLiff();
});
