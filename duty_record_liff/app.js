let currentLineId = 'test_line_id_123';
let currentLineName = '測試人員';
let dutyCheckInId = null; // GAS 產生的打卡 ID（暫時 mockup）
let currentWeekOffset = 0; // 週曆位移，0為本週，-1為上週...
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx1bOuv5kK3UeusguueCxWeCGqYvBTCGeN5XR8mYLq0nWWRj9SfycrqimOGfgTYDnHlig/exec';

// 全域本地紀錄暫存 (日期 -> 班別 -> { dutyCheckInId, handoverNotes, arrangedTasks, customers, keys, name })
window.localShiftData = window.localShiftData || {};

// 初始化 LIFF
async function initializeLiff() {
    try {
        await liff.init({ liffId: '2009511611-ArfdbQzS' });
        
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }
        
        const profile = await liff.getProfile();
        currentLineId = profile.userId;
        currentLineName = profile.displayName;
        
        document.getElementById('profileBox').innerText = `目前使用者：${currentLineName} (連線正常)`;
    } catch (err) {
        console.error('LIFF 初始化失敗', err);
        document.getElementById('profileBox').innerText = 'LIFF 載入失敗或正在本機預覽中';
    }
}

// 產生週曆 (一～日)
function renderWeekCalendar() {
    const container = document.getElementById('weekCalendar');
    container.innerHTML = '';
    const daysArr = ['一', '二', '三', '四', '五', '六', '日'];
    
    // 取得要顯示的那週的基準日
    let curr = new Date();
    curr.setDate(curr.getDate() + (currentWeekOffset * 7));
    
    // 讓 0=週日, 改成 1=週一..7=週日
    let day = curr.getDay() || 7; 
    let monday = new Date(curr.getTime());
    monday.setDate(monday.getDate() - day + 1);

    // 更新標題上的年月顯示
    const monthDisplay = document.getElementById('monthDisplay');
    if (monthDisplay) {
        monthDisplay.innerText = `${monday.getFullYear()}年 ${monday.getMonth() + 1}月`;
    }

    // 這裡用 localShiftData 來存放每個日期的各班別資料
    const mockDutyRecords = {};
    if (window.localShiftData) {
        for (let date in window.localShiftData) {
            let badges = [];
            for (let shift in window.localShiftData[date]) {
                const shiftPrefix = shift.substring(0, 1);
                const name = window.localShiftData[date][shift].name || currentLineName;
                badges.push(`${shiftPrefix} ${name.substring(0, 2)}`); // e.g. 早 柏頴
            }
            if (badges.length > 0) {
                mockDutyRecords[date] = badges;
            }
        }
    }

    // 判斷當下是否為本週，以決定預設選取日
    const realTodayStr = new Date().toDateString();

    for (let i = 0; i < 7; i++) {
        let d = new Date(monday.getTime());
        d.setDate(d.getDate() + i);

        const dateIso = d.toISOString().split('T')[0];
        const el = document.createElement('div');
        el.className = 'week-day';
        el.dataset.date = dateIso;

        // 簡化顯示，使用數字日期
        const dateStr = d.getDate();
        const dutyShiftNames = mockDutyRecords[dateIso]; 
        
        let badgeHtml = '';
        if (dutyShiftNames && dutyShiftNames.length > 0) {
            badgeHtml = dutyShiftNames.map(name => `<span class="duty-badge">${name}</span>`).join('');
        } else {
            // 為了保持高度排版一致，塞個隱形徽章或空 div (這裡使用隱形)
            badgeHtml = `<span class="duty-badge" style="visibility: hidden;">無</span>`;
        }

        el.innerHTML = `
            <span class="day-label">${daysArr[i]}</span>
            <span class="date-number">${dateStr}</span>
            <div class="duty-badges-container">
                ${badgeHtml}
            </div>
        `;
        
        // 預設選中邏輯：如果是今天則選中；如果不是本週，預設選中星期一
        if (currentWeekOffset === 0 && d.toDateString() === realTodayStr) {
            el.classList.add('selected');
        } else if (currentWeekOffset !== 0 && i === 0) {
            el.classList.add('selected');
        }

        el.addEventListener('click', () => {
            document.querySelectorAll('.week-day').forEach(n => n.classList.remove('selected'));
            el.classList.add('selected');
            document.getElementById('addDutyBtn').style.display = 'block';
            document.getElementById('dutyRecordContainer').style.display = 'none'; // 換日期先藏起來
            
            // clear form when switching dates
            document.getElementById('shiftType').value = "";
            dutyCheckInId = null;
            document.getElementById('signInStatus').innerText = '';
            document.getElementById('handoverNotes').value = '';
            document.getElementById('arrangedTasks').value = '';
            
            if (window.customerFormsManager) window.customerFormsManager.reset();
            if (window.keyFormsManager) window.keyFormsManager.reset();
        });

        container.appendChild(el);
    }
}

// 取得台灣時間 (UTC+8) YYYY-MM-DD HH:mm:ss
function getTaipeiTime() {
    const d = new Date();
    const dateStr = d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    const timeStr = d.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${dateStr} ${timeStr}`;
}
function getTaipeiDate() {
    return new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' }).replace(/\//g, '-');
}

// 初始化動態分頁表單
class DynamicFormManager {
    constructor(containerId, tabsId, addBtnId, templateId, formType) {
        this.container = document.getElementById(containerId);
        this.tabsContainer = document.getElementById(tabsId);
        this.addBtn = document.getElementById(addBtnId);
        this.templateContent = document.getElementById(templateId).content;
        this.formType = formType;
        this.pages = []; // DOM elements
        
        // Initialize first page (already has a '1' button)
        this.addPage();
        
        // Tab functionality
        this.tabsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn') && !e.target.classList.contains('add-btn')) {
                this.switchPage(parseInt(e.target.getAttribute('data-target')));
            }
        });
        
        // Add new page
        this.addBtn.addEventListener('click', () => {
            this.addPage();
        });
    }

    addPage() {
        const index = this.pages.length;
        const pageFragment = document.importNode(this.templateContent, true);
        const pageWrapper = pageFragment.querySelector('.dynamic-form-page');
        pageWrapper.id = `${this.formType}-page-${index}`;
        
        this.setupEventListeners(pageWrapper);
        
        this.pages.push(pageWrapper);
        this.container.appendChild(pageFragment);

        if (index > 0) {
            // Add a new tab button before the addBtn
            const newTab = document.createElement('button');
            newTab.className = 'tab-btn';
            newTab.setAttribute('data-target', index);
            newTab.textContent = index + 1;
            this.tabsContainer.insertBefore(newTab, this.addBtn);
        }

        this.switchPage(index);
    }

    switchPage(index) {
        // Toggle visibility of pages
        this.pages.forEach((page, i) => {
            if (i === index) {
                page.classList.add('active');
            } else {
                page.classList.remove('active');
            }
        });

        // Toggle active state of tabs
        const tabs = this.tabsContainer.querySelectorAll('.tab-btn:not(.add-btn)');
        tabs.forEach((tab, i) => {
            if (i === index) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    setupEventListeners(page) {
        // "客戶登記" Auto-Date logic when user types/interacts
        page.addEventListener('focusin', (e) => {
            const dateInput = page.querySelector('.reg-date') || page.querySelector('.key-reg-time');
            if (dateInput && !dateInput.value) {
                dateInput.value = this.formType === 'customer' ? getTaipeiTime() : getTaipeiDate();
            }
        }, { once: true }); // Only trigger once per page
        
        // Source 'Other' dropdown switch
        const sourceSelect = page.querySelector('.source-select');
        if (sourceSelect) {
            sourceSelect.addEventListener('change', (e) => {
                const otherInput = page.querySelector('.source-other');
                if (e.target.value === '其他') {
                    otherInput.classList.remove('hidden');
                } else {
                    otherInput.classList.add('hidden');
                }
            });
        }
    }

    reset() {
        this.container.innerHTML = '';
        const allTabs = this.tabsContainer.querySelectorAll('.tab-btn:not(.add-btn)');
        allTabs.forEach(t => t.remove());
        this.pages = [];
        this.addPage();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeLiff();
    renderWeekCalendar();

    // 綁定上下週按鈕
    document.getElementById('prevWeekBtn').addEventListener('click', () => {
        currentWeekOffset -= 1;
        renderWeekCalendar();
        document.getElementById('dutyRecordContainer').style.display = 'none';
        document.getElementById('addDutyBtn').style.display = 'block';
    });
    
    document.getElementById('nextWeekBtn').addEventListener('click', () => {
        currentWeekOffset += 1;
        renderWeekCalendar();
        document.getElementById('dutyRecordContainer').style.display = 'none';
        document.getElementById('addDutyBtn').style.display = 'block';
    });

    // Toggle main duty container
    document.getElementById('addDutyBtn').addEventListener('click', () => {
        document.getElementById('dutyRecordContainer').style.display = 'block';
        
        // Initialize dynamic tabs if not already done
        if (!window.customerFormsManager) {
            window.customerFormsManager = new DynamicFormManager(
                'customerFormsContainer', 'customerTabs', 'addCustomerBtn', 'customerFormTemplate', 'customer'
            );
            window.keyFormsManager = new DynamicFormManager(
                'keyFormsContainer', 'keyTabs', 'addKeyBtn', 'keyFormTemplate', 'key'
            );
        }

        // Setup clear placeholder for Area 3 (Tasks)
        const arrangedTasks = document.getElementById('arrangedTasks');
        arrangedTasks.addEventListener('focus', function() {
            this.classList.remove('placeholder-style');
        });
    });

    // Handle shift changing
    document.getElementById('shiftType').addEventListener('change', (e) => {
        const shift = e.target.value;
        const selectedDateEl = document.querySelector('.week-day.selected');
        const date = selectedDateEl ? selectedDateEl.dataset.date : null;
        
        if (!date || !shift) {
            dutyCheckInId = null;
            document.getElementById('signInStatus').innerText = '';
            document.getElementById('handoverNotes').value = '';
            document.getElementById('arrangedTasks').value = '';
            return;
        }

        // reload from memory if exists
        const dayData = window.localShiftData[date] && window.localShiftData[date][shift];
        if (dayData) {
            dutyCheckInId = dayData.dutyCheckInId;
            document.getElementById('signInStatus').innerText = `已載入本地暫存紀錄 (ID: ${dutyCheckInId})`;
            document.getElementById('handoverNotes').value = dayData.handoverNotes || '';
            document.getElementById('arrangedTasks').value = dayData.arrangedTasks || '';
        } else {
            dutyCheckInId = null;
            document.getElementById('signInStatus').innerText = '新班別，請先簽到';
            document.getElementById('handoverNotes').value = '';
            document.getElementById('arrangedTasks').value = '';
            // For simplicity, modifying shifts without reloading array data just resets them. 
            // Mock preview doesn't dynamically populate customer forms yet, but we clear it to be safe.
            if (window.customerFormsManager) window.customerFormsManager.reset();
            if (window.keyFormsManager) window.keyFormsManager.reset();
        }
    });

    // Sign-in Button Mockup with actual fetching structure
    document.getElementById('signInBtn').addEventListener('click', async () => {
        const time = getTaipeiTime();
        const shiftType = document.getElementById('shiftType').value;
        const selectedDateEl = document.querySelector('.week-day.selected');
        const date = selectedDateEl ? selectedDateEl.dataset.date : null;
        
        if (!shiftType) {
            alert('請先選擇班別');
            return;
        }

        try {
            document.getElementById('signInStatus').innerText = `連線中...`;
            
            // 如果還沒設定 GAS 網址，則走 mock 預覽流程
            if (GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL') {
                dutyCheckInId = `MOCK-${Math.floor(Math.random()*10000)}`;
                document.getElementById('signInStatus').innerText = `已打卡: ${time} (ID: ${dutyCheckInId}) (僅供預覽)`;
                return;
            }

            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'record_sign_in',
                    date: date,
                    shiftType: shiftType,
                    name: currentLineName,
                    lineId: currentLineId,
                    signInTime: time
                })
            });
            const result = await response.json();
            if (result.success) {
                dutyCheckInId = result.dutyCheckInId;
                document.getElementById('signInStatus').innerText = `已打卡: ${time} (系統ID: ${dutyCheckInId})`;
            } else {
                alert('簽到失敗: ' + result.error);
                document.getElementById('signInStatus').innerText = '';
            }
        } catch (e) {
            alert('網路連接錯誤');
            document.getElementById('signInStatus').innerText = '';
        }
    });

    // Save All Button Logic
    document.getElementById('saveAllBtn').addEventListener('click', async () => {
        if (!dutyCheckInId) {
            alert('請先進行簽到取得打卡 ID，才能儲存交接紀錄！');
            return;
        }

        const handoverNotes = document.getElementById('handoverNotes').value;
        const arrangedTasks = document.getElementById('arrangedTasks').value;

        // 收集客戶資料
        const customers = [];
        const customerPages = document.querySelectorAll('#customerFormsContainer .dynamic-form-page');
        customerPages.forEach(page => {
            const regDate = page.querySelector('.reg-date').value;
            // 簡單判斷：如果有登記日期或登記人，就當作有在填寫
            if (regDate || page.querySelector('.registrant').value) {
                customers.push({
                    regDate: regDate,
                    registrant: page.querySelector('.registrant').value,
                    source: page.querySelector('.source-select').value === '其他' ? page.querySelector('.source-other').value : page.querySelector('.source-select').value,
                    phone: page.querySelector('.contact-phone').value,
                    prop: page.querySelector('.inquiry-prop').value,
                    need: page.querySelector('.customer-need').value,
                    status: page.querySelector('.status-select').value,
                    remarks: page.querySelector('.remarks').value
                });
            }
        });

        // 收集鑰匙資料
        const keys = [];
        const keyPages = document.querySelectorAll('#keyFormsContainer .dynamic-form-page');
        keyPages.forEach(page => {
            const regTime = page.querySelector('.key-reg-time').value;
            if (regTime || page.querySelector('.borrower-name').value) {
                keys.push({
                    regTime: regTime,
                    borrower: page.querySelector('.borrower-name').value,
                    prop: page.querySelector('.prop-name').value,
                    keyNo: page.querySelector('.key-number').value,
                    borrowTime: page.querySelector('.borrow-time').value,
                    returnTime: page.querySelector('.return-time').value,
                    handler: page.querySelector('.handler-name').value,
                    confirmer: page.querySelector('.confirmer-name').value
                });
            }
        });

        const payload = {
            action: 'record_save_duty',
            dutyCheckInId: dutyCheckInId,
            handoverNotes: handoverNotes,
            arrangedTasks: arrangedTasks,
            customers: customers,
            keys: keys
        };

        if (GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL') {
            console.log("Mock Payload JSON:", payload);
            alert('預覽模式：所有資料收集成功並模擬送出！(請開啟瀏覽器 Console 查看詳細 JSON)');
            return;
        }

        const btn = document.getElementById('saveAllBtn');
        btn.innerText = '儲存中...';
        btn.disabled = true;

        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                alert('所有紀錄儲存成功！');
                
                // Save locally so the calendar and form switching works
                const selectedDateEl = document.querySelector('.week-day.selected');
                const date = selectedDateEl ? selectedDateEl.dataset.date : new Date().toISOString().split('T')[0];
                const shift = document.getElementById('shiftType').value;
                
                window.localShiftData[date] = window.localShiftData[date] || {};
                window.localShiftData[date][shift] = {
                    dutyCheckInId: dutyCheckInId,
                    handoverNotes: handoverNotes,
                    arrangedTasks: arrangedTasks,
                    name: currentLineName
                };
                renderWeekCalendar(); // refresh badges

            } else {
                alert('儲存失敗：' + result.error);
            }
        } catch (e) {
            alert('網路連接錯誤');
        } finally {
            btn.innerText = '💾 儲存所有值班與交接紀錄';
            btn.disabled = false;
        }
    });
});
