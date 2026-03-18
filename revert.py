import re

html_path = "calculator_liff/index.html"
css_path = "calculator_liff/style.css"
js_path = "calculator_liff/app.js"

# 1. HTML: Revert buttons and remove html2canvas script
with open(html_path, "r", encoding="utf-8") as f: html = f.read()
html = html.replace(
    "onclick=\"downloadScreenshot('mortgage', event)\">儲存試算結果</button>",
    "onclick=\"sendLiffMessage('mortgage')\">發送結果至聊天室</button>"
)
html = html.replace(
    "onclick=\"downloadScreenshot('sell', event)\">儲存試算結果</button>",
    "onclick=\"sendLiffMessage('sell')\">發送結果至聊天室</button>"
)
html = html.replace(
    "onclick=\"downloadScreenshot('buy', event)\">儲存試算結果</button>",
    "onclick=\"sendLiffMessage('buy')\">發送結果至聊天室</button>"
)
html = html.replace(
    "<!-- 引入 html2canvas -->\n    <script src=\"https://html2canvas.hertzen.com/dist/html2canvas.min.js\"></script>\n    <!-- 引入 LIFF SDK -->",
    "<!-- 引入 LIFF SDK -->"
)
with open(html_path, "w", encoding="utf-8") as f: f.write(html)

# 2. CSS: Revert button style, add back chat icon, remove capturing styles
with open(css_path, "r", encoding="utf-8") as f: css = f.read()

# Add chat icon back and revert btn styling to green/dark
css = css.replace(
    ".send-liff-btn {\n    width: 100%;\n    margin-top: 24px;\n    padding: 14px;\n    background: #111;\n    color: white;\n    border: none;\n    border-radius: 8px;\n    font-size: 15px;\n    font-weight: 500;\n    cursor: pointer;\n    transition: background 0.3s;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    gap: 8px;\n}\n\n.send-liff-btn:disabled {\n    background: #aaa;\n    cursor: not-allowed;\n}",
    ".send-liff-btn {\n    width: 100%;\n    margin-top: 24px;\n    padding: 14px;\n    background: #333;\n    color: white;\n    border: none;\n    border-radius: 8px;\n    font-size: 15px;\n    font-weight: 500;\n    cursor: pointer;\n    transition: background 0.3s;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    gap: 8px;\n}\n\n.send-liff-btn:before {\n    content: \"💬\";\n}"
)
css = re.sub(r"/\* 修正 iOS html2canvas[\s\S]*$", "", css)
with open(css_path, "w", encoding="utf-8") as f: f.write(css)

# 3. JS: Revert to sendLiffMessage and format strings cleanly with empty lines
with open(js_path, "r", encoding="utf-8") as f: js = f.read()

# Strings FORMATTING (spaced, no parenthesis)
js = re.sub(
    r"window\.currentResult\.mortgage = `[^`]+`;",
    """window.currentResult.mortgage = `【🏠 房貸試算結果】\\n\\n房屋總價：${document.getElementById('m-totalPrice').value} 萬元\\n\\n貸款成數：${Math.round(loanRatio * 100)}%\\n\\n貸款年限：${years} 年\\n\\n貸款利率：${(rate * 12 * 100).toFixed(2)}%\\n\\n---\\n\\n💰 預估自備款：${formatNumber(downPayment)} 元\\n\\n💰 預估月付金：${formatNumber(monthlyPay)} 元/月`;""",
    js
)

js = re.sub(
    r"window\.currentResult\.sell = `[^`]+`;",
    """window.currentResult.sell = `【💰 賣方稅費試算結果】\\n\\n賣出成交價：${document.getElementById('s-price').value} 萬元\\n\\n---\\n\\n預估房地合一稅：${formatNumber(houseTax)} 元\\n\\n仲介費：${formatNumber(agentFee)} 元\\n\\n履保費：${formatNumber(escrowFee)} 元\\n\\n代書費：${formatNumber(scrivenerFee)} 元\\n\\n👉 預估實拿金額：${formatNumber(realIncome)} 元`;""",
    js
)

js = re.sub(
    r"window\.currentResult\.buy = `[^`]+`;",
    """window.currentResult.buy = `【🛒 買方稅費試算結果】\\n\\n買入成交價：${document.getElementById('b-price').value} 萬元\\n\\n---\\n\\n契稅：${formatNumber(deedTax)} 元\\n\\n印花稅：${formatNumber(stampTax)} 元\\n\\n仲介費：${formatNumber(agentFee)} 元\\n\\n規費：${formatNumber(registerFee)} 元\\n\\n履保費：${formatNumber(escrowFee)} 元\\n\\n代書費：${formatNumber(scrivenerFee)} 元\\n\\n👉 衍生總花費預估：${formatNumber(totalExtraCost)} 元`;""",
    js
)

send_js = """/* ------------------------------
   LIFF 發送回聊天室
   ------------------------------ */
function sendLiffMessage(type) {
    const textData = window.currentResult[type];
    if (!textData) return;

    if (typeof liff === 'undefined' || !liff.isLoggedIn() || !liff.isInClient()) {
        alert("此功能需在 LINE App 中開啟才能傳送訊息到聊天室！\\n\\n預計傳送內容：\\n" + textData);
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
}"""

js = re.sub(
    r"/\* -+\n   下載截圖功能\n   -+\s*\*/\nfunction downloadScreenshot[\s\S]*\}\n*$",
    send_js,
    js
)

with open(js_path, "w", encoding="utf-8") as f: f.write(js)

print("Reverted to clean text sending.")
