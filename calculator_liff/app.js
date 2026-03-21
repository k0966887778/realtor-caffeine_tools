// 初始化 LIFF 與事件綁定
document.addEventListener('DOMContentLoaded', () => {
    // 初始化 LIFF
    liff.init({ liffId: "2009511611-2NPN8JdF" }).then(() => {
        console.log("LIFF 試算機初始化成功");
    }).catch(err => {
        console.error("LIFF 初始化失敗", err);
    });
    // Tab 切換邏輯
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有 active
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // 加上 active
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 格式化數字為千分位
    function formatNumber(num) {
        return Math.round(num).toLocaleString('zh-TW');
    }

    function formatToWan(num) {
        if (!num || num === 0) return '0 萬';
        return (num / 10000).toFixed(1).replace(/\.0$/, '') + ' 萬';
    }

    /* ------------------------------
       模組 A：房貸試算邏輯
       ------------------------------ */
    const mortgageForm = document.getElementById('mortgageForm');
    window.currentResult = {}; // 暫存計算結果準備發送 LINE

    mortgageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const totalPrice = parseFloat(document.getElementById('m-totalPrice').value) * 10000; // 元
        const loanRatio = parseFloat(document.getElementById('m-loanRatio').value) / 100;
        const years = parseInt(document.getElementById('m-years').value);
        const rate = parseFloat(document.getElementById('m-rate').value) / 100 / 12; // 月利率

        const downPayment = totalPrice * (1 - loanRatio);
        const loanAmount = totalPrice - downPayment;
        const totalMonths = years * 12;

        // 本息平均攤還
        let monthlyPay = 0;
        if (rate === 0) {
            monthlyPay = loanAmount / totalMonths;
        } else {
            monthlyPay = loanAmount * rate * Math.pow(1 + rate, totalMonths) / (Math.pow(1 + rate, totalMonths) - 1);
        }

        // 更新畫面
        document.getElementById('res-downPayment').innerText = formatToWan(downPayment);
        document.getElementById('res-loanAmount').innerText = formatToWan(loanAmount);
        document.getElementById('res-monthlyPay').innerText = formatToWan(monthlyPay);

        document.getElementById('mortgageResult').style.display = 'block';

        // 準備字串給 LIFF (無表情符號，依指定格式)
        window.currentResult.mortgage = `【房貸試算結果】

房屋總價：${document.getElementById('m-totalPrice').value} 萬
貸款成數：${Math.round(loanRatio * 100)}%
貸款年限：${years} 年
貸款利率：${(rate * 12 * 100).toFixed(2)}%
-----
自備款：${formatToWan(downPayment)}
貸款總額：${formatToWan(loanAmount)}
月付金：${formatToWan(monthlyPay)}/月`;
    });

    /* ------------------------------
       模組 B：賣方稅務試算邏輯
       ------------------------------ */
    const sellForm = document.getElementById('sellForm');
    sellForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const cost = parseFloat(document.getElementById('s-cost').value) * 10000;
        const price = parseFloat(document.getElementById('s-price').value) * 10000;
        const taxRate = parseFloat(document.getElementById('s-yearsRule').value);
        const landTax = parseFloat(document.getElementById('s-landTax').value || 0);
        const miscFee = parseFloat(document.getElementById('s-miscFee').value || 0);
        const scrivenerFee = parseFloat(document.getElementById('s-scrivener').value || 9000); // 預設9000
        const unpaidLoan = parseFloat(document.getElementById('s-unpaidLoan').value || 0) * 10000;
        const agentFeeRate = parseFloat(document.getElementById('s-agentFee').value || 4) / 100;
        const escrowFeeRate = parseFloat(document.getElementById('s-escrowFee').value || 0.06) / 100;

        const agentFee = price * agentFeeRate;
        const escrowFee = Math.round(price * escrowFeeRate);
        const totalCostAndFees = cost + agentFee + escrowFee + scrivenerFee + landTax + miscFee;
        let profit = price - totalCostAndFees;
        let houseTax = 0;
        if (profit > 0) houseTax = profit * taxRate; // 獲利才扣稅

        const realIncome = price - agentFee - escrowFee - scrivenerFee - landTax - miscFee - houseTax - unpaidLoan;

        // 更新畫面
        document.getElementById('res-houseTax').innerText = formatToWan(houseTax);
        document.getElementById('res-sellAgentFee').innerText = formatToWan(agentFee);
        document.getElementById('res-sellEscrowFee').innerText = formatToWan(escrowFee);
        document.getElementById('res-sellScrivenerFee').innerText = formatToWan(scrivenerFee);
        document.getElementById('res-sellLandTax').innerText = formatToWan(landTax);
        document.getElementById('res-sellMiscFee').innerText = formatToWan(miscFee);
        document.getElementById('res-realIncome').innerText = formatToWan(realIncome);

        document.getElementById('sellResult').style.display = 'block';

        // 整理持有時間對應的字眼
        const holdYearsSelect = document.getElementById('s-yearsRule');
        const holdYearsText = holdYearsSelect.options[holdYearsSelect.selectedIndex].text;

        let msg = `【賣方稅務試算】\n\n買入成本：${formatToWan(cost)}\n賣出成交價：${document.getElementById('s-price').value} 萬`;
        if (unpaidLoan > 0) msg += `\n貸款本金餘額：${formatToWan(unpaidLoan)}`;
        msg += `\n持有時間：${holdYearsText}\n-----\n房地合一稅：${formatToWan(houseTax)}\n仲介費：${formatToWan(agentFee)}\n履保費：${formatToWan(escrowFee)}\n代書費：${formatToWan(scrivenerFee)}`;

        if (landTax > 0) msg += `\n土地增值稅：${formatToWan(landTax)}`;
        if (miscFee > 0) msg += `\n雜費：${formatToWan(miscFee)}`;
        msg += `\n實拿金額：${formatToWan(realIncome)}`;

        window.currentResult.sell = msg;
    });

    /* ------------------------------
       模組 C：買方稅務試算邏輯
       ------------------------------ */
    const buyForm = document.getElementById('buyForm');
    buyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const price = parseFloat(document.getElementById('b-price').value) * 10000;
        const presentValue = parseFloat(document.getElementById('b-presentValue').value || 0) * 10000;
        const scrivenerFee = parseFloat(document.getElementById('b-scrivener').value || 9000); // 預設9000
        const miscFee = parseFloat(document.getElementById('b-miscFee').value || 0);

        const escrowFee = Math.round(price * 0.0006); // 履保費
        const deedTax = Math.round(presentValue * 0.06); // 契稅
        const stampTax = Math.round(price * 0.001); // 印花稅
        const agentFee = Math.round(price * 0.02); // 房仲費 2%
        const registerFee = Math.round(price * 0.001); // 規費

        const totalExtraCost = escrowFee + scrivenerFee + deedTax + stampTax + agentFee + registerFee + miscFee;

        // 更新畫面
        document.getElementById('res-deedTax').innerText = formatToWan(deedTax);
        document.getElementById('res-stampTax').innerText = formatToWan(stampTax);
        document.getElementById('res-buyAgentFee').innerText = formatToWan(agentFee);
        document.getElementById('res-buyRegisterFee').innerText = formatToWan(registerFee);
        document.getElementById('res-buyEscrowFee').innerText = formatToWan(escrowFee);
        document.getElementById('res-buyScrivenerFee').innerText = formatToWan(scrivenerFee);
        document.getElementById('res-buyMiscFee').innerText = formatToWan(miscFee);
        document.getElementById('res-totalExtraCost').innerText = formatToWan(totalExtraCost);

        document.getElementById('buyResult').style.display = 'block';

        // 準備字串給 LIFF
        let msg = `【買方稅費試算】\n\n買入成交價：${document.getElementById('b-price').value} 萬`;
        if (presentValue > 0) msg += `\n房屋現值：${formatToWan(presentValue)}`;
        msg += `\n-----\n契稅：${formatToWan(deedTax)}\n印花稅：${formatToWan(stampTax)}\n仲介費：${formatToWan(agentFee)}\n規費：${formatToWan(registerFee)}\n履保費：${formatToWan(escrowFee)}\n代書費：${formatToWan(scrivenerFee)}`;
        if (miscFee > 0) msg += `\n雜費：${formatToWan(miscFee)}`;
        msg += `\n衍生總花費：${formatToWan(totalExtraCost)}`;

        window.currentResult.buy = msg;
    });
});

/* ------------------------------
   LIFF 發送回聊天室
   ------------------------------ */
function sendLiffMessage(type) {
    const textData = window.currentResult[type];
    if (!textData) return;

    if (typeof liff === 'undefined' || !liff.isLoggedIn() || !liff.isInClient()) {
        Swal.fire({ text: "此功能需在 LINE App 中開啟才能傳送訊息到聊天室！\n\n預計傳送內容：\n" + textData, confirmButtonText: '確定', confirmButtonColor: '#20c997' });
        return;
    }

    liff.sendMessages([{
        type: 'text',
        text: textData
    }]).then(() => {
        liff.closeWindow();
    }).catch((err) => {
        console.error('LIFF send Error: ', err);
        Swal.fire({ text: '發生錯誤無法傳送：' + err, confirmButtonText: '確定', confirmButtonColor: '#20c997' });
    });
}