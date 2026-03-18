document.addEventListener('DOMContentLoaded', () => {
    // 預設設定：請替換為您最終的 GAS 部署連結
    const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyYR5WeGyLjuEqE6OWb3TJE_H3iu3pS67S7ouHHX1GsrJOFIl_irnCYfiQjYtJp11a7Kg/exec";

    const calendarEl = document.getElementById('calendar');
    const loadingStatus = document.getElementById('loadingStatus');

    let calendar; // FullCalendar 實例

    // 1. 初始化 FullCalendar UI (空資料)
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'zh-tw', // 設定繁體中文
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listWeek'
        },
        height: 'auto',
        eventClick: function(info) {
            // 點擊事件時觸發 Modal
            showModal(info.event);
        }
    });
    calendar.render();

    // 2. 抓取資料並繪製日曆
    async function fetchAttendanceData() {
        // 【防呆機制】：若未替換 GAS URL，載入假資料展示
        if (GAS_WEB_APP_URL.includes("你的_GAS_部署代碼")) {
            loadingStatus.innerText = "目前為開發展示模式 (載入假資料)";
            loadingStatus.style.color = "#888";
            loadMockData();
            return;
        }

        try {
            // 透過 GET 請求取得試算表轉成的 JSON 陣列
            const response = await fetch(GAS_WEB_APP_URL + '?action=records');
            const data = await response.json(); 
            
            // 預期 data 格式: [ { startDate: "2026/03/18", endDate: "2026/03/18", time: "09:00:00", name: "王大明", status: "簽到" }, ... ]
            const events = parseDataToEvents(data);
            calendar.addEventSource(events);
            
            loadingStatus.innerText = "資料載入完成！";
            loadingStatus.style.color = "var(--primary-color)";
            
            setTimeout(() => { loadingStatus.style.display = 'none'; }, 2000);
        } catch (err) {
            console.error("無法抓取資料", err);
            loadingStatus.innerText = "載入失敗，請確認網路與 GAS 網址是否正確。";
            loadingStatus.style.color = "red";
        }
    }

    // 3. 轉換資料：根據文件定義的欄位轉為 FullCalendar 支援的格式
    function parseDataToEvents(records) {
        return records.map(record => {
            // 決定顏色與標題 — 依照試算表 A 欄「類別」判斷
            const category = record.category || '';
            let bgColor = '#06C755'; // 預設綠色 (簽到)
            let title = `${record.name}`;
            let displayDetails = `類別：${category}\n姓名：${record.name}`;

            if (category.includes('假')) {
                bgColor = '#FF9800'; // 橘色代表請假
                title = `[假] ${record.name}`;
                displayDetails += `\n請假期間：${record.startDate} ~ ${record.endDate}`;
                if (record.reason)  displayDetails += `\n事由：${record.reason}`;
                if (record.agent)   displayDetails += `\n代理人：${record.agent}`;
            } else {
                title = `[簽] ${record.name}`;
                displayDetails += `\n打卡時間：${record.time || '無紀錄'}`;
            }

            // 日期格式化：將 YYYY/MM/DD 替換為 YYYY-MM-DD
            const startDt = String(record.startDate).replace(/\//g, '-');
            let endDt = String(record.endDate).replace(/\//g, '-');

            // 處理跨日假：FullCalendar 的 end date 是不包含的 (exclusive)，若有多天跨日結束日需加一天
            if (startDt !== endDt && endDt && endDt !== 'undefined') {
                let d = new Date(endDt);
                d.setDate(d.getDate() + 1);
                endDt = d.toISOString().split('T')[0];
            } else {
                endDt = startDt; // 單天
            }

            return {
                title: title,
                start: startDt,
                end: endDt,
                allDay: true, // 統一全天顯示格狀
                backgroundColor: bgColor,
                extendedProps: {
                    details: displayDetails // 儲存細節給 Modal 顯示
                }
            };
        });
    }

    // 4. 展示用的假資料
    function loadMockData() {
        const today = new Date().toISOString().split('T')[0];
        let tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
        const tomorrow = tmr.toISOString().split('T')[0];

        const mockEvents = [
            { title: '[簽] 柏頴', start: today, allDay: true, backgroundColor: '#06C755', extendedProps: { details: `狀態：簽到\n姓名：柏頴\n打卡時間：09:05:12` } },
            { title: '[簽] 大明', start: today, allDay: true, backgroundColor: '#06C755', extendedProps: { details: `狀態：簽到\n姓名：大明\n打卡時間：09:12:00` } },
            { title: '[假] 小美', start: today, end: tomorrow, allDay: true, backgroundColor: '#FF9800', extendedProps: { details: `狀態：特休\n姓名：小美\n請假期間：${today} ~ ${today}` } }
        ];
        calendar.addEventSource(mockEvents);
    }

    // Modal 控制邏輯
    window.showModal = function(eventObj) {
        document.getElementById('modalTitle').innerText = eventObj.title;
        document.getElementById('modalBody').innerText = eventObj.extendedProps.details || '無詳細資料';
        document.getElementById('detailModal').style.display = 'flex';
    };

    window.closeModal = function() {
        document.getElementById('detailModal').style.display = 'none';
    };

    // 點擊背景關閉 Modal
    document.getElementById('detailModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });

    // 啟動流程
    fetchAttendanceData();
});
