const AUTH_STORAGE_KEY = "frog-study-auth-date";
const SUNSET_DATE = 20260720;

const gate = document.querySelector("#authGate");
const form = document.querySelector("#authForm");
const input = document.querySelector("#authPassword");
const message = document.querySelector("#authMessage");

function chinaDateNumber() {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(`${values.year}${values.month}${values.day}`);
}

function todayPassword() {
  return String(chinaDateNumber());
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function unlockApp() {
  document.body.classList.remove("auth-pending");
  gate.hidden = true;
  await loadScript("data.js");
  await loadScript("app.js");
}

function showExpired() {
  form.hidden = true;
  message.textContent = "本应用已于 2026 年 7 月 20 日后下线。";
}

function showError(text) {
  message.textContent = text;
  input.select();
}

if (chinaDateNumber() > SUNSET_DATE) {
  showExpired();
} else if (sessionStorage.getItem(AUTH_STORAGE_KEY) === todayPassword()) {
  unlockApp().catch(() => {
    message.textContent = "应用加载失败，请稍后重试。";
  });
} else {
  input.focus();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (chinaDateNumber() > SUNSET_DATE) {
      showExpired();
      return;
    }
    if (input.value.trim() !== todayPassword()) {
      showError("密码不正确。请输入当天日期，例如 20260716。");
      return;
    }
    sessionStorage.setItem(AUTH_STORAGE_KEY, todayPassword());
    unlockApp().catch(() => {
      message.textContent = "应用加载失败，请稍后重试。";
    });
  });
}
