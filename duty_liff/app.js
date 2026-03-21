document.addEventListener('DOMContentLoaded', () => {
    const LIFF_ID = "2009511611-TcLF758l";
    const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzKBkE8rV-9C4yrWuuu0DypNgx4rPX1q1DUN6whgxDp4p8L2hiofsEKe2_2cpbXaQXLLA/exec";

    let userProfile = { userId: "", displayName: "載入中..." };
    let selectedDates = new Set();
    let calendar;
    let selectedEventRowIndex = null; // 用來儲存被點擊事件在試算表中的列數

    // 班別顏色
    const shiftColors = {
        '早班': '#06C755',
        '中班': '#FF9800',
        '晚班': '#5C6BC0'
    };

    // 如果姓名是 3 個字，只顯示後 2 個字（名）
    function formatName(name) {
        if (!name) return '';
        const n = String(name).trim();
        return n.length === 3 ? n.slice(1) : n;
    }

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
        dayCellContent: function (arg) {
            return arg.dayNumberText.replace('日', '');
        },
        dayHeaderContent: function (arg) {
            return arg.text.replace('週', '');
        },
        dateClick: function (info) {
            toggleDate(info.dateStr);
        },
        eventClick: function (info) {
            // 點擊事件顯示 Modal
            showModal(info.event);
        }
    });
    calendar.render();

    // 1.5 切換排班模式按鈕
    document.getElementById('toggleEditBtn').addEventListener('click', function () {
        const formContainer = document.getElementById('editFormContainer');
        if (formContainer.style.display === 'none') {
            formContainer.style.display = 'block';
            this.innerText = '瀏覽模式';
            calendar.updateSize(); // 讓日曆重新適應大小
        } else {
            formContainer.style.display = 'none';
            this.innerText = '編輯模式';
        }
    });

    // 2. 切換選取日期
    function toggleDate(dateStr) {
        if (selectedDates.has(dateStr)) {
            selectedDates.delete(dateStr);
        } else {
            selectedDates.add(dateStr);
        }
        updateSelectionUI();
    }

    function updateSelectionUI() {
        const allDayEls = document.querySelectorAll('.fc-daygrid-day');
        allDayEls.forEach(el => {
            const date = el.getAttribute('data-date');
            if (selectedDates.has(date)) {
                el.classList.add('selected-day');
            } else {
                el.classList.remove('selected-day');
            }
        });
        const listEl = document.getElementById('selectedDateList');
        listEl.innerHTML = '';
        Array.from(selectedDates).sort().forEach(date => {
            const tag = document.createElement('span');
            tag.className = 'date-tag';
            tag.innerText = date;
            listEl.appendChild(tag);
        });
        document.getElementById('submitBtn').disabled = selectedDates.size === 0;
    }

    // 3. 從 GAS 讀取既有排班資料
    async function fetchDutyRecords() {
        try {
            const response = await fetch(`${GAS_WEB_APP_URL}?action=get_duty_records`);
            const data = await response.json();
            if (data && data.records) {
                calendar.getEventSources().forEach(s => s.remove()); // 清除舊資料
                const events = data.records.map(r => {
                    const name = formatName(r.name);
                    const color = shiftColors[r.shift] || '#607D8B';
                    return {
                        title: `${(r.shift || '').replace('班', '')} ${name}`,
                        start: r.date,
                        allDay: true,
                        backgroundColor: color,
                        borderColor: color,
                        extendedProps: {
                            details: `班別：${r.shift}\n值班者：${r.name}\n編輯者：${r.editor}\n編輯時間：${r.timestamp}`,
                            rowIndex: r.rowIndex // 記錄列數供刪除使用
                        }
                    };
                });
                calendar.addEventSource(events);
            }
        } catch (err) {
            console.error("無法載入班表", err);
        }
    }

    // 4. Modal 控制邏輯
    window.showModal = function (eventObj) {
        document.getElementById('modalTitle').innerText = eventObj.title;
        document.getElementById('modalBody').innerText = eventObj.extendedProps.details || '無詳細資料';
        selectedEventRowIndex = eventObj.extendedProps.rowIndex;
        document.getElementById('detailModal').style.display = 'flex';
    };

    window.closeModal = function () {
        document.getElementById('detailModal').style.display = 'none';
        selectedEventRowIndex = null;
    };

    document.getElementById('detailModal').addEventListener('click', function (e) {
        if (e.target === this) closeModal();
    });

    // 5. 執行刪除動作
    document.getElementById('deleteBtn').addEventListener('click', async () => {
        if (!selectedEventRowIndex) return;

        const confirmResult = await Swal.fire({
            title: '確定要刪除這筆排班嗎？',
            text: '刪除後將無法還原。',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: '是的，刪除',
            cancelButtonText: '取消'
        });

        if (confirmResult.isConfirmed) {
            const btn = document.getElementById('deleteBtn');
            const originalText = btn.innerText;
            btn.innerText = '刪除中...';
            btn.disabled = true;

            try {
                const response = await fetch(GAS_WEB_APP_URL, {
                    method: "POST",
                    body: JSON.stringify({
                        action: "delete_duty",
                        rowIndex: selectedEventRowIndex,
                        userId: userProfile.userId
                    })
                });
                const result = await response.json();

                if (result.status === "success") {
                    Swal.fire({ text: '已成功刪除該排班。', icon: 'success', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
                    closeModal();
                    fetchDutyRecords(); // 重新讀取並刷新日曆
                } else {
                    Swal.fire({ text: '刪除失敗：' + result.message, icon: 'error', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
                }
            } catch (err) {
                Swal.fire({ text: '刪除時發生錯誤，請檢查網路。', icon: 'error', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }
    });

    // 6. 初始化 LIFF
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

    // 7. 讀取歷史人員名單
    async function fetchStaffNames() {
        const datalist = document.getElementById('staffList');
        const editorList = document.getElementById('editorList');
        try {
            const response = await fetch(`${GAS_WEB_APP_URL}?action=get_staff_list`);
            const data = await response.json();
            if (data) {
                if (data.names && datalist) {
                    datalist.innerHTML = '';
                    data.names.forEach(name => {
                        const option = document.createElement('option');
                        option.value = name;
                        datalist.appendChild(option);
                    });
                }
                if (data.editors && editorList) {
                    editorList.innerHTML = '';
                    data.editors.forEach(name => {
                        const option = document.createElement('option');
                        option.value = name;
                        editorList.appendChild(option);
                    });
                }
            }
        } catch (err) {
            console.error("無法獲取名單", err);
        }
    }

    // 8. 提交表單
    document.getElementById('dutyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitBtn');
        const statusMsg = document.getElementById('statusMsg');

        const payload = {
            action: "save_duty",
            userId: userProfile.userId,
            userName: userProfile.displayName,
            dutyDates: Array.from(selectedDates),
            shiftType: document.getElementById('shiftType').value,
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
                Swal.fire({ text: `儲存成功！共 ${result.count} 筆資料已寫入。`, icon: 'success', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
                selectedDates.clear();
                updateSelectionUI();
                document.getElementById('dutyForm').reset();
                fetchDutyRecords(); // 重新載入日曆資料
            } else {
                Swal.fire({ text: '儲存失敗：' + result.message, icon: 'error', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
            }
        } catch (err) {
            Swal.fire({ text: '儲存失敗，請檢查網路連線', icon: 'error', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
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

    // 在啟動時直接去撈資料 (不需要等 LIFF 登入完成)
    fetchDutyRecords();
    initLiff();
});
