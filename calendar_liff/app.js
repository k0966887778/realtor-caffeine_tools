document.addEventListener('DOMContentLoaded', () => {
    // 預設設定：請替換為您最終的 GAS 部署連結
    const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzKBkE8rV-9C4yrWuuu0DypNgx4rPX1q1DUN6whgxDp4p8L2hiofsEKe2_2cpbXaQXLLA/exec";

    const calendarEl = document.getElementById('calendar');
    const loadingStatus = document.getElementById('loadingStatus');

    let calendar; // FullCalendar 實例
    let allEvents = []; // 儲存所有的事件用於篩選

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
        dayCellContent: function (arg) {
            return arg.dayNumberText.replace('日', '');
        },
        dayHeaderContent: function (arg) {
            return arg.text.replace('週', '');
        },
        eventClick: function (info) {
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

            // 預期 data 格式: [ { startDate: "...", ... }, ... ]
            const events = parseDataToEvents(data);
            allEvents = events;
            calendar.addEventSource(events);

            // 建立使用者篩選器
            buildUserFilter(events);

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
            const shortName = formatName(record.name);
            let title = `${shortName}`;
            let displayDetails = `類別：${category}\n姓名：${record.name}`;

            let isLeave = category !== '簽到'; 
            let prefix = '簽';
            
            if (category === '事假') prefix = '事';
            else if (category === '病假') prefix = '病';
            else if (category === '公假') prefix = '公';
            else if (category === '特休') prefix = '特';
            else if (category === '外出帶看') prefix = '外';
            else if (isLeave) prefix = '假'; // 預防有其他未知的假別
            
            if (isLeave) {
                bgColor = '#FF9800'; // 橘黃色代表請假或外出
                title = `[${prefix}] ${shortName}`;
                displayDetails += `\n請假期間：${record.startDate} ~ ${record.endDate}`;
                if (record.reason) displayDetails += `\n事由：${record.reason}`;
                if (record.agent) displayDetails += `\n代理人：${record.agent}`;
            } else {
                bgColor = '#06C755'; // 簽到綠色
                title = `[簽] ${shortName}`;
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
                    details: displayDetails, // 儲存細節給 Modal 顯示
                    originalName: record.name  // 保留原始名稱作為篩選條件
                }
            };
        });
    }

    // 建立與處理篩選器邏輯
    function buildUserFilter(events) {
        let filterDrop = document.getElementById('userFilter');
        if (!filterDrop) {
            filterDrop = document.createElement('select');
            filterDrop.id = 'userFilter';
            filterDrop.className = 'fc-user-filter';

            // 將 select 塞入右側工具列區塊 (緊鄰視圖切換按鈕)
            const rightChunk = document.querySelector('.fc-toolbar-chunk:nth-child(3)');
            if (rightChunk) {
                // 讓 select 放置在按鈕列表的最左側
                rightChunk.insertBefore(filterDrop, rightChunk.firstChild);
            }

            filterDrop.addEventListener('change', (e) => {
                const selectedName = e.target.value;
                calendar.removeAllEventSources();
                if (selectedName === 'all') {
                    calendar.addEventSource(allEvents);
                } else {
                    const filtered = allEvents.filter(ev => ev.extendedProps.originalName === selectedName);
                    calendar.addEventSource(filtered);
                }
            });
        }

        // 抽取不重複的 LINE 名稱
        const uniqueNames = [...new Set(events.map(ev => ev.extendedProps.originalName))].filter(Boolean);
        uniqueNames.sort();

        // 渲染選單內容
        filterDrop.innerHTML = '<option value="all">全部人員</option>';
        uniqueNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            filterDrop.appendChild(opt);
        });
    }

    // 處理 3 字姓名簡化
    function formatName(name) {
        if (!name) return '';
        const n = String(name).trim();
        return n.length === 3 ? n.slice(1) : n;
    }

    // 4. 展示用的假資料
    function loadMockData() {
        const today = new Date().toISOString().split('T')[0];
        let tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
        const tomorrow = tmr.toISOString().split('T')[0];

        const mockEvents = [
            { title: '[簽] 柏頴', start: today, allDay: true, backgroundColor: '#06C755', extendedProps: { details: `狀態：簽到\n姓名：柏頴\n打卡時間：09:05:12` } },
            { title: '[簽] 大明', start: today, allDay: true, backgroundColor: '#06C755', extendedProps: { details: `狀態：簽到\n姓名：大明\n打卡時間：09:12:00` } },
            { title: '[特] 小美', start: today, end: tomorrow, allDay: true, backgroundColor: '#FF9800', extendedProps: { details: `狀態：特休\n姓名：小美\n請假期間：${today} ~ ${today}` } }
        ];
        calendar.addEventSource(mockEvents);
    }

    // Modal 控制邏輯
    window.showModal = function (eventObj) {
        document.getElementById('modalTitle').innerText = eventObj.title;
        document.getElementById('modalBody').innerText = eventObj.extendedProps.details || '無詳細資料';
        document.getElementById('detailModal').style.display = 'flex';
    };

    window.closeModal = function () {
        document.getElementById('detailModal').style.display = 'none';
    };

    // 點擊背景關閉 Modal
    document.getElementById('detailModal').addEventListener('click', function (e) {
        if (e.target === this) closeModal();
    });

    // 啟動流程
    fetchAttendanceData();
});
