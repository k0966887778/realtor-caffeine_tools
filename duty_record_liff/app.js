let currentLineId = 'test_line_id_123';
let currentLineName = '測試人員';
let dutyCheckInId = null; 
let currentWeekOffset = 0; 
let currentArrangedTasks = '';
let showingTaskHistory = false;
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyiK75XXTwFAPQLiQkcxhA0htBLAuCYhXnCVTaMXzVoBORkYPbdsdWfcuuNmFSiD4mFdQ/exec';

window.localShiftData = window.localShiftData || {};
window.localTasksData = window.localTasksData || {};

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

        if (GAS_WEB_APP_URL !== 'YOUR_GAS_WEB_APP_URL') {
            try {
                fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'get_monthly_duty_records' }) })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.records) {
                            data.records.forEach(rec => {
                                window.localShiftData[rec.date] = window.localShiftData[rec.date] || {};
                                window.localShiftData[rec.date][rec.shiftType] = { name: rec.name };
                            });
                            renderWeekCalendar();
                        }
                    }).catch(e => console.error(e));
                
                fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'get_reserved_tasks' }) })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.tasks) {
                            data.tasks.forEach(t => {
                                window.localTasksData[t.date] = window.localTasksData[t.date] || [];
                                window.localTasksData[t.date].push(t);
                            });
                            const currEl = document.querySelector('.week-day.selected');
                            if (currEl) loadReservedTasks(currEl.dataset.date);
                        }
                    }).catch(e => console.error(e));

                fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'get_unreturned_keys' }) })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.keys) {
                            window.unreturnedKeysList = data.keys;
                        }
                    }).catch(e => console.error(e));
            } catch(e) {
                console.error('Failed to fetch initial data', e);
            }
        }
    } catch (err) {
        console.error('LIFF 初始化失敗', err);
        document.getElementById('profileBox').innerText = 'LIFF 載入失敗或正在本機預覽中';
    }
}

function renderWeekCalendar() {
    const container = document.getElementById('weekCalendar');
    container.innerHTML = '';
    const daysArr = ['一', '二', '三', '四', '五', '六', '日'];
    
    let curr = new Date();
    curr.setDate(curr.getDate() + (currentWeekOffset * 7));
    
    let day = curr.getDay() || 7; 
    let monday = new Date(curr.getTime());
    monday.setDate(monday.getDate() - day + 1);

    const monthDisplay = document.getElementById('monthDisplay');
    if (monthDisplay) {
        monthDisplay.innerText = `${monday.getFullYear()}年 ${monday.getMonth() + 1}月`;
    }

    const realTodayStr = new Date().toDateString();

    for (let i = 0; i < 7; i++) {
        let d = new Date(monday.getTime());
        d.setDate(d.getDate() + i);

        const dateIso = d.toISOString().split('T')[0];
        const el = document.createElement('div');
        el.className = 'week-day';
        el.dataset.date = dateIso;

        const dateStr = d.getDate();
        
        const shifts = ['早', '中', '晚'];
        let badgesHtml = '';
        
        shifts.forEach(shiftPrefix => {
            const shiftName = shiftPrefix + '班';
            let recordName = null;
            if (window.localShiftData && window.localShiftData[dateIso] && window.localShiftData[dateIso][shiftName]) {
                recordName = window.localShiftData[dateIso][shiftName].name || '';
            }
            
            if (recordName) {
                const displayName = recordName.length > 2 ? recordName.substring(recordName.length - 2) : recordName;
                badgesHtml += `<div class="duty-badge recorded-shift" data-shift="${shiftName}">${shiftPrefix} ${displayName}</div>`;
            } else {
                badgesHtml += `<div class="duty-badge empty-shift" data-shift="${shiftName}">${shiftPrefix}</div>`;
            }
        });

        el.innerHTML = `
            <span class="day-label">${daysArr[i]}</span>
            <span class="date-number">${dateStr}</span>
            <div class="duty-badges-container">
                ${badgesHtml}
            </div>
        `;
        
        if (currentWeekOffset === 0 && d.toDateString() === realTodayStr) {
            el.classList.add('selected');
            setTimeout(() => loadReservedTasks(dateIso), 50);
        } else if (currentWeekOffset !== 0 && i === 0) {
            el.classList.add('selected');
            setTimeout(() => loadReservedTasks(dateIso), 50);
        }

        el.addEventListener('click', (e) => {
            if (!e.target.classList.contains('duty-badge')) {
                document.querySelectorAll('.week-day').forEach(n => n.classList.remove('selected'));
                el.classList.add('selected');
                loadReservedTasks(dateIso);
            }
        });

        const badges = el.querySelectorAll('.duty-badge');
        badges.forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.week-day').forEach(n => n.classList.remove('selected'));
                el.classList.add('selected');
                const selectedShift = badge.dataset.shift;
                openDutyModal(dateIso, selectedShift);
            });
        });

        container.appendChild(el);
    }
}

function getTaipeiTime() {
    const d = new Date();
    const dateStr = d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    const timeStr = d.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${dateStr} ${timeStr}`;
}
function getTaipeiDate() {
    return new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' }).replace(/\//g, '-');
}

class DynamicFormManager {
    constructor(containerId, tabsId, addBtnId, templateId, formType) {
        this.container = document.getElementById(containerId);
        this.tabsContainer = document.getElementById(tabsId);
        this.addBtn = document.getElementById(addBtnId);
        this.templateContent = document.getElementById(templateId).content;
        this.formType = formType;
        this.pages = []; 
        this.addPage();
        
        this.tabsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn') && !e.target.classList.contains('add-btn')) {
                this.switchPage(parseInt(e.target.getAttribute('data-target')));
            }
        });
        
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

        const newTab = document.createElement('button');
        newTab.className = 'tab-btn';
        if (index === 0) newTab.classList.add('active'); 
        newTab.setAttribute('data-target', index);
        newTab.textContent = index + 1;
        this.tabsContainer.insertBefore(newTab, this.addBtn);

        this.switchPage(index);
    }

    switchPage(index) {
        this.pages.forEach((page, i) => {
            if (i === index) page.classList.add('active');
            else page.classList.remove('active');
        });
        const tabs = this.tabsContainer.querySelectorAll('.tab-btn:not(.add-btn)');
        tabs.forEach((tab, i) => {
            if (i === index) tab.classList.add('active');
            else tab.classList.remove('active');
        });
    }

    setupEventListeners(page) {
        page.addEventListener('focusin', (e) => {
            const dateInput = page.querySelector('.reg-date') || page.querySelector('.key-reg-time');
            if (dateInput && !dateInput.value) {
                dateInput.value = this.formType === 'customer' ? getTaipeiTime() : getTaipeiDate();
            }
        }, { once: true });
        
        const sourceSelect = page.querySelector('.source-select');
        if (sourceSelect) {
            sourceSelect.addEventListener('change', (e) => {
                const otherInput = page.querySelector('.source-other');
                if (e.target.value === '其他') otherInput.classList.remove('hidden');
                else otherInput.classList.add('hidden');
            });
        }
        
        const unreturnedSelect = page.querySelector('.unreturned-key-select');
        if (unreturnedSelect) {
            if (window.unreturnedKeysList && unreturnedSelect.options.length === 1) {
                window.unreturnedKeysList.forEach(k => {
                    const opt = document.createElement('option');
                    opt.value = k.recordId;
                    opt.text = `[${k.regTime.substring(5)}] ${k.borrower} - ${k.prop}`;
                    unreturnedSelect.appendChild(opt);
                });
            }
            unreturnedSelect.addEventListener('change', (e) => {
                const recordId = e.target.value;
                if (!recordId) {
                    page.querySelector('.existing-record-id').value = '';
                    page.querySelector('.key-reg-time').value = getTaipeiDate();
                    page.querySelector('.borrower-name').value = '';
                    page.querySelector('.prop-name').value = '';
                    page.querySelector('.key-number').value = '';
                    page.querySelector('.borrow-time').value = '';
                    page.querySelector('.handler-name').value = '';
                    return;
                }
                const found = window.unreturnedKeysList.find(k => k.recordId === recordId);
                if (found) {
                    page.querySelector('.existing-record-id').value = found.recordId;
                    page.querySelector('.key-reg-time').value = found.regTime;
                    page.querySelector('.borrower-name').value = found.borrower;
                    page.querySelector('.prop-name').value = found.prop;
                    page.querySelector('.key-number').value = found.keyNo;
                    page.querySelector('.borrow-time').value = found.borrowTime;
                    page.querySelector('.handler-name').value = found.handler;
                    page.querySelector('.return-time').focus();
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

window.loadReservedTasks = function(date) {
    const listEl = document.getElementById('reservedTasksList');
    listEl.innerHTML = '';

    let displayTasks = [];
    Object.keys(window.localTasksData).forEach(d => {
        window.localTasksData[d].forEach(t => displayTasks.push({...t, displayDate: d}));
    });
    
    if (!showingTaskHistory) {
        displayTasks = displayTasks.filter(t => !t.isDone);
    }
    displayTasks.sort((a,b) => a.displayDate > b.displayDate ? -1 : 1);
    
    if (displayTasks.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; color: #999; font-size: 13px; padding: 10px;">${showingTaskHistory ? '尚無任何交辦事項紀錄' : '目前無未完成交辦事項'}</div>`;
        return;
    }

    displayTasks.forEach(task => {
        const div = document.createElement('div');
        div.className = showingTaskHistory && task.isDone ? 'task-item-card done-task' : 'task-item-card';

        const dStr = task.displayDate;
        const dObj = new Date(dStr);
        let dateLabel = dStr;
        if (!isNaN(dObj)) {
            const days = ['日', '一', '二', '三', '四', '五', '六'];
            dateLabel = `${dObj.getFullYear()}/${dObj.getMonth()+1}/${dObj.getDate()} (週${days[dObj.getDay()]})`;
        }

        div.innerHTML = `
            <div class="task-date-part">${dateLabel}</div>
            <div class="task-divider"></div>
            <div class="task-content-part">${task.content}</div>
        `;
        
        let pressTimer;
        const startPress = () => {
            pressTimer = setTimeout(() => {
                Swal.fire({
                    text: '即將刪除此交辦事項，確認刪除？',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: '刪除',
                    confirmButtonColor: '#dc3545'
                }).then((res) => {
                    if (res.isConfirmed) {
                        if (GAS_WEB_APP_URL !== 'YOUR_GAS_WEB_APP_URL') {
                            fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_reserved_task', taskId: task.id }) });
                        }
                        window.localTasksData[task.displayDate] = window.localTasksData[task.displayDate].filter(t => t.id !== task.id);
                        loadReservedTasks(date); 
                    }
                });
            }, 800);
        };
        const cancelPress = () => clearTimeout(pressTimer);
        div.addEventListener('touchstart', startPress);
        div.addEventListener('touchend', cancelPress);
        div.addEventListener('mousedown', startPress);
        div.addEventListener('mouseup', cancelPress);
        div.addEventListener('mouseleave', cancelPress);
        listEl.appendChild(div);
    });
}

window.openDutyModal = async function(date, shiftLabel) {
    document.getElementById('dutyModalOverlay').classList.add('active');
    document.getElementById('shiftType').value = shiftLabel;
    
    // 初始化 tasks checkboxes
    const modalTasksContainer = document.getElementById('modalTasksContainer');
    modalTasksContainer.innerHTML = '';
    
    let allActiveTasks = [];
    Object.keys(window.localTasksData).forEach(d => {
        window.localTasksData[d].forEach(t => {
            if (!t.isDone) allActiveTasks.push({...t, displayDate: d});
        });
    });
    allActiveTasks.sort((a,b) => a.displayDate > b.displayDate ? -1 : 1);
    
    if (allActiveTasks.length > 0) {
        allActiveTasks.forEach(task => {
            const div = document.createElement('div');
            div.style.marginBottom = '8px';
            div.innerHTML = `
                <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
                    <input type="checkbox" class="task-checkbox" data-taskid="${task.id}" style="margin-top:4px;">
                    <span style="line-height:1.4;"><span style="color:#888;">[${task.displayDate.substring(5)}]</span> ${task.content}</span>
                </label>
            `;
            modalTasksContainer.appendChild(div);
        });
    } else {
        modalTasksContainer.innerHTML = '<div style="color: #999;">目前無未完成交辦事項</div>';
    }

    if (!window.customerFormsManager) {
        window.customerFormsManager = new DynamicFormManager('customerFormsContainer', 'customerTabs', 'addCustomerBtn', 'customerFormTemplate', 'customer');
        window.keyFormsManager = new DynamicFormManager('keyFormsContainer', 'keyTabs', 'addKeyBtn', 'keyFormTemplate', 'key');
    }
    
    window.customerFormsManager.reset();
    window.keyFormsManager.reset();

    const dayData = window.localShiftData[date] && window.localShiftData[date][shiftLabel];
    if (dayData) {
        document.getElementById('deleteRecordBtn').style.display = 'block';
        document.getElementById('signInBtn').style.display = 'none';
        document.getElementById('signInStatus').innerHTML = `正在讀取雲端詳細紀錄...`;
        document.getElementById('saveAllBtn').innerText = '讀取中...';
        document.getElementById('saveAllBtn').disabled = true;
        document.getElementById('recordName').value = dayData.name || currentLineName;
        document.getElementById('handoverNotes').value = '';

        if (GAS_WEB_APP_URL !== 'YOUR_GAS_WEB_APP_URL') {
            try {
                const response = await fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'get_single_duty_record', date, shiftType: shiftLabel })
                });
                const result = await response.json();
                if (result.success && result.record) {
                    const rec = result.record;
                    dutyCheckInId = rec.dutyCheckInId;
                    
                    let formattedTime = String(rec.time || '');
                    const parsedDate = new Date(formattedTime);
                    if (!isNaN(parsedDate) && formattedTime.includes('GMT')) {
                        const y = parsedDate.getFullYear();
                        const m = parsedDate.getMonth() + 1;
                        const d = parsedDate.getDate();
                        const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
                        const dayStr = days[parsedDate.getDay()];
                        const h = parsedDate.getHours();
                        const min = String(parsedDate.getMinutes()).padStart(2, '0');
                        const sec = String(parsedDate.getSeconds()).padStart(2, '0');
                        let period = '';
                        if (h >= 0 && h < 12) period = '早上';
                        else if (h >= 12 && h < 18) period = '下午';
                        else period = '晚上';
                        const hh = String(h).padStart(2, '0');
                        formattedTime = `${y}年${m}月${d}日 (${dayStr}) ${period}${hh}:${min}:${sec}  (GMT+8 台北標準時間)`;
                    }

                    const timeStr = formattedTime ? `簽到時間: ${formattedTime}` : `ID: ${dutyCheckInId}`;
                    document.getElementById('signInStatus').innerHTML = `已載入雲端紀錄<br><span style="color:#888; font-size:12px; font-weight:normal; margin-top:4px; display:inline-block;">${timeStr}</span>`;
                    document.getElementById('handoverNotes').value = rec.handoverNotes || '';
                    
                    currentArrangedTasks = rec.arrangedTasks || '';
                    const compContainer = document.getElementById('modalCompletedTasksContainer');
                    if (currentArrangedTasks) {
                        compContainer.innerHTML = '<div style="margin-bottom:4px; font-weight:bold;">已完成事項：</div>' + currentArrangedTasks.replace(/\n/g, '<br>');
                        compContainer.style.display = 'block';
                    } else {
                        compContainer.style.display = 'none';
                    }

                    if (rec.customers && rec.customers.length > 0) {
                        window.customerFormsManager.reset();
                        rec.customers.forEach((c, idx) => {
                            if (idx > 0) window.customerFormsManager.addPage();
                            const page = window.customerFormsManager.pages[idx];
                            if (page) {
                                page.querySelector('.reg-date').value = c.regDate || '';
                                page.querySelector('.registrant').value = c.registrant || '';
                                const srcSelect = page.querySelector('.source-select');
                                const srcOther = page.querySelector('.source-other');
                                if (['電話','來店','LINE','網路','介紹'].includes(c.source)) {
                                    srcSelect.value = c.source;
                                    srcOther.classList.add('hidden');
                                } else if (c.source) {
                                    srcSelect.value = '其他';
                                    srcOther.value = c.source;
                                    srcOther.classList.remove('hidden');
                                }
                                page.querySelector('.contact-phone').value = c.phone || '';
                                page.querySelector('.inquiry-prop').value = c.prop || '';
                                page.querySelector('.customer-need').value = c.need || '';
                                page.querySelector('.status-select').value = c.status || '';
                                page.querySelector('.remarks').value = c.remarks || '';
                            }
                        });
                        window.customerFormsManager.switchPage(0);
                    }
                    if (rec.keys && rec.keys.length > 0) {
                        window.keyFormsManager.reset();
                        rec.keys.forEach((k, idx) => {
                            if (idx > 0) window.keyFormsManager.addPage();
                            const page = window.keyFormsManager.pages[idx];
                            if (page) {
                                page.querySelector('.key-reg-time').value = k.regTime || '';
                                page.querySelector('.borrower-name').value = k.borrower || '';
                                page.querySelector('.prop-name').value = k.prop || '';
                                page.querySelector('.key-number').value = k.keyNo || '';
                                page.querySelector('.borrow-time').value = k.borrowTime || '';
                                page.querySelector('.return-time').value = k.returnTime || '';
                                page.querySelector('.handler-name').value = k.handler || '';
                                page.querySelector('.confirmer-name').value = k.confirmer || '';
                            }
                        });
                        window.keyFormsManager.switchPage(0);
                    }
                } else {
                     document.getElementById('signInStatus').innerHTML = `讀取失敗，無法載入紀錄詳細資料`;
                }
            } catch(e) { console.error(e); }
        }
        document.getElementById('saveAllBtn').innerText = '儲存 / 修改';
        document.getElementById('saveAllBtn').disabled = false;
    } else {
        dutyCheckInId = null;
        currentArrangedTasks = '';
        document.getElementById('modalCompletedTasksContainer').style.display = 'none';
        document.getElementById('deleteRecordBtn').style.display = 'none';
        document.getElementById('signInBtn').style.display = 'block';
        document.getElementById('signInStatus').innerText = '新班別，請輸入姓名後簽到';
        document.getElementById('saveAllBtn').innerText = '儲存';
        document.getElementById('recordName').value = ''; 
        document.getElementById('handoverNotes').value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeLiff();
    renderWeekCalendar();

    document.getElementById('prevWeekBtn').addEventListener('click', () => {
        currentWeekOffset -= 1;
        renderWeekCalendar();
    });
    
    document.getElementById('nextWeekBtn').addEventListener('click', () => {
        currentWeekOffset += 1;
        renderWeekCalendar();
    });

    const closeDutyModal = () => {
        document.getElementById('dutyModalOverlay').classList.remove('active');
        document.querySelectorAll('.week-day').forEach(n => n.classList.remove('selected'));
    };

    document.getElementById('closeModalBtn').addEventListener('click', closeDutyModal);

    document.getElementById('dutyModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'dutyModalOverlay') closeDutyModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('dutyModalOverlay').classList.contains('active')) {
            closeDutyModal();
        }
    });

    // Handle toggle history
    document.getElementById('toggleTaskHistoryBtn').addEventListener('click', (e) => {
        showingTaskHistory = !showingTaskHistory;
        e.target.innerText = showingTaskHistory ? '返回待辦' : '過往紀錄';
        const currDate = document.querySelector('.week-day.selected')?.dataset.date;
        if (currDate) loadReservedTasks(currDate);
    });

    // Handle Add New Task
    document.getElementById('addNewTaskBtn').addEventListener('click', async () => {
        const selectedDateEl = document.querySelector('.week-day.selected');
        const date = selectedDateEl ? selectedDateEl.dataset.date : getTaipeiDate();
        
        const { value: formValues } = await Swal.fire({
            title: '新增交辦事項',
            html:
                `<input id="swal-input-date" type="date" class="swal2-input" value="${date}" style="margin-bottom:10px;">` +
                '<textarea id="swal-input-content" class="swal2-textarea" placeholder="請輸入交辦事項內容..."></textarea>',
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '新增',
            cancelButtonText: '取消',
            preConfirm: () => {
                const d = document.getElementById('swal-input-date').value;
                const c = document.getElementById('swal-input-content').value;
                if (!d || !c) {
                    Swal.showValidationMessage('日期與內容皆為必填');
                    return false;
                }
                return { date: d, content: c };
            }
        });

        if (formValues) {
            Swal.fire({title: '新增中...', allowOutsideClick: false});
            Swal.showLoading();
            
            const taskId = 'TASK-' + Date.now();
            window.localTasksData[formValues.date] = window.localTasksData[formValues.date] || [];
            window.localTasksData[formValues.date].push({
                id: taskId,
                content: formValues.content,
                isDone: false
            });

            if (GAS_WEB_APP_URL !== 'YOUR_GAS_WEB_APP_URL') {
                try {
                    await fetch(GAS_WEB_APP_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'add_reserved_task', taskId: taskId, date: formValues.date, content: formValues.content })
                    });
                } catch(e) { console.error(e); }
            }
            
            Swal.close();
            const currDate = document.querySelector('.week-day.selected')?.dataset.date;
            if (currDate === formValues.date) {
                loadReservedTasks(currDate);
            }
        }
    });

    document.getElementById('signInBtn').addEventListener('click', async () => {
        const time = getTaipeiTime();
        const shiftType = document.getElementById('shiftType').value;
        const selectedDateEl = document.querySelector('.week-day.selected');
        const date = selectedDateEl ? selectedDateEl.dataset.date : null;
        const recName = document.getElementById('recordName').value.trim();
        
        if (recName.length < 2) {
            Swal.fire({ text: '請輸入全名或至少2個字的名字', icon: 'warning', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
            return;
        }

        try {
            document.getElementById('signInStatus').innerText = `連線中...`;
            document.getElementById('signInBtn').disabled = true;
            document.getElementById('signInBtn').innerText = '簽到中...';
            
            if (GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL') {
                dutyCheckInId = `MOCK-${Math.floor(Math.random()*10000)}`;
                document.getElementById('signInBtn').style.display = 'none';
                document.getElementById('signInBtn').disabled = false;
                document.getElementById('signInBtn').innerText = '簽到';
                document.getElementById('signInStatus').innerHTML = `已打卡 <span style="color:#888; font-size:12px; font-weight:normal;">${time} ID: ${dutyCheckInId}</span>`;
                
                window.localShiftData[date] = window.localShiftData[date] || {};
                window.localShiftData[date][shiftType] = { name: recName, dutyCheckInId: dutyCheckInId };
                renderWeekCalendar();
                return;
            }

            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'record_sign_in',
                    date: date,
                    shiftType: shiftType,
                    name: recName,
                    lineId: currentLineId,
                    signInTime: time
                })
            });
            const result = await response.json();
            if (result.success) {
                dutyCheckInId = result.dutyCheckInId;
                document.getElementById('deleteRecordBtn').style.display = 'block';
                document.getElementById('signInBtn').style.display = 'none';
                document.getElementById('signInBtn').disabled = false;
                document.getElementById('signInStatus').innerHTML = `簽到成功！ <span style="color:#888; font-size:12px;">時間: ${time}</span>`;
                
                window.localShiftData[date] = window.localShiftData[date] || {};
                window.localShiftData[date][shiftType] = { name: recName, dutyCheckInId: dutyCheckInId };
                renderWeekCalendar();
            } else {
                Swal.fire({ text: '簽到失敗: ' + result.error, icon: 'error', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
                document.getElementById('signInStatus').innerText = '簽到失敗';
                document.getElementById('signInBtn').disabled = false;
                document.getElementById('signInBtn').innerText = '簽到';
            }
        } catch (e) {
            Swal.fire({ text: '網路連接錯誤', icon: 'error', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
            document.getElementById('signInStatus').innerText = '';
            document.getElementById('signInBtn').disabled = false;
            document.getElementById('signInBtn').innerText = '簽到';
        }
    });

    document.getElementById('saveAllBtn').addEventListener('click', async () => {
        const recName = document.getElementById('recordName').value.trim();
        if (recName.length < 2) {
            Swal.fire({ text: '請輸入全名或至少2個字的名字', icon: 'warning', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
            return;
        }
        if (!dutyCheckInId) {
            if (document.getElementById('signInBtn').style.display === 'none') {
                const date = document.querySelector('.week-day.selected') ? document.querySelector('.week-day.selected').dataset.date : new Date().toISOString().split('T')[0];
                const shiftLabel = document.getElementById('shiftType').value;
                dutyCheckInId = `DUTY-${String(date).replace(/-/g, '')}-${shiftLabel}-${currentLineId ? currentLineId.substring(0,8) : 'RECOVER'}`;
            } else {
                Swal.fire({ text: '請先進行簽到取得打卡 ID，才能儲存交接紀錄！', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
                return;
            }
        }

        const handoverNotes = document.getElementById('handoverNotes').value;
        
        const newlyChecked = [];
        document.querySelectorAll('.task-checkbox').forEach(cb => {
            if (cb.checked) newlyChecked.push('✔️ ' + cb.closest('label').querySelector('span').innerText.trim());
        });
        const arrangedTasks = [currentArrangedTasks, ...newlyChecked].filter(Boolean).join('\n');
        
        // Process completed tasks
        const checkboxes = document.querySelectorAll('.task-checkbox');
        const completedTaskIds = [];
        checkboxes.forEach(cb => {
            if (cb.checked) completedTaskIds.push(cb.dataset.taskid);
        });

        const customers = [];
        const customerPages = document.querySelectorAll('#customerFormsContainer .dynamic-form-page');
        customerPages.forEach(page => {
            const regDate = page.querySelector('.reg-date').value;
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

        const keys = [];
        const keyPages = document.querySelectorAll('#keyFormsContainer .dynamic-form-page');
        keyPages.forEach(page => {
            const regTime = page.querySelector('.key-reg-time').value;
            if (regTime || page.querySelector('.borrower-name').value) {
                keys.push({
                    existingRecordId: page.querySelector('.existing-record-id')?.value || undefined,
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

        const selectedDateEl = document.querySelector('.week-day.selected');
        const date = selectedDateEl ? selectedDateEl.dataset.date : new Date().toISOString().split('T')[0];

        const payload = {
            action: 'record_save_duty',
            dutyCheckInId: dutyCheckInId,
            name: recName,
            handoverNotes: handoverNotes,
            arrangedTasks: arrangedTasks,
            completedTaskIds: completedTaskIds, // Backend should mark these as done in 7_預約交辦事宜
            customers: customers,
            keys: keys
        };

        if (GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL') {
            // locally mark tasks done
            if (window.localTasksData[date]) {
                window.localTasksData[date].forEach(t => {
                    if (completedTaskIds.includes(t.id)) t.isDone = true;
                });
            }
            loadReservedTasks(date);
            document.getElementById('dutyModalOverlay').classList.remove('active');
            Swal.fire({ text: '儲存完成！(預覽模式)', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
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
                Swal.fire({ text: '紀錄儲存成功！', icon: 'success', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
                
                // locally mark tasks done
                if (window.localTasksData[date]) {
                    window.localTasksData[date].forEach(t => {
                        if (completedTaskIds.includes(t.id)) t.isDone = true;
                    });
                }
                loadReservedTasks(date);

                const shift = document.getElementById('shiftType').value;
                window.localShiftData[date] = window.localShiftData[date] || {};
                window.localShiftData[date][shift] = {
                    dutyCheckInId: dutyCheckInId,
                    handoverNotes: handoverNotes,
                    name: recName
                };
                renderWeekCalendar(); 
                document.getElementById('dutyModalOverlay').classList.remove('active');

            } else {
                Swal.fire({ text: '儲存失敗：' + result.error, icon: 'error', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
            }
        } catch (e) {
            Swal.fire({ text: '網路連接錯誤', icon: 'error', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
        } finally {
            btn.innerText = '儲存 / 修改';
            btn.disabled = false;
        }
    });

    document.getElementById('deleteRecordBtn').addEventListener('click', async () => {
        if (!dutyCheckInId) {
            Swal.fire({ text: '這筆紀錄在當前畫面上遺失了打卡 ID，我們將直接幫您從畫面上將它移除。', icon: 'info', confirmButtonText: '確定', confirmButtonColor: '#20c997' }).then(() => {
                const shift = document.getElementById('shiftType').value;
                const selectedDateEl = document.querySelector('.week-day.selected');
                const date = selectedDateEl ? selectedDateEl.dataset.date : null;
                if (date && window.localShiftData[date]) {
                    delete window.localShiftData[date][shift];
                    renderWeekCalendar();
                }
                document.getElementById('dutyModalOverlay').classList.remove('active');
            });
            return;
        }
        
        const confirmResult = await Swal.fire({
            title: '確定要刪除這筆紀錄嗎？',
            text: '這將會連同所有附屬紀錄一併刪除。',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: '是的，刪除',
            cancelButtonText: '取消'
        });
        
        if (confirmResult.isConfirmed) {
            const btn = document.getElementById('deleteRecordBtn');
            btn.innerText = '刪除中...';
            btn.disabled = true;
            try {
                if (GAS_WEB_APP_URL === 'YOUR_GAS_WEB_APP_URL') {
                    const selectedDateEl = document.querySelector('.week-day.selected');
                    const date = selectedDateEl ? selectedDateEl.dataset.date : null;
                    const shift = document.getElementById('shiftType').value;
                    if (date && window.localShiftData[date]) {
                        delete window.localShiftData[date][shift];
                        renderWeekCalendar();
                    }
                    document.getElementById('dutyModalOverlay').classList.remove('active');
                    Swal.fire({ text: '紀錄已成功刪除！(預覽)', icon: 'success', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
                    return;
                }

                const response = await fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'record_delete_duty', dutyCheckInId: dutyCheckInId })
                });
                const result = await response.json();
                if (result.success) {
                    Swal.fire({ text: '紀錄已成功刪除！', icon: 'success', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
                    
                    const selectedDateEl = document.querySelector('.week-day.selected');
                    const date = selectedDateEl ? selectedDateEl.dataset.date : null;
                    const shift = document.getElementById('shiftType').value;
                    if (date && window.localShiftData[date]) {
                        delete window.localShiftData[date][shift];
                        renderWeekCalendar();
                    }
                    document.getElementById('dutyModalOverlay').classList.remove('active');
                } else {
                    Swal.fire({ text: '刪除失敗: ' + result.error, icon: 'error', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
                }
            } catch (e) {
                Swal.fire({ text: '網路連接錯誤', icon: 'error', confirmButtonText: '確定', confirmButtonColor: '#20c997' });
            } finally {
                btn.innerText = '刪除';
                btn.disabled = false;
            }
        }
    });
});
