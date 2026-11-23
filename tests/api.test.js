const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApplication } = require("../server/app");

process.env.NODE_ENV = "test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "xunye-test-"));
const { server, db } = createApplication({ dbPath: path.join(tempDir, "test.db") });
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function request(pathname, { cookie = "", method = "GET", body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return {
    status: response.status,
    payload,
    cookie: (response.headers.get("set-cookie") || "").split(";")[0],
  };
}

async function login(account, password = "123456") {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: { account, password },
  });
  assert.equal(response.status, 200);
  assert.ok(response.cookie.startsWith("xunye_session="));
  return response.cookie;
}

test("serves the mobile shell, admin shell and health endpoint", async () => {
  const mobile = await request("/");
  const admin = await request("/admin");
  const health = await request("/api/health");

  assert.equal(mobile.status, 200);
  assert.match(mobile.payload, /寻页/);
  assert.equal(admin.status, 200);
  assert.match(admin.payload, /Web 管理端/);
  assert.equal(health.status, 200);
  assert.equal(health.payload.data.status, "ok");
});

test("returns seeded discovery data and protects paid chapters", async () => {
  const home = await request("/api/home");
  assert.equal(home.status, 200);
  assert.equal(home.payload.data.hot.length, 8);
  assert.equal(home.payload.data.categories.length, 8);

  const book = await request("/api/books/1");
  assert.equal(book.status, 200);
  assert.equal(book.payload.data.book.title, "雾港来信");
  assert.equal(book.payload.data.book.chapters.length, 4);
  assert.equal(book.payload.data.book.chapters[2].locked, true);

  const locked = await request("/api/chapters/3");
  assert.equal(locked.status, 402);
  assert.equal(locked.payload.error.code, "CHAPTER_LOCKED");
});

test("reader can log in, buy a chapter and see wallet and shelf state", async () => {
  const cookie = await login("reader");
  const before = await request("/api/session", { cookie });
  assert.equal(before.payload.data.user.nickname, "林间读者");
  assert.equal(before.payload.data.user.balanceCents, 12880);

  const unlock = await request("/api/chapters/3/unlock", {
    method: "POST",
    cookie,
  });
  assert.equal(unlock.status, 200);
  assert.equal(unlock.payload.data.chargedCents, 30);

  const chapter = await request("/api/chapters/3", { cookie });
  assert.equal(chapter.status, 200);
  assert.match(chapter.payload.data.chapter.content, /第3章/);

  const shelf = await request("/api/shelf", { cookie });
  assert.equal(shelf.status, 200);
  assert.ok(Array.isArray(shelf.payload.data.books));
  assert.equal(shelf.payload.data.books[0].progress.percent, 1);

  const wallet = await request("/api/wallet", { cookie });
  assert.equal(wallet.status, 200);
  assert.ok(wallet.payload.data.transactions.some((item) => item.type === "chapter_purchase"));
});

test("recharge and membership are separate account operations", async () => {
  const cookie = await login("reader");
  const recharge = await request("/api/wallet/recharge", {
    method: "POST",
    cookie,
    body: { planId: 1 },
  });
  assert.equal(recharge.status, 200);
  assert.equal(recharge.payload.data.creditedCents, 1000);

  const membership = await request("/api/memberships/subscribe", {
    method: "POST",
    cookie,
    body: { planId: 2 },
  });
  assert.equal(membership.status, 200);
  assert.equal(membership.payload.data.planName, "季卡会员");

  const session = await request("/api/session", { cookie });
  assert.equal(session.payload.data.user.isVip, true);
  assert.ok(session.payload.data.user.vipDaysLeft >= 89);

  const wallet = await request("/api/wallet", { cookie });
  const membershipOrder = wallet.payload.data.orders.find((item) => item.type === "membership");
  assert.ok(membershipOrder);
  assert.equal(wallet.payload.data.balanceCents, 13850);
});

test("author submission enters the admin review queue and can be published", async () => {
  const authorCookie = await login("author");
  const created = await request("/api/author/books", {
    method: "POST",
    cookie: authorCookie,
    body: {
      title: "自动测试之书",
      summary: "用于验证作者投稿与管理员审核链路。",
      categoryId: 1,
      vipOnly: false,
    },
  });
  assert.equal(created.status, 201);
  const bookId = created.payload.data.bookId;

  const chapter = await request(`/api/author/books/${bookId}/chapters`, {
    method: "POST",
    cookie: authorCookie,
    body: {
      title: "第一章 测试入口",
      content: "这是自动测试生成的章节正文，用来验证审核发布链路。",
      priceCents: 0,
      submit: true,
    },
  });
  assert.equal(chapter.status, 201);

  const adminCookie = await login("admin");
  const queue = await request("/api/admin/queue", { cookie: adminCookie });
  assert.equal(queue.status, 200);
  assert.ok(queue.payload.data.pendingBooks.some((book) => book.id === bookId));

  const review = await request(`/api/admin/books/${bookId}/review`, {
    method: "POST",
    cookie: adminCookie,
    body: { decision: "approved", note: "测试审核通过" },
  });
  assert.equal(review.status, 200);

  const published = await request(`/api/books/${bookId}`);
  assert.equal(published.status, 200);
  assert.equal(published.payload.data.book.title, "自动测试之书");
  assert.equal(published.payload.data.book.chapters.length, 1);
});

test("admin permissions reject readers and moderation hides comments", async () => {
  const readerCookie = await login("reader");
  const denied = await request("/api/admin/overview", { cookie: readerCookie });
  assert.equal(denied.status, 403);

  const adminCookie = await login("admin");
  const queue = await request("/api/admin/queue", { cookie: adminCookie });
  const comment = queue.payload.data.comments[0];
  const hide = await request(`/api/admin/comments/${comment.id}/status`, {
    method: "POST",
    cookie: adminCookie,
    body: { status: "hidden" },
  });
  assert.equal(hide.status, 200);
  assert.equal(hide.payload.data.status, "hidden");
});

test("registration grants starting balance and maintains a session", async () => {
  const username = `test_${Date.now()}`;
  const registered = await request("/api/auth/register", {
    method: "POST",
    body: {
      username,
      nickname: "测试读者",
      email: `${username}@example.com`,
      password: "secret123",
    },
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.payload.data.user.balanceCents, 1000);

  const session = await request("/api/session", { cookie: registered.cookie });
  assert.equal(session.status, 200);
  assert.equal(session.payload.data.user.username, username);
});

test("reader customization persists while VIP-only themes stay protected", async () => {
  const username = `theme_${Date.now()}`;
  const registered = await request("/api/auth/register", {
    method: "POST",
    body: {
      username,
      nickname: "主题测试",
      email: `${username}@example.com`,
      password: "secret123",
    },
  });
  const cookie = registered.cookie;
  const vipTheme = await request("/api/preferences", {
    method: "PUT",
    cookie,
    body: {
      fontSize: 20,
      fontFamily: "sans",
      theme: "rose",
      textColor: "#513b3d",
      background: "#f1e1df",
      lineHeight: 2,
      pageMode: "scroll",
    },
  });
  assert.equal(vipTheme.status, 403);
  assert.equal(vipTheme.payload.error.code, "VIP_THEME_REQUIRED");

  const custom = await request("/api/preferences", {
    method: "PUT",
    cookie,
    body: {
      fontSize: 20,
      fontFamily: "sans",
      theme: "night",
      textColor: "#ffcc88",
      background: "#1a1b24",
      lineHeight: 2,
      pageMode: "paged",
    },
  });
  assert.equal(custom.status, 200);
  assert.equal(custom.payload.data.preferences.text_color, "#ffcc88");
  assert.equal(custom.payload.data.preferences.background, "#1a1b24");
  assert.equal(custom.payload.data.preferences.page_mode, "paged");
});
