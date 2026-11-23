const fs = require("node:fs");
const path = require("node:path");

const DEBUG_URL = process.env.DEBUG_URL || "http://127.0.0.1:9222";
const APP_URL = process.env.APP_URL || "http://127.0.0.1:3210";
const outputDir = path.join(__dirname, "..", "artifacts");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect() {
  const targets = await fetch(`${DEBUG_URL}/json`).then((response) => response.json());
  const page = targets.find((target) => target.type === "page" && target.url === "about:blank")
    || targets.find((target) => target.type === "page");
  if (!page) throw new Error("没有找到可调试的浏览器页面");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      errors.push(`JS: ${message.params.exceptionDetails.text}`);
    }
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
      const entry = message.params.entry;
      errors.push(`${entry.source}: ${entry.text}${entry.url ? ` [${entry.url}]` : ""}`);
    }
  });
  function send(method, params = {}) {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }
  return { socket, send, errors };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function capture(send, fileName) {
  fs.mkdirSync(outputDir, { recursive: true });
  const result = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(path.join(outputDir, fileName), Buffer.from(result.data, "base64"));
}

async function navigate(send, url, wait = 900) {
  await send("Page.navigate", { url });
  await sleep(wait);
}

async function main() {
  const { socket, send, errors } = await connect();
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });

  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1440,
    screenHeight: 1000,
  });
  await navigate(send, `${APP_URL}/admin`);
  await evaluate(send, `
    document.querySelector('#admin-account').value = 'admin';
    document.querySelector('#admin-password').value = '123456';
    document.querySelector('#admin-login-form').requestSubmit();
  `);
  await sleep(3100);
  const admin = await evaluate(send, `({
    title: document.querySelector('.admin-topbar h1')?.textContent,
    metricCount: document.querySelectorAll('.metric-card').length,
    pending: document.querySelector('.nav-count')?.textContent,
    width: document.documentElement.scrollWidth,
    viewport: innerWidth
  })`);
  await capture(send, "admin-dashboard.png");
  const adminPages = {};
  for (const page of ["review", "content", "users", "community", "config", "orders"]) {
    await evaluate(send, `document.querySelector('[data-page="${page}"]').click()`);
    await sleep(650);
    adminPages[page] = await evaluate(send, `({
      title: document.querySelector('.admin-topbar h1')?.textContent,
      cards: document.querySelectorAll('.admin-card, .queue-column').length,
      tableRows: document.querySelectorAll('.admin-table tbody tr').length,
      width: document.documentElement.scrollWidth,
      viewport: innerWidth
    })`);
  }

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844,
  });
  await navigate(send, `${APP_URL}/`);
  await evaluate(send, `fetch('/api/auth/logout', { method: 'POST' })`);
  await navigate(send, `${APP_URL}/?smoke=${Date.now()}#/login`);
  await evaluate(send, `
    document.querySelector('#login-account').value = 'reader';
    document.querySelector('#login-password').value = '123456';
    document.querySelector('#login-form').requestSubmit();
  `);
  await sleep(1100);
  const mobile = await evaluate(send, `({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    navItems: document.querySelectorAll('.nav-item').length,
    title: document.querySelector('.display-title')?.textContent.trim(),
    user: state.user ? {username: state.user.username, role: state.user.role} : null,
    avatar: document.querySelector('.avatar-button')?.textContent
  })`);
  await capture(send, "mobile-home-auth.png");

  await navigate(send, `${APP_URL}/#/book/1`, 1100);
  const detail = await evaluate(send, `({
    title: document.querySelector('.detail-title')?.textContent,
    chapters: document.querySelectorAll('.chapter-row').length,
    width: document.documentElement.scrollWidth,
    viewport: innerWidth
  })`);
  await evaluate(send, `document.querySelector('[data-action="detail-tab"][data-tab="chapters"]').click()`);
  await sleep(250);
  const chapterCount = await evaluate(send, `document.querySelectorAll('.chapter-row').length`);
  await evaluate(send, `document.querySelector('.chapter-row').click()`);
  await sleep(900);
  const reader = await evaluate(send, `({
    open: Boolean(document.querySelector('#reader-root')),
    textLength: document.querySelector('#reader-content')?.textContent.length || 0,
    width: document.querySelector('#reader-root')?.scrollWidth || 0,
    viewport: innerWidth
  })`);
  await capture(send, "mobile-reader.png");
  await evaluate(send, `document.querySelector('[data-action="reader-settings"]').click()`);
  await sleep(250);
  const readerSettings = await evaluate(send, `document.querySelectorAll('#reader-settings-panel .setting-block').length`);
  await capture(send, "mobile-reader-settings.png");
  await evaluate(send, `document.querySelector('[data-action="close-reader"]').click()`);
  await sleep(800);
  await navigate(send, `${APP_URL}/#/author`, 800);
  const author = await evaluate(send, `({
    showsApply: document.querySelector('#app')?.textContent.includes('申请成为作者'),
    user: state.user ? {username: state.user.username, role: state.user.role} : null
  })`);
  await navigate(send, `${APP_URL}/#/forum`, 800);
  const forumPosts = await evaluate(send, `document.querySelectorAll('.forum-post').length`);

  await socket.close();
  console.log(JSON.stringify({
    admin,
    adminPages,
    mobile,
    detail,
    chapterCount,
    reader,
    readerSettings,
    author,
    forumPosts,
    errors,
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
