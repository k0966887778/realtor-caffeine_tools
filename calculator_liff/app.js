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
        document.getElementById('res-downPayment').innerText = formatNumber(downPayment);
        document.getElementById('res-loanAmount').innerText = formatNumber(loanAmount);
        document.getElementById('res-monthlyPay').innerText = formatNumber(monthlyPay);

        document.getElementById('mortgageResult').style.display = 'block';

        // 準備字串給 LIFF
        window.currentResult.mortgage = `【🏠 房貸試算結果】

房屋總價：${document.getElementById('m-totalPrice').value} 萬元

貸款成數：${Math.round(loanRatio * 100)}%

貸款年限：${years} 年

貸款利率：${(rate * 12 * 100).toFixed(2)}%

---

💰 預估自備款：${formatNumber(downPayment)} 元

💰 預估月付金：${formatNumber(monthlyPay)} 元/月`;
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
        const scrivenerFee = parseFloat(document.getElementById('s-scrivener').value || 9000); // 預設9000
        const unpaidLoan = parseFloat(document.getElementById('s-unpaidLoan').value || 0) * 10000;
        const agentFeeRate = parseFloat(document.getElementById('s-agentFee').value || 4) / 100;
        const escrowFeeRate = parseFloat(document.getElementById('s-escrowFee').value || 0.06) / 100;

        const agentFee = price * agentFeeRate;
        const escrowFee = Math.round(price * escrowFeeRate);
        let profit = price - cost - agentFee - escrowFee - scrivenerFee - landTax;
        let houseTax = 0;
        if (profit > 0) houseTax = profit * taxRate; // 獲利才扣稅

        const realIncome = price - agentFee - escrowFee - scrivenerFee - landTax - houseTax - unpaidLoan;

        // 更新畫面
        document.getElementById('res-houseTax').innerText = formatNumber(houseTax);
        document.getElementById('res-sellAgentFee').innerText = formatNumber(agentFee);
        document.getElementById('res-sellEscrowFee').innerText = formatNumber(escrowFee);
        document.getElementById('res-sellScrivenerFee').innerText = formatNumber(scrivenerFee);
        document.getElementById('res-realIncome').innerText = formatNumber(realIncome);

        document.getElementById('sellResult').style.display = 'block';

        // 準備字串給 LIFF (包含更詳細的明細)
        window.currentResult.sell = `【💰 賣方稅費試算結果】

賣出成交價：${document.getElementById('s-price').value} 萬元

---

預估房地合一稅：${formatNumber(houseTax)} 元

仲介費：${formatNumber(agentFee)} 元

履保費：${formatNumber(escrowFee)} 元

代書費：${formatNumber(scrivenerFee)} 元

👉 預估實拿金額：${formatNumber(realIncome)} 元`;
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

        const escrowFee = Math.round(price * 0.0006); // 履保費
        const deedTax = Math.round(presentValue * 0.06); // 契稅
        const stampTax = Math.round(price * 0.001); // 印花稅
        const agentFee = Math.round(price * 0.02); // 房仲費 2%
        const registerFee = Math.round(price * 0.001); // 規費

        const totalExtraCost = escrowFee + scrivenerFee + deedTax + stampTax + agentFee + registerFee;

        // 更新畫面
        document.getElementById('res-deedTax').innerText = formatNumber(deedTax);
        document.getElementById('res-stampTax').innerText = formatNumber(stampTax);
        document.getElementById('res-buyAgentFee').innerText = formatNumber(agentFee);
        document.getElementById('res-buyRegisterFee').innerText = formatNumber(registerFee);
        document.getElementById('res-buyEscrowFee').innerText = formatNumber(escrowFee);
        document.getElementById('res-buyScrivenerFee').innerText = formatNumber(scrivenerFee);
        document.getElementById('res-totalExtraCost').innerText = formatNumber(totalExtraCost);

        document.getElementById('buyResult').style.display = 'block';

        // 準備字串給 LIFF
        window.currentResult.buy = `【🛒 買方稅費試算結果】

買入成交價：${document.getElementById('b-price').value} 萬元

---

契稅：${formatNumber(deedTax)} 元

印花稅：${formatNumber(stampTax)} 元

仲介費：${formatNumber(agentFee)} 元

規費：${formatNumber(registerFee)} 元

履保費：${formatNumber(escrowFee)} 元

代書費：${formatNumber(scrivenerFee)} 元

👉 衍生總花費預估：${formatNumber(totalExtraCost)} 元`;
    });
});

/* ------------------------------
   LIFF 發送回聊天室
   ------------------------------ */
function sendLiffMessage(type) {
    const textData = window.currentResult[type];
    if (!textData) return;

    if (typeof liff === 'undefined' || !liff.isLoggedIn() || !liff.isInClient()) {
        alert("此功能需在 LINE App 中開啟才能傳送訊息到聊天室！

預計傳送內容：
" + textData);
        return;
    }

    liff.sendMessages([{
        type: 'text',
        text: textData
    }]).then(() => {
        liff.closeWindow();
    }).catch((err) => {
        console.error('LIFF send Error: ', err);
        alert('發生錯誤無法傳送：' + err);
    });
}